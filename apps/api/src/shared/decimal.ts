import { Decimal } from "@repo/db";

export { Decimal };

export function d(value: string | number | Decimal): Decimal {
  if (value instanceof Decimal) return value;
  return new Decimal(value);
}

export function roundMoney(value: Decimal, decimals = 2): Decimal {
  return value.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
}

export function roundRate(value: Decimal, decimals = 4): Decimal {
  return value.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
}

export function toMoneyString(value: Decimal): string {
  return roundMoney(value).toFixed(2);
}

export function toRateString(value: Decimal): string {
  return roundRate(value).toFixed(4);
}

export function percentOf(amount: Decimal, percent: Decimal): Decimal {
  return roundMoney(amount.mul(percent).div(100));
}

export function marginPercent(revenue: Decimal, cost: Decimal): Decimal {
  if (revenue.isZero()) return d(0);
  return roundRate(revenue.sub(cost).div(revenue).mul(100));
}
