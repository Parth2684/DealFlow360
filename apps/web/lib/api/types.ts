/**
 * Shared DTO shapes for the DealFlow360 API (contract: ../../../../openapi.yaml).
 *
 * The OpenAPI spec only documents request bodies, not response schemas, and the
 * Express API (apps/api) has not been implemented yet. These types are inferred
 * from the Prisma schema (packages/database/prisma/schema.prisma), assuming the
 * backend serializes records as camelCase JSON with Decimal/DateTime as strings.
 * Enum *types* are imported from @repo/db (type-only, erased at build time so the
 * Prisma runtime is never bundled into the browser) to stay in sync with the schema.
 */
import type {
  Role,
  UserStatus,
  ProductType,
  BillingType,
  TaxBehavior,
  QuoteStage,
  QuoteVersionStatus,
  ApprovalRequestStatus,
  ApprovalStepStatus,
  ApprovalDecisionAction,
  ChangeRequestStatus,
  ChangeRequestType,
  StockMovementType,
  FulfillmentPlanStatus,
  ShipmentStatus,
  BackorderStatus,
  OrderStatus,
  SubscriptionStatus,
  BillingScheduleStatus,
  InvoiceStatus,
  InvoiceType,
  CreditNoteStatus,
  PaymentStatus,
  PaymentMethod,
  ProrationConvention,
  SubscriptionInterval,
  ExportJobStatus,
  ExportFormat,
  AlertSeverity,
} from "@repo/db";

export type {
  Role,
  UserStatus,
  ProductType,
  BillingType,
  TaxBehavior,
  QuoteStage,
  QuoteVersionStatus,
  ApprovalRequestStatus,
  ApprovalStepStatus,
  ApprovalDecisionAction,
  ChangeRequestStatus,
  ChangeRequestType,
  StockMovementType,
  FulfillmentPlanStatus,
  ShipmentStatus,
  BackorderStatus,
  OrderStatus,
  SubscriptionStatus,
  BillingScheduleStatus,
  InvoiceStatus,
  InvoiceType,
  CreditNoteStatus,
  PaymentStatus,
  PaymentMethod,
  ProrationConvention,
  SubscriptionInterval,
  ExportJobStatus,
  ExportFormat,
  AlertSeverity,
};

export interface User {
  id: string;
  organizationId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  roles?: Role[];
  createdAt: string;
}

export interface CustomerTier {
  id: string;
  name: string;
  code: string;
  priority: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerContact {
  id: string;
  customerAccountId: string;
  email: string;
  firstName: string;
  lastName: string;
  isPrimary: boolean;
  portalEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerAccount {
  id: string;
  name: string;
  tierId: string;
  tier?: CustomerTier;
  salesTeamId?: string | null;
  assignedRepId?: string | null;
  preferredCurrency: string;
  paymentTermsDays: number;
  creditLimit: string;
  currentExposure: string;
  overdueBalance: string;
  active: boolean;
  revision: number;
  createdAt: string;
  updatedAt: string;
  contacts?: CustomerContact[];
}

export interface ProductCategory {
  id: string;
  name: string;
  code: string;
  active: boolean;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  name?: string | null;
  attributes?: Record<string, unknown>;
  priceSurcharge: string;
  active: boolean;
}

export interface Product {
  id: string;
  categoryId: string;
  category?: ProductCategory;
  name: string;
  code: string;
  type: ProductType;
  description?: string | null;
  unit: string;
  standardCost: string;
  taxId?: string | null;
  active: boolean;
  revision: number;
  variants?: ProductVariant[];
}

export interface Tax {
  id: string;
  name: string;
  rate: string;
  behavior: TaxBehavior;
  effectiveFrom: string;
  effectiveTo?: string | null;
  active: boolean;
}

export interface PriceList {
  id: string;
  name: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  active: boolean;
  priority: number;
}

export interface PriceRule {
  id: string;
  priceListId: string;
  productId?: string | null;
  categoryId?: string | null;
  tierId?: string | null;
  minQuantity: string;
  unitPrice: string;
  priority: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface DiscountLimit {
  id: string;
  name: string;
  tierId?: string | null;
  categoryId?: string | null;
  productId?: string | null;
  maxDiscountPct: string;
  priority: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  active: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  code: string;
  interval: SubscriptionInterval;
  intervalCount: number;
  prorationConvention: ProrationConvention;
  cancellationRules?: Record<string, unknown>;
  active: boolean;
}

export interface QuoteLine {
  id: string;
  quoteVersionId: string;
  productId: string;
  variantId?: string | null;
  lineNumber: number;
  productName: string;
  productType: ProductType;
  sku?: string | null;
  quantity: string;
  unitPrice: string;
  unitCost: string;
  discountPercent: string;
  discountAmount: string;
  taxRate: string;
  taxAmount: string;
  lineTotal: string;
  billingType: BillingType;
  subscriptionPlanId?: string | null;
  riskContribution?: Record<string, unknown>;
}

export interface QuoteVersion {
  id: string;
  quoteId: string;
  revisionNumber: number;
  status: QuoteVersionStatus;
  currency: string;
  subtotal: string;
  taxTotal: string;
  discountTotal: string;
  total: string;
  costTotal: string;
  grossMargin: string;
  marginPercent: string;
  riskFacts?: Record<string, unknown>;
  policyVersion?: string | null;
  termsFingerprint: string;
  paymentTermsDays: number;
  notes?: string | null;
  lines?: QuoteLine[];
  createdAt: string;
}

export interface Quote {
  id: string;
  customerAccountId: string;
  customerAccount?: CustomerAccount;
  ownerId: string;
  owner?: Pick<User, "id" | "firstName" | "lastName" | "email">;
  quoteNumber: string;
  stage: QuoteStage;
  currentVersionId?: string | null;
  currentVersion?: QuoteVersion;
  versions?: QuoteVersion[];
  expiresAt?: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecommendationItem {
  productId: string;
  product?: Product;
  score?: number;
  reason?: string;
  marginImpact?: string;
}

export interface ApprovalStep {
  id: string;
  approvalRequestId: string;
  sequence: number;
  requiredCapability: string;
  assigneeId?: string | null;
  status: ApprovalStepStatus;
  dueAt?: string | null;
  activatedAt?: string | null;
  completedAt?: string | null;
}

export interface ApprovalDecision {
  id: string;
  approvalRequestId: string;
  approvalStepId: string;
  actorId: string;
  actor?: Pick<User, "id" | "firstName" | "lastName">;
  action: ApprovalDecisionAction;
  reason?: string | null;
  createdAt: string;
}

export interface ApprovalRequest {
  id: string;
  quoteVersionId: string;
  quoteVersion?: QuoteVersion & { quote?: Quote };
  termsFingerprint: string;
  status: ApprovalRequestStatus;
  ruleFacts?: Record<string, unknown>;
  matchedPolicies?: unknown[];
  routeReason?: string | null;
  explainerData?: Record<string, unknown>;
  steps?: ApprovalStep[];
  decisions?: ApprovalDecision[];
  createdAt: string;
  updatedAt: string;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  address?: Record<string, unknown>;
  shippingCostWeight: string;
  leadTimeDays: number;
  active: boolean;
}

export interface InventoryBalance {
  id: string;
  warehouseId: string;
  productId: string;
  product?: Product;
  variantId?: string | null;
  onHand: string;
  reserved: string;
  available: string;
  incoming: string;
  revision: number;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  warehouseId: string;
  productId: string;
  variantId?: string | null;
  type: StockMovementType;
  quantity: string;
  referenceType?: string | null;
  referenceId?: string | null;
  createdAt: string;
}

export interface FulfillmentAllocation {
  id: string;
  fulfillmentPlanId: string;
  orderLineId?: string | null;
  quoteLineId?: string | null;
  warehouseId: string;
  warehouse?: Warehouse;
  assignedQuantity: string;
  estimatedCost: string;
  promisedDate?: string | null;
}

export interface FulfillmentPlan {
  id: string;
  orderId: string;
  status: FulfillmentPlanStatus;
  snapshot?: Record<string, unknown>;
  objectiveValues?: Record<string, unknown>;
  overrideReason?: string | null;
  allocations?: FulfillmentAllocation[];
  createdAt: string;
  acceptedAt?: string | null;
}

export interface Shipment {
  id: string;
  warehouseId: string;
  orderId: string;
  status: ShipmentStatus;
  trackingNumber?: string | null;
  promisedDate?: string | null;
  shippedDate?: string | null;
  createdAt: string;
}

export interface Backorder {
  id: string;
  orderLineId?: string | null;
  quoteLineId: string;
  remainingQty: string;
  status: BackorderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface OrderLine {
  id: string;
  orderId: string;
  quoteLineId: string;
  productId: string;
  variantId?: string | null;
  lineNumber: number;
  productName: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
  taxAmount: string;
  lineTotal: string;
  billingType: BillingType;
}

export interface Order {
  id: string;
  quoteId: string;
  quoteVersionId: string;
  customerAccountId: string;
  customerAccount?: CustomerAccount;
  orderNumber: string;
  status: OrderStatus;
  termsFingerprint: string;
  currency: string;
  subtotal: string;
  taxTotal: string;
  total: string;
  confirmedAt: string;
  createdAt: string;
  updatedAt: string;
  lines?: OrderLine[];
}

export interface SubscriptionItem {
  id: string;
  subscriptionId: string;
  orderLineId: string;
  subscriptionPlanId: string;
  subscriptionPlan?: SubscriptionPlan;
  productName: string;
  quantity: string;
  unitPrice: string;
}

export interface BillingSchedule {
  id: string;
  subscriptionId: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  amount: string;
  status: BillingScheduleStatus;
  invoiceId?: string | null;
}

export interface Subscription {
  id: string;
  orderId: string;
  customerAccountId: string;
  customerAccount?: CustomerAccount;
  status: SubscriptionStatus;
  currency: string;
  startDate: string;
  endDate?: string | null;
  cancelledAt?: string | null;
  items?: SubscriptionItem[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxAmount: string;
  lineTotal: string;
}

export interface Invoice {
  id: string;
  orderId?: string | null;
  subscriptionId?: string | null;
  invoiceNumber: string;
  type: InvoiceType;
  status: InvoiceStatus;
  currency: string;
  subtotal: string;
  taxTotal: string;
  total: string;
  amountPaid: string;
  dueDate: string;
  issuedAt?: string | null;
  createdAt: string;
  lines?: InvoiceLine[];
  payments?: Payment[];
}

export interface CreditNote {
  id: string;
  invoiceId: string;
  creditNumber: string;
  status: CreditNoteStatus;
  amount: string;
  reason?: string | null;
  createdAt: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: string;
  method: PaymentMethod;
  reference?: string | null;
  status: PaymentStatus;
  recordedAt: string;
  createdAt: string;
}

export interface NegotiationMessage {
  id: string;
  negotiationThreadId: string;
  authorType: string;
  authorId: string;
  body: string;
  quoteLineId?: string | null;
  createdAt: string;
}

export interface ChangeRequestedChange {
  quoteLineId?: string;
  action?: "REMOVE" | "CHANGE_QUANTITY" | "CHANGE_PRICE";
  quantity?: string;
  unitPrice?: string;
}

export interface ChangeRequest {
  id: string;
  quoteVersionId: string;
  quoteLineId?: string | null;
  type: ChangeRequestType;
  status: ChangeRequestStatus;
  requestedValue: Record<string, unknown>;
  message?: string | null;
  comment?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
  /** Not documented in openapi.yaml as a nested field — included defensively in
   * case the backend embeds the latest counteroffer on the change request. */
  counteroffer?: Counteroffer | null;
}

export interface Counteroffer {
  id: string;
  changeRequestId: string;
  message?: string | null;
  proposedChanges: Array<{
    quoteLineId: string;
    quantity?: string;
    unitPrice?: string;
    discountPercent?: string;
  }>;
  createdAt: string;
}

export interface Alert {
  id: string;
  quoteId?: string | null;
  alertType: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  acknowledgedAt?: string | null;
  snoozedUntil?: string | null;
  createdAt: string;
}

export interface DealHealthSnapshot {
  id: string;
  quoteId?: string;
  snapshotDate: string;
  metrics: Record<string, unknown>;
  createdAt: string;
}

export interface HealthScore {
  score: number;
  factors?: Record<string, unknown>;
  computedAt?: string;
}

export interface ExportJob {
  id: string;
  reportType: string;
  filters?: Record<string, unknown>;
  format: ExportFormat;
  status: ExportJobStatus;
  resultLocation?: string | null;
  error?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  completedAt?: string | null;
}
