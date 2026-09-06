import { BillingIntervalSchema } from "@repo/common";
import { Prisma } from "@repo/db";

import {
  addBillingDays,
  addBillingInterval,
  billingDateFromInstant,
  billingDateHasStarted,
  billingDaysBetween,
  startOfBillingDateInstant,
} from "../../modules/billing/periods.js";
import {
  jsonInput,
  recordActivity,
  type TransactionClient,
} from "../../shared/activity.js";
import {
  calculateCommercialLine,
  sumMoney,
} from "../../shared/commercial-math.js";
import type { ClaimedOutboxEvent } from "../job-events.js";
import { lockWorkerEntity } from "../locks.js";

const ZERO = new Prisma.Decimal(0);

const scheduleInclude = {
  subscription: {
    include: {
      order: { select: { paymentTermsDays: true, quoteId: true } },
      items: {
        include: { orderLine: true },
        orderBy: { id: "asc" as const },
      },
      changes: {
        where: { status: "APPLIED" as const },
        include: { creditNotes: { select: { id: true } } },
        orderBy: [{ effectiveAt: "asc" as const }, { id: "asc" as const }],
      },
    },
  },
} satisfies Prisma.BillingScheduleInclude;

type ScheduleRecord = Prisma.BillingScheduleGetPayload<{
  include: typeof scheduleInclude;
}>;

function jsonObject(
  value: Prisma.JsonValue,
): Record<string, Prisma.JsonValue | undefined> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function planPeriod(snapshot: Prisma.JsonValue): {
  interval: "DAY" | "WEEK" | "MONTH" | "YEAR";
  intervalCount: number;
} {
  const object = jsonObject(snapshot);
  const interval = BillingIntervalSchema.safeParse(object["interval"]);
  const intervalCount = object["intervalCount"];
  if (
    !interval.success ||
    typeof intervalCount !== "number" ||
    !Number.isInteger(intervalCount) ||
    intervalCount < 1
  ) {
    throw new Error(
      "The subscription plan snapshot has no valid billing interval",
    );
  }
  return { interval: interval.data, intervalCount };
}

function entityNumber(prefix: string, id: string): string {
  return `${prefix}-${id.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

function billableItemsForPeriod(
  items: ScheduleRecord["subscription"]["items"],
  periodStart: Date,
  periodEnd: Date,
) {
  return items.filter(
    (item) =>
      item.activeFrom < periodEnd &&
      (item.activeTo === null || item.activeTo > periodStart),
  );
}

function billableItems(schedule: ScheduleRecord) {
  return billableItemsForPeriod(
    schedule.subscription.items,
    schedule.periodStart,
    schedule.periodEnd,
  );
}

function decimalSnapshotValue(
  value: Prisma.JsonValue | undefined,
): Prisma.Decimal | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  try {
    return new Prisma.Decimal(value);
  } catch {
    return null;
  }
}

function immutableLineTerms(
  schedule: ScheduleRecord,
  item: ScheduleRecord["subscription"]["items"][number],
): { quantity: Prisma.Decimal; unitPrice: Prisma.Decimal } {
  const snapshot = jsonObject(schedule.calculationSnapshot);
  const lines = snapshot["lines"];
  if (Array.isArray(lines)) {
    for (const value of lines) {
      const line = jsonObject(value);
      const matches =
        line["subscriptionItemId"] === item.id ||
        line["orderLineId"] === item.orderLineId ||
        line["quoteLineId"] === item.orderLine.quoteLineId;
      if (!matches) continue;
      const quantity = decimalSnapshotValue(line["quantity"]);
      const unitPrice = decimalSnapshotValue(line["unitPrice"]);
      if (
        quantity !== null &&
        quantity.greaterThan(ZERO) &&
        unitPrice !== null &&
        !unitPrice.isNegative()
      ) {
        return { quantity, unitPrice };
      }
    }
  }

  const firstCurrentPeriodChange = schedule.subscription.changes.find(
    (change) =>
      change.subscriptionItemId === item.id &&
      change.oldQuantity !== null &&
      change.newQuantity !== null &&
      billingDateFromInstant(
        change.effectiveAt,
        schedule.subscription.timezone,
      ) >= schedule.periodStart &&
      billingDateFromInstant(
        change.effectiveAt,
        schedule.subscription.timezone,
      ) < schedule.periodEnd,
  );
  return {
    quantity: firstCurrentPeriodChange?.oldQuantity ?? item.quantity,
    unitPrice: item.unitPrice,
  };
}

function calculateInvoiceLine(
  item: ScheduleRecord["subscription"]["items"][number],
  terms: { quantity: Prisma.Decimal; unitPrice: Prisma.Decimal },
  billingFraction = new Prisma.Decimal(1),
) {
  const billedTerms = {
    ...terms,
    unitPrice: terms.unitPrice
      .mul(billingFraction)
      .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP),
  };
  const originalAmount = item.orderLine.unitPrice.mul(item.orderLine.quantity);
  const discountAmount = originalAmount.isZero()
    ? ZERO
    : billedTerms.unitPrice
        .mul(billedTerms.quantity)
        .mul(item.orderLine.discountAmount)
        .div(originalAmount);
  const amounts = calculateCommercialLine({
    unitPrice: billedTerms.unitPrice,
    quantity: billedTerms.quantity,
    discountAmount,
    taxRate: item.orderLine.taxRate,
    taxBehavior: item.orderLine.taxBehavior,
  });
  return { item, terms: billedTerms, amounts };
}

function cancellationBillingFractionForPeriod(
  subscription: ScheduleRecord["subscription"],
  periodStart: Date,
  periodEnd: Date,
  cancellationBillingDate: Date | null,
): Prisma.Decimal {
  if (
    cancellationBillingDate === null ||
    cancellationBillingDate >= periodEnd
  ) {
    return new Prisma.Decimal(1);
  }
  const cancellationChange = subscription.changes.find(
    (change) =>
      change.type === "CANCELLATION" &&
      billingDateFromInstant(
        change.effectiveAt,
        subscription.timezone,
      ).getTime() === cancellationBillingDate.getTime(),
  );
  if (
    cancellationChange?.direction === "CREDIT" &&
    cancellationChange.creditNotes.length > 0
  ) {
    return new Prisma.Decimal(1);
  }
  const actualTotalDays = Math.max(
    1,
    billingDaysBetween(periodStart, periodEnd),
  );
  const actualBilledDays = Math.max(
    0,
    billingDaysBetween(periodStart, cancellationBillingDate),
  );
  const plan = jsonObject(subscription.planSnapshot);
  const convention = plan["prorationConvention"];
  if (convention !== "THIRTY_DAY_MONTH") {
    return new Prisma.Decimal(actualBilledDays).div(actualTotalDays);
  }
  const period = planPeriod(subscription.planSnapshot);
  const configuredDays =
    period.interval === "DAY"
      ? period.intervalCount
      : period.interval === "WEEK"
        ? period.intervalCount * 7
        : period.interval === "YEAR"
          ? period.intervalCount * 360
          : period.intervalCount * 30;
  const actualRemainingDays = Math.max(0, actualTotalDays - actualBilledDays);
  const configuredRemainingDays = Math.min(
    configuredDays,
    Math.max(
      0,
      Math.ceil((actualRemainingDays / actualTotalDays) * configuredDays),
    ),
  );
  return new Prisma.Decimal(configuredDays - configuredRemainingDays).div(
    configuredDays,
  );
}

function cancellationBillingFraction(
  schedule: ScheduleRecord,
  cancellationBillingDate: Date | null,
): Prisma.Decimal {
  return cancellationBillingFractionForPeriod(
    schedule.subscription,
    schedule.periodStart,
    schedule.periodEnd,
    cancellationBillingDate,
  );
}

async function cancelUnusedSchedule(
  transaction: TransactionClient,
  schedule: ScheduleRecord,
  now: Date,
): Promise<void> {
  const cancelled = await transaction.billingSchedule.updateMany({
    where: {
      id: schedule.id,
      organizationId: schedule.organizationId,
      generationStatus: "PENDING",
      invoiceId: null,
    },
    data: { generationStatus: "CANCELLED", generatedAt: now },
  });
  if (cancelled.count !== 1) {
    throw new Error(
      "The billing schedule changed while it was being cancelled",
    );
  }
  if (
    schedule.subscription.status !== "CANCELLED" &&
    schedule.subscription.status !== "EXPIRED"
  ) {
    const subscriptionCancelled = await transaction.subscription.updateMany({
      where: {
        id: schedule.subscriptionId,
        organizationId: schedule.organizationId,
        revision: schedule.subscription.revision,
      },
      data: {
        status: "CANCELLED",
        nextBillingAt: null,
        cancelledAt: schedule.subscription.cancelAt ?? now,
        revision: { increment: 1 },
      },
    });
    if (subscriptionCancelled.count !== 1) {
      throw new Error("The subscription changed while billing was cancelled");
    }
  }
}

export async function generateRecurringInvoice(
  transaction: TransactionClient,
  event: ClaimedOutboxEvent,
): Promise<void> {
  await lockWorkerEntity(
    transaction,
    event.organizationId,
    "billing-schedule",
    event.aggregateId,
  );
  const identity = await transaction.billingSchedule.findFirst({
    where: { id: event.aggregateId, organizationId: event.organizationId },
    select: { subscriptionId: true },
  });
  if (identity === null) return;
  await lockWorkerEntity(
    transaction,
    event.organizationId,
    "subscription-billing",
    identity.subscriptionId,
  );
  const schedule = await transaction.billingSchedule.findFirst({
    where: { id: event.aggregateId, organizationId: event.organizationId },
    include: scheduleInclude,
  });
  if (schedule === null || schedule.generationStatus === "GENERATED") return;
  if (schedule.generationStatus !== "PENDING" || schedule.invoiceId !== null)
    return;

  const now = new Date();
  if (
    !billingDateHasStarted(
      schedule.periodEnd,
      now,
      schedule.subscription.timezone,
    )
  ) {
    throw new Error(
      "The billing schedule was dispatched before its period ended",
    );
  }
  const subscription = schedule.subscription;
  const cancellationBillingDate =
    subscription.cancelAt === null
      ? null
      : billingDateFromInstant(subscription.cancelAt, subscription.timezone);
  const cancelledBeforePeriod =
    subscription.status === "EXPIRED" ||
    (subscription.status === "CANCELLED" && cancellationBillingDate === null) ||
    (cancellationBillingDate !== null &&
      cancellationBillingDate <= schedule.periodStart);
  if (cancelledBeforePeriod) {
    await cancelUnusedSchedule(transaction, schedule, now);
    return;
  }
  const finalCancelledPeriod =
    subscription.status === "CANCELLED" &&
    cancellationBillingDate !== null &&
    cancellationBillingDate > schedule.periodStart;
  if (
    !finalCancelledPeriod &&
    !["ACTIVE", "CHANGE_SCHEDULED", "CANCELLATION_SCHEDULED"].includes(
      subscription.status,
    )
  ) {
    throw new Error(
      `Subscription ${subscription.id} is not billable in ${subscription.status}`,
    );
  }

  const billingFraction = cancellationBillingFraction(
    schedule,
    cancellationBillingDate,
  );
  const lines = billableItems(schedule).map((item) =>
    calculateInvoiceLine(
      item,
      immutableLineTerms(schedule, item),
      billingFraction,
    ),
  );
  if (lines.length === 0) {
    await cancelUnusedSchedule(transaction, schedule, now);
    return;
  }
  const subtotal = sumMoney(
    lines.map(({ amounts }) => amounts.preDiscountAmount),
  );
  const discountAmount = sumMoney(
    lines.map(({ amounts }) => amounts.discountAmount),
  );
  const taxAmount = sumMoney(lines.map(({ amounts }) => amounts.taxAmount));
  const total = sumMoney(lines.map(({ amounts }) => amounts.total));
  const invoiceId = crypto.randomUUID();

  await transaction.invoice.create({
    data: {
      id: invoiceId,
      organizationId: schedule.organizationId,
      customerAccountId: subscription.customerAccountId,
      orderId: subscription.orderId,
      subscriptionId: subscription.id,
      invoiceNumber: entityNumber("INV", invoiceId),
      type: "RECURRING",
      status: "DRAFT",
      currency: schedule.currency,
      billingPeriodStart: schedule.periodStart,
      billingPeriodEnd: schedule.periodEnd,
      subtotal,
      discountAmount,
      taxAmount,
      total,
      amountPaid: ZERO,
      balanceDue: total,
      calculationSnapshot: jsonInput({
        source: "scheduled-recurring-billing",
        billingScheduleId: schedule.id,
        subscriptionRevision: subscription.revision,
        generatedByOutboxEventId: event.id,
        billingTimezone: subscription.timezone,
        cancellationBillingFraction: billingFraction.toString(),
        lines: lines.map(({ item, terms, amounts }) => ({
          subscriptionItemId: item.id,
          quantity: terms.quantity.toString(),
          unitPrice: terms.unitPrice.toString(),
          discountAmount: amounts.discountAmount.toString(),
          netSubtotal: amounts.preTaxSubtotal.toString(),
          taxAmount: amounts.taxAmount.toString(),
          total: amounts.total.toString(),
        })),
      }),
      dueDate: schedule.dueDate,
      lines: {
        create: lines.map(({ item, terms, amounts }, index) => ({
          organizationId: schedule.organizationId,
          subscriptionItemId: item.id,
          position: index + 1,
          description: item.productName,
          sku: item.sku,
          unit: item.unit,
          billingType: "RECURRING" as const,
          quantity: terms.quantity,
          unitPrice: terms.unitPrice,
          discountAmount: amounts.discountAmount,
          subtotal: amounts.preDiscountAmount,
          taxSnapshot: jsonInput(item.taxSnapshot),
          taxAmount: amounts.taxAmount,
          total: amounts.total,
          billingPeriodStart: schedule.periodStart,
          billingPeriodEnd: schedule.periodEnd,
        })),
      },
    },
  });

  const generated = await transaction.billingSchedule.updateMany({
    where: {
      id: schedule.id,
      organizationId: schedule.organizationId,
      generationStatus: "PENDING",
      invoiceId: null,
    },
    data: {
      invoiceId,
      amount: total,
      generationStatus: "GENERATED",
      generatedAt: now,
    },
  });
  if (generated.count !== 1) {
    throw new Error(
      "The billing schedule changed while its invoice was generated",
    );
  }

  const closesAfterThisPeriod =
    cancellationBillingDate !== null &&
    cancellationBillingDate <= schedule.periodEnd;
  if (closesAfterThisPeriod) {
    const cancelled = await transaction.subscription.updateMany({
      where: {
        id: subscription.id,
        organizationId: schedule.organizationId,
        revision: subscription.revision,
      },
      data: {
        status: "CANCELLED",
        currentPeriodStart: schedule.periodStart,
        currentPeriodEnd: schedule.periodEnd,
        nextBillingAt: null,
        cancelledAt: subscription.cancelAt,
        revision: { increment: 1 },
      },
    });
    if (cancelled.count !== 1) {
      throw new Error(
        "The subscription changed while its final invoice was generated",
      );
    }
    await transaction.subscriptionItem.updateMany({
      where: {
        organizationId: schedule.organizationId,
        subscriptionId: subscription.id,
        activeTo: null,
      },
      data: { activeTo: subscription.cancelAt },
    });
  } else {
    const period = planPeriod(subscription.planSnapshot);
    const nextPeriodStart = addBillingDays(schedule.periodEnd, 0);
    const nextPeriodEnd = addBillingInterval(
      nextPeriodStart,
      period.interval,
      period.intervalCount,
      subscription.billingAnchorDay ?? nextPeriodStart.getUTCDate(),
    );
    const nextDueDate = addBillingDays(
      nextPeriodEnd,
      subscription.order.paymentTermsDays,
    );
    const nextBillingFraction = cancellationBillingFractionForPeriod(
      subscription,
      nextPeriodStart,
      nextPeriodEnd,
      cancellationBillingDate,
    );
    const nextLines = billableItemsForPeriod(
      subscription.items,
      nextPeriodStart,
      nextPeriodEnd,
    ).map((item) =>
      calculateInvoiceLine(
        item,
        { quantity: item.quantity, unitPrice: item.unitPrice },
        nextBillingFraction,
      ),
    );
    const nextTotal = sumMoney(nextLines.map(({ amounts }) => amounts.total));
    const existingNext = await transaction.billingSchedule.findFirst({
      where: {
        organizationId: schedule.organizationId,
        subscriptionId: subscription.id,
        periodStart: nextPeriodStart,
        periodEnd: nextPeriodEnd,
      },
      select: { id: true },
    });
    if (existingNext === null) {
      await transaction.billingSchedule.create({
        data: {
          organizationId: schedule.organizationId,
          subscriptionId: subscription.id,
          periodStart: nextPeriodStart,
          periodEnd: nextPeriodEnd,
          dueDate: nextDueDate,
          amount: nextTotal,
          currency: schedule.currency,
          generationStatus: "PENDING",
          calculationSnapshot: jsonInput({
            source: "scheduled-recurring-billing",
            previousBillingScheduleId: schedule.id,
            planSnapshot: subscription.planSnapshot,
            billingTimezone: subscription.timezone,
            cancellationBillingFraction: nextBillingFraction.toString(),
            lines: nextLines.map(({ item }) => ({
              subscriptionItemId: item.id,
              orderLineId: item.orderLineId,
              quoteLineId: item.orderLine.quoteLineId,
              quantity: item.quantity.toString(),
              unitPrice: item.unitPrice.toString(),
            })),
          }),
        },
      });
    }
    const advanced = await transaction.subscription.updateMany({
      where: {
        id: subscription.id,
        organizationId: schedule.organizationId,
        revision: subscription.revision,
        currentPeriodStart: schedule.periodStart,
        currentPeriodEnd: schedule.periodEnd,
      },
      data: {
        status:
          cancellationBillingDate !== null &&
          cancellationBillingDate > schedule.periodEnd
            ? "CANCELLATION_SCHEDULED"
            : "ACTIVE",
        currentPeriodStart: nextPeriodStart,
        currentPeriodEnd: nextPeriodEnd,
        nextBillingAt: startOfBillingDateInstant(
          nextPeriodEnd,
          subscription.timezone,
        ),
        revision: { increment: 1 },
      },
    });
    if (advanced.count !== 1) {
      throw new Error(
        "The subscription changed while its billing period advanced",
      );
    }
  }

  await recordActivity(transaction, {
    organizationId: schedule.organizationId,
    eventType: "invoice.created",
    entityType: "Invoice",
    entityId: invoiceId,
    entityVersion: 1,
    quoteId: subscription.order.quoteId,
    title: "Recurring invoice created",
    metadata: {
      subscriptionId: subscription.id,
      billingScheduleId: schedule.id,
      periodStart: schedule.periodStart,
      periodEnd: schedule.periodEnd,
      total: total.toString(),
    },
  });
}

export async function markBillingScheduleFailed(
  transaction: TransactionClient,
  organizationId: string,
  scheduleId: string,
): Promise<void> {
  await transaction.billingSchedule.updateMany({
    where: {
      id: scheduleId,
      organizationId,
      generationStatus: "PENDING",
      invoiceId: null,
    },
    data: { generationStatus: "FAILED" },
  });
}
