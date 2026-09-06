import {
  ReservationResultDtoSchema,
  type ReservationResultDto,
} from "@repo/common";
import { prisma, Prisma } from "@repo/db";

import {
  jsonInput,
  recordActivity,
  type TransactionClient,
} from "../../shared/activity.js";
import { conflict, notFound } from "../../shared/errors.js";
import type { InternalPrincipal } from "../../shared/types.js";
import { assertSalesObjectVisible } from "./access.js";
import {
  buildManualPreview,
  buildRecommendedPreview,
  type AllocationBalance,
  type AllocationOrder,
  type AllocationPreview,
} from "./allocation.js";
import {
  mapBackorder,
  mapFulfillmentPlan,
  mapOrder,
  mapReservation,
  mapShipment,
} from "./mappers.js";

const ZERO = new Prisma.Decimal(0);

function entityNumber(prefix: string, id: string): string {
  return `${prefix}-${id.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

export async function loadRecommendedPreview(
  actor: InternalPrincipal,
  orderId: string,
  expectedRevision?: number,
): Promise<AllocationPreview> {
  const organizationId = actor.organizationId;
  const order = await prisma.order.findFirst({
    where: { id: orderId, organizationId },
    include: {
      lines: { include: { product: true }, orderBy: { position: "asc" } },
      quote: { select: { salesTeamId: true } },
    },
  });
  if (order === null) notFound("Order");
  assertSalesObjectVisible(actor, {
    ownerId: order.ownerId,
    salesTeamId: order.quote.salesTeamId,
  });
  if (order.status !== "ALLOCATION_PENDING" && order.status !== "CONFIRMED") {
    conflict(
      "This order is not eligible for a fulfillment preview",
      "INVALID_ORDER_STATE",
    );
  }
  if (expectedRevision !== undefined && order.revision !== expectedRevision) {
    conflict(
      "The order changed after this preview request was prepared",
      "STALE_REVISION",
    );
  }
  const balances = await prisma.inventoryBalance.findMany({
    where: {
      organizationId,
      productId: { in: order.lines.map((line) => line.productId) },
      warehouse: { status: "ACTIVE" },
    },
    include: { warehouse: true },
  });
  return buildRecommendedPreview(order, balances);
}

async function loadTransactionContext(
  transaction: TransactionClient,
  actor: InternalPrincipal,
  orderId: string,
) {
  const organizationId = actor.organizationId;
  const order = await transaction.order.findFirst({
    where: { id: orderId, organizationId },
    include: {
      lines: { include: { product: true }, orderBy: { position: "asc" } },
      quote: { select: { salesTeamId: true } },
    },
  });
  if (order === null) notFound("Order");
  assertSalesObjectVisible(actor, {
    ownerId: order.ownerId,
    salesTeamId: order.quote.salesTeamId,
  });
  const balances = await transaction.inventoryBalance.findMany({
    where: {
      organizationId,
      productId: { in: order.lines.map((line) => line.productId) },
      warehouse: { status: "ACTIVE" },
    },
    include: { warehouse: true },
  });
  return {
    order: order as AllocationOrder,
    balances: balances as AllocationBalance[],
  };
}

async function existingReservationResult(
  transaction: TransactionClient,
  organizationId: string,
  orderId: string,
  planId: string,
): Promise<ReservationResultDto | null> {
  const plan = await transaction.fulfillmentPlan.findFirst({
    where: { id: planId, organizationId, orderId, status: "ACCEPTED" },
    include: {
      allocations: {
        include: { warehouse: true },
        orderBy: [{ orderLineId: "asc" }, { warehouseId: "asc" }],
      },
    },
  });
  if (plan === null) return null;
  const [order, reservations, backorders] = await Promise.all([
    transaction.order.findFirst({
      where: { id: orderId, organizationId },
      include: {
        lines: {
          include: { product: true },
          orderBy: { position: "asc" },
        },
      },
    }),
    transaction.stockReservation.findMany({
      where: {
        organizationId,
        fulfillmentAllocation: { fulfillmentPlanId: planId },
      },
      orderBy: { id: "asc" },
    }),
    transaction.backorder.findMany({
      where: {
        organizationId,
        orderId,
        status: { in: ["OPEN", "PARTIALLY_ALLOCATED"] },
      },
      include: { orderLine: true },
      orderBy: { id: "asc" },
    }),
  ]);
  if (order === null) notFound("Order");
  return ReservationResultDtoSchema.parse({
    order: mapOrder(order),
    plan: mapFulfillmentPlan(plan),
    reservations: reservations.map(mapReservation),
    backorders: backorders.map((backorder) => mapBackorder(backorder)),
  });
}

export async function reservePreview(
  transaction: TransactionClient,
  organizationId: string,
  orderId: string,
  planId: string,
  planRevision: number | undefined,
  actor: InternalPrincipal,
): Promise<ReservationResultDto> {
  const existing = await existingReservationResult(
    transaction,
    organizationId,
    orderId,
    planId,
  );
  if (existing !== null) return existing;
  const { order, balances } = await loadTransactionContext(
    transaction,
    actor,
    orderId,
  );
  const preview = buildRecommendedPreview(order, balances);
  if (
    preview.dto.id !== planId ||
    (planRevision !== undefined && preview.dto.revision !== planRevision)
  ) {
    conflict(
      "Inventory or order data changed after the allocation preview",
      "FULFILLMENT_PREVIEW_STALE",
    );
  }
  return acceptPreview(transaction, organizationId, order, preview, actor);
}

export async function overrideAndReserve(
  transaction: TransactionClient,
  organizationId: string,
  orderId: string,
  requested: Parameters<typeof buildManualPreview>[2],
  reason: string,
  actor: InternalPrincipal,
): Promise<ReservationResultDto> {
  const { order, balances } = await loadTransactionContext(
    transaction,
    actor,
    orderId,
  );
  const preview = buildManualPreview(order, balances, requested, reason);
  const existing = await existingReservationResult(
    transaction,
    organizationId,
    orderId,
    preview.dto.id,
  );
  if (existing !== null) return existing;
  return acceptPreview(transaction, organizationId, order, preview, actor);
}

async function acceptPreview(
  transaction: TransactionClient,
  organizationId: string,
  order: AllocationOrder,
  preview: AllocationPreview,
  actor: InternalPrincipal,
): Promise<ReservationResultDto> {
  if (order.status !== "ALLOCATION_PENDING" && order.status !== "CONFIRMED") {
    conflict(
      "This order cannot accept another fulfillment plan",
      "ORDER_ALREADY_RESERVED",
    );
  }
  const plan = await transaction.fulfillmentPlan.create({
    data: {
      id: preview.dto.id,
      organizationId,
      orderId: order.id,
      revision: preview.dto.revision,
      status: "ACCEPTED",
      source: preview.dto.source,
      recommendationSnapshot: jsonInput({
        algorithm: "deterministic-greedy-v2",
        objectives: [
          "unfulfilled-quantity",
          "shipment-count",
          "estimated-shipping-cost",
          "promise-date",
        ],
        promiseDateConfidence: preview.dto.promiseDateConfidence,
      }),
      availabilitySnapshot: jsonInput(preview.dto.availabilitySnapshot),
      unfulfilledQuantity: preview.dto.unfulfilledQuantity,
      shipmentCount: preview.dto.shipmentCount,
      estimatedShippingCost: preview.dto.estimatedShippingCost,
      estimatedPromiseAt: preview.dto.estimatedPromiseAt,
      overrideReason: preview.dto.overrideReason,
      acceptedById: actor.userId,
      acceptedAt: new Date(),
      allocations: {
        create: preview.allocations.map((allocation) => ({
          organizationId,
          orderLineId: allocation.orderLineId,
          warehouseId: allocation.warehouseId,
          quantity: allocation.quantity,
          availableAtPreview: allocation.availableAtPreview,
          estimatedCost: allocation.estimatedCost,
          estimatedDate: allocation.estimatedDate,
        })),
      },
    },
    include: {
      allocations: {
        include: { warehouse: true },
        orderBy: [{ orderLineId: "asc" }, { warehouseId: "asc" }],
      },
    },
  });

  const reservations: Prisma.StockReservationGetPayload<object>[] = [];
  const allocationsByBalance = new Map<string, typeof preview.allocations>();
  for (const allocation of preview.allocations) {
    const group = allocationsByBalance.get(allocation.inventoryBalanceId) ?? [];
    group.push(allocation);
    allocationsByBalance.set(allocation.inventoryBalanceId, group);
  }
  for (const [inventoryBalanceId, balanceAllocations] of allocationsByBalance) {
    const firstAllocation = balanceAllocations[0];
    if (firstAllocation === undefined) continue;
    const reservedQuantity = balanceAllocations.reduce(
      (total, allocation) => total.plus(allocation.quantity),
      ZERO,
    );
    const updated = await transaction.inventoryBalance.updateMany({
      where: {
        id: inventoryBalanceId,
        organizationId,
        revision: firstAllocation.inventoryRevision,
        available: { gte: reservedQuantity },
      },
      data: {
        reserved: { increment: reservedQuantity },
        available: { decrement: reservedQuantity },
        revision: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      conflict(
        "Inventory changed while stock was being reserved",
        "INVENTORY_CONFLICT",
      );
    }
    const balance = await transaction.inventoryBalance.findUnique({
      where: { id: inventoryBalanceId },
    });
    if (balance === null) notFound("Inventory balance");
    let runningReserved = balance.reserved.minus(reservedQuantity);
    const orderedAllocations = [...balanceAllocations].sort((left, right) => {
      const line = left.orderLineId.localeCompare(right.orderLineId);
      return line === 0
        ? left.warehouseId.localeCompare(right.warehouseId)
        : line;
    });
    for (const allocation of orderedAllocations) {
      runningReserved = runningReserved.plus(allocation.quantity);
      const persistedAllocation = plan.allocations.find(
        (item) =>
          item.orderLineId === allocation.orderLineId &&
          item.warehouseId === allocation.warehouseId,
      );
      if (persistedAllocation === undefined) {
        throw new Error(
          "Persisted fulfillment allocation could not be resolved",
        );
      }
      const reservation = await transaction.stockReservation.create({
        data: {
          organizationId,
          orderLineId: allocation.orderLineId,
          warehouseId: allocation.warehouseId,
          inventoryBalanceId,
          fulfillmentAllocationId: persistedAllocation.id,
          quantity: allocation.quantity,
          status: "ACTIVE",
        },
      });
      reservations.push(reservation);
      await transaction.stockMovement.create({
        data: {
          organizationId,
          inventoryBalanceId,
          warehouseId: allocation.warehouseId,
          productId: allocation.productId,
          variantId: allocation.variantId,
          stockReservationId: reservation.id,
          actorId: actor.userId,
          type: "RESERVATION",
          quantity: allocation.quantity,
          reference: plan.id,
          reason: preview.dto.overrideReason,
          onHandAfter: balance.onHand,
          reservedAfter: runningReserved,
          metadata: jsonInput({
            orderId: order.id,
            fulfillmentPlanId: plan.id,
          }),
        },
      });
    }
  }

  const hardwareLines = order.lines.filter(
    (line) => line.product.type === "HARDWARE",
  );
  const allocatedByLine = new Map<string, Prisma.Decimal>();
  for (const allocation of preview.allocations) {
    allocatedByLine.set(
      allocation.orderLineId,
      (allocatedByLine.get(allocation.orderLineId) ?? ZERO).plus(
        allocation.quantity,
      ),
    );
  }
  const backorders: Prisma.BackorderGetPayload<{
    include: { orderLine: true };
  }>[] = [];
  for (const line of hardwareLines) {
    const remaining = Prisma.Decimal.max(
      ZERO,
      line.quantity.minus(allocatedByLine.get(line.id) ?? ZERO),
    );
    if (remaining.isZero()) continue;
    const backorder = await transaction.backorder.create({
      data: {
        organizationId,
        orderId: order.id,
        orderLineId: line.id,
        remainingQuantity: remaining,
        status: "OPEN",
      },
      include: { orderLine: true },
    });
    backorders.push(backorder);
    await recordActivity(transaction, {
      organizationId,
      actor,
      eventType: "backorder.created",
      entityType: "Backorder",
      entityId: backorder.id,
      quoteId: order.quoteId,
      title: "Backorder created",
      metadata: {
        orderId: order.id,
        orderLineId: line.id,
        quantity: remaining.toString(),
      },
    });
  }

  const allocationsByWarehouse = new Map<string, typeof preview.allocations>();
  for (const allocation of preview.allocations) {
    const current = allocationsByWarehouse.get(allocation.warehouseId) ?? [];
    current.push(allocation);
    allocationsByWarehouse.set(allocation.warehouseId, current);
  }
  for (const [warehouseId, warehouseAllocations] of allocationsByWarehouse) {
    const shipmentId = crypto.randomUUID();
    await transaction.shipment.create({
      data: {
        id: shipmentId,
        organizationId,
        orderId: order.id,
        warehouseId,
        shipmentNumber: entityNumber("SHP", shipmentId),
        status: "READY",
        promisedDate: warehouseAllocations.reduce<Date | null>(
          (latest, allocation) =>
            latest === null || allocation.estimatedDate > latest
              ? allocation.estimatedDate
              : latest,
          null,
        ),
        estimatedShippingCost: warehouseAllocations[0]?.estimatedCost ?? ZERO,
        items: {
          create: warehouseAllocations.map((allocation) => {
            const reservation = reservations.find(
              (item) =>
                item.orderLineId === allocation.orderLineId &&
                item.warehouseId === allocation.warehouseId,
            );
            if (reservation === undefined) {
              throw new Error("A shipment allocation has no stock reservation");
            }
            return {
              organizationId,
              orderLineId: allocation.orderLineId,
              stockReservationId: reservation.id,
              quantity: allocation.quantity,
            };
          }),
        },
      },
    });
  }

  const orderUpdated = await transaction.order.updateMany({
    where: {
      id: order.id,
      organizationId,
      revision: order.revision,
      status: { in: ["CONFIRMED", "ALLOCATION_PENDING"] },
    },
    data: { status: "RESERVED", revision: { increment: 1 } },
  });
  if (orderUpdated.count !== 1) {
    conflict(
      "The order changed while inventory was being reserved",
      "STALE_REVISION",
    );
  }
  await recordActivity(transaction, {
    organizationId,
    actor,
    eventType: "stock.reserved",
    entityType: "FulfillmentPlan",
    entityId: plan.id,
    entityVersion: plan.revision,
    quoteId: order.quoteId,
    reason: preview.dto.overrideReason ?? undefined,
    title:
      preview.dto.source === "MANUAL"
        ? "Manual allocation reserved"
        : "Recommended allocation reserved",
    metadata: {
      orderId: order.id,
      shipmentCount: preview.dto.shipmentCount,
      unfulfilledQuantity: preview.dto.unfulfilledQuantity,
    },
  });

  const updatedOrder = await transaction.order.findUnique({
    where: { id: order.id },
    include: {
      lines: {
        include: { product: true },
        orderBy: { position: "asc" },
      },
    },
  });
  if (updatedOrder === null) notFound("Order");
  return ReservationResultDtoSchema.parse({
    order: mapOrder(updatedOrder),
    plan: mapFulfillmentPlan(plan),
    reservations: reservations.map(mapReservation),
    backorders: backorders.map((backorder) => mapBackorder(backorder)),
  });
}

export async function shipShipment(
  transaction: TransactionClient,
  organizationId: string,
  shipmentId: string,
  trackingNumber: string,
  actor: InternalPrincipal,
) {
  const shipment = await transaction.shipment.findFirst({
    where: { id: shipmentId, organizationId },
    include: {
      order: { include: { quote: { select: { salesTeamId: true } } } },
      warehouse: true,
      items: {
        include: {
          orderLine: true,
          stockReservation: { include: { inventoryBalance: true } },
        },
        orderBy: { id: "asc" },
      },
    },
  });
  if (shipment === null) notFound("Shipment");
  assertSalesObjectVisible(actor, {
    ownerId: shipment.order.ownerId,
    salesTeamId: shipment.order.quote.salesTeamId,
  });
  if (shipment.status === "SHIPPED") {
    return mapShipment(shipment);
  }
  if (shipment.status !== "READY") {
    conflict("Only a ready shipment can be shipped", "INVALID_SHIPMENT_STATE");
  }
  const now = new Date();
  const itemsByBalance = new Map<string, typeof shipment.items>();
  for (const item of shipment.items) {
    if (
      item.stockReservation === null ||
      item.stockReservation.status !== "ACTIVE"
    ) {
      conflict(
        "Every shipment item must have an active reservation",
        "RESERVATION_NOT_ACTIVE",
      );
    }
    const group =
      itemsByBalance.get(item.stockReservation.inventoryBalanceId) ?? [];
    group.push(item);
    itemsByBalance.set(item.stockReservation.inventoryBalanceId, group);
  }
  for (const [inventoryBalanceId, balanceItems] of itemsByBalance) {
    const firstItem = balanceItems[0];
    const firstReservation = firstItem?.stockReservation;
    if (firstReservation === null || firstReservation === undefined) {
      throw new Error("A shipment inventory group has no reservation");
    }
    const balance = firstReservation.inventoryBalance;
    const shippedQuantity = balanceItems.reduce(
      (total, item) => total.plus(item.quantity),
      ZERO,
    );
    const onHandAfterShipment = balance.onHand.minus(shippedQuantity);
    const updated = await transaction.inventoryBalance.updateMany({
      where: {
        id: inventoryBalanceId,
        organizationId,
        revision: balance.revision,
        onHand: { gte: shippedQuantity },
        reserved: { gte: shippedQuantity },
      },
      data: {
        onHand: { decrement: shippedQuantity },
        reserved: { decrement: shippedQuantity },
        stockedSince: onHandAfterShipment.isZero()
          ? null
          : (balance.stockedSince ?? now),
        revision: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      conflict(
        "Reserved stock changed while the shipment was being posted",
        "INVENTORY_CONFLICT",
      );
    }
    const after = await transaction.inventoryBalance.findUnique({
      where: { id: inventoryBalanceId },
    });
    if (after === null) notFound("Inventory balance");
    let runningOnHand = after.onHand.plus(shippedQuantity);
    let runningReserved = after.reserved.plus(shippedQuantity);
    const orderedItems = [...balanceItems].sort((left, right) => {
      const line = left.orderLineId.localeCompare(right.orderLineId);
      return line === 0 ? left.id.localeCompare(right.id) : line;
    });
    for (const item of orderedItems) {
      const reservation = item.stockReservation;
      if (reservation === null) {
        throw new Error("A shipment item lost its stock reservation");
      }
      runningOnHand = runningOnHand.minus(item.quantity);
      runningReserved = runningReserved.minus(item.quantity);
      await transaction.stockReservation.update({
        where: { id: reservation.id },
        data: { status: "SHIPPED", shippedAt: now },
      });
      await transaction.stockMovement.create({
        data: {
          organizationId,
          inventoryBalanceId,
          warehouseId: balance.warehouseId,
          productId: balance.productId,
          variantId: balance.variantId,
          stockReservationId: reservation.id,
          shipmentId: shipment.id,
          actorId: actor.userId,
          type: "SHIPMENT",
          quantity: item.quantity.negated(),
          reference: trackingNumber,
          onHandAfter: runningOnHand,
          reservedAfter: runningReserved,
          metadata: jsonInput({
            orderId: shipment.orderId,
            shipmentId: shipment.id,
          }),
        },
      });
    }
  }
  await transaction.shipment.update({
    where: { id: shipment.id },
    data: { status: "SHIPPED", trackingNumber, actualDate: now },
  });
  const [unshippedCount, openBackorderCount] = await Promise.all([
    transaction.shipment.count({
      where: {
        organizationId,
        orderId: shipment.orderId,
        status: { in: ["PLANNED", "READY"] },
      },
    }),
    transaction.backorder.count({
      where: {
        organizationId,
        orderId: shipment.orderId,
        status: { in: ["OPEN", "PARTIALLY_ALLOCATED"] },
      },
    }),
  ]);
  await transaction.order.update({
    where: { id: shipment.orderId },
    data: {
      status:
        unshippedCount === 0 && openBackorderCount === 0
          ? "FULFILLED"
          : "PARTIALLY_FULFILLED",
      revision: { increment: 1 },
    },
  });
  await recordActivity(transaction, {
    organizationId,
    actor,
    eventType: "deal.activityRecorded",
    entityType: "Shipment",
    entityId: shipment.id,
    quoteId: shipment.order.quoteId,
    title: "Shipment posted",
    metadata: { orderId: shipment.orderId, trackingNumber },
  });
  const updatedShipment = await transaction.shipment.findUnique({
    where: { id: shipment.id },
    include: {
      warehouse: true,
      items: { include: { orderLine: true }, orderBy: { id: "asc" } },
    },
  });
  if (updatedShipment === null) notFound("Shipment");
  return mapShipment(updatedShipment);
}

export async function consolidateBackorder(
  transaction: TransactionClient,
  organizationId: string,
  backorderId: string,
  actor: InternalPrincipal,
) {
  await transaction.$queryRaw<Array<{ locked: unknown }>>(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${organizationId}:backorder:${backorderId}`}, 0)) AS locked`,
  );
  const target = await transaction.backorder.findFirst({
    where: { id: backorderId, organizationId },
    include: {
      orderLine: true,
      order: { include: { quote: { select: { salesTeamId: true } } } },
    },
  });
  if (target === null) notFound("Backorder");
  assertSalesObjectVisible(actor, {
    ownerId: target.order.ownerId,
    salesTeamId: target.order.quote.salesTeamId,
  });
  if (!(target.status === "OPEN" || target.status === "PARTIALLY_ALLOCATED")) {
    conflict(
      "Only an open or partially allocated backorder can consume replenished stock",
      "INVALID_BACKORDER_STATE",
    );
  }
  const rankedBalances = (
    await transaction.inventoryBalance.findMany({
      where: {
        organizationId,
        productId: target.orderLine.productId,
        variantId: target.orderLine.variantId,
        warehouse: { status: "ACTIVE" },
      },
      include: { warehouse: true },
    })
  ).sort((left, right) => {
    if (left.warehouse.leadTimeDays !== right.warehouse.leadTimeDays) {
      return left.warehouse.leadTimeDays - right.warehouse.leadTimeDays;
    }
    const cost = left.warehouse.shippingCostWeight.comparedTo(
      right.warehouse.shippingCostWeight,
    );
    if (cost !== 0) return cost;
    const code = left.warehouse.code.localeCompare(right.warehouse.code);
    return code === 0 ? left.id.localeCompare(right.id) : code;
  });
  const available = rankedBalances.reduce(
    (amount, balance) => amount.plus(balance.available),
    ZERO,
  );
  if (!available.greaterThan(ZERO)) {
    conflict(
      "No replenished stock is available for this backorder",
      "BACKORDER_NOT_ELIGIBLE",
    );
  }
  const now = new Date();
  let remaining = new Prisma.Decimal(target.remainingQuantity);
  const allocations: Array<{
    warehouseId: string;
    reservationId: string;
    shipmentId: string;
    quantity: Prisma.Decimal;
  }> = [];
  for (const balance of rankedBalances) {
    if (!remaining.greaterThan(ZERO) || !balance.available.greaterThan(ZERO)) {
      continue;
    }
    const quantity = Prisma.Decimal.min(remaining, balance.available);
    const claimed = await transaction.inventoryBalance.updateMany({
      where: {
        id: balance.id,
        organizationId,
        revision: balance.revision,
        available: { gte: quantity },
      },
      data: {
        reserved: { increment: quantity },
        available: { decrement: quantity },
        revision: { increment: 1 },
      },
    });
    if (claimed.count !== 1) {
      conflict(
        "Inventory changed while replenished stock was being reserved",
        "INVENTORY_CONFLICT",
      );
    }
    const reservation = await transaction.stockReservation.create({
      data: {
        organizationId,
        orderLineId: target.orderLineId,
        warehouseId: balance.warehouseId,
        inventoryBalanceId: balance.id,
        quantity,
        status: "ACTIVE",
      },
    });
    const promisedDate = new Date(now);
    promisedDate.setUTCDate(
      promisedDate.getUTCDate() + balance.warehouse.leadTimeDays,
    );
    const existingShipment = await transaction.shipment.findFirst({
      where: {
        organizationId,
        orderId: target.orderId,
        warehouseId: balance.warehouseId,
        status: "READY",
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    let shipmentId: string;
    if (existingShipment === null) {
      shipmentId = crypto.randomUUID();
      await transaction.shipment.create({
        data: {
          id: shipmentId,
          organizationId,
          orderId: target.orderId,
          warehouseId: balance.warehouseId,
          shipmentNumber: entityNumber("SHP", shipmentId),
          status: "READY",
          promisedDate,
          estimatedShippingCost: balance.warehouse.shippingCostWeight,
          items: {
            create: {
              organizationId,
              orderLineId: target.orderLineId,
              stockReservationId: reservation.id,
              quantity,
            },
          },
        },
      });
    } else {
      shipmentId = existingShipment.id;
      await transaction.shipmentItem.create({
        data: {
          organizationId,
          shipmentId,
          orderLineId: target.orderLineId,
          stockReservationId: reservation.id,
          quantity,
        },
      });
      if (
        existingShipment.promisedDate === null ||
        existingShipment.promisedDate < promisedDate
      ) {
        await transaction.shipment.update({
          where: { id: shipmentId },
          data: { promisedDate },
        });
      }
    }
    await transaction.stockMovement.create({
      data: {
        organizationId,
        inventoryBalanceId: balance.id,
        warehouseId: balance.warehouseId,
        productId: balance.productId,
        variantId: balance.variantId,
        stockReservationId: reservation.id,
        actorId: actor.userId,
        type: "RESERVATION",
        quantity,
        reference: target.id,
        reason: "Backorder replenishment allocation",
        onHandAfter: balance.onHand,
        reservedAfter: balance.reserved.plus(quantity),
        metadata: jsonInput({
          orderId: target.orderId,
          backorderId: target.id,
          shipmentId,
        }),
        occurredAt: now,
      },
    });
    allocations.push({
      warehouseId: balance.warehouseId,
      reservationId: reservation.id,
      shipmentId,
      quantity,
    });
    remaining = remaining.minus(quantity);
  }

  const expectedAt = remaining.greaterThan(ZERO)
    ? rankedBalances.reduce<Date | null>((earliest, balance) => {
        if (
          !balance.incoming.greaterThan(ZERO) ||
          balance.incomingExpectedAt === null
        ) {
          return earliest;
        }
        const arrival = new Date(balance.incomingExpectedAt);
        arrival.setUTCDate(
          arrival.getUTCDate() + balance.warehouse.leadTimeDays,
        );
        return earliest === null || arrival < earliest ? arrival : earliest;
      }, null)
    : null;
  const claimedBackorder = await transaction.backorder.updateMany({
    where: {
      id: target.id,
      organizationId,
      status: target.status,
      remainingQuantity: target.remainingQuantity,
    },
    data: {
      status: remaining.isZero() ? "FULFILLED" : "PARTIALLY_ALLOCATED",
      remainingQuantity: remaining,
      expectedAt,
      fulfilledAt: remaining.isZero() ? now : null,
      consolidatedIntoId: null,
    },
  });
  if (claimedBackorder.count !== 1) {
    conflict(
      "The backorder changed while replenished stock was being reserved",
      "BACKORDER_CONFLICT",
    );
  }
  await transaction.alert.updateMany({
    where: {
      organizationId,
      quoteId: target.order.quoteId,
      reasonCode: `BACKORDER_READY:${target.id}`,
      status: { in: ["OPEN", "ACKNOWLEDGED", "SNOOZED"] },
    },
    data: {
      status: "RESOLVED",
      resolvedAt: now,
      snoozedUntil: null,
      revision: { increment: 1 },
    },
  });
  await recordActivity(transaction, {
    organizationId,
    actor,
    eventType: "stock.reserved",
    entityType: "Backorder",
    entityId: target.id,
    quoteId: target.order.quoteId,
    title: "Replenished stock reserved for backorder",
    metadata: {
      orderId: target.orderId,
      allocatedQuantity: target.remainingQuantity.minus(remaining).toString(),
      remainingQuantity: remaining.toString(),
      allocations: allocations.map((allocation) => ({
        warehouseId: allocation.warehouseId,
        reservationId: allocation.reservationId,
        shipmentId: allocation.shipmentId,
        quantity: allocation.quantity.toString(),
      })),
    },
  });
  const updated = await transaction.backorder.findUnique({
    where: { id: target.id },
    include: { orderLine: true },
  });
  if (updated === null) notFound("Backorder");
  return mapBackorder(updated, {
    availableQuantity: Prisma.Decimal.max(
      ZERO,
      available.minus(target.remainingQuantity),
    ),
    consolidationEligible: false,
    consolidationReason: remaining.isZero()
      ? null
      : "All currently available replenishment stock was reserved",
  });
}
