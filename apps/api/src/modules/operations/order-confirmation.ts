import { Prisma } from "@repo/db";

import {
  recordActivity,
  jsonInput,
  type TransactionClient,
} from "../../shared/activity.js";
import { conflict, notFound } from "../../shared/errors.js";
import type { InternalPrincipal } from "../../shared/types.js";
import {
  addBillingDays,
  addBillingInterval,
  billingDateFromInstant,
  startOfBillingDateInstant,
} from "../billing/periods.js";
import { assertSalesObjectVisible } from "./access.js";
import { mapOrder } from "./mappers.js";

const ZERO = new Prisma.Decimal(0);

function entityNumber(prefix: string, id: string): string {
  return `${prefix}-${id.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

function sum(values: readonly Prisma.Decimal[]): Prisma.Decimal {
  return values.reduce((total, value) => total.plus(value), ZERO);
}

export interface ConfirmOrderResult {
  status: 200 | 201;
  order: ReturnType<typeof mapOrder>;
}

export async function confirmOrderFromQuote(
  transaction: TransactionClient,
  organizationId: string,
  quoteId: string,
  revision: number,
  actor: InternalPrincipal,
): Promise<ConfirmOrderResult> {
  const quote = await transaction.quote.findFirst({
    where: { id: quoteId, organizationId },
    include: {
      organization: true,
      customerAccount: true,
      currentVersion: {
        include: {
          lines: {
            include: { subscriptionPlan: true },
            orderBy: { lineNumber: "asc" },
          },
          approvalRequests: { orderBy: { requestedAt: "desc" } },
          customerAcceptances: { orderBy: { acceptedAt: "desc" } },
        },
      },
    },
  });
  if (quote === null) notFound("Quote");
  assertSalesObjectVisible(actor, {
    ownerId: quote.ownerId,
    salesTeamId: quote.salesTeamId,
  });
  if (quote.revision !== revision) {
    conflict(
      "The quote changed after this confirmation request was prepared",
      "STALE_REVISION",
    );
  }
  const version = quote.currentVersion;
  if (version === null || quote.currentVersionId !== version.id) {
    conflict(
      "The quote has no current immutable version to confirm",
      "QUOTE_VERSION_MISSING",
    );
  }
  if (
    quote.stage !== "CUSTOMER_ACCEPTED" ||
    version.status !== "CUSTOMER_ACCEPTED"
  ) {
    conflict(
      "Only a customer-accepted quote can be confirmed",
      "QUOTE_NOT_ACCEPTED",
    );
  }
  const acceptance = version.customerAcceptances.find(
    (item) => item.acceptedFingerprint === version.termsFingerprint,
  );
  if (acceptance === undefined) {
    conflict(
      "The current quote fingerprint has not been accepted by the customer",
      "ACCEPTANCE_FINGERPRINT_MISMATCH",
    );
  }
  const requestsForVersion = version.approvalRequests.filter(
    (request) => request.status !== "SUPERSEDED",
  );
  if (
    requestsForVersion.length > 0 &&
    !requestsForVersion.some(
      (request) =>
        request.status === "APPROVED" &&
        request.termsFingerprint === version.termsFingerprint,
    )
  ) {
    conflict(
      "The accepted quote fingerprint has not completed its required approvals",
      "APPROVAL_FINGERPRINT_MISMATCH",
    );
  }

  const existing = await transaction.order.findFirst({
    where: { organizationId, quoteVersionId: version.id },
    include: {
      lines: {
        include: { product: true },
        orderBy: { position: "asc" },
      },
    },
  });
  if (existing !== null) return { status: 200, order: mapOrder(existing) };

  const now = new Date();
  const confirmationBillingDate = billingDateFromInstant(
    now,
    quote.organization.timezone,
  );
  const orderId = crypto.randomUUID();
  const hardwareLines = version.lines.filter(
    (line) => line.productType === "HARDWARE",
  );
  const orderLineIds = new Map(
    version.lines.map((line) => [line.id, crypto.randomUUID()]),
  );
  const orderLineIdFor = (quoteLineId: string): string => {
    const orderLineId = orderLineIds.get(quoteLineId);
    if (orderLineId === undefined) {
      throw new Error(
        "An order-line identifier was not prepared for the quote line",
      );
    }
    return orderLineId;
  };
  await transaction.order.create({
    data: {
      id: orderId,
      organizationId,
      quoteId: quote.id,
      quoteVersionId: version.id,
      customerAccountId: quote.customerAccountId,
      ownerId: quote.ownerId,
      confirmedById: actor.userId,
      orderNumber: entityNumber("ORD", orderId),
      status: hardwareLines.length > 0 ? "ALLOCATION_PENDING" : "CONFIRMED",
      termsFingerprint: version.termsFingerprint,
      customerName: quote.customerAccount.name,
      currency: version.currency,
      timezone: quote.organization.timezone,
      paymentTermsDays: version.paymentTermsDays,
      subtotal: version.subtotal,
      discountTotal: version.lineDiscountTotal.plus(version.orderDiscountTotal),
      taxTotal: version.taxTotal,
      total: version.total,
      costTotal: version.costTotal,
      grossMargin: version.grossMargin,
      marginPercent: version.marginPercent,
      confirmedAt: now,
      lines: {
        create: version.lines.map((line) => ({
          id: orderLineIdFor(line.id),
          organizationId,
          quoteLineId: line.id,
          productId: line.productId,
          variantId: line.variantId,
          subscriptionPlanId: line.subscriptionPlanId,
          position: line.lineNumber,
          productCode: line.productCode,
          productName: line.productName,
          productDescription: line.productDescription,
          sku: line.sku,
          unit: line.unit,
          quantity: line.quantity,
          billingType: line.billingType,
          subscriptionSnapshot: line.subscriptionSnapshot ?? undefined,
          unitPrice: line.unitPrice,
          unitCost: line.unitCost,
          discountPercent: line.discountPercent,
          discountAmount: line.lineDiscountAmount.plus(
            line.allocatedOrderDiscount,
          ),
          taxCode: line.taxCode,
          taxRate: line.taxRate,
          taxBehavior: line.taxBehavior,
          subtotal: line.preTaxSubtotal,
          taxAmount: line.taxAmount,
          total: line.total,
          costTotal: line.costTotal,
        })),
      },
    },
  });

  const oneTimeLines = version.lines.filter(
    (line) => line.billingType === "ONE_TIME",
  );
  let invoiceId: string | undefined;
  if (oneTimeLines.length > 0) {
    invoiceId = crypto.randomUUID();
    const subtotal = sum(
      oneTimeLines.map((line) => line.unitPrice.mul(line.quantity)),
    );
    const discount = sum(
      oneTimeLines.map((line) =>
        line.lineDiscountAmount.plus(line.allocatedOrderDiscount),
      ),
    );
    const tax = sum(oneTimeLines.map((line) => line.taxAmount));
    const total = sum(oneTimeLines.map((line) => line.total));
    await transaction.invoice.create({
      data: {
        id: invoiceId,
        organizationId,
        customerAccountId: quote.customerAccountId,
        orderId,
        invoiceNumber: entityNumber("INV", invoiceId),
        type: "ONE_TIME",
        status: "DRAFT",
        currency: version.currency,
        subtotal,
        discountAmount: discount,
        taxAmount: tax,
        total,
        amountPaid: ZERO,
        balanceDue: total,
        calculationSnapshot: jsonInput({
          quoteVersionId: version.id,
          termsFingerprint: version.termsFingerprint,
          source: "confirmed-order-one-time-lines",
          billingTimezone: quote.organization.timezone,
          confirmationBillingDate,
        }),
        dueDate: addBillingDays(
          confirmationBillingDate,
          version.paymentTermsDays,
        ),
        lines: {
          create: oneTimeLines.map((line, index) => ({
            organizationId,
            orderLineId: orderLineIdFor(line.id),
            position: index + 1,
            description: line.productName,
            sku: line.sku,
            unit: line.unit,
            billingType: "ONE_TIME",
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountAmount: line.lineDiscountAmount.plus(
              line.allocatedOrderDiscount,
            ),
            subtotal: line.unitPrice.mul(line.quantity),
            taxSnapshot: jsonInput({
              code: line.taxCode,
              rate: line.taxRate.toString(),
              behavior: line.taxBehavior,
            }),
            taxAmount: line.taxAmount,
            total: line.total,
          })),
        },
      },
    });
  }

  const recurringByPlan = new Map<string, typeof version.lines>();
  for (const line of version.lines.filter(
    (item) => item.billingType === "RECURRING",
  )) {
    if (line.subscriptionPlanId === null || line.subscriptionPlan === null) {
      conflict(
        "Every recurring line must reference an active subscription plan",
        "SUBSCRIPTION_PLAN_REQUIRED",
      );
    }
    const group = recurringByPlan.get(line.subscriptionPlanId) ?? [];
    group.push(line);
    recurringByPlan.set(line.subscriptionPlanId, group);
  }
  const periodStart = confirmationBillingDate;
  for (const [planId, lines] of recurringByPlan) {
    const plan = lines[0]?.subscriptionPlan;
    if (plan === null || plan === undefined || plan.status !== "ACTIVE") {
      conflict(
        "A recurring line references an unavailable subscription plan",
        "SUBSCRIPTION_PLAN_UNAVAILABLE",
      );
    }
    const subscriptionId = crypto.randomUUID();
    const periodEnd = addBillingInterval(
      periodStart,
      plan.interval,
      plan.intervalCount,
    );
    const amount = sum(lines.map((line) => line.total));
    const planSnapshot = {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      interval: plan.interval,
      intervalCount: plan.intervalCount,
      prorationConvention: plan.prorationConvention,
      cancellationRules: plan.cancellationRules,
      refundRules: plan.refundRules,
    };
    await transaction.subscription.create({
      data: {
        id: subscriptionId,
        organizationId,
        orderId,
        customerAccountId: quote.customerAccountId,
        subscriptionPlanId: planId,
        subscriptionNumber: entityNumber("SUB", subscriptionId),
        status: "ACTIVE",
        currency: version.currency,
        timezone: quote.organization.timezone,
        planSnapshot: jsonInput(planSnapshot),
        startedAt: now,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        nextBillingAt: startOfBillingDateInstant(
          periodEnd,
          quote.organization.timezone,
        ),
        billingAnchorDay: periodStart.getUTCDate(),
        items: {
          create: lines.map((line) => ({
            organizationId,
            orderLineId: orderLineIdFor(line.id),
            productId: line.productId,
            variantId: line.variantId,
            subscriptionPlanId: planId,
            sku: line.sku,
            productName: line.productName,
            unit: line.unit,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            taxSnapshot: jsonInput({
              code: line.taxCode,
              rate: line.taxRate.toString(),
              behavior: line.taxBehavior,
              discountAmount: line.lineDiscountAmount
                .plus(line.allocatedOrderDiscount)
                .toString(),
              subtotal: line.preTaxSubtotal.toString(),
              taxAmount: line.taxAmount.toString(),
              total: line.total.toString(),
            }),
            activeFrom: now,
          })),
        },
        billingSchedules: {
          create: {
            organizationId,
            periodStart,
            periodEnd,
            dueDate: addBillingDays(periodEnd, version.paymentTermsDays),
            amount,
            currency: version.currency,
            generationStatus: "PENDING",
            calculationSnapshot: jsonInput({
              source: "confirmed-order-recurring-lines",
              plan: planSnapshot,
              termsFingerprint: version.termsFingerprint,
              billingTimezone: quote.organization.timezone,
              lines: lines.map((line) => ({
                quoteLineId: line.id,
                orderLineId: orderLineIdFor(line.id),
                quantity: line.quantity.toString(),
                unitPrice: line.unitPrice.toString(),
                total: line.total.toString(),
              })),
            }),
          },
        },
      },
    });
    await recordActivity(transaction, {
      organizationId,
      actor,
      eventType: "subscription.started",
      entityType: "Subscription",
      entityId: subscriptionId,
      entityVersion: 1,
      quoteId: quote.id,
      title: "Recurring billing started",
      metadata: { orderId, planId, periodStart, periodEnd },
    });
  }

  const quoteUpdated = await transaction.quote.updateMany({
    where: {
      id: quote.id,
      organizationId,
      revision,
      stage: "CUSTOMER_ACCEPTED",
      currentVersionId: version.id,
    },
    data: { stage: "CONFIRMED", revision: { increment: 1 } },
  });
  if (quoteUpdated.count !== 1) {
    conflict(
      "The quote changed while it was being confirmed",
      "STALE_REVISION",
    );
  }
  await recordActivity(transaction, {
    organizationId,
    actor,
    eventType: "order.confirmed",
    entityType: "Order",
    entityId: orderId,
    entityVersion: 1,
    termsFingerprint: version.termsFingerprint,
    quoteId: quote.id,
    title: "Order confirmed",
    metadata: {
      quoteVersionId: version.id,
      acceptanceId: acceptance.id,
      invoiceId,
      recurringPlanCount: recurringByPlan.size,
    },
  });
  if (invoiceId !== undefined) {
    await recordActivity(transaction, {
      organizationId,
      actor,
      eventType: "invoice.created",
      entityType: "Invoice",
      entityId: invoiceId,
      entityVersion: 1,
      quoteId: quote.id,
      title: "One-time invoice created",
      metadata: { orderId },
    });
  }

  const created = await transaction.order.findUnique({
    where: { id: orderId },
    include: {
      lines: {
        include: { product: true },
        orderBy: { position: "asc" },
      },
    },
  });
  if (created === null) notFound("Order");
  return { status: 201, order: mapOrder(created) };
}
