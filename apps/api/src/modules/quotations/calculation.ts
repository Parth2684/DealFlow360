import type { ApprovalRouteStepDto } from "@repo/common";
import { Prisma } from "@repo/db";

import { jsonInput, type TransactionClient } from "../../shared/activity.js";
import { approvalAuthority } from "../../shared/approval-authority.js";
import { conflict, HttpError, notFound } from "../../shared/errors.js";
import { stableFingerprint } from "../../shared/security.js";
import {
  calculateCommercialLine,
  roundedMoney,
} from "../../shared/commercial-math.js";
import { billingDateFromInstant } from "../billing/periods.js";
import { quoteInclude, type QuoteRecord } from "./mappers.js";

export type LoadedQuote = QuoteRecord & {
  currentVersion: NonNullable<QuoteRecord["currentVersion"]>;
};

const ZERO = new Prisma.Decimal(0);
const ONE_HUNDRED = new Prisma.Decimal(100);

const rounded = roundedMoney;

function effectiveDiscountPercent(
  listUnitPrice: Prisma.Decimal,
  unitPrice: Prisma.Decimal,
  explicitDiscountPercent: Prisma.Decimal,
): Prisma.Decimal {
  if (listUnitPrice.isZero()) return rounded(explicitDiscountPercent);
  const discountedUnitPrice = unitPrice
    .mul(ONE_HUNDRED.minus(explicitDiscountPercent))
    .div(ONE_HUNDRED);
  return rounded(
    Prisma.Decimal.min(
      ONE_HUNDRED,
      Prisma.Decimal.max(
        ZERO,
        listUnitPrice
          .minus(discountedUnitPrice)
          .div(listUnitPrice)
          .mul(ONE_HUNDRED),
      ),
    ),
  );
}

function safeExplicitDiscountPercent(
  listUnitPrice: Prisma.Decimal,
  unitPrice: Prisma.Decimal,
  allowedEffectiveDiscount: Prisma.Decimal,
): Prisma.Decimal | null {
  if (listUnitPrice.isZero()) return rounded(allowedEffectiveDiscount);
  const minimumNetUnitPrice = listUnitPrice
    .mul(ONE_HUNDRED.minus(allowedEffectiveDiscount))
    .div(ONE_HUNDRED);
  if (unitPrice.isZero() || unitPrice.lessThan(minimumNetUnitPrice)) {
    return null;
  }
  return Prisma.Decimal.min(
    ONE_HUNDRED,
    Prisma.Decimal.max(
      ZERO,
      ONE_HUNDRED.minus(minimumNetUnitPrice.div(unitPrice).mul(ONE_HUNDRED)),
    ),
  ).toDecimalPlaces(4, Prisma.Decimal.ROUND_DOWN);
}

function minimum(values: Prisma.Decimal[]): Prisma.Decimal {
  return values.reduce(
    (result, value) => (value.lessThan(result) ? value : result),
    ONE_HUNDRED,
  );
}

function jsonObject(
  value: Prisma.JsonValue,
): Record<string, Prisma.JsonValue | undefined> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function predicateDecimal(
  predicates: Record<string, Prisma.JsonValue | undefined>,
  key: string,
): Prisma.Decimal | null {
  const value = predicates[key];
  if (typeof value !== "string" && typeof value !== "number") return null;
  try {
    return new Prisma.Decimal(value);
  } catch {
    return null;
  }
}

interface PolicyFacts {
  anyLineAboveCeiling: boolean;
  blendedExcess: Prisma.Decimal;
  maximumLineExcess: Prisma.Decimal;
  marginPercent: Prisma.Decimal;
  creditExposure: Prisma.Decimal;
  creditUtilization: Prisma.Decimal;
  overdueBalance: Prisma.Decimal;
  latePaidInvoiceCount: number;
  failedPaymentCount: number;
  onTimePaymentRatePercent: Prisma.Decimal | null;
  representativeAnomaly: Prisma.Decimal;
}

interface PaymentHistoryFacts {
  settledInvoiceCount: number;
  latePaidInvoiceCount: number;
  failedPaymentCount: number;
  onTimePaymentRatePercent: Prisma.Decimal | null;
}

interface RepresentativeAnomalyBenchmark {
  anomaly: Prisma.Decimal;
  meanBlendedExcess: Prisma.Decimal;
  meanAbsoluteDeviation: Prisma.Decimal;
  threshold: Prisma.Decimal;
  sampleSize: number;
  basis: "REPRESENTATIVE_HISTORY" | "COLD_START_POLICY_BASELINE";
}

function representativeAnomalyBenchmark(
  currentBlendedExcess: Prisma.Decimal,
  history: readonly Prisma.Decimal[],
): RepresentativeAnomalyBenchmark {
  if (history.length === 0) {
    const threshold = new Prisma.Decimal(1);
    return {
      anomaly: Prisma.Decimal.max(
        ZERO,
        currentBlendedExcess.minus(threshold),
      ).toDecimalPlaces(4),
      meanBlendedExcess: ZERO,
      meanAbsoluteDeviation: ZERO,
      threshold,
      sampleSize: 0,
      basis: "COLD_START_POLICY_BASELINE",
    };
  }
  const sampleSize = history.length;
  const meanBlendedExcess = history
    .reduce((total, value) => total.plus(value), ZERO)
    .div(sampleSize)
    .toDecimalPlaces(4);
  const meanAbsoluteDeviation = history
    .reduce(
      (total, value) => total.plus(value.minus(meanBlendedExcess).abs()),
      ZERO,
    )
    .div(sampleSize)
    .toDecimalPlaces(4);
  const threshold = meanBlendedExcess
    .plus(
      Prisma.Decimal.max(new Prisma.Decimal(1), meanAbsoluteDeviation.mul(2)),
    )
    .toDecimalPlaces(4);
  return {
    anomaly: Prisma.Decimal.max(
      ZERO,
      currentBlendedExcess.minus(threshold),
    ).toDecimalPlaces(4),
    meanBlendedExcess,
    meanAbsoluteDeviation,
    threshold,
    sampleSize,
    basis: "REPRESENTATIVE_HISTORY",
  };
}

function matchingPredicateReasons(
  rawPredicates: Prisma.JsonValue,
  facts: PolicyFacts,
): string[] {
  const predicates = jsonObject(rawPredicates);
  const reasons: string[] = [];
  if (predicates["always"] === true)
    reasons.push("Policy applies to every quote");
  if (predicates["anyLineAboveCeiling"] === true && facts.anyLineAboveCeiling) {
    reasons.push("At least one line exceeds its configured discount ceiling");
  }
  const blended = predicateDecimal(predicates, "blendedExcessAtLeast");
  if (blended !== null && facts.blendedExcess.greaterThanOrEqualTo(blended)) {
    reasons.push(
      `Blended discount excess is at least ${blended.toString()} points`,
    );
  }
  const maximum = predicateDecimal(predicates, "maximumLineExcessAtLeast");
  if (
    maximum !== null &&
    facts.maximumLineExcess.greaterThanOrEqualTo(maximum)
  ) {
    reasons.push(
      `Maximum line excess is at least ${maximum.toString()} points`,
    );
  }
  const margin =
    predicateDecimal(predicates, "marginBelow") ??
    predicateDecimal(predicates, "marginPercentBelow") ??
    predicateDecimal(predicates, "marginFloor");
  if (margin !== null && facts.marginPercent.lessThan(margin)) {
    reasons.push(`Post-discount margin is below ${margin.toString()}%`);
  }
  const exposure = predicateDecimal(predicates, "creditExposureAtLeast");
  if (
    exposure !== null &&
    facts.creditExposure.greaterThanOrEqualTo(exposure)
  ) {
    reasons.push(`Credit exposure is at least ${exposure.toString()}`);
  }
  const utilization = predicateDecimal(predicates, "creditUtilizationAtLeast");
  if (
    utilization !== null &&
    facts.creditUtilization.greaterThanOrEqualTo(utilization)
  ) {
    reasons.push(`Credit utilization is at least ${utilization.toString()}%`);
  }
  const overdue = predicateDecimal(predicates, "overdueBalanceAbove");
  if (overdue !== null && facts.overdueBalance.greaterThan(overdue)) {
    reasons.push(`Overdue balance is above ${overdue.toString()}`);
  }
  const latePayments = predicateDecimal(
    predicates,
    "latePaidInvoiceCountAtLeast",
  );
  if (
    latePayments !== null &&
    new Prisma.Decimal(facts.latePaidInvoiceCount).greaterThanOrEqualTo(
      latePayments,
    )
  ) {
    reasons.push(
      `Payment history contains at least ${latePayments.toString()} late-paid invoice(s)`,
    );
  }
  const failedPayments = predicateDecimal(
    predicates,
    "failedPaymentCountAtLeast",
  );
  if (
    failedPayments !== null &&
    new Prisma.Decimal(facts.failedPaymentCount).greaterThanOrEqualTo(
      failedPayments,
    )
  ) {
    reasons.push(
      `Payment history contains at least ${failedPayments.toString()} failed payment(s)`,
    );
  }
  const onTimeRate = predicateDecimal(predicates, "onTimePaymentRateBelow");
  if (
    onTimeRate !== null &&
    facts.onTimePaymentRatePercent !== null &&
    facts.onTimePaymentRatePercent.lessThan(onTimeRate)
  ) {
    reasons.push(`On-time payment rate is below ${onTimeRate.toString()}%`);
  }
  const representativeAnomaly = predicateDecimal(
    predicates,
    "representativeAnomalyAtLeast",
  );
  if (
    representativeAnomaly !== null &&
    facts.representativeAnomaly.greaterThanOrEqualTo(representativeAnomaly)
  ) {
    reasons.push(
      `Representative discount anomaly is at least ${representativeAnomaly.toString()} points`,
    );
  }
  return reasons;
}

export async function loadQuote(
  transaction: TransactionClient,
  organizationId: string,
  quoteId: string,
): Promise<LoadedQuote> {
  const quote = await transaction.quote.findFirst({
    where: { id: quoteId, organizationId },
    include: quoteInclude,
  });
  if (quote === null || quote.currentVersion === null) notFound("Quote");
  return { ...quote, currentVersion: quote.currentVersion };
}

export async function recalculateQuote(
  transaction: TransactionClient,
  organizationId: string,
  quoteId: string,
): Promise<LoadedQuote> {
  const quote = await loadQuote(transaction, organizationId, quoteId);
  const version = quote.currentVersion;
  if (version === null) notFound("Current quote version");
  if (version.status !== "DRAFT" && version.status !== "REVISION_REQUIRED") {
    throw new HttpError(
      409,
      "Commercial snapshot is immutable",
      `A ${version.status} quote version cannot be recalculated; create a new version first`,
      { code: "QUOTE_VERSION_IMMUTABLE" },
    );
  }
  const now = new Date();
  const limits = await transaction.discountLimit.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  const preDiscountTotal = version.lines.reduce(
    (sum, line) => sum.plus(line.listUnitPrice.mul(line.quantity)),
    ZERO,
  );
  let subtotal = ZERO;
  let lineDiscountTotal = ZERO;
  let taxTotal = ZERO;
  let total = ZERO;
  let costTotal = ZERO;
  let netRevenue = ZERO;
  const calculatedLines: Array<{
    line: (typeof version.lines)[number];
    preDiscountValue: Prisma.Decimal;
    appliedDiscount: Prisma.Decimal;
    allowed: Prisma.Decimal;
    excess: Prisma.Decimal;
    weight: Prisma.Decimal;
    weightedExcess: Prisma.Decimal;
    netRevenue: Prisma.Decimal;
    matched: typeof limits;
  }> = [];

  for (const line of version.lines) {
    const amounts = calculateCommercialLine({
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      discountPercent: line.discountPercent,
      taxRate: line.taxRate,
      taxBehavior: line.taxBehavior,
    });
    const commercialPreDiscountValue = amounts.preDiscountAmount;
    const preDiscountValue = rounded(line.listUnitPrice.mul(line.quantity));
    const appliedDiscount = effectiveDiscountPercent(
      line.listUnitPrice,
      line.unitPrice,
      line.discountPercent,
    );
    const discountAmount = amounts.discountAmount;
    const preTaxSubtotal = amounts.preTaxSubtotal;
    const taxAmount = amounts.taxAmount;
    const lineTotal = amounts.total;
    const lineCost = rounded(line.unitCost.mul(line.quantity));
    const lineMargin = rounded(preTaxSubtotal.minus(lineCost));
    await transaction.quoteLine.update({
      where: { id: line.id },
      data: {
        lineDiscountAmount: discountAmount,
        preTaxSubtotal,
        taxAmount,
        total: lineTotal,
        costTotal: lineCost,
        grossMargin: lineMargin,
      },
    });

    subtotal = subtotal.plus(commercialPreDiscountValue);
    lineDiscountTotal = lineDiscountTotal.plus(discountAmount);
    taxTotal = taxTotal.plus(taxAmount);
    total = total.plus(lineTotal);
    costTotal = costTotal.plus(lineCost);
    netRevenue = netRevenue.plus(preTaxSubtotal);

    const matched = limits.filter(
      (limit) =>
        (limit.tierId === null ||
          limit.tierId === quote.customerAccount.tierId) &&
        (limit.productId === null || limit.productId === line.productId) &&
        (limit.categoryId === null ||
          limit.categoryId ===
            Reflect.get(
              line.pricingSnapshot !== null &&
                typeof line.pricingSnapshot === "object" &&
                !Array.isArray(line.pricingSnapshot)
                ? line.pricingSnapshot
                : {},
              "categoryId",
            )),
    );
    const allowed =
      matched.length === 0
        ? ONE_HUNDRED
        : minimum(matched.map((limit) => limit.maxDiscountPercent));
    const excess = Prisma.Decimal.max(ZERO, appliedDiscount.minus(allowed));
    const weight = preDiscountTotal.isZero()
      ? ZERO
      : rounded(preDiscountValue.div(preDiscountTotal));
    const weightedExcess = rounded(weight.mul(excess));
    calculatedLines.push({
      line,
      preDiscountValue,
      appliedDiscount,
      allowed,
      excess,
      weight,
      weightedExcess,
      netRevenue: preTaxSubtotal,
      matched,
    });
  }

  subtotal = rounded(subtotal);
  lineDiscountTotal = rounded(lineDiscountTotal);
  taxTotal = rounded(taxTotal);
  total = rounded(total);
  costTotal = rounded(costTotal);
  netRevenue = rounded(netRevenue);
  const grossMargin = rounded(netRevenue.minus(costTotal));
  const marginPercent = netRevenue.isZero()
    ? ZERO
    : rounded(grossMargin.div(netRevenue).mul(ONE_HUNDRED));
  const blendedExcess = rounded(
    calculatedLines.reduce((sum, line) => sum.plus(line.weightedExcess), ZERO),
  );
  const maximumLineExcess = calculatedLines.reduce(
    (result, line) => Prisma.Decimal.max(result, line.excess),
    ZERO,
  );
  const creditExposure = rounded(
    quote.customerAccount.currentExposure.plus(total),
  );
  const creditUtilization = quote.customerAccount.creditLimit.isZero()
    ? ZERO
    : rounded(
        creditExposure.div(quote.customerAccount.creditLimit).mul(ONE_HUNDRED),
      );
  const organization = await transaction.organization.findUnique({
    where: { id: organizationId },
    select: { timezone: true },
  });
  if (organization === null) notFound("Organization");
  const [settledInvoices, failedPaymentCount] = await Promise.all([
    transaction.invoice.findMany({
      where: {
        organizationId,
        customerAccountId: quote.customerAccountId,
        status: "PAID",
        paidAt: { not: null },
      },
      select: { dueDate: true, paidAt: true },
    }),
    transaction.payment.count({
      where: {
        organizationId,
        status: "FAILED",
        invoice: { customerAccountId: quote.customerAccountId },
      },
    }),
  ]);
  const latePaidInvoiceCount = settledInvoices.filter(
    (invoice) =>
      invoice.paidAt !== null &&
      billingDateFromInstant(invoice.paidAt, organization.timezone) >
        invoice.dueDate,
  ).length;
  const paymentHistory: PaymentHistoryFacts = {
    settledInvoiceCount: settledInvoices.length,
    latePaidInvoiceCount,
    failedPaymentCount,
    onTimePaymentRatePercent:
      settledInvoices.length === 0
        ? null
        : new Prisma.Decimal(settledInvoices.length - latePaidInvoiceCount)
            .div(settledInvoices.length)
            .mul(ONE_HUNDRED)
            .toDecimalPlaces(4),
  };
  const representativeHistory = await transaction.quoteRiskAssessment.findMany({
    where: {
      organizationId,
      quoteVersionId: { not: version.id },
      quoteVersion: { quote: { ownerId: quote.ownerId } },
    },
    select: { blendedExcess: true },
    orderBy: [{ calculatedAt: "desc" }, { id: "asc" }],
    take: 50,
  });
  const anomalyBenchmark = representativeAnomalyBenchmark(
    blendedExcess,
    representativeHistory.map((assessment) => assessment.blendedExcess),
  );
  const representativeAnomaly = anomalyBenchmark.anomaly;
  const reasonCodes: string[] = [];
  if (maximumLineExcess.greaterThan(ZERO))
    reasonCodes.push("DISCOUNT_LIMIT_EXCEEDED");
  if (grossMargin.lessThan(ZERO)) reasonCodes.push("NEGATIVE_MARGIN");
  if (quote.customerAccount.overdueBalance.greaterThan(ZERO)) {
    reasonCodes.push("OVERDUE_BALANCE");
  }
  if (creditUtilization.greaterThan(100))
    reasonCodes.push("CREDIT_EXPOSURE_HIGH");
  if (paymentHistory.latePaidInvoiceCount > 0) {
    reasonCodes.push("PAYMENT_HISTORY_LATE");
  }
  if (paymentHistory.failedPaymentCount > 0) {
    reasonCodes.push("PAYMENT_HISTORY_FAILED");
  }
  if (representativeAnomaly.greaterThan(ZERO)) {
    reasonCodes.push("REPRESENTATIVE_DISCOUNT_ANOMALY");
  }

  const policies = await transaction.approvalPolicy.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    },
    include: { stepTemplates: { orderBy: { sequence: "asc" } } },
    orderBy: [{ priority: "desc" }, { version: "desc" }, { createdAt: "asc" }],
  });
  const facts: PolicyFacts = {
    anyLineAboveCeiling: maximumLineExcess.greaterThan(ZERO),
    blendedExcess,
    maximumLineExcess,
    marginPercent,
    creditExposure,
    creditUtilization,
    overdueBalance: quote.customerAccount.overdueBalance,
    latePaidInvoiceCount: paymentHistory.latePaidInvoiceCount,
    failedPaymentCount: paymentHistory.failedPaymentCount,
    onTimePaymentRatePercent: paymentHistory.onTimePaymentRatePercent,
    representativeAnomaly,
  };
  const evaluatePolicyRoute = (evaluatedFacts: PolicyFacts) => {
    const matchedPolicies = policies.flatMap((policy) => {
      if (
        policy.stepTemplates.some(
          (step) =>
            approvalAuthority(step.requiredRole, step.requiredCapability) ===
            null,
        )
      ) {
        conflict(
          `Approval policy ${policy.code} has an invalid role/capability authority`,
          "INVALID_APPROVAL_POLICY",
        );
      }
      const predicates = jsonObject(policy.predicates);
      const managerReasons = matchingPredicateReasons(
        predicates["manager"] ?? policy.predicates,
        evaluatedFacts,
      );
      const financeReasons = matchingPredicateReasons(
        predicates["finance"] ?? policy.predicates,
        evaluatedFacts,
      );
      const generalReasons = matchingPredicateReasons(
        predicates["conditions"] ?? policy.predicates,
        evaluatedFacts,
      );
      const steps = policy.stepTemplates.flatMap((step) => {
        const reasons =
          step.requiredRole === "SALES_MANAGER"
            ? managerReasons
            : step.requiredRole === "FINANCE"
              ? financeReasons
              : generalReasons;
        return reasons.length === 0 ? [] : [{ step, reasons }];
      });
      return steps.length === 0 ? [] : [{ policy, steps }];
    });
    const routeCandidates = matchedPolicies.flatMap(({ policy, steps }) =>
      steps.map(({ step, reasons }) => ({ policy, step, reasons })),
    );
    const routeByAuthority = new Map<
      string,
      (typeof routeCandidates)[number]
    >();
    for (const candidate of routeCandidates) {
      const key = `${candidate.step.requiredRole}:${candidate.step.requiredCapability}`;
      if (!routeByAuthority.has(key)) routeByAuthority.set(key, candidate);
    }
    const requiredRoute: ApprovalRouteStepDto[] = [...routeByAuthority.values()]
      .sort((left, right) => left.step.sequence - right.step.sequence)
      .map((candidate, index) => ({
        sequence: index + 1,
        role: candidate.step.requiredRole,
        capability: candidate.step.requiredCapability,
        reason: `${candidate.policy.name}: ${candidate.reasons.join("; ")}`,
      }));
    return { matchedPolicies, requiredRoute };
  };
  const { matchedPolicies, requiredRoute } = evaluatePolicyRoute(facts);

  const fingerprint = stableFingerprint({
    customerAccountId: quote.customerAccountId,
    currency: version.currency,
    paymentTermsDays: version.paymentTermsDays,
    lines: version.lines.map((line) => ({
      productId: line.productId,
      variantId: line.variantId,
      subscriptionPlanId: line.subscriptionPlanId,
      quantity: line.quantity.toString(),
      unitPrice: line.unitPrice.toString(),
      discountPercent: line.discountPercent.toString(),
      taxCode: line.taxCode,
      taxRate: line.taxRate.toString(),
      taxBehavior: line.taxBehavior,
      billingType: line.billingType,
    })),
  });

  const existingRisk = await transaction.quoteRiskAssessment.findUnique({
    where: { quoteVersionId: version.id },
    select: { id: true },
  });
  if (existingRisk !== null) {
    await transaction.quoteLineRiskLimitMatch.deleteMany({
      where: {
        organizationId,
        lineRiskFact: { assessmentId: existingRisk.id },
      },
    });
    await transaction.quoteLineRiskFact.deleteMany({
      where: { organizationId, assessmentId: existingRisk.id },
    });
    await transaction.quoteRiskAssessment.delete({
      where: { id: existingRisk.id },
    });
  }

  const violatingLines = calculatedLines.filter((line) =>
    line.excess.greaterThan(ZERO),
  );
  const lineAdjustments = violatingLines.flatMap((line) => {
    const discountPercent = safeExplicitDiscountPercent(
      line.line.listUnitPrice,
      line.line.unitPrice,
      line.allowed,
    );
    return discountPercent === null
      ? []
      : [
          {
            lineId: line.line.id,
            productName: line.line.productName,
            discountPercent,
          },
        ];
  });
  const suggestedDiscounts = new Map(
    lineAdjustments.map((adjustment) => [
      adjustment.lineId,
      adjustment.discountPercent,
    ]),
  );
  const suggestedAmounts = calculatedLines.map((calculatedLine) => ({
    calculatedLine,
    discountPercent:
      suggestedDiscounts.get(calculatedLine.line.id) ??
      calculatedLine.line.discountPercent,
    amounts: calculateCommercialLine({
      unitPrice: calculatedLine.line.unitPrice,
      quantity: calculatedLine.line.quantity,
      discountPercent:
        suggestedDiscounts.get(calculatedLine.line.id) ??
        calculatedLine.line.discountPercent,
      taxRate: calculatedLine.line.taxRate,
      taxBehavior: calculatedLine.line.taxBehavior,
    }),
  }));
  const projectedRevenue = rounded(
    suggestedAmounts.reduce(
      (sum, suggestion) => sum.plus(suggestion.amounts.preTaxSubtotal),
      ZERO,
    ),
  );
  const projectedTotal = rounded(
    suggestedAmounts.reduce(
      (sum, suggestion) => sum.plus(suggestion.amounts.total),
      ZERO,
    ),
  );
  const projectedMarginPercent = projectedRevenue.isZero()
    ? ZERO
    : rounded(
        projectedRevenue
          .minus(costTotal)
          .div(projectedRevenue)
          .mul(ONE_HUNDRED),
      );
  const projectedExcesses = suggestedAmounts.map(
    ({ calculatedLine, discountPercent }) => {
      const appliedDiscount = effectiveDiscountPercent(
        calculatedLine.line.listUnitPrice,
        calculatedLine.line.unitPrice,
        discountPercent,
      );
      return {
        excess: Prisma.Decimal.max(
          ZERO,
          appliedDiscount.minus(calculatedLine.allowed),
        ),
        weight: calculatedLine.weight,
      };
    },
  );
  const projectedBlendedExcess = rounded(
    projectedExcesses.reduce(
      (sum, line) => sum.plus(line.weight.mul(line.excess)),
      ZERO,
    ),
  );
  const projectedMaximumLineExcess = projectedExcesses.reduce(
    (maximum, line) => Prisma.Decimal.max(maximum, line.excess),
    ZERO,
  );
  const projectedCreditExposure = rounded(
    quote.customerAccount.currentExposure.plus(projectedTotal),
  );
  const projectedCreditUtilization = quote.customerAccount.creditLimit.isZero()
    ? ZERO
    : rounded(
        projectedCreditExposure
          .div(quote.customerAccount.creditLimit)
          .mul(ONE_HUNDRED),
      );
  const projectedRepresentativeAnomaly = representativeAnomalyBenchmark(
    projectedBlendedExcess,
    representativeHistory.map((assessment) => assessment.blendedExcess),
  ).anomaly;
  const projectedPolicy = evaluatePolicyRoute({
    anyLineAboveCeiling: false,
    blendedExcess: projectedBlendedExcess,
    maximumLineExcess: projectedMaximumLineExcess,
    marginPercent: projectedMarginPercent,
    creditExposure: projectedCreditExposure,
    creditUtilization: projectedCreditUtilization,
    overdueBalance: quote.customerAccount.overdueBalance,
    latePaidInvoiceCount: paymentHistory.latePaidInvoiceCount,
    failedPaymentCount: paymentHistory.failedPaymentCount,
    onTimePaymentRatePercent: paymentHistory.onTimePaymentRatePercent,
    representativeAnomaly: projectedRepresentativeAnomaly,
  });
  const firstAdjustment = lineAdjustments[0];
  const thresholdSafeSuggestion =
    firstAdjustment !== undefined &&
    lineAdjustments.length === violatingLines.length &&
    projectedMaximumLineExcess.isZero() &&
    projectedPolicy.requiredRoute.length === 0
      ? {
          lineId: firstAdjustment.lineId,
          discountPercent: firstAdjustment.discountPercent.toString(),
          lineAdjustments: lineAdjustments.map((adjustment) => ({
            lineId: adjustment.lineId,
            discountPercent: adjustment.discountPercent.toString(),
          })),
          projectedMarginPercent: projectedMarginPercent.toString(),
          projectedBlendedExcess: projectedBlendedExcess.toString(),
          projectedMaximumLineExcess: projectedMaximumLineExcess.toString(),
          verifiedNoApprovalRoute: true as const,
          explanation: `Reduce ${lineAdjustments.length} line(s) to their applicable discount ceilings (${lineAdjustments.map((adjustment) => `${adjustment.productName}: ${adjustment.discountPercent.toString()}%`).join(", ")}). The complete active policy set was re-evaluated and requires no approval at those values.`,
        }
      : null;
  const risk = await transaction.quoteRiskAssessment.create({
    data: {
      organizationId,
      quoteVersionId: version.id,
      blendedExcess,
      maximumLineExcess,
      postDiscountMarginPercent: marginPercent,
      creditExposure,
      creditUtilizationPercent: creditUtilization,
      overdueBalance: quote.customerAccount.overdueBalance,
      representativeAnomaly,
      requiredRoute: jsonInput(requiredRoute),
      reasonCodes,
      thresholdSafeSuggestion:
        thresholdSafeSuggestion === null
          ? undefined
          : jsonInput(thresholdSafeSuggestion),
      lineFacts: {
        create: calculatedLines.map((line) => ({
          organizationId,
          quoteLineId: line.line.id,
          appliedDiscountPercent: line.appliedDiscount,
          allowedDiscountPercent: line.allowed,
          excessDiscountPercent: line.excess,
          preDiscountValue: line.preDiscountValue,
          weight: line.weight,
          weightedExcess: line.weightedExcess,
          reasonCodes: line.excess.greaterThan(ZERO)
            ? ["LINE_DISCOUNT_ABOVE_CEILING"]
            : [],
          limitMatches: {
            create: line.matched.map((limit) => ({
              organizationId,
              quoteLineId: line.line.id,
              discountLimitId: limit.id,
              ruleSnapshot: jsonInput({
                name: limit.name,
                maxDiscountPercent: limit.maxDiscountPercent.toString(),
                priority: limit.priority,
              }),
              reason: `Maximum ${limit.maxDiscountPercent.toString()}% from ${limit.name}`,
            })),
          },
        })),
      },
    },
  });
  await transaction.quoteVersion.update({
    where: { id: version.id },
    data: {
      subtotal,
      lineDiscountTotal,
      taxTotal,
      total,
      costTotal,
      grossMargin,
      marginPercent,
      riskFacts: jsonInput({
        blendedExcess: blendedExcess.toString(),
        maximumLineExcess: maximumLineExcess.toString(),
        representativeAnomaly: representativeAnomaly.toString(),
        paymentHistory: {
          settledInvoiceCount: paymentHistory.settledInvoiceCount,
          latePaidInvoiceCount: paymentHistory.latePaidInvoiceCount,
          failedPaymentCount: paymentHistory.failedPaymentCount,
          onTimePaymentRatePercent:
            paymentHistory.onTimePaymentRatePercent?.toString() ?? null,
        },
        representativeAnomalyBenchmark: {
          basis: anomalyBenchmark.basis,
          sampleSize: anomalyBenchmark.sampleSize,
          meanBlendedExcess: anomalyBenchmark.meanBlendedExcess.toString(),
          meanAbsoluteDeviation:
            anomalyBenchmark.meanAbsoluteDeviation.toString(),
          alertThreshold: anomalyBenchmark.threshold.toString(),
          method:
            "Current blended excess above the representative's recent mean plus the larger of one percentage point or two mean absolute deviations",
        },
        reasonCodes,
      }),
      policySnapshot: jsonInput({
        evaluatedAt: now.toISOString(),
        matchedPolicies: matchedPolicies.map(({ policy, steps }) => ({
          id: policy.id,
          code: policy.code,
          version: policy.version,
          name: policy.name,
          priority: policy.priority,
          predicates: policy.predicates,
          matchedReasons: [...new Set(steps.flatMap(({ reasons }) => reasons))],
          steps: steps.map(({ step }) => ({
            templateId: step.id,
            sequence: step.sequence,
            requiredRole: step.requiredRole,
            requiredCapability: step.requiredCapability,
            assigneeStrategy: step.assigneeStrategy,
            dueAfterHours: step.dueAfterHours,
          })),
        })),
      }),
      termsFingerprint: fingerprint,
    },
  });
  void risk;
  return loadQuote(transaction, organizationId, quoteId);
}
