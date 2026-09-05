import { prisma } from "@repo/db";
import { Errors, OutboxEventTypes } from "@repo/contracts";
import { d } from "../../shared/decimal.js";
import { writeAuditEvent, writeOutboxEvent } from "../../shared/outbox.js";
import type { AuthContext } from "../../shared/context.js";

export class InventoryService {
  // Warehouses
  async listWarehouses(auth: AuthContext) {
    const warehouses = await prisma.warehouse.findMany({
      where: { organizationId: auth.organizationId, active: true },
      include: { inventoryBalances: true },
      orderBy: { name: "asc" },
    });

    return warehouses.map((w: any) => ({
      id: w.id,
      name: w.name,
      address: w.address,
      active: w.active,
      inventoryBalances: w.inventoryBalances.map((b: any) => ({
        productId: b.productId,
        onHand: String(b.onHand),
        reserved: String(b.reserved),
        available: String(b.available),
        incoming: String(b.incoming),
      })),
    }));
  }

  async createWarehouse(
    auth: AuthContext,
    input: {
      name: string;
      address: string;
      leadTimeDays?: number;
      shippingCostWeight?: number;
    },
  ) {
    const warehouse = await prisma.warehouse.create({
      data: {
        organizationId: auth.organizationId,
        name: input.name,
        address: input.address,
        leadTimeDays: input.leadTimeDays ?? 0,
        shippingCostWeight: input.shippingCostWeight ?? 1,
      },
    });

    await writeAuditEvent(prisma, {
      organizationId: auth.organizationId,
      actorId: auth.userId,
      entityType: "warehouse",
      entityId: warehouse.id,
      eventType: "warehouse.created",
      afterSummary: { name: warehouse.name },
    });

    return this.toWarehouseDto(warehouse);
  }

  async updateWarehouse(
    auth: AuthContext,
    warehouseId: string,
    input: {
      name?: string;
      address?: string;
      active?: boolean;
    },
  ) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseId, organizationId: auth.organizationId },
    });
    if (!warehouse) throw Errors.notFound("Warehouse");

    const updated = await prisma.warehouse.update({
      where: { id: warehouseId },
      data: input,
    });

    await writeAuditEvent(prisma, {
      organizationId: auth.organizationId,
      actorId: auth.userId,
      entityType: "warehouse",
      entityId: warehouseId,
      eventType: "warehouse.updated",
      beforeSummary: { name: warehouse.name },
      afterSummary: { name: updated.name },
    });

    return this.toWarehouseDto(updated);
  }

  // Inventory Balances
  async listBalances(auth: AuthContext, warehouseId: string) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseId, organizationId: auth.organizationId },
    });
    if (!warehouse) throw Errors.notFound("Warehouse");

    const balances = await prisma.inventoryBalance.findMany({
      where: { organizationId: auth.organizationId, warehouseId },
      include: { product: true, variant: true },
      orderBy: { productId: "asc" },
    });

    return balances.map((b: any) => ({
      id: b.id,
      productId: b.productId,
      productName: b.product?.name ?? null,
      variantId: b.variantId,
      sku: b.variant?.sku ?? null,
      onHand: String(b.onHand),
      reserved: String(b.reserved),
      available: String(b.available),
      incoming: String(b.incoming),
    }));
  }

  async adjustInventory(
    auth: AuthContext,
    warehouseId: string,
    input: {
      productId: string;
      variantId?: string;
      quantity: string;
      reason: string;
    },
  ) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseId, organizationId: auth.organizationId },
    });
    if (!warehouse) throw Errors.notFound("Warehouse");

    const product = await prisma.product.findFirst({
      where: { id: input.productId, organizationId: auth.organizationId },
    });
    if (!product) throw Errors.notFound("Product");

    const quantity = d(input.quantity);

    const result = await prisma.$transaction(async (tx: any) => {
      const balance = await tx.inventoryBalance.findUnique({
        where: {
          organizationId_warehouseId_productId_variantId: {
            organizationId: auth.organizationId,
            warehouseId,
            productId: input.productId,
            variantId: input.variantId ?? null,
          },
        },
      });

      if (balance) {
        const newOnHand = d(balance.onHand).add(quantity);
        const newAvailable = newOnHand.sub(d(balance.reserved));

        await tx.inventoryBalance.update({
          where: { id: balance.id },
          data: {
            onHand: newOnHand,
            available: newAvailable,
          },
        });
      } else {
        await tx.inventoryBalance.create({
          data: {
            organizationId: auth.organizationId,
            warehouseId,
            productId: input.productId,
            variantId: input.variantId ?? null,
            onHand: quantity,
            reserved: "0",
            available: quantity,
            incoming: "0",
          },
        });
      }

      const movement = await tx.stockMovement.create({
        data: {
          organizationId: auth.organizationId,
          warehouseId,
          productId: input.productId,
          variantId: input.variantId ?? null,
          type: "ADJUSTMENT",
          quantity: input.quantity,
          reference: input.reason,
        },
      });

      await writeAuditEvent(tx, {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        entityType: "inventory_balance",
        entityId: warehouseId,
        eventType: "inventory.adjusted",
        afterSummary: { productId: input.productId, quantity: input.quantity, reason: input.reason },
      });

      await writeOutboxEvent(tx, {
        organizationId: auth.organizationId,
        eventType: OutboxEventTypes.INVENTORY_REPLENISHED,
        payload: { warehouseId, productId: input.productId },
      });

      return movement;
    });

    return { success: true, movementId: result.id };
  }

  // Stock Movements
  async listStockMovements(auth: AuthContext) {
    const movements = await prisma.stockMovement.findMany({
      where: { organizationId: auth.organizationId },
      include: { warehouse: true, product: true, variant: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return movements.map((m: any) => ({
      id: m.id,
      type: m.type,
      warehouseId: m.warehouseId,
      warehouseName: m.warehouse?.name ?? null,
      productId: m.productId,
      productName: m.product?.name ?? null,
      variantId: m.variantId,
      sku: m.variant?.sku ?? null,
      quantity: String(m.quantity),
      reference: m.reference,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async createReceipt(
    auth: AuthContext,
    input: {
      warehouseId: string;
      items: Array<{
        productId: string;
        variantId?: string;
        quantity: string;
      }>;
      reference?: string;
    },
  ) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: input.warehouseId, organizationId: auth.organizationId },
    });
    if (!warehouse) throw Errors.notFound("Warehouse");

    await prisma.$transaction(async (tx: any) => {
      for (const item of input.items) {
        const product = await tx.product.findFirst({
          where: { id: item.productId, organizationId: auth.organizationId },
        });
        if (!product) throw Errors.notFound(`Product ${item.productId}`);

        const balance = await tx.inventoryBalance.findUnique({
          where: {
            organizationId_warehouseId_productId_variantId: {
              organizationId: auth.organizationId,
              warehouseId: input.warehouseId,
              productId: item.productId,
              variantId: item.variantId ?? null,
            },
          },
        });

        const quantity = d(item.quantity);

        if (balance) {
          const newOnHand = d(balance.onHand).add(quantity);
          const newIncoming = d(balance.incoming).sub(quantity);
          const newAvailable = newOnHand.sub(d(balance.reserved));

          await tx.inventoryBalance.update({
            where: { id: balance.id },
            data: {
              onHand: newOnHand,
              incoming: newIncoming,
              available: newAvailable,
            },
          });
        } else {
          await tx.inventoryBalance.create({
            data: {
              organizationId: auth.organizationId,
              warehouseId: input.warehouseId,
              productId: item.productId,
              variantId: item.variantId ?? null,
              onHand: quantity,
              reserved: "0",
              available: quantity,
              incoming: "0",
            },
          });
        }

        await tx.stockMovement.create({
          data: {
            organizationId: auth.organizationId,
            warehouseId: input.warehouseId,
            productId: item.productId,
            variantId: item.variantId ?? null,
            type: "RECEIPT",
            quantity: item.quantity,
            reference: input.reference ?? "Receipt",
          },
        });
      }

      await writeAuditEvent(tx, {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        entityType: "stock_movement",
        entityId: input.warehouseId,
        eventType: "stock.receipt",
        afterSummary: { itemCount: input.items.length, reference: input.reference },
      });

      await writeOutboxEvent(tx, {
        organizationId: auth.organizationId,
        eventType: OutboxEventTypes.INVENTORY_REPLENISHED,
        payload: { warehouseId: input.warehouseId },
      });
    });

    return { success: true };
  }

  private toWarehouseDto(warehouse: any) {
    return {
      id: warehouse.id,
      name: warehouse.name,
      address: warehouse.address,
      leadTimeDays: warehouse.leadTimeDays,
      shippingCostWeight: warehouse.shippingCostWeight,
      active: warehouse.active,
    };
  }
}

export const inventoryService = new InventoryService();
