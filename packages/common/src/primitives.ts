import { z } from "zod";

import { DEFAULT_LOCALE } from "./constants.js";

const DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d{1,4})?$/;
const NON_NEGATIVE_DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/;

export const IdSchema = z.uuid();
export type Id = z.infer<typeof IdSchema>;

export const EmailSchema = z
  .email()
  .max(254)
  .transform((email) => email.toLowerCase());
export const CurrencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "Expected a three-letter ISO 4217 currency code");
export const LocaleSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .refine(
    (value) => {
      try {
        Intl.getCanonicalLocales(value);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Expected a valid BCP 47 locale" },
  )
  .transform((value) => Intl.getCanonicalLocales(value)[0] ?? DEFAULT_LOCALE);
export type Locale = z.infer<typeof LocaleSchema>;
export const TimeZoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine(
    (value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    },
    { message: "Expected a valid IANA timezone" },
  );

/** API timestamps are UTC/offset-aware ISO 8601 strings, never Date objects. */
export const IsoDateTimeSchema = z.iso.datetime({ offset: true });
/** Calendar-only values are serialized as YYYY-MM-DD to avoid timezone drift. */
export const IsoDateSchema = z.iso.date();

/**
 * Decimal values cross the API as base-10 strings with at most four fractional
 * digits. Converting them to JavaScript numbers for business arithmetic is not
 * part of this contract.
 */
export const DecimalStringSchema = z
  .string()
  .trim()
  .regex(
    DECIMAL_PATTERN,
    "Expected a base-10 decimal string with up to four decimal places",
  );
export type DecimalString = z.infer<typeof DecimalStringSchema>;

export const NonNegativeDecimalStringSchema = z
  .string()
  .trim()
  .regex(
    NON_NEGATIVE_DECIMAL_PATTERN,
    "Expected a non-negative decimal string with up to four decimal places",
  );
export type NonNegativeDecimalString = z.infer<
  typeof NonNegativeDecimalStringSchema
>;

export const PositiveDecimalStringSchema =
  NonNegativeDecimalStringSchema.refine(
    (value) =>
      NON_NEGATIVE_DECIMAL_PATTERN.test(value) &&
      decimalStringToScaledInteger(value) > 0n,
    { message: "Expected a positive decimal string" },
  );
export type PositiveDecimalString = z.infer<typeof PositiveDecimalStringSchema>;

export const PercentageStringSchema = NonNegativeDecimalStringSchema.refine(
  (value) =>
    NON_NEGATIVE_DECIMAL_PATTERN.test(value) &&
    decimalStringToScaledInteger(value) <= 1_000_000n,
  { message: "Expected a percentage between 0 and 100" },
);
export type PercentageString = z.infer<typeof PercentageStringSchema>;

export const RevisionSchema = z.int().positive();
export const NonNegativeIntegerSchema = z.int().nonnegative();
export const PositiveIntegerSchema = z.int().positive();
export const NonEmptyStringSchema = z.string().trim().min(1);
export const CodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[A-Za-z0-9_-]+$/);
export const TermsFingerprintSchema = z.string().regex(/^[a-fA-F0-9]{64}$/);
export const IdempotencyKeySchema = z.string().trim().min(8).max(191);

export const JsonObjectSchema = z.record(z.string(), z.unknown());
export type JsonObject = z.infer<typeof JsonObjectSchema>;

export const EntityTimestampsSchema = z.object({
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type EntityTimestamps = z.infer<typeof EntityTimestampsSchema>;

export const RevisionPreconditionSchema = z.object({
  revision: RevisionSchema,
});
export type RevisionPrecondition = z.infer<typeof RevisionPreconditionSchema>;

export const CursorPageQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type CursorPageQuery = z.infer<typeof CursorPageQuerySchema>;

/** Common query fields for searchable, sortable cursor-based list endpoints. */
export const ListQuerySchema = CursorPageQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  sort: z.string().trim().min(1).max(64).optional(),
  direction: z.enum(["asc", "desc"]).default("desc"),
});
export type ListQuery = z.infer<typeof ListQuerySchema>;

export const PageInfoSchema = z.object({
  nextCursor: z.string().min(1).nullable(),
  hasNextPage: z.boolean(),
});
export type PageInfo = z.infer<typeof PageInfoSchema>;

export function createCursorPageSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    pageInfo: PageInfoSchema,
  });
}

export interface CursorPage<T> {
  items: T[];
  pageInfo: PageInfo;
}

export const ValidationIssueSchema = z.object({
  path: z.array(z.union([z.string(), z.number().int()])),
  message: z.string().min(1),
  code: z.string().min(1).optional(),
});
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

/** RFC 7807-compatible error body with DealFlow360 validation extensions. */
export const ProblemDetailsSchema = z.object({
  type: z.string().min(1).default("about:blank"),
  title: z.string().min(1),
  status: z.number().int().min(400).max(599),
  detail: z.string().optional(),
  instance: z.string().optional(),
  code: z.string().min(1).optional(),
  traceId: z.string().min(1).optional(),
  errors: z.array(ValidationIssueSchema).optional(),
});
export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;

export const HealthResponseSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  service: z.literal("dealflow360-api"),
  version: z.string().min(1),
  timestamp: IsoDateTimeSchema,
  dependencies: z.record(z.string(), z.enum(["ok", "degraded"])).optional(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export function decimalStringToScaledInteger(value: string, scale = 4): bigint {
  if (!DECIMAL_PATTERN.test(value)) {
    throw new TypeError(`Invalid decimal string: ${value}`);
  }

  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const paddedFraction = fraction.padEnd(scale, "0").slice(0, scale);
  const result =
    BigInt(whole) * 10n ** BigInt(scale) + BigInt(paddedFraction || "0");
  return negative ? -result : result;
}
