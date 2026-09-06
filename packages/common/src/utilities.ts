import { DECIMAL_SCALE } from "./constants.js";
import {
  DecimalStringSchema,
  decimalStringToScaledInteger,
  type DecimalString,
} from "./primitives.js";

const SCALE_FACTOR = 10n ** BigInt(DECIMAL_SCALE);

function roundedQuotient(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new RangeError("Cannot divide by zero");
  }

  const negative = numerator < 0n !== denominator < 0n;
  const absoluteNumerator = numerator < 0n ? -numerator : numerator;
  const absoluteDenominator = denominator < 0n ? -denominator : denominator;
  const quotient = absoluteNumerator / absoluteDenominator;
  const remainder = absoluteNumerator % absoluteDenominator;
  const rounded =
    remainder * 2n >= absoluteDenominator ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
}

export function scaledIntegerToDecimalString(
  value: bigint,
  trimTrailingZeros = true,
): DecimalString {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / SCALE_FACTOR;
  const fractional = (absolute % SCALE_FACTOR)
    .toString()
    .padStart(DECIMAL_SCALE, "0");
  const normalizedFraction = trimTrailingZeros
    ? fractional.replace(/0+$/, "")
    : fractional;
  const unsigned =
    normalizedFraction.length > 0
      ? `${whole}.${normalizedFraction}`
      : `${whole}`;
  const result = negative && absolute !== 0n ? `-${unsigned}` : unsigned;
  return DecimalStringSchema.parse(result);
}

export function normalizeDecimalString(value: string): DecimalString {
  const parsed = DecimalStringSchema.parse(value);
  return scaledIntegerToDecimalString(decimalStringToScaledInteger(parsed));
}

export function compareDecimalStrings(left: string, right: string): -1 | 0 | 1 {
  const difference =
    decimalStringToScaledInteger(DecimalStringSchema.parse(left)) -
    decimalStringToScaledInteger(DecimalStringSchema.parse(right));
  if (difference < 0n) return -1;
  if (difference > 0n) return 1;
  return 0;
}

export function addDecimalStrings(...values: readonly string[]): DecimalString {
  const sum = values.reduce(
    (total, value) =>
      total + decimalStringToScaledInteger(DecimalStringSchema.parse(value)),
    0n,
  );
  return scaledIntegerToDecimalString(sum);
}

export function subtractDecimalStrings(
  minuend: string,
  subtrahend: string,
): DecimalString {
  return scaledIntegerToDecimalString(
    decimalStringToScaledInteger(DecimalStringSchema.parse(minuend)) -
      decimalStringToScaledInteger(DecimalStringSchema.parse(subtrahend)),
  );
}

export function multiplyDecimalStrings(
  left: string,
  right: string,
): DecimalString {
  const product =
    decimalStringToScaledInteger(DecimalStringSchema.parse(left)) *
    decimalStringToScaledInteger(DecimalStringSchema.parse(right));
  return scaledIntegerToDecimalString(roundedQuotient(product, SCALE_FACTOR));
}

export function divideDecimalStrings(
  dividend: string,
  divisor: string,
): DecimalString {
  const scaledDividend = decimalStringToScaledInteger(
    DecimalStringSchema.parse(dividend),
  );
  const scaledDivisor = decimalStringToScaledInteger(
    DecimalStringSchema.parse(divisor),
  );
  return scaledIntegerToDecimalString(
    roundedQuotient(scaledDividend * SCALE_FACTOR, scaledDivisor),
  );
}

/**
 * Formatting is a presentation boundary only. Authoritative arithmetic should
 * stay in Prisma Decimal on the API or use the exact helpers above.
 */
export function formatMoney(
  value: string,
  currency: string,
  locale = "en-US",
): string {
  const decimal = normalizeDecimalString(value);
  const numeric = Number(decimal);
  if (!Number.isFinite(numeric)) {
    throw new RangeError("Money value is outside the display formatter range");
  }
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: DECIMAL_SCALE,
  }).format(numeric);
}

export function formatPercentage(
  value: string,
  locale = "en-US",
  maximumFractionDigits = 2,
): string {
  const decimal = normalizeDecimalString(value);
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits }).format(Number(decimal))}%`;
}

export function formatEnumLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatDateTime(
  value: string,
  locale = "en-US",
  timeZone = "UTC",
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

export function assertNever(value: never, message = "Unexpected value"): never {
  throw new TypeError(`${message}: ${String(value)}`);
}
