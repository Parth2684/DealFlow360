/**
 * UI-facing option lists for enum fields. Kept as plain literals (rather than
 * importing the runtime enum objects from @repo/db) so the browser bundle
 * never pulls in the Prisma client — see lib/api/types.ts for the type-only
 * enum imports that keep this list honest.
 */

export const QUOTE_STAGES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "READY_TO_SEND",
  "SENT",
  "UNDER_NEGOTIATION",
  "CUSTOMER_ACCEPTED",
  "CONFIRMED",
  "REVISION_REQUIRED",
  "EXPIRED",
  "CANCELLED",
] as const;

export const BILLING_TYPES = ["ONE_TIME", "RECURRING"] as const;

export const TAX_BEHAVIORS = ["INCLUSIVE", "EXCLUSIVE"] as const;

export const APPROVAL_ACTIONS = ["APPROVE", "REJECT", "REQUEST_REVISION"] as const;

export const CHANGE_REQUEST_ACTIONS = ["REMOVE", "CHANGE_QUANTITY", "CHANGE_PRICE"] as const;

export const PAYMENT_METHODS = ["BANK_TRANSFER", "CREDIT_CARD", "CHECK", "OTHER"] as const;

export const SUBSCRIPTION_INTERVALS = ["DAY", "WEEK", "MONTH", "YEAR"] as const;

export const PRORATION_CONVENTIONS = ["CALENDAR_DAYS", "THIRTY_DAY_MONTH"] as const;

export const EXPORT_REPORT_TYPES = ["QUOTES", "ORDERS", "INVOICES", "CUSTOMERS", "INVENTORY"] as const;

export const EXPORT_FORMATS = ["CSV", "XLSX", "PDF"] as const;

export const CURRENCIES = ["USD", "EUR", "GBP", "INR"] as const;
