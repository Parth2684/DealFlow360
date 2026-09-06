import { DealHealthSnapshotDtoSchema, type RiskLevel } from "@repo/common";
import { Prisma } from "@repo/db";

import {
  jsonInput,
  recordActivity,
  type TransactionClient,
} from "../../shared/activity.js";
import { notFound } from "../../shared/errors.js";
import type { InternalPrincipal } from "../../shared/types.js";
import { mayReadQuote } from "../quotations/service.js";

const ZERO = new Prisma.Decimal(0);
const ONE_HUNDRED = new Prisma.Decimal(100);
const HEALTH_ALERT_REASON_CODES = [
  "DEAL_STALLED",
  "DISCOUNT_ANOMALY",
  "APPROVAL_OVERDUE",
  "PROMISE_LATE",
  "CREDIT_EXPOSURE_HIGH",
] as const;

export interface SystemHealthContext {
  kind: "system";
  organizationId: string;
}

type HealthContext = InternalPrincipal | SystemHealthContext;

const healthQuoteInclude = {
  customerAccount: true,
  currentVersion: { include: { riskAssessment: true } },
  approvalRequests: { include: { steps: true } },
  orders: { include: { shipments: true, backorders: true } },
  dealEvents: {
    where: {
      OR: [
        { sourceEntityType: null },
        {
          sourceEntityType: { notIn: ["DealHealthSnapshot", "Alert", "Nudge"] },
        },
      ],
    },
    orderBy: { occurredAt: "desc" as const },
    take: 1,
  },
} satisfies Prisma.QuoteInclude;

type HealthQuote = Prisma.QuoteGetPayload<{
  include: typeof healthQuoteInclude;
}>;

export interface HealthCalculation {
  quote: HealthQuote & {
    currentVersion: NonNullable<HealthQuote["currentVersion"]>;
  };
  calculatedAt: Date;
  healthScore: Prisma.Decimal;
  riskLevel: RiskLevel;
  stalledDays: number;
  discountAnomalyScore: Prisma.Decimal;
  approvalSlaHoursOverdue: number;
  promiseSlippageDays: number;
  creditExposure: Prisma.Decimal;
  creditUtilizationPercent: Prisma.Decimal;
  facts: Record<string, unknown>;
  explanation: string[];
}

function daysOverdue(value: Date | null, now: Date): number {
  if (value === null || value >= now) return 0;
  return Math.floor((now.getTime() - value.getTime()) / 86_400_000);
}

export function levelFromScore(score: Prisma.Decimal): RiskLevel {
  if (score.lessThanOrEqualTo(25)) return "CRITICAL";
  if (score.lessThanOrEqualTo(50)) return "HIGH";
  if (score.lessThanOrEqualTo(75)) return "MEDIUM";
  return "LOW";
}

export async function calculateHealth(
  transaction: TransactionClient,
  principal: HealthContext,
  quoteId: string,
): Promise<HealthCalculation> {
  const quote = await transaction.quote.findFirst({
    where: { id: quoteId, organizationId: principal.organizationId },
    include: healthQuoteInclude,
  });
  if (quote === null || quote.currentVersion === null) notFound("Quote");
  if (principal.kind === "internal" && !mayReadQuote(principal, quote))
    notFound("Quote");
  const typedQuote = { ...quote, currentVersion: quote.currentVersion };
  const calculatedAt = new Date();
  const lastMeaningfulActivityAt =
    quote.dealEvents[0]?.occurredAt ?? quote.updatedAt;
  const stalledDays = Math.max(
    0,
    Math.floor(
      (calculatedAt.getTime() - lastMeaningfulActivityAt.getTime()) /
        86_400_000,
    ),
  );
  const activeSteps = quote.approvalRequests.flatMap((request) =>
    request.steps.filter((step) => step.status === "ACTIVE"),
  );
  const approvalSlaHoursOverdue = activeSteps.reduce((maximum, step) => {
    if (step.dueAt === null || step.dueAt >= calculatedAt) return maximum;
    return Math.max(
      maximum,
      Math.floor((calculatedAt.getTime() - step.dueAt.getTime()) / 3_600_000),
    );
  }, 0);
  const shipmentSlippage = quote.orders
    .flatMap((order) => order.shipments)
    .filter(
      (shipment) =>
        !["SHIPPED", "DELIVERED", "CANCELLED"].includes(shipment.status),
    )
    .reduce(
      (maximum, shipment) =>
        Math.max(maximum, daysOverdue(shipment.promisedDate, calculatedAt)),
      0,
    );
  const backorderSlippage = quote.orders
    .flatMap((order) => order.backorders)
    .filter(
      (backorder) =>
        !["FULFILLED", "CANCELLED", "CONSOLIDATED"].includes(backorder.status),
    )
    .reduce(
      (maximum, backorder) =>
        Math.max(maximum, daysOverdue(backorder.expectedAt, calculatedAt)),
      0,
    );
  const promiseSlippageDays = Math.max(shipmentSlippage, backorderSlippage);
  const risk = quote.currentVersion.riskAssessment;
  const discountAnomalyScore =
    risk?.representativeAnomaly ?? risk?.maximumLineExcess ?? ZERO;
  const creditExposure =
    risk?.creditExposure ??
    quote.customerAccount.currentExposure.plus(quote.currentVersion.total);
  const creditUtilizationPercent = quote.customerAccount.creditLimit.isZero()
    ? ZERO
    : creditExposure
        .div(quote.customerAccount.creditLimit)
        .mul(100)
        .toDecimalPlaces(4);
  const stalledPenalty = Prisma.Decimal.min(
    new Prisma.Decimal(30),
    new Prisma.Decimal(stalledDays * 2),
  );
  const approvalPenalty = Prisma.Decimal.min(
    new Prisma.Decimal(25),
    new Prisma.Decimal(approvalSlaHoursOverdue).div(4),
  );
  const promisePenalty = Prisma.Decimal.min(
    new Prisma.Decimal(20),
    new Prisma.Decimal(promiseSlippageDays * 5),
  );
  const anomalyPenalty = Prisma.Decimal.min(
    new Prisma.Decimal(15),
    discountAnomalyScore.mul(2),
  );
  const creditPenalty = creditUtilizationPercent.greaterThan(100)
    ? new Prisma.Decimal(20)
    : creditUtilizationPercent.greaterThan(90)
      ? new Prisma.Decimal(10)
      : ZERO;
  const healthScore = Prisma.Decimal.max(
    ZERO,
    ONE_HUNDRED.minus(stalledPenalty)
      .minus(approvalPenalty)
      .minus(promisePenalty)
      .minus(anomalyPenalty)
      .minus(creditPenalty),
  ).toDecimalPlaces(4);
  const explanation = [
    ...(stalledDays >= 7 ? [`No deal update for ${stalledDays} days`] : []),
    ...(discountAnomalyScore.greaterThan(ZERO)
      ? [`Discount anomaly score is ${discountAnomalyScore.toString()}`]
      : []),
    ...(approvalSlaHoursOverdue > 0
      ? [`Approval is ${approvalSlaHoursOverdue} hours overdue`]
      : []),
    ...(promiseSlippageDays > 0
      ? [`A fulfillment promise is ${promiseSlippageDays} days late`]
      : []),
    ...(creditUtilizationPercent.greaterThan(90)
      ? [`Credit utilization is ${creditUtilizationPercent.toString()}%`]
      : []),
  ];
  if (explanation.length === 0)
    explanation.push("No active deal-health rule is breached");
  const facts = {
    stage: quote.stage,
    currentRevision: quote.currentRevision,
    quoteUpdatedAt: quote.updatedAt.toISOString(),
    lastMeaningfulActivityAt: lastMeaningfulActivityAt.toISOString(),
    creditUtilizationPercent: creditUtilizationPercent.toString(),
    riskReasonCodes: risk?.reasonCodes ?? [],
    explanation,
  };
  return {
    quote: typedQuote,
    calculatedAt,
    healthScore,
    riskLevel: levelFromScore(healthScore),
    stalledDays,
    discountAnomalyScore,
    approvalSlaHoursOverdue,
    promiseSlippageDays,
    creditExposure,
    creditUtilizationPercent,
    facts,
    explanation,
  };
}

export function mapHealthCalculation(
  calculation: HealthCalculation,
  id = calculation.quote.id,
  reason = "On-demand health calculation",
) {
  return DealHealthSnapshotDtoSchema.parse({
    id,
    quoteId: calculation.quote.id,
    reason,
    healthScore: calculation.healthScore.toString(),
    riskLevel: calculation.riskLevel,
    stalledDays: calculation.stalledDays,
    discountAnomalyScore: calculation.discountAnomalyScore.toString(),
    approvalSlaHoursOverdue: calculation.approvalSlaHoursOverdue,
    promiseSlippageDays: calculation.promiseSlippageDays,
    creditExposure: calculation.creditExposure.toString(),
    facts: calculation.facts,
    explanation: calculation.explanation,
    calculatedAt: calculation.calculatedAt.toISOString(),
  });
}

export async function persistHealthSnapshot(
  transaction: TransactionClient,
  principal: HealthContext,
  quoteId: string,
  reason: string,
  options: { recordSnapshotActivity?: boolean } = {},
) {
  const lockKey = `${principal.organizationId}:deal-health:${quoteId}`;
  await transaction.$queryRaw<Array<{ locked: unknown }>>(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0)) AS locked`,
  );
  const calculation = await calculateHealth(transaction, principal, quoteId);
  const snapshot = await transaction.dealHealthSnapshot.create({
    data: {
      organizationId: principal.organizationId,
      quoteId,
      reason,
      healthScore: calculation.healthScore,
      stalledDays: calculation.stalledDays,
      discountAnomalyScore: calculation.discountAnomalyScore,
      approvalSlaHoursOverdue: calculation.approvalSlaHoursOverdue,
      promiseSlippageDays: calculation.promiseSlippageDays,
      creditExposure: calculation.creditExposure,
      facts: jsonInput(calculation.facts),
    },
  });
  const candidates = [
    ...(calculation.stalledDays >= 7
      ? [
          {
            type: "STALLED_DEAL" as const,
            severity: "WARNING" as const,
            reasonCode: "DEAL_STALLED",
            title: "Deal activity has stalled",
            message: `No activity for ${calculation.stalledDays} days`,
          },
        ]
      : []),
    ...(calculation.discountAnomalyScore.greaterThan(ZERO)
      ? [
          {
            type: "DISCOUNT_ANOMALY" as const,
            severity: "WARNING" as const,
            reasonCode: "DISCOUNT_ANOMALY",
            title: "Discount needs attention",
            message: `Anomaly score ${calculation.discountAnomalyScore.toString()}`,
          },
        ]
      : []),
    ...(calculation.approvalSlaHoursOverdue > 0
      ? [
          {
            type: "APPROVAL_SLA" as const,
            severity: "CRITICAL" as const,
            reasonCode: "APPROVAL_OVERDUE",
            title: "Approval SLA missed",
            message: `${calculation.approvalSlaHoursOverdue} hours overdue`,
          },
        ]
      : []),
    ...(calculation.promiseSlippageDays > 0
      ? [
          {
            type: "PROMISE_SLIPPAGE" as const,
            severity: "CRITICAL" as const,
            reasonCode: "PROMISE_LATE",
            title: "Delivery promise is at risk",
            message: `${calculation.promiseSlippageDays} days late`,
          },
        ]
      : []),
    ...(calculation.creditUtilizationPercent.greaterThan(90)
      ? [
          {
            type: "CREDIT_EXPOSURE" as const,
            severity: "CRITICAL" as const,
            reasonCode: "CREDIT_EXPOSURE_HIGH",
            title: "Credit exposure is high",
            message: `${calculation.creditUtilizationPercent.toString()}% utilized`,
          },
        ]
      : []),
  ];
  const activeReasonCodes = candidates.map((candidate) => candidate.reasonCode);
  await transaction.alert.updateMany({
    where: {
      organizationId: principal.organizationId,
      quoteId,
      reasonCode: {
        in: [...HEALTH_ALERT_REASON_CODES],
        ...(activeReasonCodes.length === 0 ? {} : { notIn: activeReasonCodes }),
      },
      status: { in: ["OPEN", "ACKNOWLEDGED", "SNOOZED"] },
    },
    data: {
      status: "RESOLVED",
      resolvedAt: calculation.calculatedAt,
      snoozedUntil: null,
      revision: { increment: 1 },
    },
  });
  for (const candidate of candidates) {
    const existing = await transaction.alert.findFirst({
      where: {
        organizationId: principal.organizationId,
        quoteId,
        type: candidate.type,
        reasonCode: candidate.reasonCode,
        status: { in: ["OPEN", "ACKNOWLEDGED", "SNOOZED"] },
      },
    });
    if (existing === null) {
      const alert = await transaction.alert.create({
        data: {
          organizationId: principal.organizationId,
          quoteId,
          dealHealthSnapshotId: snapshot.id,
          ...candidate,
          facts: jsonInput(calculation.facts),
        },
      });
      await recordActivity(transaction, {
        organizationId: principal.organizationId,
        actor: principal.kind === "internal" ? principal : undefined,
        eventType: "alert.created",
        entityType: "Alert",
        entityId: alert.id,
        entityVersion: alert.revision,
        quoteId,
        title: alert.title,
        message: alert.message,
      });
    } else {
      await transaction.alert.update({
        where: { id: existing.id },
        data: {
          severity: candidate.severity,
          message: candidate.message,
          facts: jsonInput(calculation.facts),
          dealHealthSnapshotId: snapshot.id,
          status:
            existing.status === "SNOOZED" &&
            (existing.snoozedUntil === null ||
              existing.snoozedUntil <= calculation.calculatedAt)
              ? "OPEN"
              : existing.status,
          resolvedAt: null,
          revision: { increment: 1 },
        },
      });
    }
  }
  if (options.recordSnapshotActivity !== false) {
    await recordActivity(transaction, {
      organizationId: principal.organizationId,
      actor: principal.kind === "internal" ? principal : undefined,
      eventType: "deal.activityRecorded",
      entityType: "DealHealthSnapshot",
      entityId: snapshot.id,
      quoteId,
      title: "Deal health recalculated",
      message: reason,
    });
  }
  return mapHealthCalculation(calculation, snapshot.id, reason);
}
