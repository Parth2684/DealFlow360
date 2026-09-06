import { z } from "zod";

/**
 * Contract enums intentionally do not import Prisma. They are the stable wire
 * values shared by the API and web app; the database keeps equivalent enums at
 * its persistence boundary.
 */
export const ROLES = [
  "ADMIN",
  "SALES_REP",
  "SALES_MANAGER",
  "FINANCE",
  "OPERATIONS",
  "CUSTOMER",
] as const;
export const RoleSchema = z.enum(ROLES);
export type Role = z.infer<typeof RoleSchema>;

export const USER_STATUSES = [
  "INVITED",
  "ACTIVE",
  "SUSPENDED",
  "DISABLED",
] as const;
export const UserStatusSchema = z.enum(USER_STATUSES);
export type UserStatus = z.infer<typeof UserStatusSchema>;

export const PORTAL_IDENTITY_STATUSES = ["ACTIVE", "DISABLED"] as const;
export const PortalIdentityStatusSchema = z.enum(PORTAL_IDENTITY_STATUSES);
export type PortalIdentityStatus = z.infer<typeof PortalIdentityStatusSchema>;

export const MAGIC_LINK_SCOPES = ["CUSTOMER", "QUOTE"] as const;
export const MagicLinkScopeSchema = z.enum(MAGIC_LINK_SCOPES);
export type MagicLinkScope = z.infer<typeof MagicLinkScopeSchema>;

export const CONFIGURATION_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export const ConfigurationStatusSchema = z.enum(CONFIGURATION_STATUSES);
export type ConfigurationStatus = z.infer<typeof ConfigurationStatusSchema>;

export const PRODUCT_TYPES = ["HARDWARE", "SERVICE", "SUBSCRIPTION"] as const;
export const ProductTypeSchema = z.enum(PRODUCT_TYPES);
export type ProductType = z.infer<typeof ProductTypeSchema>;

export const BILLING_TYPES = ["ONE_TIME", "RECURRING"] as const;
export const BillingTypeSchema = z.enum(BILLING_TYPES);
export type BillingType = z.infer<typeof BillingTypeSchema>;

export const TAX_BEHAVIORS = ["INCLUSIVE", "EXCLUSIVE"] as const;
export const TaxBehaviorSchema = z.enum(TAX_BEHAVIORS);
export type TaxBehavior = z.infer<typeof TaxBehaviorSchema>;

export const BILLING_INTERVALS = ["DAY", "WEEK", "MONTH", "YEAR"] as const;
export const BillingIntervalSchema = z.enum(BILLING_INTERVALS);
export type BillingInterval = z.infer<typeof BillingIntervalSchema>;

export const PRORATION_CONVENTIONS = [
  "CALENDAR_DAYS",
  "THIRTY_DAY_MONTH",
] as const;
export const ProrationConventionSchema = z.enum(PRORATION_CONVENTIONS);
export type ProrationConvention = z.infer<typeof ProrationConventionSchema>;

export const QUOTE_STAGES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "REVISION_REQUIRED",
  "READY_TO_SEND",
  "SENT",
  "UNDER_NEGOTIATION",
  "CUSTOMER_ACCEPTED",
  "CONFIRMED",
  "EXPIRED",
  "CANCELLED",
] as const;
export const QuoteStageSchema = z.enum(QUOTE_STAGES);
export type QuoteStage = z.infer<typeof QuoteStageSchema>;

export const QUOTE_VERSION_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "REVISION_REQUIRED",
  "READY_TO_SEND",
  "APPROVED",
  "REJECTED",
  "CUSTOMER_ACCEPTED",
  "SUPERSEDED",
] as const;
export const QuoteVersionStatusSchema = z.enum(QUOTE_VERSION_STATUSES);
export type QuoteVersionStatus = z.infer<typeof QuoteVersionStatusSchema>;

export const APPROVAL_REQUEST_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "APPROVED",
  "REJECTED",
  "REVISION_REQUIRED",
  "SUPERSEDED",
] as const;
export const ApprovalRequestStatusSchema = z.enum(APPROVAL_REQUEST_STATUSES);
export type ApprovalRequestStatus = z.infer<typeof ApprovalRequestStatusSchema>;

export const APPROVAL_STEP_STATUSES = [
  "WAITING",
  "ACTIVE",
  "APPROVED",
  "REJECTED",
  "REVISION_REQUIRED",
  "SKIPPED",
  "SUPERSEDED",
] as const;
export const ApprovalStepStatusSchema = z.enum(APPROVAL_STEP_STATUSES);
export type ApprovalStepStatus = z.infer<typeof ApprovalStepStatusSchema>;

export const APPROVAL_DECISION_ACTIONS = [
  "APPROVE",
  "REJECT",
  "REQUEST_REVISION",
] as const;
export const ApprovalDecisionActionSchema = z.enum(APPROVAL_DECISION_ACTIONS);
export type ApprovalDecisionAction = z.infer<
  typeof ApprovalDecisionActionSchema
>;

export const RECOMMENDATION_INTERACTION_TYPES = [
  "IMPRESSION",
  "DISMISSAL",
  "ACCEPTANCE",
] as const;
export const RecommendationInteractionTypeSchema = z.enum(
  RECOMMENDATION_INTERACTION_TYPES,
);
export type RecommendationInteractionType = z.infer<
  typeof RecommendationInteractionTypeSchema
>;

export const NEGOTIATION_THREAD_STATUSES = ["OPEN", "CLOSED"] as const;
export const NegotiationThreadStatusSchema = z.enum(
  NEGOTIATION_THREAD_STATUSES,
);
export type NegotiationThreadStatus = z.infer<
  typeof NegotiationThreadStatusSchema
>;

export const VISIBILITIES = ["INTERNAL", "CUSTOMER", "BOTH"] as const;
export const VisibilitySchema = z.enum(VISIBILITIES);
export type Visibility = z.infer<typeof VisibilitySchema>;

export const ACTOR_TYPES = ["USER", "PORTAL", "SYSTEM"] as const;
export const ActorTypeSchema = z.enum(ACTOR_TYPES);
export type ActorType = z.infer<typeof ActorTypeSchema>;

export const CHANGE_REQUEST_STATUSES = [
  "PENDING",
  "COUNTERED",
  "ACCEPTED",
  "REJECTED",
  "SUPERSEDED",
] as const;
export const ChangeRequestStatusSchema = z.enum(CHANGE_REQUEST_STATUSES);
export type ChangeRequestStatus = z.infer<typeof ChangeRequestStatusSchema>;

export const CHANGE_REQUEST_ACTIONS = [
  "REMOVE",
  "CHANGE_QUANTITY",
  "CHANGE_PRICE",
  "CHANGE_DISCOUNT",
  "CHANGE_TERMS",
] as const;
export const ChangeRequestActionSchema = z.enum(CHANGE_REQUEST_ACTIONS);
export type ChangeRequestAction = z.infer<typeof ChangeRequestActionSchema>;

export const COUNTEROFFER_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "SUPERSEDED",
  "EXPIRED",
] as const;
export const CounterofferStatusSchema = z.enum(COUNTEROFFER_STATUSES);
export type CounterofferStatus = z.infer<typeof CounterofferStatusSchema>;

export const ORDER_STATUSES = [
  "CONFIRMED",
  "ALLOCATION_PENDING",
  "RESERVED",
  "PARTIALLY_FULFILLED",
  "FULFILLED",
  "CANCELLED",
] as const;
export const OrderStatusSchema = z.enum(ORDER_STATUSES);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const STOCK_MOVEMENT_TYPES = [
  "RECEIPT",
  "RESERVATION",
  "RELEASE",
  "SHIPMENT",
  "ADJUSTMENT",
] as const;
export const StockMovementTypeSchema = z.enum(STOCK_MOVEMENT_TYPES);
export type StockMovementType = z.infer<typeof StockMovementTypeSchema>;

export const STOCK_RESERVATION_STATUSES = [
  "ACTIVE",
  "RELEASED",
  "SHIPPED",
  "CANCELLED",
] as const;
export const StockReservationStatusSchema = z.enum(STOCK_RESERVATION_STATUSES);
export type StockReservationStatus = z.infer<
  typeof StockReservationStatusSchema
>;

export const FULFILLMENT_PLAN_STATUSES = [
  "PREVIEW",
  "ACCEPTED",
  "SUPERSEDED",
  "EXPIRED",
] as const;
export const FulfillmentPlanStatusSchema = z.enum(FULFILLMENT_PLAN_STATUSES);
export type FulfillmentPlanStatus = z.infer<typeof FulfillmentPlanStatusSchema>;

export const FULFILLMENT_PLAN_SOURCES = ["RECOMMENDED", "MANUAL"] as const;
export const FulfillmentPlanSourceSchema = z.enum(FULFILLMENT_PLAN_SOURCES);
export type FulfillmentPlanSource = z.infer<typeof FulfillmentPlanSourceSchema>;

export const SHIPMENT_STATUSES = [
  "PLANNED",
  "READY",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;
export const ShipmentStatusSchema = z.enum(SHIPMENT_STATUSES);
export type ShipmentStatus = z.infer<typeof ShipmentStatusSchema>;

export const BACKORDER_STATUSES = [
  "OPEN",
  "PARTIALLY_ALLOCATED",
  "CONSOLIDATED",
  "FULFILLED",
  "CANCELLED",
] as const;
export const BackorderStatusSchema = z.enum(BACKORDER_STATUSES);
export type BackorderStatus = z.infer<typeof BackorderStatusSchema>;

export const SUBSCRIPTION_STATUSES = [
  "PENDING",
  "ACTIVE",
  "CHANGE_SCHEDULED",
  "CANCELLATION_SCHEDULED",
  "CANCELLED",
  "EXPIRED",
] as const;
export const SubscriptionStatusSchema = z.enum(SUBSCRIPTION_STATUSES);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

export const SUBSCRIPTION_CHANGE_TYPES = [
  "QUANTITY_CHANGE",
  "PLAN_CHANGE",
  "CANCELLATION",
] as const;
export const SubscriptionChangeTypeSchema = z.enum(SUBSCRIPTION_CHANGE_TYPES);
export type SubscriptionChangeType = z.infer<
  typeof SubscriptionChangeTypeSchema
>;

export const PRORATION_DIRECTIONS = ["DEBIT", "CREDIT", "NONE"] as const;
export const ProrationDirectionSchema = z.enum(PRORATION_DIRECTIONS);
export type ProrationDirection = z.infer<typeof ProrationDirectionSchema>;

export const SUBSCRIPTION_CHANGE_STATUSES = ["APPLIED", "REVERSED"] as const;
export const SubscriptionChangeStatusSchema = z.enum(
  SUBSCRIPTION_CHANGE_STATUSES,
);
export type SubscriptionChangeStatus = z.infer<
  typeof SubscriptionChangeStatusSchema
>;

export const BILLING_SCHEDULE_STATUSES = [
  "PENDING",
  "GENERATED",
  "SKIPPED",
  "CANCELLED",
  "FAILED",
] as const;
export const BillingScheduleStatusSchema = z.enum(BILLING_SCHEDULE_STATUSES);
export type BillingScheduleStatus = z.infer<typeof BillingScheduleStatusSchema>;

export const INVOICE_TYPES = ["ONE_TIME", "RECURRING", "PRORATION"] as const;
export const InvoiceTypeSchema = z.enum(INVOICE_TYPES);
export type InvoiceType = z.infer<typeof InvoiceTypeSchema>;

export const INVOICE_STATUSES = [
  "DRAFT",
  "ISSUED",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "VOID",
] as const;
export const InvoiceStatusSchema = z.enum(INVOICE_STATUSES);
export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>;

export const CREDIT_NOTE_STATUSES = [
  "DRAFT",
  "ISSUED",
  "APPLIED",
  "VOID",
] as const;
export const CreditNoteStatusSchema = z.enum(CREDIT_NOTE_STATUSES);
export type CreditNoteStatus = z.infer<typeof CreditNoteStatusSchema>;

export const PAYMENT_METHODS = [
  "BANK_TRANSFER",
  "CREDIT_CARD",
  "CHECK",
  "OTHER",
] as const;
export const PaymentMethodSchema = z.enum(PAYMENT_METHODS);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const PAYMENT_STATUSES = ["RECORDED", "REVERSED", "FAILED"] as const;
export const PaymentStatusSchema = z.enum(PAYMENT_STATUSES);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const ALERT_TYPES = [
  "STALLED_DEAL",
  "DISCOUNT_ANOMALY",
  "APPROVAL_SLA",
  "PROMISE_SLIPPAGE",
  "CREDIT_EXPOSURE",
] as const;
export const AlertTypeSchema = z.enum(ALERT_TYPES);
export type AlertType = z.infer<typeof AlertTypeSchema>;

export const ALERT_SEVERITIES = ["INFO", "WARNING", "CRITICAL"] as const;
export const AlertSeveritySchema = z.enum(ALERT_SEVERITIES);
export type AlertSeverity = z.infer<typeof AlertSeveritySchema>;

export const ALERT_STATUSES = [
  "OPEN",
  "ACKNOWLEDGED",
  "SNOOZED",
  "RESOLVED",
] as const;
export const AlertStatusSchema = z.enum(ALERT_STATUSES);
export type AlertStatus = z.infer<typeof AlertStatusSchema>;

export const NUDGE_CHANNELS = ["IN_APP", "EMAIL"] as const;
export const NudgeChannelSchema = z.enum(NUDGE_CHANNELS);
export type NudgeChannel = z.infer<typeof NudgeChannelSchema>;

export const NUDGE_STATUSES = [
  "QUEUED",
  "SENT",
  "FAILED",
  "CANCELLED",
] as const;
export const NudgeStatusSchema = z.enum(NUDGE_STATUSES);
export type NudgeStatus = z.infer<typeof NudgeStatusSchema>;

export const OUTBOX_EVENT_STATUSES = [
  "PENDING",
  "PROCESSING",
  "PROCESSED",
  "FAILED",
  "DEAD_LETTER",
] as const;
export const OutboxEventStatusSchema = z.enum(OUTBOX_EVENT_STATUSES);
export type OutboxEventStatus = z.infer<typeof OutboxEventStatusSchema>;

export const IDEMPOTENCY_STATUSES = [
  "IN_PROGRESS",
  "COMPLETED",
  "FAILED",
] as const;
export const IdempotencyStatusSchema = z.enum(IDEMPOTENCY_STATUSES);
export type IdempotencyStatus = z.infer<typeof IdempotencyStatusSchema>;

export const REPORT_TYPES = [
  "QUOTES",
  "ORDERS",
  "INVOICES",
  "CUSTOMERS",
  "INVENTORY",
] as const;
export const ReportTypeSchema = z.enum(REPORT_TYPES);
export type ReportType = z.infer<typeof ReportTypeSchema>;

export const EXPORT_FORMATS = ["CSV", "XLSX", "PDF"] as const;
export const ExportFormatSchema = z.enum(EXPORT_FORMATS);
export type ExportFormat = z.infer<typeof ExportFormatSchema>;

export const EXPORT_JOB_STATUSES = [
  "QUEUED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
] as const;
export const ExportJobStatusSchema = z.enum(EXPORT_JOB_STATUSES);
export type ExportJobStatus = z.infer<typeof ExportJobStatusSchema>;

export const NOTIFICATION_CHANNELS = ["IN_APP", "EMAIL"] as const;
export const NotificationChannelSchema = z.enum(NOTIFICATION_CHANNELS);
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;

export const NOTIFICATION_STATUSES = [
  "QUEUED",
  "SENT",
  "FAILED",
  "CANCELLED",
] as const;
export const NotificationStatusSchema = z.enum(NOTIFICATION_STATUSES);
export type NotificationStatus = z.infer<typeof NotificationStatusSchema>;

export const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const RiskLevelSchema = z.enum(RISK_LEVELS);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const SORT_DIRECTIONS = ["asc", "desc"] as const;
export const SortDirectionSchema = z.enum(SORT_DIRECTIONS);
export type SortDirection = z.infer<typeof SortDirectionSchema>;

export const SERVICE_HEALTH_STATUSES = ["ok", "degraded"] as const;
export const ServiceHealthStatusSchema = z.enum(SERVICE_HEALTH_STATUSES);
export type ServiceHealthStatus = z.infer<typeof ServiceHealthStatusSchema>;
