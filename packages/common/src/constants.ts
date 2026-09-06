import { z } from "zod";

import type { Role } from "./enums.js";

export const API_V1_PREFIX = "/api/v1" as const;
export const SESSION_COOKIE_NAME = "session" as const;
export const PORTAL_SESSION_COOKIE_NAME = "portal_session" as const;
export const IDEMPOTENCY_HEADER = "Idempotency-Key" as const;
export const CSRF_HEADER = "X-CSRF-Token" as const;
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
export const DECIMAL_SCALE = 4;
export const DEFAULT_CURRENCY = "USD" as const;
export const DEFAULT_LOCALE = "en-US" as const;
export const DEFAULT_TIMEZONE = "UTC" as const;

export const CAPABILITIES = [
  "quotation.read",
  "quotation.create",
  "quotation.editOwn",
  "quotation.editAny",
  "quotation.submit",
  "quotation.send",
  "quotation.confirm",
  "approval.read",
  "approval.managerAct",
  "approval.financeAct",
  "customer.read",
  "customer.manage",
  "catalog.read",
  "configuration.manage",
  "recommendation.read",
  "inventory.read",
  "inventory.adjust",
  "fulfillment.read",
  "fulfillment.reserve",
  "fulfillment.override",
  "billing.read",
  "billing.issueInvoice",
  "billing.recordPayment",
  "billing.manageCredit",
  "subscription.read",
  "subscription.manage",
  "negotiation.read",
  "negotiation.respond",
  "portal.quoteRead",
  "portal.negotiate",
  "portal.confirm",
  "dealHealth.read",
  "dealHealth.manage",
  "reporting.read",
  "reporting.export",
  "audit.read",
] as const;
export const CapabilitySchema = z.enum(CAPABILITIES);
export type Capability = z.infer<typeof CapabilitySchema>;

const allInternalCapabilities = CAPABILITIES.filter(
  (capability) => !capability.startsWith("portal."),
);

export const ROLE_CAPABILITIES: Readonly<Record<Role, readonly Capability[]>> =
  {
    ADMIN: allInternalCapabilities,
    SALES_REP: [
      "quotation.read",
      "quotation.create",
      "quotation.editOwn",
      "quotation.submit",
      "quotation.send",
      "quotation.confirm",
      "approval.read",
      "customer.read",
      "catalog.read",
      "recommendation.read",
      "inventory.read",
      "fulfillment.read",
      "billing.read",
      "subscription.read",
      "negotiation.read",
      "negotiation.respond",
      "dealHealth.read",
      "reporting.read",
    ],
    SALES_MANAGER: [
      "quotation.read",
      "quotation.create",
      "quotation.editOwn",
      "quotation.editAny",
      "quotation.submit",
      "quotation.send",
      "quotation.confirm",
      "approval.read",
      "approval.managerAct",
      "customer.read",
      "customer.manage",
      "catalog.read",
      "recommendation.read",
      "inventory.read",
      "fulfillment.read",
      "billing.read",
      "subscription.read",
      "negotiation.read",
      "negotiation.respond",
      "dealHealth.read",
      "dealHealth.manage",
      "reporting.read",
      "reporting.export",
      "audit.read",
    ],
    FINANCE: [
      "quotation.read",
      "approval.read",
      "approval.financeAct",
      "customer.read",
      "catalog.read",
      "billing.read",
      "billing.issueInvoice",
      "billing.recordPayment",
      "billing.manageCredit",
      "subscription.read",
      "subscription.manage",
      "dealHealth.read",
      "dealHealth.manage",
      "reporting.read",
      "reporting.export",
      "audit.read",
    ],
    OPERATIONS: [
      "quotation.read",
      "customer.read",
      "catalog.read",
      "inventory.read",
      "inventory.adjust",
      "fulfillment.read",
      "fulfillment.reserve",
      "fulfillment.override",
      "billing.read",
      "subscription.read",
      "dealHealth.read",
      "dealHealth.manage",
      "reporting.read",
      "reporting.export",
      "audit.read",
    ],
    CUSTOMER: ["portal.quoteRead", "portal.negotiate", "portal.confirm"],
  };

export function hasCapability(
  roles: readonly Role[],
  capability: Capability,
): boolean {
  return roles.some((role) => ROLE_CAPABILITIES[role].includes(capability));
}

export const MATERIAL_QUOTE_FIELDS = [
  "customerAccountId",
  "productId",
  "variantId",
  "quantity",
  "unitPrice",
  "discountPercent",
  "taxId",
  "subscriptionPlanId",
  "billingType",
  "paymentTermsDays",
] as const;
export type MaterialQuoteField = (typeof MATERIAL_QUOTE_FIELDS)[number];

export const DOMAIN_EVENT_TYPES = [
  "quote.created",
  "quote.versioned",
  "quote.submitted",
  "quote.sent",
  "quote.negotiation_started",
  "quote.negotiation_paused",
  "quote.cancelled",
  "approval.requested",
  "approval.completed",
  "approval.superseded",
  "approval.delegated",
  "approval.delegation.cleared",
  "approval.delegation.expired",
  "customer.countered",
  "customer.accepted",
  "order.confirmed",
  "stock.reserved",
  "backorder.created",
  "inventory.replenished",
  "subscription.started",
  "subscription.changed",
  "invoice.created",
  "invoice.due",
  "payment.recorded",
  "deal.activityRecorded",
  "alert.created",
  "nudge.requested",
] as const;
export const DomainEventTypeSchema = z.enum(DOMAIN_EVENT_TYPES);
export type DomainEventType = z.infer<typeof DomainEventTypeSchema>;
