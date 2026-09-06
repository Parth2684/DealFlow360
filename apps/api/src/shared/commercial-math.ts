import { Prisma } from "@repo/db";

const ZERO = new Prisma.Decimal(0);
const ONE_HUNDRED = new Prisma.Decimal(100);

export interface CommercialLineInput {
  unitPrice: Prisma.Decimal;
  quantity: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  taxBehavior: "INCLUSIVE" | "EXCLUSIVE";
  discountPercent?: Prisma.Decimal;
  discountAmount?: Prisma.Decimal;
}

export interface CommercialLineAmounts {
  preDiscountAmount: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  discountedGross: Prisma.Decimal;
  preTaxSubtotal: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  total: Prisma.Decimal;
}

export function roundedMoney(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
}

export function sumMoney(values: readonly Prisma.Decimal[]): Prisma.Decimal {
  return roundedMoney(values.reduce((total, value) => total.plus(value), ZERO));
}

/**
 * The single source of truth for discounted line and inclusive/exclusive tax
 * arithmetic. Callers may supply either a percentage or an already allocated
 * discount amount, but never both.
 */
export function calculateCommercialLine(
  input: CommercialLineInput,
): CommercialLineAmounts {
  if (
    input.discountPercent !== undefined &&
    input.discountAmount !== undefined
  ) {
    throw new Error("A commercial line cannot have two discount inputs");
  }
  const preDiscountAmount = roundedMoney(input.unitPrice.mul(input.quantity));
  const discountAmount = roundedMoney(
    input.discountAmount ??
      preDiscountAmount.mul(input.discountPercent ?? ZERO).div(ONE_HUNDRED),
  );
  if (
    discountAmount.isNegative() ||
    discountAmount.greaterThan(preDiscountAmount)
  ) {
    throw new Error(
      "A commercial line discount must be within the line amount",
    );
  }
  const discountedGross = roundedMoney(preDiscountAmount.minus(discountAmount));
  const preTaxSubtotal =
    input.taxBehavior === "INCLUSIVE" && !input.taxRate.isZero()
      ? roundedMoney(
          discountedGross.div(ONE_HUNDRED.plus(input.taxRate)).mul(ONE_HUNDRED),
        )
      : discountedGross;
  const taxAmount =
    input.taxBehavior === "INCLUSIVE"
      ? roundedMoney(discountedGross.minus(preTaxSubtotal))
      : roundedMoney(preTaxSubtotal.mul(input.taxRate).div(ONE_HUNDRED));
  return {
    preDiscountAmount,
    discountAmount,
    discountedGross,
    preTaxSubtotal,
    taxAmount,
    total:
      input.taxBehavior === "INCLUSIVE"
        ? discountedGross
        : roundedMoney(preTaxSubtotal.plus(taxAmount)),
  };
}
