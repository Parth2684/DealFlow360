import type { BillingInterval } from "@repo/common";

const DAY_MS = 86_400_000;
const SEARCH_WINDOW_MS = 48 * 60 * 60_000;
const billingDateFormatters = new Map<string, Intl.DateTimeFormat>();

function billingDateFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = billingDateFormatters.get(timeZone);
  if (cached !== undefined) return cached;
  const formatter = new Intl.DateTimeFormat("en-US", {
    calendar: "iso8601",
    numberingSystem: "latn",
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  billingDateFormatters.set(timeZone, formatter);
  return formatter;
}

function localDateParts(
  value: Date,
  timeZone: string,
): { year: number; month: number; day: number } {
  const parts = billingDateFormatter(timeZone).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes): number => {
    const valuePart = parts.find((candidate) => candidate.type === type)?.value;
    if (valuePart === undefined) {
      throw new RangeError(
        `Unable to resolve ${type} in time zone ${timeZone}`,
      );
    }
    return Number.parseInt(valuePart, 10);
  };
  return { year: part("year"), month: part("month"), day: part("day") };
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

export function utcDate(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

export function addUtcDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Converts an instant to the organization's local calendar date. Date-only
 * values are represented internally as UTC midnight so PostgreSQL `date`
 * columns and ISO serialization remain stable across server time zones.
 */
export function billingDateFromInstant(value: Date, timeZone: string): Date {
  const { year, month, day } = localDateParts(value, timeZone);
  return new Date(Date.UTC(year, month - 1, day));
}

export function billingDateKey(value: Date): string {
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
}

export function billingDateKeyInTimeZone(
  value: Date,
  timeZone: string,
): string {
  return billingDateKey(billingDateFromInstant(value, timeZone));
}

export function addBillingDays(value: Date, days: number): Date {
  return addUtcDays(utcDate(value), days);
}

export function billingDateHasStarted(
  date: Date,
  now: Date,
  timeZone: string,
): boolean {
  return billingDateKeyInTimeZone(now, timeZone) >= billingDateKey(date);
}

/** An invoice becomes overdue only after its local due calendar day ends. */
export function isPastBillingDueDate(
  dueDate: Date,
  now: Date,
  timeZone: string,
): boolean {
  return billingDateKeyInTimeZone(now, timeZone) > billingDateKey(dueDate);
}

/**
 * Resolves the first real instant belonging to an organization's calendar
 * date. A binary search avoids assuming a fixed offset and remains correct at
 * daylight-saving boundaries. It rejects historically skipped local dates.
 */
export function startOfBillingDateInstant(date: Date, timeZone: string): Date {
  const canonical = utcDate(date);
  const target = billingDateKey(canonical);
  let low = canonical.getTime() - SEARCH_WINDOW_MS;
  let high = canonical.getTime() + SEARCH_WINDOW_MS;
  if (
    billingDateKeyInTimeZone(new Date(low), timeZone) >= target ||
    billingDateKeyInTimeZone(new Date(high), timeZone) < target
  ) {
    throw new RangeError(
      `Unable to locate billing date ${target} in ${timeZone}`,
    );
  }
  while (high - low > 1) {
    const middle = low + Math.floor((high - low) / 2);
    if (billingDateKeyInTimeZone(new Date(middle), timeZone) >= target) {
      high = middle;
    } else {
      low = middle;
    }
  }
  const result = new Date(high);
  if (billingDateKeyInTimeZone(result, timeZone) !== target) {
    throw new RangeError(
      `Billing date ${target} does not exist in ${timeZone}`,
    );
  }
  return result;
}

export function billingDaysBetween(start: Date, end: Date): number {
  return Math.round(
    (utcDate(end).getTime() - utcDate(start).getTime()) / DAY_MS,
  );
}

function lastUtcDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Advances a billing boundary without JavaScript's month-end overflow. For
 * example, a January 31 monthly anchor becomes February 28/29, not March 2/3.
 */
export function addBillingInterval(
  value: Date,
  interval: BillingInterval,
  count: number,
  anchorDay = value.getUTCDate(),
): Date {
  const result = utcDate(value);
  if (interval === "DAY") return addUtcDays(result, count);
  if (interval === "WEEK") return addUtcDays(result, count * 7);

  result.setUTCDate(1);
  if (interval === "MONTH") result.setUTCMonth(result.getUTCMonth() + count);
  if (interval === "YEAR")
    result.setUTCFullYear(result.getUTCFullYear() + count);
  result.setUTCDate(
    Math.min(
      Math.max(anchorDay, 1),
      lastUtcDayOfMonth(result.getUTCFullYear(), result.getUTCMonth()),
    ),
  );
  return result;
}
