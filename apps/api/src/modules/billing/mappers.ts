import {
  BillingScheduleDtoSchema,
  CreditNoteDtoSchema,
  InvoiceDtoSchema,
  InvoiceSummaryDtoSchema,
  JsonObjectSchema,
  PaymentDtoSchema,
  SubscriptionChangeDtoSchema,
  SubscriptionDtoSchema,
  SubscriptionSummaryDtoSchema,
  type BillingScheduleDto,
  type CreditNoteDto,
  type InvoiceDto,
  type InvoiceSummaryDto,
  type PaymentDto,
  type SubscriptionChangeDto,
  type SubscriptionDto,
  type SubscriptionSummaryDto,
} from "@repo/common";
import type { Prisma } from "@repo/db";

import { toJsonValue } from "../../shared/http.js";

export type SubscriptionRecord = Prisma.SubscriptionGetPayload<{
  include: {
    customerAccount: true;
    subscriptionPlan: true;
    items: { orderBy: { id: "asc" } };
  };
}>;

export type InvoiceRecord = Prisma.InvoiceGetPayload<{
  include: {
    customerAccount: true;
    lines: { orderBy: { position: "asc" } };
  };
}>;

export type PaymentRecord = Prisma.PaymentGetPayload<{
  include: { recordedBy: true };
}>;

export type CreditNoteRecord = Prisma.CreditNoteGetPayload<{
  include: { lines: { orderBy: { position: "asc" } } };
}>;

function jsonObject(value: unknown) {
  return JsonObjectSchema.parse(toJsonValue(value));
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function mapSubscriptionSummary(
  record: Prisma.SubscriptionGetPayload<{
    include: { customerAccount: true; subscriptionPlan: true };
  }>,
): SubscriptionSummaryDto {
  return SubscriptionSummaryDtoSchema.parse({
    id: record.id,
    subscriptionNumber: record.subscriptionNumber,
    orderId: record.orderId,
    customerAccountId: record.customerAccountId,
    customerName: record.customerAccount.name,
    subscriptionPlanId: record.subscriptionPlanId,
    planName: record.subscriptionPlan.name,
    status: record.status,
    currency: record.currency,
    startedAt: record.startedAt.toISOString(),
    currentPeriodStart: isoDate(record.currentPeriodStart),
    currentPeriodEnd: isoDate(record.currentPeriodEnd),
    nextBillingAt: record.nextBillingAt?.toISOString() ?? null,
    revision: record.revision,
  });
}

export function mapSubscription(record: SubscriptionRecord): SubscriptionDto {
  return SubscriptionDtoSchema.parse({
    ...mapSubscriptionSummary(record),
    timezone: record.timezone,
    planSnapshot: jsonObject(record.planSnapshot),
    billingAnchorDay: record.billingAnchorDay,
    cancelAt: record.cancelAt?.toISOString() ?? null,
    cancelledAt: record.cancelledAt?.toISOString() ?? null,
    cancellationReason: record.cancellationReason,
    items: record.items.map((item) => ({
      id: item.id,
      orderLineId: item.orderLineId,
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      unit: item.unit,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
      activeFrom: item.activeFrom.toISOString(),
      activeTo: item.activeTo?.toISOString() ?? null,
    })),
  });
}

export function mapBillingSchedule(
  record: Prisma.BillingScheduleGetPayload<object>,
): BillingScheduleDto {
  return BillingScheduleDtoSchema.parse({
    id: record.id,
    subscriptionId: record.subscriptionId,
    invoiceId: record.invoiceId,
    periodStart: isoDate(record.periodStart),
    periodEnd: isoDate(record.periodEnd),
    dueDate: isoDate(record.dueDate),
    amount: record.amount.toString(),
    currency: record.currency,
    generationStatus: record.generationStatus,
    generatedAt: record.generatedAt?.toISOString() ?? null,
  });
}

export function mapInvoiceSummary(
  record: Prisma.InvoiceGetPayload<{ include: { customerAccount: true } }>,
): InvoiceSummaryDto {
  return InvoiceSummaryDtoSchema.parse({
    id: record.id,
    invoiceNumber: record.invoiceNumber,
    customerAccountId: record.customerAccountId,
    customerName: record.customerAccount.name,
    orderId: record.orderId,
    subscriptionId: record.subscriptionId,
    type: record.type,
    status: record.status,
    currency: record.currency,
    total: record.total.toString(),
    amountPaid: record.amountPaid.toString(),
    balanceDue: record.balanceDue.toString(),
    dueDate: isoDate(record.dueDate),
    issuedAt: record.issuedAt?.toISOString() ?? null,
    paidAt: record.paidAt?.toISOString() ?? null,
    revision: record.revision,
  });
}

export function mapInvoice(record: InvoiceRecord): InvoiceDto {
  return InvoiceDtoSchema.parse({
    ...mapInvoiceSummary(record),
    billingPeriodStart:
      record.billingPeriodStart === null
        ? null
        : isoDate(record.billingPeriodStart),
    billingPeriodEnd:
      record.billingPeriodEnd === null
        ? null
        : isoDate(record.billingPeriodEnd),
    subtotal: record.subtotal.toString(),
    discountAmount: record.discountAmount.toString(),
    taxAmount: record.taxAmount.toString(),
    calculationSnapshot: jsonObject(record.calculationSnapshot),
    lines: record.lines.map((line) => ({
      id: line.id,
      position: line.position,
      description: line.description,
      sku: line.sku,
      unit: line.unit,
      billingType: line.billingType,
      quantity: line.quantity.toString(),
      unitPrice: line.unitPrice.toString(),
      discountAmount: line.discountAmount.toString(),
      subtotal: line.subtotal.toString(),
      taxAmount: line.taxAmount.toString(),
      total: line.total.toString(),
      billingPeriodStart:
        line.billingPeriodStart === null
          ? null
          : isoDate(line.billingPeriodStart),
      billingPeriodEnd:
        line.billingPeriodEnd === null ? null : isoDate(line.billingPeriodEnd),
      prorationSnapshot:
        line.prorationSnapshot === null
          ? null
          : jsonObject(line.prorationSnapshot),
    })),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

export function mapPayment(record: PaymentRecord): PaymentDto {
  return PaymentDtoSchema.parse({
    id: record.id,
    invoiceId: record.invoiceId,
    recordedById: record.recordedById,
    recordedByName: `${record.recordedBy.firstName} ${record.recordedBy.lastName}`,
    amount: record.amount.toString(),
    currency: record.currency,
    method: record.method,
    reference: record.reference,
    status: record.status,
    paymentDate: record.paymentDate.toISOString(),
    createdAt: record.createdAt.toISOString(),
  });
}

export function mapCreditNote(record: CreditNoteRecord): CreditNoteDto {
  return CreditNoteDtoSchema.parse({
    id: record.id,
    creditNoteNumber: record.creditNoteNumber,
    sourceInvoiceId: record.sourceInvoiceId,
    appliedInvoiceId: record.appliedInvoiceId,
    status: record.status,
    currency: record.currency,
    subtotal: record.subtotal.toString(),
    taxAmount: record.taxAmount.toString(),
    total: record.total.toString(),
    reason: record.reason,
    issuedAt: record.issuedAt?.toISOString() ?? null,
    appliedAt: record.appliedAt?.toISOString() ?? null,
    lines: record.lines.map((line) => ({
      id: line.id,
      position: line.position,
      description: line.description,
      quantity: line.quantity.toString(),
      unitAmount: line.unitAmount.toString(),
      taxAmount: line.taxAmount.toString(),
      total: line.total.toString(),
    })),
    createdAt: record.createdAt.toISOString(),
  });
}

export function mapSubscriptionChange(
  record: Prisma.SubscriptionChangeGetPayload<{
    include: { subscription: true };
  }>,
): SubscriptionChangeDto {
  return SubscriptionChangeDtoSchema.parse({
    id: record.id,
    subscriptionId: record.subscriptionId,
    changeType: record.type,
    effectiveAt: record.effectiveAt.toISOString(),
    periodStart: isoDate(record.periodStart),
    periodEnd: isoDate(record.periodEnd),
    remainingBillableDays: record.remainingBillableDays,
    totalDays: record.totalDays,
    convention: record.prorationConvention,
    unroundedAmount: record.unroundedAmount.toString(),
    roundedAmount: record.roundedAmount.toString(),
    direction: record.direction,
    currency: record.subscription.currency,
    explanation: [
      `Proration uses ${record.prorationConvention === "CALENDAR_DAYS" ? "calendar days" : "a 30-day month"}.`,
      `${record.remainingBillableDays} of ${record.totalDays} billable days remain in the current period.`,
      record.direction === "NONE"
        ? "This change does not create a prorated debit or credit."
        : `The rounded ${record.direction.toLowerCase()} amount is ${record.roundedAmount.toString()} ${record.subscription.currency}.`,
    ],
    status: record.status,
    reason: record.reason,
    createdAt: record.createdAt.toISOString(),
  });
}
