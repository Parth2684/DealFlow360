import { z } from "zod";

import {
  BackorderStatusSchema,
  BillingTypeSchema,
  ConfigurationStatusSchema,
  FulfillmentPlanSourceSchema,
  FulfillmentPlanStatusSchema,
  OrderStatusSchema,
  ProductTypeSchema,
  ShipmentStatusSchema,
  StockMovementTypeSchema,
  StockReservationStatusSchema,
} from "./enums.js";
import {
  CurrencyCodeSchema,
  DecimalStringSchema,
  decimalStringToScaledInteger,
  IdSchema,
  IsoDateTimeSchema,
  JsonObjectSchema,
  NonNegativeDecimalStringSchema,
  PositiveDecimalStringSchema,
  RevisionSchema,
  TermsFingerprintSchema,
} from "./primitives.js";

export const WarehouseDtoSchema = z.object({
  id: IdSchema,
  code: z.string().min(1),
  name: z.string().min(1),
  address: JsonObjectSchema,
  shippingCostWeight: NonNegativeDecimalStringSchema,
  leadTimeDays: z.number().int().nonnegative(),
  status: ConfigurationStatusSchema,
  revision: RevisionSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type WarehouseDto = z.infer<typeof WarehouseDtoSchema>;

export const CreateWarehouseRequestSchema = z
  .object({
    code: z.string().trim().min(1).max(40).optional(),
    name: z.string().trim().min(1).max(120),
    address: z.union([JsonObjectSchema, z.string().trim().min(1)]),
    leadTimeDays: z.number().int().nonnegative().default(1),
    shippingCostWeight: NonNegativeDecimalStringSchema.default("1"),
  })
  .strict();
export type CreateWarehouseRequest = z.infer<
  typeof CreateWarehouseRequestSchema
>;

export const UpdateWarehouseRequestSchema = z
  .object({
    revision: RevisionSchema,
    name: z.string().trim().min(1).max(120).optional(),
    address: z.union([JsonObjectSchema, z.string().trim().min(1)]).optional(),
    leadTimeDays: z.number().int().nonnegative().optional(),
    shippingCostWeight: NonNegativeDecimalStringSchema.optional(),
    active: z.boolean().optional(),
    status: ConfigurationStatusSchema.optional(),
  })
  .strict();
export type UpdateWarehouseRequest = z.infer<
  typeof UpdateWarehouseRequestSchema
>;

export const InventoryBalanceDtoSchema = z.object({
  id: IdSchema,
  warehouseId: IdSchema,
  warehouseName: z.string().min(1),
  productId: IdSchema,
  productName: z.string().min(1),
  variantId: IdSchema.nullable(),
  sku: z.string().nullable(),
  onHand: NonNegativeDecimalStringSchema,
  reserved: NonNegativeDecimalStringSchema,
  available: NonNegativeDecimalStringSchema,
  incoming: NonNegativeDecimalStringSchema,
  incomingExpectedAt: IsoDateTimeSchema.nullable(),
  stockedSince: IsoDateTimeSchema.nullable(),
  stockAgeDays: z.number().int().nonnegative().nullable(),
  revision: RevisionSchema,
  updatedAt: IsoDateTimeSchema,
});
export type InventoryBalanceDto = z.infer<typeof InventoryBalanceDtoSchema>;

export const InventoryAdjustmentRequestSchema = z
  .object({
    productId: IdSchema,
    variantId: IdSchema.optional(),
    quantity: DecimalStringSchema.refine(
      (value) =>
        DecimalStringSchema.safeParse(value).success &&
        decimalStringToScaledInteger(value) !== 0n,
      { message: "Adjustment quantity cannot be zero" },
    ),
    reason: z.string().trim().min(1).max(1000),
    revision: RevisionSchema.optional(),
  })
  .strict();
export type InventoryAdjustmentRequest = z.infer<
  typeof InventoryAdjustmentRequestSchema
>;

export const SetIncomingStockRequestSchema = z
  .object({
    productId: IdSchema,
    variantId: IdSchema.optional(),
    incomingQuantity: NonNegativeDecimalStringSchema,
    expectedAt: IsoDateTimeSchema.nullable().optional(),
    revision: RevisionSchema.optional(),
    reason: z.string().trim().min(1).max(1000),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      !NonNegativeDecimalStringSchema.safeParse(value.incomingQuantity).success
    )
      return;
    const hasIncoming =
      decimalStringToScaledInteger(value.incomingQuantity) > 0n;
    if (
      hasIncoming &&
      (value.expectedAt === undefined || value.expectedAt === null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["expectedAt"],
        message: "An expected arrival is required for incoming stock",
      });
    }
    if (
      !hasIncoming &&
      value.expectedAt !== undefined &&
      value.expectedAt !== null
    ) {
      context.addIssue({
        code: "custom",
        path: ["expectedAt"],
        message: "An empty incoming quantity cannot retain an arrival date",
      });
    }
  });
export type SetIncomingStockRequest = z.infer<
  typeof SetIncomingStockRequestSchema
>;

export const StockReceiptItemSchema = z
  .object({
    productId: IdSchema,
    variantId: IdSchema.optional(),
    quantity: PositiveDecimalStringSchema,
  })
  .strict();
export type StockReceiptItem = z.infer<typeof StockReceiptItemSchema>;

export const StockReceiptRequestSchema = z
  .object({
    warehouseId: IdSchema,
    items: z.array(StockReceiptItemSchema).min(1),
    reference: z.string().trim().min(1).max(120),
  })
  .strict();
export type StockReceiptRequest = z.infer<typeof StockReceiptRequestSchema>;

export const StockMovementDtoSchema = z.object({
  id: IdSchema,
  warehouseId: IdSchema,
  productId: IdSchema,
  variantId: IdSchema.nullable(),
  type: StockMovementTypeSchema,
  quantity: DecimalStringSchema,
  reference: z.string().nullable(),
  reason: z.string().nullable(),
  onHandAfter: NonNegativeDecimalStringSchema,
  reservedAfter: NonNegativeDecimalStringSchema,
  occurredAt: IsoDateTimeSchema,
});
export type StockMovementDto = z.infer<typeof StockMovementDtoSchema>;

export const InventoryAdjustmentResultDtoSchema = z.object({
  balance: InventoryBalanceDtoSchema,
  movement: StockMovementDtoSchema,
});
export type InventoryAdjustmentResultDto = z.infer<
  typeof InventoryAdjustmentResultDtoSchema
>;

export const StockReceiptResultDtoSchema = z.object({
  warehouseId: IdSchema,
  reference: z.string().min(1),
  balances: z.array(InventoryBalanceDtoSchema).min(1),
  movements: z.array(StockMovementDtoSchema).min(1),
});
export type StockReceiptResultDto = z.infer<typeof StockReceiptResultDtoSchema>;

export const OrderLineDtoSchema = z.object({
  id: IdSchema,
  quoteLineId: IdSchema,
  productId: IdSchema,
  variantId: IdSchema.nullable(),
  subscriptionPlanId: IdSchema.nullable(),
  position: z.number().int().positive(),
  productCode: z.string().min(1),
  productName: z.string().min(1),
  productType: ProductTypeSchema,
  sku: z.string().nullable(),
  unit: z.string().min(1),
  quantity: PositiveDecimalStringSchema,
  billingType: BillingTypeSchema,
  unitPrice: NonNegativeDecimalStringSchema,
  unitCost: NonNegativeDecimalStringSchema,
  discountPercent: NonNegativeDecimalStringSchema,
  discountAmount: NonNegativeDecimalStringSchema,
  taxAmount: NonNegativeDecimalStringSchema,
  subtotal: NonNegativeDecimalStringSchema,
  total: NonNegativeDecimalStringSchema,
  costTotal: NonNegativeDecimalStringSchema,
});
export type OrderLineDto = z.infer<typeof OrderLineDtoSchema>;

export const OrderSummaryDtoSchema = z.object({
  id: IdSchema,
  orderNumber: z.string().min(1),
  quoteId: IdSchema,
  quoteVersionId: IdSchema,
  customerAccountId: IdSchema,
  customerName: z.string().min(1),
  ownerId: IdSchema,
  status: OrderStatusSchema,
  currency: CurrencyCodeSchema,
  total: NonNegativeDecimalStringSchema,
  termsFingerprint: TermsFingerprintSchema,
  confirmedAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type OrderSummaryDto = z.infer<typeof OrderSummaryDtoSchema>;

export const OrderDtoSchema = OrderSummaryDtoSchema.extend({
  paymentTermsDays: z.number().int().nonnegative(),
  subtotal: NonNegativeDecimalStringSchema,
  discountTotal: NonNegativeDecimalStringSchema,
  taxTotal: NonNegativeDecimalStringSchema,
  costTotal: NonNegativeDecimalStringSchema,
  grossMargin: DecimalStringSchema,
  marginPercent: DecimalStringSchema,
  revision: RevisionSchema,
  lines: z.array(OrderLineDtoSchema),
});
export type OrderDto = z.infer<typeof OrderDtoSchema>;

export const ConfirmOrderRequestSchema = z
  .object({ revision: RevisionSchema })
  .strict();
export type ConfirmOrderRequest = z.infer<typeof ConfirmOrderRequestSchema>;

export const FulfillmentAllocationDtoSchema = z.object({
  id: IdSchema.optional(),
  orderLineId: IdSchema,
  warehouseId: IdSchema,
  warehouseName: z.string().min(1),
  quantity: PositiveDecimalStringSchema,
  availableAtPreview: NonNegativeDecimalStringSchema,
  estimatedCost: NonNegativeDecimalStringSchema,
  estimatedDate: IsoDateTimeSchema.nullable(),
});
export type FulfillmentAllocationDto = z.infer<
  typeof FulfillmentAllocationDtoSchema
>;

export const PromiseDateInventoryInputDtoSchema = z.object({
  orderLineId: IdSchema,
  warehouseId: IdSchema,
  currentAvailable: NonNegativeDecimalStringSchema,
  existingReserved: NonNegativeDecimalStringSchema,
  incomingQuantity: NonNegativeDecimalStringSchema,
  incomingExpectedAt: IsoDateTimeSchema.nullable(),
  leadTimeDays: z.number().int().nonnegative(),
});
export type PromiseDateInventoryInputDto = z.infer<
  typeof PromiseDateInventoryInputDtoSchema
>;

export const PromiseDateConfidenceDtoSchema = z.object({
  level: z.enum(["HIGH", "MEDIUM", "LOW", "UNAVAILABLE"]),
  score: z.number().int().min(0).max(100),
  estimatedPromiseAt: IsoDateTimeSchema.nullable(),
  splitShipmentCount: z.number().int().nonnegative(),
  projectedUnfulfilledQuantity: NonNegativeDecimalStringSchema,
  inventoryInputs: z.array(PromiseDateInventoryInputDtoSchema),
  reasonCodes: z.array(z.string().min(1)),
  explanation: z.array(z.string().min(1)),
});
export type PromiseDateConfidenceDto = z.infer<
  typeof PromiseDateConfidenceDtoSchema
>;

export const FulfillmentPlanDtoSchema = z.object({
  id: IdSchema,
  orderId: IdSchema,
  revision: RevisionSchema,
  status: FulfillmentPlanStatusSchema,
  source: FulfillmentPlanSourceSchema,
  allocations: z.array(FulfillmentAllocationDtoSchema),
  unfulfilledQuantity: NonNegativeDecimalStringSchema,
  shipmentCount: z.number().int().nonnegative(),
  estimatedShippingCost: NonNegativeDecimalStringSchema,
  estimatedPromiseAt: IsoDateTimeSchema.nullable(),
  promiseDateConfidence: PromiseDateConfidenceDtoSchema,
  overrideReason: z.string().nullable(),
  availabilitySnapshot: JsonObjectSchema,
  expiresAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
});
export type FulfillmentPlanDto = z.infer<typeof FulfillmentPlanDtoSchema>;

export const FulfillmentPreviewRequestSchema = z
  .object({ orderRevision: RevisionSchema.optional() })
  .strict();
export type FulfillmentPreviewRequest = z.infer<
  typeof FulfillmentPreviewRequestSchema
>;

export const ReserveFulfillmentRequestSchema = z
  .object({ planId: IdSchema, planRevision: RevisionSchema.optional() })
  .strict();
export type ReserveFulfillmentRequest = z.infer<
  typeof ReserveFulfillmentRequestSchema
>;

export const ManualFulfillmentAllocationRequestSchema = z
  .object({
    warehouseId: IdSchema,
    orderLineId: IdSchema.optional(),
    quoteLineId: IdSchema.optional(),
    quantity: PositiveDecimalStringSchema,
  })
  .strict()
  .refine(
    (value) =>
      value.orderLineId !== undefined || value.quoteLineId !== undefined,
    {
      message: "An orderLineId or OpenAPI-compatible quoteLineId is required",
      path: ["orderLineId"],
    },
  );
export type ManualFulfillmentAllocationRequest = z.infer<
  typeof ManualFulfillmentAllocationRequestSchema
>;

export const OverrideFulfillmentRequestSchema = z
  .object({
    allocations: z.array(ManualFulfillmentAllocationRequestSchema).min(1),
    reason: z.string().trim().min(1).max(1000),
  })
  .strict();
export type OverrideFulfillmentRequest = z.infer<
  typeof OverrideFulfillmentRequestSchema
>;

export const StockReservationDtoSchema = z.object({
  id: IdSchema,
  orderLineId: IdSchema,
  warehouseId: IdSchema,
  quantity: PositiveDecimalStringSchema,
  status: StockReservationStatusSchema,
  reservedAt: IsoDateTimeSchema,
});
export type StockReservationDto = z.infer<typeof StockReservationDtoSchema>;

export const ReservationResultDtoSchema = z.object({
  order: OrderDtoSchema,
  plan: FulfillmentPlanDtoSchema,
  reservations: z.array(StockReservationDtoSchema),
  backorders: z.array(z.lazy(() => BackorderDtoSchema)),
});
export type ReservationResultDto = z.infer<typeof ReservationResultDtoSchema>;

export const ShipmentItemDtoSchema = z.object({
  orderLineId: IdSchema,
  productName: z.string().min(1),
  quantity: PositiveDecimalStringSchema,
});
export type ShipmentItemDto = z.infer<typeof ShipmentItemDtoSchema>;

export const ShipmentDtoSchema = z.object({
  id: IdSchema,
  shipmentNumber: z.string().min(1),
  orderId: IdSchema,
  warehouseId: IdSchema,
  warehouseName: z.string().min(1),
  status: ShipmentStatusSchema,
  promisedDate: IsoDateTimeSchema.nullable(),
  actualDate: IsoDateTimeSchema.nullable(),
  trackingNumber: z.string().nullable(),
  estimatedShippingCost: NonNegativeDecimalStringSchema,
  items: z.array(ShipmentItemDtoSchema),
  createdAt: IsoDateTimeSchema,
});
export type ShipmentDto = z.infer<typeof ShipmentDtoSchema>;

export const ShipShipmentRequestSchema = z
  .object({ trackingNumber: z.string().trim().min(1).max(120) })
  .strict();
export type ShipShipmentRequest = z.infer<typeof ShipShipmentRequestSchema>;

export const BackorderDtoSchema = z.object({
  id: IdSchema,
  orderId: IdSchema,
  orderLineId: IdSchema,
  productName: z.string().min(1),
  remainingQuantity: NonNegativeDecimalStringSchema,
  status: BackorderStatusSchema,
  availableQuantity: NonNegativeDecimalStringSchema,
  consolidationEligible: z.boolean(),
  consolidationReason: z.string().min(1).nullable(),
  expectedAt: IsoDateTimeSchema.nullable(),
  fulfilledAt: IsoDateTimeSchema.nullable(),
  consolidatedIntoId: IdSchema.nullable(),
  createdAt: IsoDateTimeSchema,
});
export type BackorderDto = z.infer<typeof BackorderDtoSchema>;
