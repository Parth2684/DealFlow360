import { d, roundMoney, roundRate, percentOf, marginPercent, toMoneyString, toRateString } from "../../../shared/decimal.js";
import type { Decimal } from "@repo/db";

export interface PriceResolutionInput {
  productId: string;
  categoryId: string;
  tierId: string;
  quantity: Decimal;
  unitPriceOverride?: Decimal;
  variantSurcharge?: Decimal;
}

export interface ResolvedPrice {
  unitPrice: Decimal;
  unitCost: Decimal;
  source: string;
}

export interface QuoteLineCalcInput {
  lineId: string;
  productId: string;
  categoryId: string;
  quantity: Decimal;
  unitPrice: Decimal;
  unitCost: Decimal;
  discountPercent: Decimal;
  taxRate: Decimal;
  taxBehavior: "INCLUSIVE" | "EXCLUSIVE";
}

export interface QuoteLineCalcResult {
  lineId: string;
  discountAmount: Decimal;
  taxAmount: Decimal;
  lineSubtotal: Decimal;
  lineTotal: Decimal;
  lineCost: Decimal;
  preDiscountValue: Decimal;
}

export interface QuoteTotalsResult {
  subtotal: Decimal;
  taxTotal: Decimal;
  discountTotal: Decimal;
  total: Decimal;
  costTotal: Decimal;
  grossMargin: Decimal;
  marginPercent: Decimal;
  lines: QuoteLineCalcResult[];
}

export function calculateLine(input: QuoteLineCalcInput): QuoteLineCalcResult {
  const preDiscountValue = roundMoney(input.unitPrice.mul(input.quantity));
  const discountAmount = percentOf(preDiscountValue, input.discountPercent);
  const lineSubtotal = roundMoney(preDiscountValue.sub(discountAmount));
  const lineCost = roundMoney(input.unitCost.mul(input.quantity));

  let taxAmount: Decimal;
  if (input.taxBehavior === "INCLUSIVE") {
    taxAmount = roundMoney(
      lineSubtotal.sub(lineSubtotal.div(d(1).add(input.taxRate.div(100)))),
    );
  } else {
    taxAmount = percentOf(lineSubtotal, input.taxRate);
  }

  const lineTotal =
    input.taxBehavior === "INCLUSIVE"
      ? lineSubtotal
      : roundMoney(lineSubtotal.add(taxAmount));

  return {
    lineId: input.lineId,
    discountAmount,
    taxAmount,
    lineSubtotal,
    lineTotal,
    lineCost,
    preDiscountValue,
  };
}

export function calculateQuoteTotals(
  lines: QuoteLineCalcInput[],
): QuoteTotalsResult {
  const calculated = lines.map(calculateLine);
  const subtotal = roundMoney(
    calculated.reduce((sum, l) => sum.add(l.lineSubtotal), d(0)),
  );
  const taxTotal = roundMoney(
    calculated.reduce((sum, l) => sum.add(l.taxAmount), d(0)),
  );
  const discountTotal = roundMoney(
    calculated.reduce((sum, l) => sum.add(l.discountAmount), d(0)),
  );
  const total = roundMoney(
    calculated.reduce((sum, l) => sum.add(l.lineTotal), d(0)),
  );
  const costTotal = roundMoney(
    calculated.reduce((sum, l) => sum.add(l.lineCost), d(0)),
  );
  const grossMargin = roundMoney(total.sub(taxTotal).sub(costTotal));
  const revenue = total.sub(taxTotal);

  return {
    subtotal,
    taxTotal,
    discountTotal,
    total,
    costTotal,
    grossMargin,
    marginPercent: marginPercent(revenue, costTotal),
    lines: calculated,
  };
}

export function serializeTotals(totals: QuoteTotalsResult) {
  return {
    subtotal: toMoneyString(totals.subtotal),
    taxTotal: toMoneyString(totals.taxTotal),
    discountTotal: toMoneyString(totals.discountTotal),
    total: toMoneyString(totals.total),
    costTotal: toMoneyString(totals.costTotal),
    grossMargin: toMoneyString(totals.grossMargin),
    marginPercent: toRateString(totals.marginPercent),
  };
}

export function resolveUnitPrice(
  rules: Array<{ unitPrice: Decimal; priority: number; minQuantity: Decimal; tierId?: string | null; productId?: string | null; categoryId?: string | null }>,
  input: PriceResolutionInput,
  baseCost: Decimal,
  fallbackPrice?: Decimal,
): ResolvedPrice {
  const applicable = rules
    .filter((r) => {
      if (r.productId && r.productId !== input.productId) return false;
      if (r.categoryId && r.categoryId !== input.categoryId) return false;
      if (r.tierId && r.tierId !== input.tierId) return false;
      if (input.quantity.lt(r.minQuantity)) return false;
      return true;
    })
    .sort((a, b) => b.priority - a.priority);

  const best = applicable[0];
  let unitPrice = best?.unitPrice ?? fallbackPrice ?? baseCost.mul(2);
  if (input.unitPriceOverride) unitPrice = input.unitPriceOverride;
  if (input.variantSurcharge) unitPrice = unitPrice.add(input.variantSurcharge);

  return {
    unitPrice: roundMoney(unitPrice),
    unitCost: roundMoney(baseCost),
    source: best ? "price_list" : "fallback",
  };
}
