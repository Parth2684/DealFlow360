import { prisma } from "@repo/db";
import { Errors, OutboxEventTypes } from "@repo/contracts";
import { d } from "../../shared/decimal.js";
import { writeAuditEvent, writeDealEvent, writeOutboxEvent } from "../../shared/outbox.js";
import type { AuthContext } from "../../shared/context.js";

interface AllocationSuggestion {
  warehouseId: string;
  warehouseName: string;
  quoteLineId: string;
  productName: string;
  requestedQuantity: string;
  availableQuantity: string;
  assignedQuantity: string;
  backorderQuantity: string;
  estimatedCost: string;
  promisedDate: string;
}

interface FulfillmentPlan {
  id: string;
  orderId: string;
  status: string;
  totalShipments: number;
  totalBackorderQuantity: string;
  estimatedCost: string;
  allocations: AllocationSuggestion[];
}

export class FulfillmentService {
  async previewAllocation(auth: AuthContext, orderId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, organizationId: auth.organizationId },
      include: {
        lines: {
          include: {
            quoteLine: {
              include: {
                product: true,
                variant: true,
              },
            },
          },
        },
      },
    });
    if (!order) throw Errors.notFound("Order");

    const warehouses = await prisma.warehouse.findMany({
      where: { organizationId: auth.organizationId, active: true },
      include: { inventoryBalances: true },
    });

    const allocations = this.calculateOptimalAllocation(order.lines, warehouses);

    const totalBackorder = allocations.reduce(
      (sum, a) => sum.add(d(a.backorderQuantity)),
      d(0),
    );
    const totalCost = allocations.reduce(
      (sum, a) => sum.add(d(a.estimatedCost)),
      d(0),
    );

    return {
      orderId,
      status: "PREVIEW",
      totalShipments: new Set(allocations.map((a) => a.warehouseId)).size,
      totalBackorderQuantity: totalBackorder.toString(),
      estimatedCost: totalCost.toString(),
      allocations,
    };
  }

  async reserveStock(auth: AuthContext, orderId: string, planId?: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, organizationId: auth.organizationId },
      include: {
        lines: {
          include: {
            quoteLine: {
              include: {
                product: true,
                variant: true,
              },
            },
          },
        },
      },
    });
    if (!order) throw Errors.notFound("Order");

    if (order.status !== "CONFIRMED") {
      throw Errors.conflict("Order must be confirmed before fulfillment");
    }

    const warehouses = await prisma.warehouse.findMany({
      where: { organizationId: auth.organizationId, active: true },
      include: { inventoryBalances: true },
    });

    const allocations = this.calculateOptimalAllocation(order.lines, warehouses);

    const result = await prisma.$transaction(async (tx: any) => {
      // Create fulfillment plan
      const plan = await tx.fulfillmentPlan.create({
        data: {
          organizationId: auth.organizationId,
          orderId,
          status: "ACCEPTED",
          objectiveValues: {
            totalShipments: new Set(allocations.map((a) => a.warehouseId)).size,
            totalBackorder: allocations.reduce((sum, a) => sum.add(d(a.backorderQuantity)), d(0)).toString(),
            estimatedCost: allocations.reduce((sum, a) => sum.add(d(a.estimatedCost)), d(0)).toString(),
          },
        },
      });

      // Group allocations by warehouse
      const warehouseAllocations = new Map<string, typeof allocations>();
      for (const alloc of allocations) {
        if (!warehouseAllocations.has(alloc.warehouseId)) {
          warehouseAllocations.set(alloc.warehouseId, []);
        }
        warehouseAllocations.get(alloc.warehouseId)!.push(alloc);
      }

      // Process each warehouse
      for (const [warehouseId, warehouseAllocs] of warehouseAllocations) {
        const hasAnyStock = warehouseAllocs.some((a) => d(a.assignedQuantity).gt(0));

        if (hasAnyStock) {
          // Create shipment
          const shipment = await tx.shipment.create({
            data: {
              organizationId: auth.organizationId,
              warehouseId,
              orderId,
              status: "PENDING",
              promisedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            },
          });

          // Reserve stock and create allocations
          for (const alloc of warehouseAllocs) {
            if (d(alloc.assignedQuantity).gt(0)) {
              // Reserve stock
              const balance = await tx.inventoryBalance.findUnique({
                where: {
                  organizationId_warehouseId_productId_variantId: {
                    organizationId: auth.organizationId,
                    warehouseId,
                    productId: alloc.quoteLineId,
                    variantId: null,
                  },
                },
              });

              if (balance) {
                const newReserved = d(balance.reserved).add(d(alloc.assignedQuantity));
                const newAvailable = d(balance.available).sub(d(alloc.assignedQuantity));

                await tx.inventoryBalance.update({
                  where: { id: balance.id },
                  data: {
                    reserved: newReserved,
                    available: newAvailable,
                  },
                });

                // Create stock movement
                await tx.stockMovement.create({
                  data: {
                    organizationId: auth.organizationId,
                    warehouseId,
                    productId: alloc.quoteLineId,
                    type: "RESERVATION",
                    quantity: alloc.assignedQuantity,
                    reference: `Order ${orderId}`,
                  },
                });
              }

              // Create fulfillment allocation
              await tx.fulfillmentAllocation.create({
                data: {
                  organizationId: auth.organizationId,
                  orderId,
                  fulfillmentPlanId: plan.id,
                  shipmentId: shipment.id,
                  quoteLineId: alloc.quoteLineId,
                  warehouseId,
                  assignedQuantity: alloc.assignedQuantity,
                  estimatedCost: alloc.estimatedCost,
                },
              });
            }

            // Create backorder if needed
            if (d(alloc.backorderQuantity).gt(0)) {
              await tx.backorder.create({
                data: {
                  organizationId: auth.organizationId,
                  orderId,
                  quoteLineId: alloc.quoteLineId,
                  quantity: alloc.backorderQuantity,
                  status: "OPEN",
                },
              });
            }
          }
        }
      }

      // Update order status
      await tx.order.update({
        where: { id: orderId },
        data: { status: "ALLOCATING" },
      });

      await writeAuditEvent(tx, {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        entityType: "fulfillment_plan",
        entityId: plan.id,
        eventType: "fulfillment.reserved",
        afterSummary: { orderId, allocationCount: allocations.length },
      });

      await writeOutboxEvent(tx, {
        organizationId: auth.organizationId,
        eventType: OutboxEventTypes.STOCK_RESERVED,
        payload: { orderId, planId: plan.id },
      });

      await writeDealEvent(tx, {
        organizationId: auth.organizationId,
        quoteId: order.quoteId,
        eventType: "fulfillment.reserved",
        title: "Stock reserved for fulfillment",
        actorId: auth.userId,
        visibility: "INTERNAL",
      });

      return { planId: plan.id, orderId };
    });

    return result;
  }

  async overrideAllocation(
    auth: AuthContext,
    orderId: string,
    input: {
      allocations: Array<{
        warehouseId: string;
        quoteLineId: string;
        quantity: string;
      }>;
      reason: string;
    },
  ) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, organizationId: auth.organizationId },
    });
    if (!order) throw Errors.notFound("Order");

    await prisma.$transaction(async (tx: any) => {
      // Create new override plan
      const plan = await tx.fulfillmentPlan.create({
        data: {
          organizationId: auth.organizationId,
          orderId,
          status: "OVERRIDDEN",
          objectiveValues: { overrideReason: input.reason },
        },
      });

      // Process manual allocations
      for (const alloc of input.allocations) {
        await tx.fulfillmentAllocation.create({
          data: {
            organizationId: auth.organizationId,
            orderId,
            fulfillmentPlanId: plan.id,
            warehouseId: alloc.warehouseId,
            quoteLineId: alloc.quoteLineId,
            assignedQuantity: alloc.quantity,
            estimatedCost: "0", // Would calculate based on warehouse cost
          },
        });
      }

      await writeAuditEvent(tx, {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        entityType: "fulfillment_plan",
        entityId: plan.id,
        eventType: "fulfillment.overridden",
        afterSummary: { orderId, reason: input.reason },
      });

      return { planId: plan.id };
    });

    return { success: true };
  }

  async listShipments(auth: AuthContext, orderId: string) {
    const shipments = await prisma.shipment.findMany({
      where: { organizationId: auth.organizationId, orderId },
      include: { warehouse: true },
      orderBy: { createdAt: "asc" },
    });

    return shipments.map((s: any) => ({
      id: s.id,
      warehouseId: s.warehouseId,
      warehouseName: s.warehouse?.name ?? null,
      status: s.status,
      promisedDate: s.promisedDate?.toISOString() ?? null,
      actualDate: s.actualDate?.toISOString() ?? null,
      trackingNumber: s.trackingNumber,
      createdAt: s.createdAt.toISOString(),
    }));
  }

  async shipShipment(auth: AuthContext, shipmentId: string, trackingNumber?: string) {
    const shipment = await prisma.shipment.findFirst({
      where: { id: shipmentId, organizationId: auth.organizationId },
      include: { order: true },
    });
    if (!shipment) throw Errors.notFound("Shipment");

    if (shipment.status !== "PENDING") {
      throw Errors.conflict("Shipment has already been processed");
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: "SHIPPED",
          actualDate: new Date(),
          trackingNumber: trackingNumber ?? null,
        },
      });

      // Release reserved stock
      const allocations = await tx.fulfillmentAllocation.findMany({
        where: { shipmentId },
      });

      for (const alloc of allocations) {
        const balance = await tx.inventoryBalance.findUnique({
          where: {
            organizationId_warehouseId_productId_variantId: {
              organizationId: auth.organizationId,
              warehouseId: alloc.warehouseId,
              productId: alloc.quoteLineId,
              variantId: null,
            },
          },
        });

        if (balance) {
          const newReserved = d(balance.reserved).sub(d(alloc.assignedQuantity));
          const newOnHand = d(balance.onHand).sub(d(alloc.assignedQuantity));

          await tx.inventoryBalance.update({
            where: { id: balance.id },
            data: {
              reserved: newReserved,
              onHand: newOnHand,
            },
          });

          // Create shipment movement
          await tx.stockMovement.create({
            data: {
              organizationId: auth.organizationId,
              warehouseId: alloc.warehouseId,
              productId: alloc.quoteLineId,
              type: "SHIPMENT",
              quantity: alloc.assignedQuantity,
              reference: `Shipment ${shipmentId}`,
            },
          });
        }
      }

      await writeAuditEvent(tx, {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        entityType: "shipment",
        entityId: shipmentId,
        eventType: "shipment.shipped",
        afterSummary: { trackingNumber },
      });

      await writeOutboxEvent(tx, {
        organizationId: auth.organizationId,
        eventType: OutboxEventTypes.DEAL_ACTIVITY_RECORDED,
        payload: { type: "shipped", shipmentId, orderId: shipment.orderId },
      });
    });

    return { success: true };
  }

  async listBackorders(auth: AuthContext) {
    const backorders = await prisma.backorder.findMany({
      where: { organizationId: auth.organizationId, status: { in: ["OPEN", "PARTIALLY_FULFILLED"] } },
      include: {
        order: { include: { customerAccount: true } },
        quoteLine: { include: { product: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return backorders.map((b: any) => ({
      id: b.id,
      orderId: b.orderId,
      orderNumber: b.order?.orderNumber ?? null,
      customerName: b.order?.customerAccount?.name ?? null,
      quoteLineId: b.quoteLineId,
      productName: b.quoteLine?.product?.name ?? null,
      quantity: String(b.quantity),
      status: b.status,
      createdAt: b.createdAt.toISOString(),
    }));
  }

  async consolidateBackorder(auth: AuthContext, backorderId: string) {
    const backorder = await prisma.backorder.findFirst({
      where: { id: backorderId, organizationId: auth.organizationId },
      include: { quoteLine: { include: { product: true } } },
    });
    if (!backorder) throw Errors.notFound("Backorder");

    // Check if stock is now available
    const balances = await prisma.inventoryBalance.findMany({
      where: {
        organizationId: auth.organizationId,
        productId: backorder.quoteLineId,
        available: { gte: backorder.quantity },
      },
    });

    if (balances.length === 0) {
      throw Errors.conflict("No available stock to consolidate backorder");
    }

    await prisma.$transaction(async (tx: any) => {
      const balance = balances[0]!;

      // Reserve stock
      const newReserved = d(balance.reserved).add(d(backorder.quantity));
      const newAvailable = d(balance.available).sub(d(backorder.quantity));

      await tx.inventoryBalance.update({
        where: { id: balance.id },
        data: {
          reserved: newReserved,
          available: newAvailable,
        },
      });

      // Update backorder
      await tx.backorder.update({
        where: { id: backorderId },
        data: { status: "FULFILLED" },
      });

      await writeAuditEvent(tx, {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        entityType: "backorder",
        entityId: backorderId,
        eventType: "backorder.consolidated",
        afterSummary: { quantity: String(backorder.quantity) },
      });

      await writeOutboxEvent(tx, {
        organizationId: auth.organizationId,
        eventType: OutboxEventTypes.INVENTORY_REPLENISHED,
        payload: { backorderId },
      });
    });

    return { success: true };
  }

  private calculateOptimalAllocation(
    orderLines: any[],
    warehouses: any[],
  ): AllocationSuggestion[] {
    const allocations: AllocationSuggestion[] = [];

    for (const line of orderLines) {
      const requested = d(line.quantity);
      let remaining = requested;

      // Sort warehouses by availability (greedy approach)
      const sortedWarehouses = [...warehouses].sort((a, b) => {
        const aBalance = a.inventoryBalances.find((ib: any) => ib.productId === line.quoteLineId);
        const bBalance = b.inventoryBalances.find((ib: any) => ib.productId === line.quoteLineId);
        const aAvail = aBalance ? d(aBalance.available) : d(0);
        const bAvail = bBalance ? d(bBalance.available) : d(0);
        return bAvail.minus(aAvail).toNumber();
      });

      for (const warehouse of sortedWarehouses) {
        if (remaining.lte(0)) break;

        const balance = warehouse.inventoryBalances.find(
          (ib: any) => ib.productId === line.quoteLineId,
        );
        const available = balance ? d(balance.available) : d(0);
        const assign = remaining.lt(available) ? remaining : available;

        if (assign.gt(0)) {
          allocations.push({
            warehouseId: warehouse.id,
            warehouseName: warehouse.name,
            quoteLineId: line.quoteLineId,
            productName: line.quoteLine?.product?.name ?? "Unknown",
            requestedQuantity: requested.toString(),
            availableQuantity: available.toString(),
            assignedQuantity: assign.toString(),
            backorderQuantity: "0",
            estimatedCost: assign.mul(d(warehouse.shippingCostWeight ?? 1)).toString(),
            promisedDate: new Date(Date.now() + (warehouse.leadTimeDays ?? 7) * 24 * 60 * 60 * 1000).toISOString(),
          });

          remaining = remaining.sub(assign);
        }
      }

      // Create backorder for remaining quantity
      if (remaining.gt(0)) {
        allocations.push({
          warehouseId: warehouses[0]?.id ?? "",
          warehouseName: warehouses[0]?.name ?? "Backorder",
          quoteLineId: line.quoteLineId,
          productName: line.quoteLine?.product?.name ?? "Unknown",
          requestedQuantity: requested.toString(),
          availableQuantity: "0",
          assignedQuantity: "0",
          backorderQuantity: remaining.toString(),
          estimatedCost: "0",
          promisedDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }
    }

    return allocations;
  }
}

export const fulfillmentService = new FulfillmentService();
export const fulfillmentService = new FulfillmentService();
