export const Roles = {
  ADMIN: "ADMIN",
  SALES_REP: "SALES_REP",
  SALES_MANAGER: "SALES_MANAGER",
  FINANCE: "FINANCE",
  OPERATIONS: "OPERATIONS",
  CUSTOMER: "CUSTOMER",
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];

export const ProductTypes = {
  HARDWARE: "HARDWARE",
  SERVICE: "SERVICE",
  SUBSCRIPTION: "SUBSCRIPTION",
} as const;

export type ProductType = (typeof ProductTypes)[keyof typeof ProductTypes];

export const BillingTypes = {
  ONE_TIME: "ONE_TIME",
  RECURRING: "RECURRING",
} as const;

export type BillingType = (typeof BillingTypes)[keyof typeof BillingTypes];

export const QuoteStages = {
  DRAFT: "DRAFT",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  READY_TO_SEND: "READY_TO_SEND",
  SENT: "SENT",
  UNDER_NEGOTIATION: "UNDER_NEGOTIATION",
  CUSTOMER_ACCEPTED: "CUSTOMER_ACCEPTED",
  CONFIRMED: "CONFIRMED",
  REVISION_REQUIRED: "REVISION_REQUIRED",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED",
} as const;

export type QuoteStage = (typeof QuoteStages)[keyof typeof QuoteStages];

export const ApprovalDecisionActions = {
  APPROVE: "APPROVE",
  REJECT: "REJECT",
  REQUEST_REVISION: "REQUEST_REVISION",
} as const;

export type ApprovalDecisionAction =
  (typeof ApprovalDecisionActions)[keyof typeof ApprovalDecisionActions];

export const OutboxEventTypes = {
  QUOTE_CREATED: "quote.created",
  QUOTE_VERSIONED: "quote.versioned",
  QUOTE_SUBMITTED: "quote.submitted",
  QUOTE_SENT: "quote.sent",
  APPROVAL_REQUESTED: "approval.requested",
  APPROVAL_COMPLETED: "approval.completed",
  APPROVAL_SUPERSEDED: "approval.superseded",
  CUSTOMER_COUNTERED: "customer.countered",
  CUSTOMER_ACCEPTED: "customer.accepted",
  ORDER_CONFIRMED: "order.confirmed",
  STOCK_RESERVED: "stock.reserved",
  BACKORDER_CREATED: "backorder.created",
  INVENTORY_REPLENISHED: "inventory.replenished",
  SUBSCRIPTION_STARTED: "subscription.started",
  SUBSCRIPTION_CHANGED: "subscription.changed",
  INVOICE_CREATED: "invoice.created",
  INVOICE_DUE: "invoice.due",
  PAYMENT_RECORDED: "payment.recorded",
  DEAL_ACTIVITY_RECORDED: "deal.activityRecorded",
  ALERT_CREATED: "alert.created",
  NUDGE_REQUESTED: "nudge.requested",
} as const;

export type OutboxEventType =
  (typeof OutboxEventTypes)[keyof typeof OutboxEventTypes];
