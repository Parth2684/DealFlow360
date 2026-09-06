import {
  BackorderDtoSchema,
  FulfillmentPlanDtoSchema,
  InventoryBalanceDtoSchema,
  JsonObjectSchema,
  OrderDtoSchema,
  OrderSummaryDtoSchema,
  PromiseDateConfidenceDtoSchema,
  ShipmentDtoSchema,
  StockMovementDtoSchema,
  StockReservationDtoSchema,
  type BackorderDto,
  type FulfillmentPlanDto,
  type InventoryBalanceDto,
  type OrderDto,
  type OrderSummaryDto,
  type ShipmentDto,
  type StockMovementDto,
  type StockReservationDto,
} from "@repo/common";
import type { Prisma } from "@repo/db";

import { toJsonValue } from "../../shared/http.js";

export type OrderRecord = Prisma.OrderGetPayload<{
  include: {
    lines: {
      include: { product: true };
      orderBy: { position: "asc" };
    };
  };
}>;

export type FulfillmentPlanRecord = Prisma.FulfillmentPlanGetPayload<{
  include: {
    allocations: {
      include: { warehouse: true };
      orderBy: [{ orderLineId: "asc" }, { warehouseId: "asc" }];
    };
  };
}>;

export type ShipmentRecord = Prisma.ShipmentGetPayload<{
  include: {
    warehouse: true;
    items: {
      include: { orderLine: true };
      orderBy: { id: "asc" };
    };
  };
}>;

export type BackorderRecord = Prisma.BackorderGetPayload<{
  include: { orderLine: true };
}>;

export type InventoryBalanceRecord = Prisma.InventoryBalanceGetPayload<{
  include: { warehouse: true; product: true; variant: true };
}>;

export function mapOrderSummary(
  record: Prisma.OrderGetPayload<object>,
): OrderSummaryDto {
  return OrderSummaryDtoSchema.parse({
    id: record.id,
    orderNumber: record.orderNumber,
    quoteId: record.quoteId,
    quoteVersionId: record.quoteVersionId,
    customerAccountId: record.customerAccountId,
    customerName: record.customerName,
    ownerId: record.ownerId,
    status: record.status,
    currency: record.currency,
    total: record.total.toString(),
    termsFingerprint: record.termsFingerprint,
    confirmedAt: record.confirmedAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

export function mapOrder(record: OrderRecord): OrderDto {
  return OrderDtoSchema.parse({
    ...mapOrderSummary(record),
    paymentTermsDays: record.paymentTermsDays,
    subtotal: record.subtotal.toString(),
    discountTotal: record.discountTotal.toString(),
    taxTotal: record.taxTotal.toString(),
    costTotal: record.costTotal.toString(),
    grossMargin: record.grossMargin.toString(),
    marginPercent: record.marginPercent.toString(),
    revision: record.revision,
    lines: record.lines.map((line) => ({
      id: line.id,
      quoteLineId: line.quoteLineId,
      productId: line.productId,
      variantId: line.variantId,
      subscriptionPlanId: line.subscriptionPlanId,
      position: line.position,
      productCode: line.productCode,
      productName: line.productName,
      productType: line.product.type,
      sku: line.sku,
      unit: line.unit,
      quantity: line.quantity.toString(),
      billingType: line.billingType,
      unitPrice: line.unitPrice.toString(),
      unitCost: line.unitCost.toString(),
      discountPercent: line.discountPercent.toString(),
      discountAmount: line.discountAmount.toString(),
      taxAmount: line.taxAmount.toString(),
      subtotal: line.subtotal.toString(),
      total: line.total.toString(),
      costTotal: line.costTotal.toString(),
    })),
  });
}

export function mapFulfillmentPlan(
  record: FulfillmentPlanRecord,
): FulfillmentPlanDto {
  const recommendationSnapshot = toJsonValue(record.recommendationSnapshot);
  const parsedConfidence =
    typeof recommendationSnapshot === "object" &&
    recommendationSnapshot !== null &&
    !Array.isArray(recommendationSnapshot)
      ? PromiseDateConfidenceDtoSchema.safeParse(
          Reflect.get(recommendationSnapshot, "promiseDateConfidence"),
        )
      : null;
  const promiseDateConfidence =
    parsedConfidence?.success === true
      ? parsedConfidence.data
      : PromiseDateConfidenceDtoSchema.parse({
          level: "UNAVAILABLE",
          score: 0,
          estimatedPromiseAt: null,
          splitShipmentCount: record.shipmentCount,
          projectedUnfulfilledQuantity: record.unfulfilledQuantity.toString(),
          inventoryInputs: [],
          reasonCodes: ["LEGACY_SNAPSHOT_UNAVAILABLE"],
          explanation: [
            "This saved plan predates the promise-date confidence snapshot and must be previewed again for an explanation.",
          ],
        });
  return FulfillmentPlanDtoSchema.parse({
    id: record.id,
    orderId: record.orderId,
    revision: record.revision,
    status: record.status,
    source: record.source,
    allocations: record.allocations.map((allocation) => ({
      id: allocation.id,
      orderLineId: allocation.orderLineId,
      warehouseId: allocation.warehouseId,
      warehouseName: allocation.warehouse.name,
      quantity: allocation.quantity.toString(),
      availableAtPreview: allocation.availableAtPreview.toString(),
      estimatedCost: allocation.estimatedCost.toString(),
      estimatedDate: allocation.estimatedDate?.toISOString() ?? null,
    })),
    unfulfilledQuantity: record.unfulfilledQuantity.toString(),
    shipmentCount: record.shipmentCount,
    estimatedShippingCost: record.estimatedShippingCost.toString(),
    estimatedPromiseAt: record.estimatedPromiseAt?.toISOString() ?? null,
    promiseDateConfidence,
    overrideReason: record.overrideReason,
    availabilitySnapshot: JsonObjectSchema.parse(
      toJsonValue(record.availabilitySnapshot),
    ),
    expiresAt: record.expiresAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  });
}

export function mapShipment(record: ShipmentRecord): ShipmentDto {
  return ShipmentDtoSchema.parse({
    id: record.id,
    shipmentNumber: record.shipmentNumber,
    orderId: record.orderId,
    warehouseId: record.warehouseId,
    warehouseName: record.warehouse.name,
    status: record.status,
    promisedDate: record.promisedDate?.toISOString() ?? null,
    actualDate: record.actualDate?.toISOString() ?? null,
    trackingNumber: record.trackingNumber,
    estimatedShippingCost: record.estimatedShippingCost.toString(),
    items: record.items.map((item) => ({
      orderLineId: item.orderLineId,
      productName: item.orderLine.productName,
      quantity: item.quantity.toString(),
    })),
    createdAt: record.createdAt.toISOString(),
  });
}

export function mapBackorder(
  record: BackorderRecord,
  availability: {
    availableQuantity: Prisma.Decimal | string;
    consolidationEligible: boolean;
    consolidationReason: string | null;
  } = {
    availableQuantity: "0",
    consolidationEligible: false,
    consolidationReason: null,
  },
): BackorderDto {
  return BackorderDtoSchema.parse({
    id: record.id,
    orderId: record.orderId,
    orderLineId: record.orderLineId,
    productName: record.orderLine.productName,
    remainingQuantity: record.remainingQuantity.toString(),
    status: record.status,
    availableQuantity: availability.availableQuantity.toString(),
    consolidationEligible: availability.consolidationEligible,
    consolidationReason: availability.consolidationReason,
    expectedAt: record.expectedAt?.toISOString() ?? null,
    fulfilledAt: record.fulfilledAt?.toISOString() ?? null,
    consolidatedIntoId: record.consolidatedIntoId,
    createdAt: record.createdAt.toISOString(),
  });
}

export function mapReservation(
  record: Prisma.StockReservationGetPayload<object>,
): StockReservationDto {
  return StockReservationDtoSchema.parse({
    id: record.id,
    orderLineId: record.orderLineId,
    warehouseId: record.warehouseId,
    quantity: record.quantity.toString(),
    status: record.status,
    reservedAt: record.reservedAt.toISOString(),
  });
}

export function mapInventoryBalance(
  record: InventoryBalanceRecord,
): InventoryBalanceDto {
  const stockAgeDays =
    record.stockedSince === null
      ? null
      : Math.max(
          0,
          Math.floor(
            (Date.now() - record.stockedSince.getTime()) /
              (24 * 60 * 60 * 1000),
          ),
        );
  return InventoryBalanceDtoSchema.parse({
    id: record.id,
    warehouseId: record.warehouseId,
    warehouseName: record.warehouse.name,
    productId: record.productId,
    productName: record.product.name,
    variantId: record.variantId,
    sku: record.variant?.sku ?? null,
    onHand: record.onHand.toString(),
    reserved: record.reserved.toString(),
    available: record.available.toString(),
    incoming: record.incoming.toString(),
    incomingExpectedAt: record.incomingExpectedAt?.toISOString() ?? null,
    stockedSince: record.stockedSince?.toISOString() ?? null,
    stockAgeDays,
    revision: record.revision,
    updatedAt: record.updatedAt.toISOString(),
  });
}

export function mapStockMovement(
  record: Prisma.StockMovementGetPayload<object>,
): StockMovementDto {
  return StockMovementDtoSchema.parse({
    id: record.id,
    warehouseId: record.warehouseId,
    productId: record.productId,
    variantId: record.variantId,
    type: record.type,
    quantity: record.quantity.toString(),
    reference: record.reference,
    reason: record.reason,
    onHandAfter: record.onHandAfter.toString(),
    reservedAfter: record.reservedAfter.toString(),
    occurredAt: record.occurredAt.toISOString(),
  });
}
