import { z } from "zod";

import {
  BillingScheduleStatusSchema,
  BillingTypeSchema,
  CreditNoteStatusSchema,
  InvoiceStatusSchema,
  InvoiceTypeSchema,
  PaymentMethodSchema,
  PaymentStatusSchema,
  ProrationConventionSchema,
  ProrationDirectionSchema,
  SubscriptionChangeStatusSchema,
  SubscriptionChangeTypeSchema,
  SubscriptionStatusSchema,
} from "./enums.js";
import {
  CurrencyCodeSchema,
  DecimalStringSchema,
  IdSchema,
  IsoDateSchema,
  IsoDateTimeSchema,
  JsonObjectSchema,
  NonNegativeDecimalStringSchema,
  PositiveDecimalStringSchema,
  RevisionSchema,
} from "./primitives.js";

export const SubscriptionItemDtoSchema = z.object({
  id: IdSchema,
  orderLineId: IdSchema,
  productId: IdSchema,
  productName: z.string().min(1),
  sku: z.string().nullable(),
  unit: z.string().min(1),
  quantity: PositiveDecimalStringSchema,
  unitPrice: NonNegativeDecimalStringSchema,
  activeFrom: IsoDateTimeSchema,
  activeTo: IsoDateTimeSchema.nullable(),
});
export type SubscriptionItemDto = z.infer<typeof SubscriptionItemDtoSchema>;

export const SubscriptionSummaryDtoSchema = z.object({
  id: IdSchema,
  subscriptionNumber: z.string().min(1),
  orderId: IdSchema,
  customerAccountId: IdSchema,
  customerName: z.string().min(1),
  subscriptionPlanId: IdSchema,
  planName: z.string().min(1),
  status: SubscriptionStatusSchema,
  currency: CurrencyCodeSchema,
  startedAt: IsoDateTimeSchema,
  currentPeriodStart: IsoDateSchema,
  currentPeriodEnd: IsoDateSchema,
  nextBillingAt: IsoDateTimeSchema.nullable(),
  revision: RevisionSchema,
});
export type SubscriptionSummaryDto = z.infer<
  typeof SubscriptionSummaryDtoSchema
>;

export const SubscriptionDtoSchema = SubscriptionSummaryDtoSchema.extend({
  timezone: z.string().min(1),
  planSnapshot: JsonObjectSchema,
  billingAnchorDay: z.number().int().min(1).max(31).nullable(),
  cancelAt: IsoDateTimeSchema.nullable(),
  cancelledAt: IsoDateTimeSchema.nullable(),
  cancellationReason: z.string().nullable(),
  items: z.array(SubscriptionItemDtoSchema),
});
export type SubscriptionDto = z.infer<typeof SubscriptionDtoSchema>;

export const SubscriptionChangeRequestSchema = z
  .object({
    revision: RevisionSchema.optional(),
    quantity: PositiveDecimalStringSchema.optional(),
    planId: IdSchema.optional(),
    effectiveDate: IsoDateTimeSchema.optional(),
    reason: z.string().trim().max(1000).optional(),
  })
  .strict()
  .refine(
    (value) => value.quantity !== undefined || value.planId !== undefined,
    {
      message: "A quantity or plan change is required",
      path: ["quantity"],
    },
  );
export type SubscriptionChangeRequest = z.infer<
  typeof SubscriptionChangeRequestSchema
>;

export const SubscriptionCancelRequestSchema = z
  .object({
    revision: RevisionSchema.optional(),
    effectiveDate: IsoDateTimeSchema,
    reason: z.string().trim().min(1).max(1000),
  })
  .strict();
export type SubscriptionCancelRequest = z.infer<
  typeof SubscriptionCancelRequestSchema
>;

export const SubscriptionCancellationPreviewRequestSchema = z
  .object({
    revision: RevisionSchema.optional(),
    effectiveDate: IsoDateTimeSchema,
  })
  .strict();
export type SubscriptionCancellationPreviewRequest = z.infer<
  typeof SubscriptionCancellationPreviewRequestSchema
>;

export const ProrationPreviewDtoSchema = z.object({
  subscriptionId: IdSchema,
  changeType: SubscriptionChangeTypeSchema,
  effectiveAt: IsoDateTimeSchema,
  periodStart: IsoDateSchema,
  periodEnd: IsoDateSchema,
  remainingBillableDays: z.number().int().nonnegative(),
  totalDays: z.number().int().positive(),
  convention: ProrationConventionSchema,
  unroundedAmount: DecimalStringSchema,
  roundedAmount: DecimalStringSchema,
  direction: ProrationDirectionSchema,
  currency: CurrencyCodeSchema,
  explanation: z.array(z.string().min(1)),
});
export type ProrationPreviewDto = z.infer<typeof ProrationPreviewDtoSchema>;

export const SubscriptionChangeDtoSchema = ProrationPreviewDtoSchema.extend({
  id: IdSchema,
  status: SubscriptionChangeStatusSchema,
  reason: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
});
export type SubscriptionChangeDto = z.infer<typeof SubscriptionChangeDtoSchema>;

export const BillingScheduleDtoSchema = z.object({
  id: IdSchema,
  subscriptionId: IdSchema,
  invoiceId: IdSchema.nullable(),
  periodStart: IsoDateSchema,
  periodEnd: IsoDateSchema,
  dueDate: IsoDateSchema,
  amount: NonNegativeDecimalStringSchema,
  currency: CurrencyCodeSchema,
  generationStatus: BillingScheduleStatusSchema,
  generatedAt: IsoDateTimeSchema.nullable(),
});
export type BillingScheduleDto = z.infer<typeof BillingScheduleDtoSchema>;

export const InvoiceLineDtoSchema = z.object({
  id: IdSchema,
  position: z.number().int().positive(),
  description: z.string().min(1),
  sku: z.string().nullable(),
  unit: z.string().min(1),
  billingType: BillingTypeSchema,
  quantity: PositiveDecimalStringSchema,
  unitPrice: NonNegativeDecimalStringSchema,
  discountAmount: NonNegativeDecimalStringSchema,
  subtotal: NonNegativeDecimalStringSchema,
  taxAmount: NonNegativeDecimalStringSchema,
  total: DecimalStringSchema,
  billingPeriodStart: IsoDateSchema.nullable(),
  billingPeriodEnd: IsoDateSchema.nullable(),
  prorationSnapshot: JsonObjectSchema.nullable(),
});
export type InvoiceLineDto = z.infer<typeof InvoiceLineDtoSchema>;

export const InvoiceSummaryDtoSchema = z.object({
  id: IdSchema,
  invoiceNumber: z.string().min(1),
  customerAccountId: IdSchema,
  customerName: z.string().min(1),
  orderId: IdSchema.nullable(),
  subscriptionId: IdSchema.nullable(),
  type: InvoiceTypeSchema,
  status: InvoiceStatusSchema,
  currency: CurrencyCodeSchema,
  total: DecimalStringSchema,
  amountPaid: NonNegativeDecimalStringSchema,
  balanceDue: DecimalStringSchema,
  dueDate: IsoDateSchema,
  issuedAt: IsoDateTimeSchema.nullable(),
  paidAt: IsoDateTimeSchema.nullable(),
  revision: RevisionSchema,
});
export type InvoiceSummaryDto = z.infer<typeof InvoiceSummaryDtoSchema>;

export const InvoiceDtoSchema = InvoiceSummaryDtoSchema.extend({
  billingPeriodStart: IsoDateSchema.nullable(),
  billingPeriodEnd: IsoDateSchema.nullable(),
  subtotal: NonNegativeDecimalStringSchema,
  discountAmount: NonNegativeDecimalStringSchema,
  taxAmount: NonNegativeDecimalStringSchema,
  calculationSnapshot: JsonObjectSchema,
  lines: z.array(InvoiceLineDtoSchema),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type InvoiceDto = z.infer<typeof InvoiceDtoSchema>;

export const IssueInvoiceRequestSchema = z
  .object({ revision: RevisionSchema.optional() })
  .strict();
export type IssueInvoiceRequest = z.infer<typeof IssueInvoiceRequestSchema>;

export const PaymentDtoSchema = z.object({
  id: IdSchema,
  invoiceId: IdSchema,
  recordedById: IdSchema,
  recordedByName: z.string().min(1),
  amount: PositiveDecimalStringSchema,
  currency: CurrencyCodeSchema,
  method: PaymentMethodSchema,
  reference: z.string().nullable(),
  status: PaymentStatusSchema,
  paymentDate: IsoDateTimeSchema,
  createdAt: IsoDateTimeSchema,
});
export type PaymentDto = z.infer<typeof PaymentDtoSchema>;

export const RecordPaymentRequestSchema = z
  .object({
    amount: PositiveDecimalStringSchema,
    method: PaymentMethodSchema,
    reference: z.string().trim().max(160).optional(),
    paymentDate: IsoDateTimeSchema,
  })
  .strict();
export type RecordPaymentRequest = z.infer<typeof RecordPaymentRequestSchema>;

export const CreditNoteLineDtoSchema = z.object({
  id: IdSchema,
  position: z.number().int().positive(),
  description: z.string().min(1),
  quantity: PositiveDecimalStringSchema,
  unitAmount: DecimalStringSchema,
  taxAmount: DecimalStringSchema,
  total: DecimalStringSchema,
});
export type CreditNoteLineDto = z.infer<typeof CreditNoteLineDtoSchema>;

export const CreditNoteDtoSchema = z.object({
  id: IdSchema,
  creditNoteNumber: z.string().min(1),
  sourceInvoiceId: IdSchema,
  appliedInvoiceId: IdSchema.nullable(),
  status: CreditNoteStatusSchema,
  currency: CurrencyCodeSchema,
  subtotal: DecimalStringSchema,
  taxAmount: DecimalStringSchema,
  total: DecimalStringSchema,
  reason: z.string().nullable(),
  issuedAt: IsoDateTimeSchema.nullable(),
  appliedAt: IsoDateTimeSchema.nullable(),
  lines: z.array(CreditNoteLineDtoSchema),
  createdAt: IsoDateTimeSchema,
});
export type CreditNoteDto = z.infer<typeof CreditNoteDtoSchema>;

export const ApplyCreditNoteRequestSchema = z
  .object({ invoiceId: IdSchema })
  .strict();
export type ApplyCreditNoteRequest = z.infer<
  typeof ApplyCreditNoteRequestSchema
>;

export const OrderBillingDtoSchema = z.object({
  orderId: IdSchema,
  oneTimeInvoices: z.array(InvoiceSummaryDtoSchema),
  subscriptions: z.array(SubscriptionSummaryDtoSchema),
  upcomingSchedules: z.array(BillingScheduleDtoSchema),
  totalOneTime: NonNegativeDecimalStringSchema,
  recurringAmount: NonNegativeDecimalStringSchema,
  currency: CurrencyCodeSchema,
});
export type OrderBillingDto = z.infer<typeof OrderBillingDtoSchema>;
