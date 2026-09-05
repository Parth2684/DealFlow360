import { d, roundRate, toRateString } from "../../../shared/decimal.js";
import type { Decimal } from "@repo/db";

export interface DiscountCeiling {
  limitId: string;
  name: string;
  maxDiscountPct: Decimal;
  priority: number;
}

export interface LineRiskInput {
  lineId: string;
  productName: string;
  appliedDiscountPct: Decimal;
  preDiscountValue: Decimal;
  ceilings: DiscountCeiling[];
}

export interface LineRiskContribution {
  lineId: string;
  productName: string;
  allowedDiscount: Decimal;
  appliedDiscount: Decimal;
  excess: Decimal;
  weight: Decimal;
  weightedExcess: Decimal;
  violatingCeilings: string[];
}

export interface RiskEvaluationInput {
  lines: LineRiskInput[];
  marginPercent: Decimal;
  creditLimit: Decimal;
  currentExposure: Decimal;
  overdueBalance: Decimal;
  policyThresholds?: {
    managerBlendedExcessGte?: number;
    financeMaxLineExcessGte?: number;
    financeBlendedExcessGte?: number;
    financeMarginPercentLt?: number;
    financeCreditExposureRatioGt?: number;
  };
}

export interface RiskEvaluationResult {
  blendedExcess: Decimal;
  maxLineExcess: Decimal;
  lineContributions: LineRiskContribution[];
  routeReasons: string[];
  requiredApprovers: ("manager" | "finance")[];
  requiresManager: boolean;
  requiresFinance: boolean;
  safeDiscountSuggestion: {
    lineId: string;
    suggestedDiscount: Decimal;
    reason: string;
  } | null;
}

const DEFAULT_THRESHOLDS = {
  managerBlendedExcessGte: 1.5,
  financeMaxLineExcessGte: 8,
  financeBlendedExcessGte: 4,
  financeMarginPercentLt: 25,
  financeCreditExposureRatioGt: 0.8,
};

export function resolveAllowedDiscount(
  ceilings: DiscountCeiling[],
): Decimal {
  if (ceilings.length === 0) return d(100);
  const sorted = [...ceilings].sort((a, b) => b.priority - a.priority);
  return sorted.reduce((min, c) =>
    c.maxDiscountPct.lt(min) ? c.maxDiscountPct : min,
  sorted[0]!.maxDiscountPct);
}

export function evaluateDiscountRisk(
  input: RiskEvaluationInput,
): RiskEvaluationResult {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...input.policyThresholds };
  const totalPreDiscount = input.lines.reduce(
    (sum, l) => sum.add(l.preDiscountValue),
    d(0),
  );

  const lineContributions: LineRiskContribution[] = input.lines.map((line) => {
    const allowedDiscount = resolveAllowedDiscount(line.ceilings);
    const excess = line.appliedDiscountPct.gt(allowedDiscount)
      ? roundRate(line.appliedDiscountPct.sub(allowedDiscount))
      : d(0);
    const weight = totalPreDiscount.isZero()
      ? d(0)
      : roundRate(line.preDiscountValue.div(totalPreDiscount).mul(100));
    const weightedExcess = roundRate(weight.mul(excess).div(100));
    const violating = line.ceilings
      .filter((c) => line.appliedDiscountPct.gt(c.maxDiscountPct))
      .map((c) => c.name);

    return {
      lineId: line.lineId,
      productName: line.productName,
      allowedDiscount,
      appliedDiscount: line.appliedDiscountPct,
      excess,
      weight,
      weightedExcess,
      violatingCeilings: violating,
    };
  });

  const blendedExcess = roundRate(
    lineContributions.reduce((sum, l) => sum.add(l.weightedExcess), d(0)),
  );
  const maxLineExcess = lineContributions.reduce(
    (max, l) => (l.excess.gt(max) ? l.excess : max),
    d(0),
  );

  const creditRatio = input.creditLimit.isZero()
    ? d(0)
    : roundRate(input.currentExposure.div(input.creditLimit));

  const routeReasons: string[] = [];
  const requiredApprovers: ("manager" | "finance")[] = [];

  const anyLineExceeds = lineContributions.some((l) => l.excess.gt(0));
  const requiresManager =
    anyLineExceeds ||
    blendedExcess.gte(thresholds.managerBlendedExcessGte);

  if (anyLineExceeds) {
    routeReasons.push("One or more lines exceed their discount ceiling");
  }
  if (blendedExcess.gte(thresholds.managerBlendedExcessGte)) {
    routeReasons.push(
      `Blended excess (${toRateString(blendedExcess)} pts) meets manager threshold (${thresholds.managerBlendedExcessGte} pts)`,
    );
  }

  const requiresFinance =
    maxLineExcess.gte(thresholds.financeMaxLineExcessGte) ||
    blendedExcess.gte(thresholds.financeBlendedExcessGte) ||
    input.marginPercent.lt(thresholds.financeMarginPercentLt) ||
    creditRatio.gt(thresholds.financeCreditExposureRatioGt) ||
    input.overdueBalance.gt(0);

  if (maxLineExcess.gte(thresholds.financeMaxLineExcessGte)) {
    routeReasons.push(
      `Maximum line excess (${toRateString(maxLineExcess)} pts) requires finance review`,
    );
  }
  if (blendedExcess.gte(thresholds.financeBlendedExcessGte)) {
    routeReasons.push(
      `Blended excess (${toRateString(blendedExcess)} pts) requires finance review`,
    );
  }
  if (input.marginPercent.lt(thresholds.financeMarginPercentLt)) {
    routeReasons.push(
      `Margin (${toRateString(input.marginPercent)}%) is below floor (${thresholds.financeMarginPercentLt}%)`,
    );
  }
  if (creditRatio.gt(thresholds.financeCreditExposureRatioGt)) {
    routeReasons.push(
      `Credit utilization (${toRateString(creditRatio.mul(100))}%) exceeds threshold`,
    );
  }
  if (input.overdueBalance.gt(0)) {
    routeReasons.push(
      `Customer has overdue balance of ${input.overdueBalance.toFixed(2)}`,
    );
  }

  if (requiresManager) requiredApprovers.push("manager");
  if (requiresFinance) requiredApprovers.push("finance");

  const worstLine = [...lineContributions].sort((a, b) =>
    b.excess.comparedTo(a.excess),
  )[0];

  const safeDiscountSuggestion =
    worstLine && worstLine.excess.gt(0)
      ? {
          lineId: worstLine.lineId,
          suggestedDiscount: worstLine.allowedDiscount,
          reason: `Reduce discount on ${worstLine.productName} to ${toRateString(worstLine.allowedDiscount)}% to meet the most restrictive ceiling`,
        }
      : null;

  return {
    blendedExcess,
    maxLineExcess,
    lineContributions,
    routeReasons,
    requiredApprovers,
    requiresManager,
    requiresFinance,
    safeDiscountSuggestion,
  };
}
