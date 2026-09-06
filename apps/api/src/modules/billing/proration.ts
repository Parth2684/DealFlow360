import {
  ProrationPreviewDtoSchema,
  SubscriptionCancellationRulesSchema,
  SubscriptionRefundRulesSchema,
  type ProrationPreviewDto,
  type SubscriptionCancelRequest,
  type SubscriptionChangeRequest,
} from "@repo/common";
import { Prisma } from "@repo/db";

import { conflict } from "../../shared/errors.js";
import {
  addBillingDays,
  billingDateFromInstant,
  billingDateKey,
  billingDaysBetween,
} from "./periods.js";

export type SubscriptionForProration = Prisma.SubscriptionGetPayload<{
  include: {
    customerAccount: true;
    subscriptionPlan: true;
    items: { orderBy: { id: "asc" } };
  };
}>;

export interface ProrationCalculation {
  dto: ProrationPreviewDto;
  type: "QUANTITY_CHANGE" | "PLAN_CHANGE" | "CANCELLATION";
  effectiveAt: Date;
  itemId: string | null;
  oldQuantity: Prisma.Decimal | null;
  newQuantity: Prisma.Decimal | null;
  oldPlanSnapshot: Prisma.InputJsonValue | null;
  newPlanSnapshot: Prisma.InputJsonValue | null;
  unroundedAmount: Prisma.Decimal;
  roundedAmount: Prisma.Decimal;
}

const ZERO = new Prisma.Decimal(0);

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function configuredPeriodDays(subscription: SubscriptionForProration): number {
  const { interval, intervalCount } = subscription.subscriptionPlan;
  if (interval === "DAY") return intervalCount;
  if (interval === "WEEK") return intervalCount * 7;
  if (interval === "YEAR") return intervalCount * 360;
  return intervalCount * 30;
}

function dayCounts(
  subscription: SubscriptionForProration,
  effectiveAt: Date,
): { totalDays: number; remainingDays: number } {
  const effectiveDate = billingDateFromInstant(
    effectiveAt,
    subscription.timezone,
  );
  const start = subscription.currentPeriodStart;
  const end = subscription.currentPeriodEnd;
  if (effectiveDate < start || effectiveDate >= end) {
    conflict(
      "The effective date must fall within the current billing period",
      "EFFECTIVE_DATE_OUTSIDE_PERIOD",
    );
  }
  const actualTotal = Math.max(1, billingDaysBetween(start, end));
  const actualRemaining = Math.max(0, billingDaysBetween(effectiveDate, end));
  if (subscription.subscriptionPlan.prorationConvention === "CALENDAR_DAYS") {
    return {
      totalDays: actualTotal,
      remainingDays: Math.min(actualTotal, actualRemaining),
    };
  }
  const totalDays = configuredPeriodDays(subscription);
  const remainingDays = Math.min(
    totalDays,
    Math.max(0, Math.ceil((actualRemaining / actualTotal) * totalDays)),
  );
  return { totalDays, remainingDays };
}

function planSnapshot(
  plan: Pick<
    SubscriptionForProration["subscriptionPlan"],
    | "id"
    | "code"
    | "name"
    | "interval"
    | "intervalCount"
    | "prorationConvention"
    | "cancellationRules"
    | "refundRules"
  >,
): Prisma.InputJsonValue {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    interval: plan.interval,
    intervalCount: plan.intervalCount,
    prorationConvention: plan.prorationConvention,
    cancellationRules: plan.cancellationRules as Prisma.InputJsonValue,
    refundRules: plan.refundRules as Prisma.InputJsonValue,
  };
}

function activeItems(subscription: SubscriptionForProration) {
  return subscription.items.filter((item) => item.activeTo === null);
}

export function calculateSubscriptionChange(
  subscription: SubscriptionForProration,
  input: SubscriptionChangeRequest,
  nextPlan: SubscriptionForProration["subscriptionPlan"] | null,
): ProrationCalculation {
  if (!["ACTIVE", "CHANGE_SCHEDULED"].includes(subscription.status)) {
    conflict(
      "Only an active subscription can be changed",
      "INVALID_SUBSCRIPTION_STATE",
    );
  }
  const items = activeItems(subscription);
  if (input.quantity !== undefined && items.length !== 1) {
    conflict(
      "Quantity changes require a subscription with exactly one active item",
      "AMBIGUOUS_SUBSCRIPTION_ITEM",
    );
  }
  if (input.planId !== undefined && nextPlan === null) {
    conflict(
      "The requested subscription plan is unavailable",
      "SUBSCRIPTION_PLAN_UNAVAILABLE",
    );
  }
  const effectiveAt = new Date(input.effectiveDate ?? new Date());
  const { totalDays, remainingDays } = dayCounts(subscription, effectiveAt);
  const item = input.quantity === undefined ? null : (items[0] ?? null);
  const oldQuantity = item?.quantity ?? null;
  const newQuantity =
    input.quantity === undefined ? null : new Prisma.Decimal(input.quantity);
  const fullPeriodDelta =
    item === null || newQuantity === null
      ? ZERO
      : newQuantity.minus(item.quantity).mul(item.unitPrice);
  const signedUnrounded = fullPeriodDelta.mul(remainingDays).div(totalDays);
  const direction = signedUnrounded.greaterThan(0)
    ? "DEBIT"
    : signedUnrounded.lessThan(0)
      ? "CREDIT"
      : "NONE";
  const unroundedAmount = signedUnrounded.abs();
  const roundedAmount = unroundedAmount.toDecimalPlaces(
    4,
    Prisma.Decimal.ROUND_HALF_UP,
  );
  const type = input.planId !== undefined ? "PLAN_CHANGE" : "QUANTITY_CHANGE";
  const planPricingExplanation =
    input.planId === undefined
      ? null
      : "Subscription plans define cadence and policy, not a separate price. The existing item's snapshotted unit price remains authoritative, so changing only the plan has no current-period monetary delta.";
  return {
    dto: ProrationPreviewDtoSchema.parse({
      subscriptionId: subscription.id,
      changeType: type,
      effectiveAt: effectiveAt.toISOString(),
      periodStart: isoDate(subscription.currentPeriodStart),
      periodEnd: isoDate(subscription.currentPeriodEnd),
      remainingBillableDays: remainingDays,
      totalDays,
      convention: subscription.subscriptionPlan.prorationConvention,
      unroundedAmount: unroundedAmount.toString(),
      roundedAmount: roundedAmount.toString(),
      direction,
      currency: subscription.currency,
      explanation: [
        `Proration uses ${subscription.subscriptionPlan.prorationConvention === "CALENDAR_DAYS" ? "calendar days" : "a 30-day-month convention"}.`,
        `${remainingDays} of ${totalDays} billable days remain in the current period.`,
        ...(planPricingExplanation === null ? [] : [planPricingExplanation]),
        direction === "NONE"
          ? input.planId === undefined
            ? "The requested quantity is unchanged, so there is no price delta."
            : "The plan component contributes zero; no additional quantity adjustment was requested."
          : `The remaining-period ${direction.toLowerCase()} is ${roundedAmount.toString()} ${subscription.currency}.`,
      ],
    }),
    type,
    effectiveAt,
    itemId: item?.id ?? null,
    oldQuantity,
    newQuantity,
    oldPlanSnapshot:
      input.planId === undefined
        ? null
        : planSnapshot(subscription.subscriptionPlan),
    newPlanSnapshot: nextPlan === null ? null : planSnapshot(nextPlan),
    unroundedAmount,
    roundedAmount,
  };
}

export function calculateCancellation(
  subscription: SubscriptionForProration,
  input: Pick<SubscriptionCancelRequest, "effectiveDate">,
): ProrationCalculation {
  if (!["ACTIVE", "CHANGE_SCHEDULED"].includes(subscription.status)) {
    conflict(
      "Only an active subscription can be cancelled",
      "INVALID_SUBSCRIPTION_STATE",
    );
  }
  const effectiveAt = new Date(input.effectiveDate);
  const cancellationRulesResult = SubscriptionCancellationRulesSchema.safeParse(
    subscription.subscriptionPlan.cancellationRules,
  );
  const refundRulesResult = SubscriptionRefundRulesSchema.safeParse(
    subscription.subscriptionPlan.refundRules,
  );
  if (!cancellationRulesResult.success || !refundRulesResult.success) {
    conflict(
      "The subscription plan has invalid cancellation or refund rules",
      "INVALID_SUBSCRIPTION_PLAN_RULES",
    );
  }
  const cancellationRules = cancellationRulesResult.data;
  const refundRules = refundRulesResult.data;
  const requestDate = billingDateFromInstant(new Date(), subscription.timezone);
  const effectiveDate = billingDateFromInstant(
    effectiveAt,
    subscription.timezone,
  );
  const earliestEffectiveDate = addBillingDays(
    requestDate,
    cancellationRules.noticeDays,
  );
  if (effectiveDate < earliestEffectiveDate) {
    conflict(
      `This plan requires ${cancellationRules.noticeDays} day(s) notice; the earliest cancellation date is ${billingDateKey(earliestEffectiveDate)}`,
      "CANCELLATION_NOTICE_REQUIRED",
    );
  }
  if (effectiveDate < subscription.currentPeriodStart) {
    conflict(
      "The cancellation date cannot precede the current billing period",
      "EFFECTIVE_DATE_OUTSIDE_PERIOD",
    );
  }
  const isCurrentPeriodCancellation =
    effectiveDate < subscription.currentPeriodEnd;
  const { totalDays, remainingDays } = isCurrentPeriodCancellation
    ? dayCounts(subscription, effectiveAt)
    : {
        totalDays:
          subscription.subscriptionPlan.prorationConvention === "CALENDAR_DAYS"
            ? Math.max(
                1,
                billingDaysBetween(
                  subscription.currentPeriodStart,
                  subscription.currentPeriodEnd,
                ),
              )
            : configuredPeriodDays(subscription),
        remainingDays: 0,
      };
  const fullPeriodAmount = activeItems(subscription).reduce(
    (total, item) => total.plus(item.quantity.mul(item.unitPrice)),
    ZERO,
  );
  const creditUnusedDays =
    isCurrentPeriodCancellation && refundRules.unusedDays === "credit";
  const unroundedAmount = creditUnusedDays
    ? fullPeriodAmount.mul(remainingDays).div(totalDays)
    : ZERO;
  const roundedAmount = unroundedAmount.toDecimalPlaces(
    4,
    Prisma.Decimal.ROUND_HALF_UP,
  );
  const direction = roundedAmount.greaterThan(0) ? "CREDIT" : "NONE";
  return {
    dto: ProrationPreviewDtoSchema.parse({
      subscriptionId: subscription.id,
      changeType: "CANCELLATION",
      effectiveAt: effectiveAt.toISOString(),
      periodStart: isoDate(subscription.currentPeriodStart),
      periodEnd: isoDate(subscription.currentPeriodEnd),
      remainingBillableDays: remainingDays,
      totalDays,
      convention: subscription.subscriptionPlan.prorationConvention,
      unroundedAmount: unroundedAmount.toString(),
      roundedAmount: roundedAmount.toString(),
      direction,
      currency: subscription.currency,
      explanation: [
        `The plan requires ${cancellationRules.noticeDays} day(s) cancellation notice; this request is effective on or after ${billingDateKey(earliestEffectiveDate)}.`,
        !isCurrentPeriodCancellation
          ? "The cancellation is after the current billed period. No credit is promised for future time that has not yet been invoiced; billing stops at the effective date."
          : creditUnusedDays
            ? `Cancellation credit uses ${subscription.subscriptionPlan.prorationConvention === "CALENDAR_DAYS" ? "calendar days" : "a 30-day-month convention"}.`
            : "This plan does not credit unused days after cancellation.",
        `${remainingDays} of ${totalDays} billable days remain in the current period.`,
        direction === "CREDIT"
          ? `The eligible cancellation credit is ${roundedAmount.toString()} ${subscription.currency}.`
          : "No cancellation credit remains in this billing period.",
      ],
    }),
    type: "CANCELLATION",
    effectiveAt,
    itemId: null,
    oldQuantity: null,
    newQuantity: null,
    oldPlanSnapshot: planSnapshot(subscription.subscriptionPlan),
    newPlanSnapshot: null,
    unroundedAmount,
    roundedAmount,
  };
}
