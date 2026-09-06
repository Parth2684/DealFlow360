import type {
  ApplyCreditNoteRequest,
  RecordPaymentRequest,
  SubscriptionCancelRequest,
  SubscriptionChangeRequest,
} from "@repo/common";
import { Prisma } from "@repo/db";

import {
  jsonInput,
  recordActivity,
  type TransactionClient,
} from "../../shared/activity.js";
import { conflict, notFound } from "../../shared/errors.js";
import type { InternalPrincipal } from "../../shared/types.js";
import {
  mapCreditNote,
  mapInvoice,
  mapPayment,
  mapSubscriptionChange,
} from "./mappers.js";
import {
  calculateCancellation,
  calculateSubscriptionChange,
  type ProrationCalculation,
  type SubscriptionForProration,
} from "./proration.js";
import { billingDateFromInstant, billingDateHasStarted } from "./periods.js";

const ZERO = new Prisma.Decimal(0);

function entityNumber(prefix: string, id: string): string {
  return `${prefix}-${id.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

function subscriptionInclude() {
  return {
    customerAccount: true,
    subscriptionPlan: true,
    items: { orderBy: { id: "asc" as const } },
  };
}

async function createProrationDocument(
  transaction: TransactionClient,
  subscription: SubscriptionForProration,
  calculation: ProrationCalculation,
  changeId: string,
  reason: string | undefined,
): Promise<{ invoiceId?: string; creditNoteId?: string }> {
  if (
    calculation.dto.direction === "NONE" ||
    calculation.roundedAmount.isZero()
  ) {
    return {};
  }
  const snapshot = jsonInput({
    changeId,
    changeType: calculation.type,
    effectiveAt: calculation.effectiveAt,
    periodStart: subscription.currentPeriodStart,
    periodEnd: subscription.currentPeriodEnd,
    remainingBillableDays: calculation.dto.remainingBillableDays,
    totalDays: calculation.dto.totalDays,
    convention: calculation.dto.convention,
    timezone: subscription.timezone,
    unroundedAmount: calculation.unroundedAmount.toString(),
    roundedAmount: calculation.roundedAmount.toString(),
    direction: calculation.dto.direction,
  });
  if (calculation.dto.direction === "DEBIT") {
    const invoiceId = crypto.randomUUID();
    await transaction.invoice.create({
      data: {
        id: invoiceId,
        organizationId: subscription.organizationId,
        customerAccountId: subscription.customerAccountId,
        orderId: subscription.orderId,
        subscriptionId: subscription.id,
        invoiceNumber: entityNumber("INV", invoiceId),
        type: "PRORATION",
        status: "DRAFT",
        currency: subscription.currency,
        billingPeriodStart: subscription.currentPeriodStart,
        billingPeriodEnd: subscription.currentPeriodEnd,
        subtotal: calculation.roundedAmount,
        discountAmount: ZERO,
        taxAmount: ZERO,
        total: calculation.roundedAmount,
        amountPaid: ZERO,
        balanceDue: calculation.roundedAmount,
        calculationSnapshot: snapshot,
        dueDate: billingDateFromInstant(new Date(), subscription.timezone),
        lines: {
          create: {
            organizationId: subscription.organizationId,
            subscriptionItemId: calculation.itemId,
            subscriptionChangeId: changeId,
            position: 1,
            description: "Prorated subscription change",
            unit: "adjustment",
            billingType: "RECURRING",
            quantity: new Prisma.Decimal(1),
            unitPrice: calculation.roundedAmount,
            discountAmount: ZERO,
            subtotal: calculation.roundedAmount,
            taxSnapshot: jsonInput({}),
            taxAmount: ZERO,
            total: calculation.roundedAmount,
            billingPeriodStart: subscription.currentPeriodStart,
            billingPeriodEnd: subscription.currentPeriodEnd,
            prorationSnapshot: snapshot,
          },
        },
      },
    });
    return { invoiceId };
  }

  const sourceInvoice = await transaction.invoice.findFirst({
    where: {
      organizationId: subscription.organizationId,
      customerAccountId: subscription.customerAccountId,
      status: { not: "VOID" },
      subscriptionId: subscription.id,
    },
    include: { lines: { orderBy: { position: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  if (sourceInvoice === null) {
    if (calculation.type === "CANCELLATION") {
      // Recurring schedules are generated in arrears. If no prior recurring
      // invoice exists, the final schedule is reduced to the used portion
      // instead of attaching a subscription credit to an unrelated invoice.
      return {};
    }
    conflict(
      "A credit requires an existing invoice for this subscription",
      "CREDIT_SOURCE_INVOICE_REQUIRED",
    );
  }
  const creditNoteId = crypto.randomUUID();
  await transaction.creditNote.create({
    data: {
      id: creditNoteId,
      organizationId: subscription.organizationId,
      sourceInvoiceId: sourceInvoice.id,
      subscriptionChangeId: changeId,
      creditNoteNumber: entityNumber("CRN", creditNoteId),
      status: "ISSUED",
      currency: subscription.currency,
      subtotal: calculation.roundedAmount,
      taxAmount: ZERO,
      total: calculation.roundedAmount,
      reason,
      issuedAt: new Date(),
      lines: {
        create: {
          organizationId: subscription.organizationId,
          sourceInvoiceLineId: sourceInvoice.lines[0]?.id,
          subscriptionChangeId: changeId,
          position: 1,
          description: "Prorated subscription credit",
          quantity: new Prisma.Decimal(1),
          unitAmount: calculation.roundedAmount,
          taxAmount: ZERO,
          total: calculation.roundedAmount,
        },
      },
    },
  });
  return { creditNoteId };
}

export async function applySubscriptionChange(
  transaction: TransactionClient,
  organizationId: string,
  subscriptionId: string,
  input: SubscriptionChangeRequest,
  actor: InternalPrincipal,
) {
  const subscription = await transaction.subscription.findFirst({
    where: { id: subscriptionId, organizationId },
    include: subscriptionInclude(),
  });
  if (subscription === null) notFound("Subscription");
  if (
    input.revision !== undefined &&
    input.revision !== subscription.revision
  ) {
    conflict(
      "The subscription changed after this request was prepared",
      "STALE_REVISION",
    );
  }
  const nextPlan =
    input.planId === undefined
      ? null
      : await transaction.subscriptionPlan.findFirst({
          where: { id: input.planId, organizationId, status: "ACTIVE" },
        });
  const calculation = calculateSubscriptionChange(
    subscription as SubscriptionForProration,
    input,
    nextPlan,
  );
  const effectiveBillingDate = billingDateFromInstant(
    calculation.effectiveAt,
    subscription.timezone,
  );
  if (
    !billingDateHasStarted(
      effectiveBillingDate,
      new Date(),
      subscription.timezone,
    )
  ) {
    conflict(
      "A subscription change can be previewed for a future date, but it must be applied on or after that local billing date",
      "FUTURE_SUBSCRIPTION_CHANGE",
    );
  }
  const changeId = crypto.randomUUID();
  const change = await transaction.subscriptionChange.create({
    data: {
      id: changeId,
      organizationId,
      subscriptionId,
      subscriptionItemId: calculation.itemId,
      actorId: actor.userId,
      type: calculation.type,
      status: "APPLIED",
      effectiveAt: calculation.effectiveAt,
      reason: input.reason,
      oldQuantity: calculation.oldQuantity,
      newQuantity: calculation.newQuantity,
      oldPlanSnapshot: calculation.oldPlanSnapshot ?? undefined,
      newPlanSnapshot: calculation.newPlanSnapshot ?? undefined,
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      timezone: subscription.timezone,
      remainingBillableDays: calculation.dto.remainingBillableDays,
      totalDays: calculation.dto.totalDays,
      prorationConvention: calculation.dto.convention,
      unroundedAmount: calculation.unroundedAmount,
      roundedAmount: calculation.roundedAmount,
      direction: calculation.dto.direction,
      calculationSnapshot: jsonInput({
        explanation: calculation.dto.explanation,
        currency: subscription.currency,
      }),
    },
    include: { subscription: true },
  });
  if (calculation.itemId !== null && calculation.newQuantity !== null) {
    await transaction.subscriptionItem.update({
      where: { id: calculation.itemId },
      data: { quantity: calculation.newQuantity },
    });
  }
  if (nextPlan !== null) {
    await transaction.subscriptionItem.updateMany({
      where: { organizationId, subscriptionId, activeTo: null },
      data: { subscriptionPlanId: nextPlan.id },
    });
  }
  const updated = await transaction.subscription.updateMany({
    where: {
      id: subscriptionId,
      organizationId,
      revision: subscription.revision,
    },
    data: {
      ...(nextPlan === null
        ? {}
        : {
            subscriptionPlanId: nextPlan.id,
            planSnapshot: calculation.newPlanSnapshot ?? jsonInput({}),
          }),
      status: "ACTIVE",
      revision: { increment: 1 },
    },
  });
  if (updated.count !== 1) {
    conflict(
      "The subscription changed while the update was being applied",
      "STALE_REVISION",
    );
  }
  const document = await createProrationDocument(
    transaction,
    subscription as SubscriptionForProration,
    calculation,
    changeId,
    input.reason,
  );
  await recordActivity(transaction, {
    organizationId,
    actor,
    eventType: "subscription.changed",
    entityType: "SubscriptionChange",
    entityId: changeId,
    entityVersion: subscription.revision + 1,
    quoteId: undefined,
    reason: input.reason,
    title: "Subscription changed",
    metadata: { subscriptionId, ...document, proration: calculation.dto },
  });
  return mapSubscriptionChange(change);
}

export async function cancelSubscription(
  transaction: TransactionClient,
  organizationId: string,
  subscriptionId: string,
  input: SubscriptionCancelRequest,
  actor: InternalPrincipal,
) {
  const subscription = await transaction.subscription.findFirst({
    where: { id: subscriptionId, organizationId },
    include: subscriptionInclude(),
  });
  if (subscription === null) notFound("Subscription");
  if (
    input.revision !== undefined &&
    input.revision !== subscription.revision
  ) {
    conflict(
      "The subscription changed after this request was prepared",
      "STALE_REVISION",
    );
  }
  const calculation = calculateCancellation(
    subscription as SubscriptionForProration,
    input,
  );
  const changeId = crypto.randomUUID();
  const change = await transaction.subscriptionChange.create({
    data: {
      id: changeId,
      organizationId,
      subscriptionId,
      actorId: actor.userId,
      type: "CANCELLATION",
      status: "APPLIED",
      effectiveAt: calculation.effectiveAt,
      reason: input.reason,
      oldPlanSnapshot: calculation.oldPlanSnapshot ?? undefined,
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      timezone: subscription.timezone,
      remainingBillableDays: calculation.dto.remainingBillableDays,
      totalDays: calculation.dto.totalDays,
      prorationConvention: calculation.dto.convention,
      unroundedAmount: calculation.unroundedAmount,
      roundedAmount: calculation.roundedAmount,
      direction: calculation.dto.direction,
      calculationSnapshot: jsonInput({
        explanation: calculation.dto.explanation,
        currency: subscription.currency,
      }),
    },
    include: { subscription: true },
  });
  const now = new Date();
  const immediate = billingDateHasStarted(
    billingDateFromInstant(calculation.effectiveAt, subscription.timezone),
    now,
    subscription.timezone,
  );
  const updated = await transaction.subscription.updateMany({
    where: {
      id: subscriptionId,
      organizationId,
      revision: subscription.revision,
    },
    data: {
      status: immediate ? "CANCELLED" : "CANCELLATION_SCHEDULED",
      cancelAt: calculation.effectiveAt,
      cancelledAt: immediate ? calculation.effectiveAt : null,
      cancellationReason: input.reason,
      revision: { increment: 1 },
    },
  });
  if (updated.count !== 1) {
    conflict(
      "The subscription changed while cancellation was being applied",
      "STALE_REVISION",
    );
  }
  if (immediate) {
    await transaction.subscriptionItem.updateMany({
      where: { organizationId, subscriptionId, activeTo: null },
      data: { activeTo: calculation.effectiveAt },
    });
  }
  const document = immediate
    ? await createProrationDocument(
        transaction,
        subscription as SubscriptionForProration,
        calculation,
        changeId,
        input.reason,
      )
    : {};
  await recordActivity(transaction, {
    organizationId,
    actor,
    eventType: "subscription.changed",
    entityType: "SubscriptionChange",
    entityId: changeId,
    entityVersion: subscription.revision + 1,
    reason: input.reason,
    title: immediate
      ? "Subscription cancelled"
      : "Subscription cancellation scheduled",
    metadata: {
      subscriptionId,
      effectiveAt: calculation.effectiveAt,
      ...document,
    },
  });
  return mapSubscriptionChange(change);
}

export async function issueInvoice(
  transaction: TransactionClient,
  organizationId: string,
  invoiceId: string,
  revision: number | undefined,
  actor: InternalPrincipal,
) {
  const invoice = await transaction.invoice.findFirst({
    where: { id: invoiceId, organizationId },
    include: {
      customerAccount: true,
      order: true,
      lines: { orderBy: { position: "asc" } },
    },
  });
  if (invoice === null) notFound("Invoice");
  if (revision !== undefined && revision !== invoice.revision) {
    conflict(
      "The invoice changed after this request was prepared",
      "STALE_REVISION",
    );
  }
  if (invoice.status !== "DRAFT") {
    if (
      ["ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE"].includes(invoice.status)
    ) {
      return mapInvoice(invoice);
    }
    conflict("Only a draft invoice can be issued", "INVALID_INVOICE_STATE");
  }
  const now = new Date();
  const updated = await transaction.invoice.updateMany({
    where: {
      id: invoiceId,
      organizationId,
      revision: invoice.revision,
      status: "DRAFT",
    },
    data: { status: "ISSUED", issuedAt: now, revision: { increment: 1 } },
  });
  if (updated.count !== 1) {
    conflict("The invoice changed while it was being issued", "STALE_REVISION");
  }
  await transaction.customerAccount.update({
    where: { id: invoice.customerAccountId },
    data: {
      currentExposure: { increment: invoice.balanceDue },
      revision: { increment: 1 },
    },
  });
  await recordActivity(transaction, {
    organizationId,
    actor,
    eventType: "deal.activityRecorded",
    entityType: "Invoice",
    entityId: invoiceId,
    entityVersion: invoice.revision + 1,
    quoteId: invoice.order?.quoteId,
    title: "Invoice issued",
    metadata: {
      dueDate: invoice.dueDate,
      balanceDue: invoice.balanceDue.toString(),
    },
  });
  const result = await transaction.invoice.findUnique({
    where: { id: invoiceId },
    include: { customerAccount: true, lines: { orderBy: { position: "asc" } } },
  });
  if (result === null) notFound("Invoice");
  return mapInvoice(result);
}

export async function recordPayment(
  transaction: TransactionClient,
  organizationId: string,
  invoiceId: string,
  input: RecordPaymentRequest,
  actor: InternalPrincipal,
) {
  const invoice = await transaction.invoice.findFirst({
    where: { id: invoiceId, organizationId },
    include: { customerAccount: true, order: true },
  });
  if (invoice === null) notFound("Invoice");
  if (!["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status)) {
    conflict(
      "Payments can only be recorded against an outstanding issued invoice",
      "INVALID_INVOICE_STATE",
    );
  }
  const amount = new Prisma.Decimal(input.amount);
  if (amount.greaterThan(invoice.balanceDue)) {
    conflict(
      "The payment exceeds the invoice balance",
      "PAYMENT_EXCEEDS_BALANCE",
    );
  }
  const nextPaid = invoice.amountPaid.plus(amount);
  const nextBalance = invoice.balanceDue.minus(amount);
  const updated = await transaction.invoice.updateMany({
    where: {
      id: invoiceId,
      organizationId,
      revision: invoice.revision,
      balanceDue: { gte: amount },
      status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
    },
    data: {
      amountPaid: nextPaid,
      balanceDue: nextBalance,
      status: nextBalance.isZero()
        ? "PAID"
        : invoice.status === "OVERDUE"
          ? "OVERDUE"
          : "PARTIALLY_PAID",
      paidAt: nextBalance.isZero() ? new Date(input.paymentDate) : null,
      revision: { increment: 1 },
    },
  });
  if (updated.count !== 1) {
    conflict(
      "The invoice changed while the payment was being recorded",
      "INVOICE_PAYMENT_CONFLICT",
    );
  }
  const nextExposure = Prisma.Decimal.max(
    ZERO,
    invoice.customerAccount.currentExposure.minus(amount),
  );
  const nextOverdueBalance =
    invoice.status === "OVERDUE"
      ? Prisma.Decimal.max(
          ZERO,
          invoice.customerAccount.overdueBalance.minus(amount),
        )
      : invoice.customerAccount.overdueBalance;
  const customerUpdated = await transaction.customerAccount.updateMany({
    where: {
      id: invoice.customerAccountId,
      organizationId,
      revision: invoice.customerAccount.revision,
    },
    data: {
      currentExposure: nextExposure,
      overdueBalance: nextOverdueBalance,
      revision: { increment: 1 },
    },
  });
  if (customerUpdated.count !== 1) {
    conflict(
      "Customer exposure changed while the payment was being recorded",
      "CUSTOMER_EXPOSURE_CONFLICT",
    );
  }
  const payment = await transaction.payment.create({
    data: {
      organizationId,
      invoiceId,
      recordedById: actor.userId,
      amount,
      currency: invoice.currency,
      method: input.method,
      reference: input.reference,
      status: "RECORDED",
      paymentDate: new Date(input.paymentDate),
    },
    include: { recordedBy: true },
  });
  await recordActivity(transaction, {
    organizationId,
    actor,
    eventType: "payment.recorded",
    entityType: "Payment",
    entityId: payment.id,
    quoteId: invoice.order?.quoteId,
    title: "Payment recorded",
    metadata: {
      invoiceId,
      amount: amount.toString(),
      balanceDue: nextBalance.toString(),
    },
  });
  return mapPayment(payment);
}

export async function applyCreditNote(
  transaction: TransactionClient,
  organizationId: string,
  creditNoteId: string,
  input: ApplyCreditNoteRequest,
  actor: InternalPrincipal,
) {
  const credit = await transaction.creditNote.findFirst({
    where: { id: creditNoteId, organizationId },
    include: {
      sourceInvoice: { include: { customerAccount: true } },
      lines: { orderBy: { position: "asc" } },
    },
  });
  if (credit === null) notFound("Credit note");
  if (
    credit.status === "APPLIED" &&
    credit.appliedInvoiceId === input.invoiceId
  ) {
    return mapCreditNote(credit);
  }
  if (credit.status !== "ISSUED") {
    conflict(
      "Only an issued credit note can be applied",
      "INVALID_CREDIT_NOTE_STATE",
    );
  }
  const invoice = await transaction.invoice.findFirst({
    where: { id: input.invoiceId, organizationId },
    include: { customerAccount: true, order: true },
  });
  if (invoice === null) notFound("Invoice");
  if (
    invoice.customerAccountId !== credit.sourceInvoice.customerAccountId ||
    invoice.currency !== credit.currency
  ) {
    conflict(
      "A credit note can only be applied to the same customer and currency",
      "CREDIT_NOTE_TARGET_MISMATCH",
    );
  }
  if (!["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status)) {
    conflict(
      "A credit note requires an outstanding issued invoice",
      "INVALID_INVOICE_STATE",
    );
  }
  if (credit.total.greaterThan(invoice.balanceDue)) {
    conflict(
      "The credit note exceeds the invoice balance",
      "CREDIT_EXCEEDS_BALANCE",
    );
  }
  const nextBalance = invoice.balanceDue.minus(credit.total);
  const updatedInvoice = await transaction.invoice.updateMany({
    where: {
      id: invoice.id,
      organizationId,
      revision: invoice.revision,
      balanceDue: { gte: credit.total },
    },
    data: {
      balanceDue: nextBalance,
      status: nextBalance.isZero()
        ? "PAID"
        : invoice.status === "OVERDUE"
          ? "OVERDUE"
          : "PARTIALLY_PAID",
      paidAt: nextBalance.isZero() ? new Date() : null,
      revision: { increment: 1 },
    },
  });
  if (updatedInvoice.count !== 1) {
    conflict(
      "The invoice changed while the credit was being applied",
      "INVOICE_CREDIT_CONFLICT",
    );
  }
  const nextExposure = Prisma.Decimal.max(
    ZERO,
    invoice.customerAccount.currentExposure.minus(credit.total),
  );
  const nextOverdueBalance =
    invoice.status === "OVERDUE"
      ? Prisma.Decimal.max(
          ZERO,
          invoice.customerAccount.overdueBalance.minus(credit.total),
        )
      : invoice.customerAccount.overdueBalance;
  const customerUpdated = await transaction.customerAccount.updateMany({
    where: {
      id: invoice.customerAccountId,
      organizationId,
      revision: invoice.customerAccount.revision,
    },
    data: {
      currentExposure: nextExposure,
      overdueBalance: nextOverdueBalance,
      revision: { increment: 1 },
    },
  });
  if (customerUpdated.count !== 1) {
    conflict(
      "Customer exposure changed while the credit was being applied",
      "CUSTOMER_EXPOSURE_CONFLICT",
    );
  }
  const updatedCredit = await transaction.creditNote.updateMany({
    where: {
      id: credit.id,
      organizationId,
      status: "ISSUED",
      appliedInvoiceId: null,
    },
    data: {
      status: "APPLIED",
      appliedInvoiceId: invoice.id,
      appliedAt: new Date(),
    },
  });
  if (updatedCredit.count !== 1) {
    conflict(
      "The credit note was applied by another request",
      "CREDIT_NOTE_CONFLICT",
    );
  }
  await recordActivity(transaction, {
    organizationId,
    actor,
    eventType: "deal.activityRecorded",
    entityType: "CreditNote",
    entityId: credit.id,
    quoteId: invoice.order?.quoteId,
    title: "Credit note applied",
    metadata: { invoiceId: invoice.id, amount: credit.total.toString() },
  });
  const result = await transaction.creditNote.findUnique({
    where: { id: credit.id },
    include: { lines: { orderBy: { position: "asc" } } },
  });
  if (result === null) notFound("Credit note");
  return mapCreditNote(result);
}
