import { Router, type RequestHandler } from "express";

import {
  ConfirmOrderRequestSchema,
  FulfillmentPreviewRequestSchema,
  InventoryAdjustmentRequestSchema,
  InventoryAdjustmentResultDtoSchema,
  ListQuerySchema,
  OrderBillingDtoSchema,
  OverrideFulfillmentRequestSchema,
  ReserveFulfillmentRequestSchema,
  SetIncomingStockRequestSchema,
  ShipShipmentRequestSchema,
  StockReceiptRequestSchema,
  StockReceiptResultDtoSchema,
} from "@repo/common";
import { prisma, Prisma } from "@repo/db";

import {
  authenticateInternal,
  internalPrincipal,
  requireCapability,
  requireAnyCapability,
  requireCsrf,
} from "../../middleware/auth.js";
import {
  jsonInput,
  recordActivity,
  type TransactionClient,
} from "../../shared/activity.js";
import { conflict, HttpError, notFound } from "../../shared/errors.js";
import {
  cursorArgs,
  pageFromRows,
  parseBody,
  parsePathId,
  parseQuery,
} from "../../shared/http.js";
import { runIdempotent } from "../../shared/idempotency.js";
import {
  mapBillingSchedule,
  mapInvoiceSummary,
  mapSubscriptionSummary,
} from "../billing/mappers.js";
import { orderVisibilityWhere } from "./access.js";
import {
  consolidateBackorder,
  loadRecommendedPreview,
  overrideAndReserve,
  reservePreview,
  shipShipment,
} from "./fulfillment.js";
import {
  mapBackorder,
  mapInventoryBalance,
  mapOrder,
  mapOrderSummary,
  mapShipment,
  mapStockMovement,
} from "./mappers.js";
import { confirmOrderFromQuote } from "./order-confirmation.js";

const ZERO = new Prisma.Decimal(0);
const inventoryBalanceInclude = {
  warehouse: true,
  product: true,
  variant: true,
} satisfies Prisma.InventoryBalanceInclude;

async function lockInventoryKey(
  transaction: TransactionClient,
  key: string,
): Promise<void> {
  await transaction.$queryRaw<Array<{ locked: unknown }>>(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0)) AS locked`,
  );
}

async function loadStockBalance(
  transaction: TransactionClient,
  input: {
    organizationId: string;
    warehouseId: string;
    productId: string;
    variantId: string | null;
  },
) {
  await lockInventoryKey(
    transaction,
    `${input.organizationId}:${input.warehouseId}:${input.productId}:${input.variantId ?? "base"}`,
  );
  const [warehouse, product] = await Promise.all([
    transaction.warehouse.findFirst({
      where: {
        id: input.warehouseId,
        organizationId: input.organizationId,
        status: "ACTIVE",
      },
      select: { id: true },
    }),
    transaction.product.findFirst({
      where: {
        id: input.productId,
        organizationId: input.organizationId,
        status: "ACTIVE",
      },
      include: {
        variants: { where: { status: "ACTIVE" }, select: { id: true } },
      },
    }),
  ]);
  if (warehouse === null) notFound("Active warehouse");
  if (product === null) notFound("Active product");
  if (
    input.variantId !== null &&
    !product.variants.some((variant) => variant.id === input.variantId)
  ) {
    notFound("Active product variant");
  }
  const existing = await transaction.inventoryBalance.findFirst({
    where: {
      organizationId: input.organizationId,
      warehouseId: input.warehouseId,
      productId: input.productId,
      variantId: input.variantId,
    },
    include: inventoryBalanceInclude,
  });
  if (existing !== null) return existing;
  return transaction.inventoryBalance.create({
    data: {
      organizationId: input.organizationId,
      warehouseId: input.warehouseId,
      productId: input.productId,
      variantId: input.variantId,
      onHand: ZERO,
      reserved: ZERO,
      available: ZERO,
      incoming: ZERO,
      incomingExpectedAt: null,
      stockedSince: null,
    },
    include: inventoryBalanceInclude,
  });
}

async function applyStockDelta(
  transaction: TransactionClient,
  input: {
    organizationId: string;
    warehouseId: string;
    productId: string;
    variantId: string | null;
    quantity: Prisma.Decimal;
    type: "ADJUSTMENT" | "RECEIPT";
    reference: string | null;
    reason: string | null;
    actorId: string;
    expectedRevision?: number;
  },
) {
  const balance = await loadStockBalance(transaction, input);
  if (
    input.expectedRevision !== undefined &&
    balance.revision !== input.expectedRevision
  ) {
    conflict(
      "The inventory balance changed; reload before adjusting",
      "REVISION_CONFLICT",
    );
  }
  const onHand = balance.onHand.plus(input.quantity);
  const available = onHand.minus(balance.reserved);
  if (onHand.isNegative() || available.isNegative()) {
    conflict(
      "The adjustment would reduce stock below its active reservations",
      "INSUFFICIENT_STOCK",
    );
  }
  const operationAt = new Date();
  const incoming =
    input.type === "RECEIPT"
      ? Prisma.Decimal.max(ZERO, balance.incoming.minus(input.quantity))
      : balance.incoming;
  const incomingExpectedAt = incoming.isZero()
    ? null
    : balance.incomingExpectedAt;
  const stockedSince = onHand.isZero()
    ? null
    : (balance.stockedSince ?? operationAt);
  const claimed = await transaction.inventoryBalance.updateMany({
    where: {
      id: balance.id,
      organizationId: input.organizationId,
      revision: balance.revision,
    },
    data: {
      onHand,
      available,
      incoming,
      incomingExpectedAt,
      stockedSince,
      revision: { increment: 1 },
    },
  });
  if (claimed.count !== 1) {
    conflict(
      "The inventory balance changed; reload before adjusting",
      "REVISION_CONFLICT",
    );
  }
  const [updated, movement] = await Promise.all([
    transaction.inventoryBalance.findUnique({
      where: { id: balance.id },
      include: inventoryBalanceInclude,
    }),
    transaction.stockMovement.create({
      data: {
        organizationId: input.organizationId,
        inventoryBalanceId: balance.id,
        warehouseId: input.warehouseId,
        productId: input.productId,
        variantId: input.variantId,
        actorId: input.actorId,
        type: input.type,
        quantity: input.quantity,
        reference: input.reference,
        reason: input.reason,
        onHandAfter: onHand,
        reservedAfter: balance.reserved,
        metadata: jsonInput({
          balanceRevision: balance.revision + 1,
          incomingBefore: balance.incoming.toString(),
          incomingAfter: incoming.toString(),
          incomingExpectedAtBefore:
            balance.incomingExpectedAt?.toISOString() ?? null,
          incomingExpectedAtAfter: incomingExpectedAt?.toISOString() ?? null,
          stockedSince: stockedSince?.toISOString() ?? null,
        }),
        occurredAt: operationAt,
      },
    }),
  ]);
  if (updated === null) notFound("Inventory balance");
  return { balance: updated, movement };
}

export function createOperationsRouter(): Router {
  const router = Router();

  router.get(
    "/inventory/warehouses/:warehouseId/balances",
    authenticateInternal,
    requireCapability("inventory.read"),
    async (request, response) => {
      const actor = internalPrincipal(response);
      const warehouseId = parsePathId(request, "warehouseId");
      const query = parseQuery(ListQuerySchema, request);
      const warehouse = await prisma.warehouse.findFirst({
        where: { id: warehouseId, organizationId: actor.organizationId },
        select: { id: true },
      });
      if (warehouse === null) notFound("Warehouse");
      const rows = await prisma.inventoryBalance.findMany({
        where: {
          organizationId: actor.organizationId,
          warehouseId,
          ...(query.search === undefined
            ? {}
            : {
                OR: [
                  {
                    product: {
                      name: {
                        contains: query.search,
                        mode: "insensitive" as const,
                      },
                    },
                  },
                  {
                    product: {
                      code: {
                        contains: query.search,
                        mode: "insensitive" as const,
                      },
                    },
                  },
                  {
                    variant: {
                      sku: {
                        contains: query.search,
                        mode: "insensitive" as const,
                      },
                    },
                  },
                ],
              }),
        },
        include: inventoryBalanceInclude,
        orderBy: { id: query.direction },
        ...cursorArgs(query.cursor, query.limit),
      });
      response.json(pageFromRows(rows.map(mapInventoryBalance), query.limit));
    },
  );

  router.post(
    "/inventory/warehouses/:warehouseId/adjust",
    authenticateInternal,
    requireCapability("inventory.adjust"),
    requireCsrf,
    async (request, response) => {
      const actor = internalPrincipal(response);
      const warehouseId = parsePathId(request, "warehouseId");
      const input = parseBody(InventoryAdjustmentRequestSchema, request);
      const result = await runIdempotent(
        request,
        actor,
        "inventory.adjust",
        { warehouseId, ...input },
        async (transaction) => {
          const updated = await applyStockDelta(transaction, {
            organizationId: actor.organizationId,
            warehouseId,
            productId: input.productId,
            variantId: input.variantId ?? null,
            quantity: new Prisma.Decimal(input.quantity),
            type: "ADJUSTMENT",
            reference: null,
            reason: input.reason,
            actorId: actor.userId,
            ...(input.revision === undefined
              ? {}
              : { expectedRevision: input.revision }),
          });
          const body = InventoryAdjustmentResultDtoSchema.parse({
            balance: mapInventoryBalance(updated.balance),
            movement: mapStockMovement(updated.movement),
          });
          await recordActivity(transaction, {
            organizationId: actor.organizationId,
            actor,
            eventType: "deal.activityRecorded",
            entityType: "InventoryBalance",
            entityId: updated.balance.id,
            entityVersion: updated.balance.revision,
            title: "Inventory balance adjusted",
            message: input.reason,
            after: body,
          });
          return {
            status: 200,
            body,
            entityType: "InventoryBalance",
            entityId: updated.balance.id,
          };
        },
      );
      response.status(result.status).json(result.body);
    },
  );

  router.put(
    "/inventory/warehouses/:warehouseId/incoming",
    authenticateInternal,
    requireCapability("inventory.adjust"),
    requireCsrf,
    async (request, response) => {
      const actor = internalPrincipal(response);
      const warehouseId = parsePathId(request, "warehouseId");
      const input = parseBody(SetIncomingStockRequestSchema, request);
      const result = await runIdempotent(
        request,
        actor,
        "inventory.set-incoming",
        { warehouseId, ...input },
        async (transaction) => {
          const balance = await loadStockBalance(transaction, {
            organizationId: actor.organizationId,
            warehouseId,
            productId: input.productId,
            variantId: input.variantId ?? null,
          });
          if (
            input.revision !== undefined &&
            input.revision !== balance.revision
          ) {
            conflict(
              "The inventory balance changed; reload before setting incoming stock",
              "REVISION_CONFLICT",
            );
          }
          const incoming = new Prisma.Decimal(input.incomingQuantity);
          const expectedAt =
            input.expectedAt === undefined || input.expectedAt === null
              ? null
              : new Date(input.expectedAt);
          if (
            incoming.greaterThan(ZERO) &&
            (expectedAt === null || expectedAt <= new Date())
          ) {
            throw new HttpError(
              422,
              "Validation failed",
              "Incoming stock must have a future expected arrival",
              { code: "INVALID_INCOMING_ETA" },
            );
          }
          const before = mapInventoryBalance(balance);
          const claimed = await transaction.inventoryBalance.updateMany({
            where: {
              id: balance.id,
              organizationId: actor.organizationId,
              revision: balance.revision,
            },
            data: {
              incoming,
              incomingExpectedAt: expectedAt,
              revision: { increment: 1 },
            },
          });
          if (claimed.count !== 1) {
            conflict(
              "The inventory balance changed; reload before setting incoming stock",
              "REVISION_CONFLICT",
            );
          }
          const updated = await transaction.inventoryBalance.findUnique({
            where: { id: balance.id },
            include: inventoryBalanceInclude,
          });
          if (updated === null) notFound("Inventory balance");
          const body = mapInventoryBalance(updated);
          await recordActivity(transaction, {
            organizationId: actor.organizationId,
            actor,
            eventType: "inventory.replenished",
            entityType: "InventoryBalance",
            entityId: updated.id,
            entityVersion: updated.revision,
            title: incoming.isZero()
              ? "Incoming stock cleared"
              : "Incoming stock scheduled",
            message: input.reason,
            before,
            after: body,
            metadata: {
              warehouseId,
              expectedAt: expectedAt?.toISOString() ?? null,
            },
          });
          return {
            status: 200,
            body,
            entityType: "InventoryBalance",
            entityId: updated.id,
          };
        },
      );
      response.status(result.status).json(result.body);
    },
  );

  router.get(
    "/inventory/stock-movements",
    authenticateInternal,
    requireCapability("inventory.read"),
    async (request, response) => {
      const actor = internalPrincipal(response);
      const query = parseQuery(ListQuerySchema, request);
      const rows = await prisma.stockMovement.findMany({
        where: {
          organizationId: actor.organizationId,
          ...(query.search === undefined
            ? {}
            : {
                OR: [
                  {
                    reference: {
                      contains: query.search,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    reason: {
                      contains: query.search,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              }),
        },
        orderBy: { id: query.direction },
        ...cursorArgs(query.cursor, query.limit),
      });
      response.json(pageFromRows(rows.map(mapStockMovement), query.limit));
    },
  );

  router.post(
    "/inventory/stock-movements/receipt",
    authenticateInternal,
    requireCapability("inventory.adjust"),
    requireCsrf,
    async (request, response) => {
      const actor = internalPrincipal(response);
      const input = parseBody(StockReceiptRequestSchema, request);
      const result = await runIdempotent(
        request,
        actor,
        "inventory.receive",
        input,
        async (transaction) => {
          await lockInventoryKey(
            transaction,
            `${actor.organizationId}:${input.warehouseId}:receipt:${input.reference}`,
          );
          const existingReceipt = await transaction.stockMovement.findFirst({
            where: {
              organizationId: actor.organizationId,
              warehouseId: input.warehouseId,
              type: "RECEIPT",
              reference: input.reference,
            },
            select: { id: true },
          });
          if (existingReceipt !== null) {
            conflict(
              "This warehouse receipt reference was already recorded",
              "RECEIPT_EXISTS",
            );
          }
          const aggregated = new Map<
            string,
            {
              productId: string;
              variantId: string | null;
              quantity: Prisma.Decimal;
            }
          >();
          for (const item of input.items) {
            const variantId = item.variantId ?? null;
            const key = `${item.productId}:${variantId ?? "base"}`;
            const previous = aggregated.get(key);
            aggregated.set(key, {
              productId: item.productId,
              variantId,
              quantity: (previous?.quantity ?? ZERO).plus(item.quantity),
            });
          }
          const balances = [];
          const movements = [];
          for (const item of [...aggregated.values()].sort((left, right) =>
            `${left.productId}:${left.variantId ?? ""}`.localeCompare(
              `${right.productId}:${right.variantId ?? ""}`,
            ),
          )) {
            const updated = await applyStockDelta(transaction, {
              organizationId: actor.organizationId,
              warehouseId: input.warehouseId,
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              type: "RECEIPT",
              reference: input.reference,
              reason: "Stock receipt",
              actorId: actor.userId,
            });
            balances.push(mapInventoryBalance(updated.balance));
            movements.push(mapStockMovement(updated.movement));
          }
          const body = StockReceiptResultDtoSchema.parse({
            warehouseId: input.warehouseId,
            reference: input.reference,
            balances,
            movements,
          });
          await recordActivity(transaction, {
            organizationId: actor.organizationId,
            actor,
            eventType: "inventory.replenished",
            entityType: "Warehouse",
            entityId: input.warehouseId,
            title: "Inventory receipt recorded",
            message: input.reference,
            after: body,
          });
          return {
            status: 201,
            body,
            entityType: "Warehouse",
            entityId: input.warehouseId,
          };
        },
      );
      response.status(result.status).json(result.body);
    },
  );

  router.get(
    "/orders",
    authenticateInternal,
    requireAnyCapability("fulfillment.read", "billing.read"),
    async (request, response) => {
      const actor = internalPrincipal(response);
      const query = parseQuery(ListQuerySchema, request);
      const searchWhere =
        query.search === undefined
          ? {}
          : {
              OR: [
                {
                  orderNumber: {
                    contains: query.search,
                    mode: "insensitive" as const,
                  },
                },
                {
                  customerName: {
                    contains: query.search,
                    mode: "insensitive" as const,
                  },
                },
              ],
            };
      const rows = await prisma.order.findMany({
        where: {
          organizationId: actor.organizationId,
          AND: [orderVisibilityWhere(actor), searchWhere],
        },
        orderBy: { id: query.direction },
        ...cursorArgs(query.cursor, query.limit),
      });
      response.json(pageFromRows(rows.map(mapOrderSummary), query.limit));
    },
  );

  router.get(
    "/orders/:orderId",
    authenticateInternal,
    requireAnyCapability("fulfillment.read", "billing.read"),
    async (request, response) => {
      const actor = internalPrincipal(response);
      const orderId = parsePathId(request, "orderId");
      const order = await prisma.order.findFirst({
        where: {
          id: orderId,
          organizationId: actor.organizationId,
          ...orderVisibilityWhere(actor),
        },
        include: {
          lines: {
            include: { product: true },
            orderBy: { position: "asc" },
          },
        },
      });
      if (order === null) notFound("Order");
      response.json(mapOrder(order));
    },
  );

  router.post(
    "/orders/quotes/:quoteId/confirm",
    authenticateInternal,
    requireCapability("quotation.confirm"),
    requireCsrf,
    async (request, response) => {
      const actor = internalPrincipal(response);
      const quoteId = parsePathId(request, "quoteId");
      const input = parseBody(ConfirmOrderRequestSchema, request);
      const result = await runIdempotent(
        request,
        actor,
        "order.confirm-from-quote",
        { quoteId, ...input },
        async (transaction) => {
          const confirmed = await confirmOrderFromQuote(
            transaction,
            actor.organizationId,
            quoteId,
            input.revision,
            actor,
          );
          return {
            status: confirmed.status,
            body: confirmed.order,
            entityType: "Order",
            entityId: confirmed.order.id,
          };
        },
      );
      response.status(result.status).json(result.body);
    },
  );

  router.get(
    "/orders/:orderId/billing",
    authenticateInternal,
    requireCapability("billing.read"),
    async (request, response) => {
      const actor = internalPrincipal(response);
      const orderId = parsePathId(request, "orderId");
      const order = await prisma.order.findFirst({
        where: {
          id: orderId,
          organizationId: actor.organizationId,
          ...orderVisibilityWhere(actor),
        },
        select: { id: true, currency: true },
      });
      if (order === null) notFound("Order");
      const [invoices, subscriptions, schedules] = await Promise.all([
        prisma.invoice.findMany({
          where: { organizationId: actor.organizationId, orderId },
          include: { customerAccount: true },
          orderBy: { id: "asc" },
        }),
        prisma.subscription.findMany({
          where: { organizationId: actor.organizationId, orderId },
          include: {
            customerAccount: true,
            subscriptionPlan: true,
            items: true,
          },
          orderBy: { id: "asc" },
        }),
        prisma.billingSchedule.findMany({
          where: {
            organizationId: actor.organizationId,
            subscription: { orderId },
            generationStatus: "PENDING",
          },
          orderBy: [{ periodStart: "asc" }, { id: "asc" }],
        }),
      ]);
      const totalOneTime = invoices
        .filter(
          (invoice) => invoice.type === "ONE_TIME" && invoice.status !== "VOID",
        )
        .reduce((total, invoice) => total.plus(invoice.total), ZERO);
      const recurringAmount = subscriptions
        .filter((subscription) =>
          ["ACTIVE", "CHANGE_SCHEDULED", "CANCELLATION_SCHEDULED"].includes(
            subscription.status,
          ),
        )
        .flatMap((subscription) =>
          subscription.items.filter((item) => item.activeTo === null),
        )
        .reduce(
          (total, item) => total.plus(item.unitPrice.mul(item.quantity)),
          ZERO,
        );
      response.json(
        OrderBillingDtoSchema.parse({
          orderId,
          oneTimeInvoices: invoices
            .filter((invoice) => invoice.type === "ONE_TIME")
            .map(mapInvoiceSummary),
          subscriptions: subscriptions.map(mapSubscriptionSummary),
          upcomingSchedules: schedules.map(mapBillingSchedule),
          totalOneTime: totalOneTime.toString(),
          recurringAmount: recurringAmount.toString(),
          currency: order.currency,
        }),
      );
    },
  );

  const getPreview: RequestHandler = async (request, response) => {
    const actor = internalPrincipal(response);
    const orderId = parsePathId(request, "orderId");
    const preview = await loadRecommendedPreview(actor, orderId);
    response.json(preview.dto);
  };
  router.get(
    "/fulfillment/orders/:orderId/fulfillment/preview",
    authenticateInternal,
    requireCapability("fulfillment.read"),
    getPreview,
  );

  const postPreview: RequestHandler = async (request, response) => {
    const actor = internalPrincipal(response);
    const orderId = parsePathId(request, "orderId");
    const input = parseBody(FulfillmentPreviewRequestSchema, request);
    const preview = await loadRecommendedPreview(
      actor,
      orderId,
      input.orderRevision,
    );
    response.json(preview.dto);
  };
  router.post(
    "/orders/:orderId/fulfillment/preview",
    authenticateInternal,
    requireCapability("fulfillment.read"),
    requireCsrf,
    postPreview,
  );

  const reserve: RequestHandler = async (request, response) => {
    const actor = internalPrincipal(response);
    const orderId = parsePathId(request, "orderId");
    const input = parseBody(ReserveFulfillmentRequestSchema, request);
    const result = await runIdempotent(
      request,
      actor,
      "fulfillment.reserve",
      { orderId, ...input },
      async (transaction) => {
        const body = await reservePreview(
          transaction,
          actor.organizationId,
          orderId,
          input.planId,
          input.planRevision,
          actor,
        );
        return {
          status: 200,
          body,
          entityType: "FulfillmentPlan",
          entityId: body.plan.id,
        };
      },
    );
    response.status(result.status).json(result.body);
  };
  router.post(
    "/fulfillment/orders/:orderId/fulfillment/reserve",
    authenticateInternal,
    requireCapability("fulfillment.reserve"),
    requireCsrf,
    reserve,
  );
  router.post(
    "/orders/:orderId/fulfillment/reserve",
    authenticateInternal,
    requireCapability("fulfillment.reserve"),
    requireCsrf,
    reserve,
  );

  const override: RequestHandler = async (request, response) => {
    const actor = internalPrincipal(response);
    const orderId = parsePathId(request, "orderId");
    const input = parseBody(OverrideFulfillmentRequestSchema, request);
    const result = await runIdempotent(
      request,
      actor,
      "fulfillment.override-and-reserve",
      { orderId, ...input },
      async (transaction) => {
        const body = await overrideAndReserve(
          transaction,
          actor.organizationId,
          orderId,
          input.allocations,
          input.reason,
          actor,
        );
        return {
          status: 200,
          body,
          entityType: "FulfillmentPlan",
          entityId: body.plan.id,
        };
      },
    );
    response.status(result.status).json(result.body);
  };
  router.post(
    "/fulfillment/orders/:orderId/fulfillment/override",
    authenticateInternal,
    requireCapability("fulfillment.override"),
    requireCsrf,
    override,
  );
  router.post(
    "/orders/:orderId/fulfillment/override",
    authenticateInternal,
    requireCapability("fulfillment.override"),
    requireCsrf,
    override,
  );

  router.get(
    "/fulfillment/orders/:orderId/shipments",
    authenticateInternal,
    requireCapability("fulfillment.read"),
    async (request, response) => {
      const actor = internalPrincipal(response);
      const orderId = parsePathId(request, "orderId");
      const order = await prisma.order.findFirst({
        where: {
          id: orderId,
          organizationId: actor.organizationId,
          ...orderVisibilityWhere(actor),
        },
        select: { id: true },
      });
      if (order === null) notFound("Order");
      const shipments = await prisma.shipment.findMany({
        where: { organizationId: actor.organizationId, orderId },
        include: {
          warehouse: true,
          items: { include: { orderLine: true }, orderBy: { id: "asc" } },
        },
        orderBy: { id: "asc" },
      });
      response.json(shipments.map(mapShipment));
    },
  );

  router.post(
    "/fulfillment/shipments/:shipmentId/ship",
    authenticateInternal,
    requireCapability("fulfillment.reserve"),
    requireCsrf,
    async (request, response) => {
      const actor = internalPrincipal(response);
      const shipmentId = parsePathId(request, "shipmentId");
      const input = parseBody(ShipShipmentRequestSchema, request);
      const result = await runIdempotent(
        request,
        actor,
        "fulfillment.ship",
        { shipmentId, ...input },
        async (transaction) => ({
          status: 200,
          body: await shipShipment(
            transaction,
            actor.organizationId,
            shipmentId,
            input.trackingNumber,
            actor,
          ),
          entityType: "Shipment",
          entityId: shipmentId,
        }),
      );
      response.status(result.status).json(result.body);
    },
  );

  router.get(
    "/fulfillment/backorders",
    authenticateInternal,
    requireCapability("fulfillment.read"),
    async (request, response) => {
      const actor = internalPrincipal(response);
      const query = parseQuery(ListQuerySchema, request);
      const rows = await prisma.backorder.findMany({
        where: {
          organizationId: actor.organizationId,
          order: orderVisibilityWhere(actor),
          ...(query.search === undefined
            ? {}
            : {
                OR: [
                  {
                    orderLine: {
                      productName: {
                        contains: query.search,
                        mode: "insensitive" as const,
                      },
                    },
                  },
                  {
                    order: {
                      orderNumber: {
                        contains: query.search,
                        mode: "insensitive" as const,
                      },
                    },
                  },
                ],
              }),
        },
        include: { orderLine: true },
        orderBy: { id: query.direction },
        ...cursorArgs(query.cursor, query.limit),
      });
      const balances =
        rows.length === 0
          ? []
          : await prisma.inventoryBalance.findMany({
              where: {
                organizationId: actor.organizationId,
                warehouse: { status: "ACTIVE" },
                OR: rows.map((row) => ({
                  productId: row.orderLine.productId,
                  variantId: row.orderLine.variantId,
                })),
              },
              select: { productId: true, variantId: true, available: true },
            });
      response.json(
        pageFromRows(
          rows.map((row) => {
            const available = balances
              .filter(
                (balance) =>
                  balance.productId === row.orderLine.productId &&
                  balance.variantId === row.orderLine.variantId,
              )
              .reduce((total, balance) => total.plus(balance.available), ZERO);
            const open = ["OPEN", "PARTIALLY_ALLOCATED"].includes(row.status);
            const consolidationEligible = open && available.greaterThan(ZERO);
            return mapBackorder(row, {
              availableQuantity: available,
              consolidationEligible,
              consolidationReason: consolidationEligible
                ? `${available.toString()} unit(s) can be reserved from replenished stock`
                : open
                  ? "No replenished stock is currently available"
                  : null,
            });
          }),
          query.limit,
        ),
      );
    },
  );

  const consolidate: RequestHandler = async (request, response) => {
    const actor = internalPrincipal(response);
    const backorderId = parsePathId(request, "backorderId");
    const result = await runIdempotent(
      request,
      actor,
      "fulfillment.consolidate-backorder",
      { backorderId },
      async (transaction) => ({
        status: 200,
        body: await consolidateBackorder(
          transaction,
          actor.organizationId,
          backorderId,
          actor,
        ),
        entityType: "Backorder",
        entityId: backorderId,
      }),
    );
    response.status(result.status).json(result.body);
  };
  router.post(
    "/fulfillment/backorders/:backorderId/consolidate",
    authenticateInternal,
    requireCapability("fulfillment.reserve"),
    requireCsrf,
    consolidate,
  );
  router.post(
    "/backorders/:backorderId/consolidate",
    authenticateInternal,
    requireCapability("fulfillment.reserve"),
    requireCsrf,
    consolidate,
  );

  return router;
}
