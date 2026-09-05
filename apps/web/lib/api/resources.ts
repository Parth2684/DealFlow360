/**
 * Typed calls for every endpoint in openapi.yaml, grouped by tag.
 * Thin wrappers over `api` (see ./client) — no business logic lives here.
 */
import { api, unwrapItem, unwrapList } from "./client";
import type {
  Alert,
  ApprovalRequest,
  Backorder,
  BillingSchedule,
  ChangeRequest,
  ChangeRequestedChange,
  Counteroffer,
  CreditNote,
  CustomerAccount,
  CustomerContact,
  CustomerTier,
  DealHealthSnapshot,
  DiscountLimit,
  ExportJob,
  FulfillmentPlan,
  HealthScore,
  InventoryBalance,
  Invoice,
  Order,
  Payment,
  PriceList,
  PriceRule,
  Product,
  Quote,
  QuoteLine,
  RecommendationItem,
  Shipment,
  StockMovement,
  Subscription,
  SubscriptionPlan,
  Tax,
  User,
  Warehouse,
} from "./types";

// ─── Auth ─────────────────────────────────────────────────────────────────

export interface SignupInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export const authApi = {
  signup: (input: SignupInput) => api.post<{ user: User }>("/auth/signup", input),
  login: (input: LoginInput) => api.post<{ user: User }>("/auth/login", input),
  logout: () => api.post<void>("/auth/logout"),
  me: () => api.get<User>("/auth/me").then((r) => unwrapItem<User>(r)),
};

// ─── Quotations ───────────────────────────────────────────────────────────

export interface CreateQuoteInput {
  customerAccountId: string;
  currency?: string;
  paymentTermsDays?: number;
  expiresAt?: string;
}

export interface AddQuoteLineInput {
  productId: string;
  variantId?: string;
  quantity: string;
  discountPercent?: string;
  billingType?: "ONE_TIME" | "RECURRING";
  subscriptionPlanId?: string;
}

export const quotesApi = {
  list: (params?: Record<string, string | undefined>) =>
    api.get<unknown>(`/quotes${toQuery(params)}`).then((r) => unwrapList<Quote>(r)),
  get: (quoteId: string) => api.get<unknown>(`/quotes/${quoteId}`).then((r) => unwrapItem<Quote>(r)),
  create: (input: CreateQuoteInput) => api.post<unknown>("/quotes", input).then((r) => unwrapItem<Quote>(r)),
  addLine: (quoteId: string, input: AddQuoteLineInput) =>
    api.post<unknown>(`/quotes/${quoteId}/lines`, input).then((r) => unwrapItem<QuoteLine>(r)),
  calculate: (quoteId: string, revision: number) =>
    api.post<unknown>(`/quotes/${quoteId}/calculate`, { revision }).then((r) => unwrapItem<Quote>(r)),
  submit: (quoteId: string, revision: number) =>
    api.post<unknown>(`/quotes/${quoteId}/submit`, { revision }).then((r) => unwrapItem<Quote>(r)),
  recommendations: (quoteId: string) =>
    api.get<unknown>(`/quotes/${quoteId}/recommendations`).then((r) => unwrapList<RecommendationItem>(r)),
  dismissRecommendation: (quoteId: string, productId: string) =>
    api.post<void>(`/quotes/${quoteId}/recommendations/${productId}/dismiss`),
  addRecommendation: (quoteId: string, productId: string) =>
    api.post<unknown>(`/quotes/${quoteId}/recommendations/${productId}/add`).then((r) => unwrapItem<QuoteLine>(r)),
};

// ─── Approvals ────────────────────────────────────────────────────────────

export interface ApprovalDecisionInput {
  action: "APPROVE" | "REJECT" | "REQUEST_REVISION";
  comment?: string;
}

export const approvalsApi = {
  inbox: () => api.get<unknown>("/approvals").then((r) => unwrapList<ApprovalRequest>(r)),
  decide: (requestId: string, input: ApprovalDecisionInput) =>
    api.post<unknown>(`/approvals/${requestId}/decide`, input).then((r) => unwrapItem<ApprovalRequest>(r)),
};

// ─── Catalog (read-only lookups) ───────────────────────────────────────────

export const catalogApi = {
  products: () => api.get<unknown>("/products").then((r) => unwrapList<Product>(r)),
  customers: () => api.get<unknown>("/customers").then((r) => unwrapList<CustomerAccount>(r)),
  warehouses: () => api.get<unknown>("/warehouses").then((r) => unwrapList<Warehouse>(r)),
  subscriptionPlans: () => api.get<unknown>("/subscription-plans").then((r) => unwrapList<SubscriptionPlan>(r)),
};

// ─── Customers ────────────────────────────────────────────────────────────

export interface CreateTierInput {
  name: string;
  code: string;
  priority?: number;
}

export interface CreateCustomerAccountInput {
  name: string;
  tierId: string;
  salesTeamId?: string;
  assignedRepId?: string;
  preferredCurrency?: string;
  paymentTermsDays?: number;
  creditLimit?: string;
}

export interface CreateContactInput {
  email: string;
  firstName: string;
  lastName: string;
  isPrimary?: boolean;
  portalEnabled?: boolean;
}

export const customersApi = {
  tiers: () => api.get<unknown>("/customer-accounts/tiers").then((r) => unwrapList<CustomerTier>(r)),
  createTier: (input: CreateTierInput) =>
    api.post<unknown>("/customer-accounts/tiers", input).then((r) => unwrapItem<CustomerTier>(r)),
  updateTier: (tierId: string, input: Partial<{ name: string; active: boolean }>) =>
    api.patch<unknown>(`/customer-accounts/tiers/${tierId}`, input).then((r) => unwrapItem<CustomerTier>(r)),
  accounts: () => api.get<unknown>("/customer-accounts/accounts").then((r) => unwrapList<CustomerAccount>(r)),
  createAccount: (input: CreateCustomerAccountInput) =>
    api.post<unknown>("/customer-accounts/accounts", input).then((r) => unwrapItem<CustomerAccount>(r)),
  getAccount: (customerId: string) =>
    api.get<unknown>(`/customer-accounts/accounts/${customerId}`).then((r) => unwrapItem<CustomerAccount>(r)),
  updateAccount: (
    customerId: string,
    input: Partial<{ name: string; tierId: string; paymentTermsDays: number; creditLimit: string; active: boolean }>,
  ) => api.patch<unknown>(`/customer-accounts/accounts/${customerId}`, input).then((r) => unwrapItem<CustomerAccount>(r)),
  contacts: (customerId: string) =>
    api.get<unknown>(`/customer-accounts/accounts/${customerId}/contacts`).then((r) => unwrapList<CustomerContact>(r)),
  createContact: (customerId: string, input: CreateContactInput) =>
    api
      .post<unknown>(`/customer-accounts/accounts/${customerId}/contacts`, input)
      .then((r) => unwrapItem<CustomerContact>(r)),
  updateContact: (customerId: string, contactId: string, input: Partial<CreateContactInput>) =>
    api
      .patch<unknown>(`/customer-accounts/accounts/${customerId}/contacts/${contactId}`, input)
      .then((r) => unwrapItem<CustomerContact>(r)),
};

// ─── Pricing ──────────────────────────────────────────────────────────────

export interface CreatePriceListInput {
  name: string;
  currency?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  priority?: number;
}

export interface CreatePriceRuleInput {
  productId?: string;
  categoryId?: string;
  tierId?: string;
  minQuantity?: string;
  unitPrice: string;
  priority?: number;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface CreateDiscountLimitInput {
  name: string;
  tierId?: string;
  categoryId?: string;
  productId?: string;
  maxDiscountPct: string;
  priority?: number;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface CreateTaxInput {
  name: string;
  rate: string;
  behavior?: "INCLUSIVE" | "EXCLUSIVE";
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface CreateSubscriptionPlanInput {
  name: string;
  code: string;
  interval: "DAY" | "WEEK" | "MONTH" | "YEAR";
  intervalCount?: number;
  prorationConvention?: "CALENDAR_DAYS" | "THIRTY_DAY_MONTH";
  cancellationRules?: Record<string, unknown>;
}

export const pricingApi = {
  priceLists: () => api.get<unknown>("/pricing/price-lists").then((r) => unwrapList<PriceList>(r)),
  createPriceList: (input: CreatePriceListInput) =>
    api.post<unknown>("/pricing/price-lists", input).then((r) => unwrapItem<PriceList>(r)),
  updatePriceList: (id: string, input: Partial<{ name: string; active: boolean; effectiveTo: string }>) =>
    api.patch<unknown>(`/pricing/price-lists/${id}`, input).then((r) => unwrapItem<PriceList>(r)),
  priceRules: (priceListId: string) =>
    api.get<unknown>(`/pricing/price-lists/${priceListId}/rules`).then((r) => unwrapList<PriceRule>(r)),
  createPriceRule: (priceListId: string, input: CreatePriceRuleInput) =>
    api.post<unknown>(`/pricing/price-lists/${priceListId}/rules`, input).then((r) => unwrapItem<PriceRule>(r)),
  updatePriceRule: (ruleId: string, input: Partial<{ unitPrice: string; priority: number; effectiveTo: string }>) =>
    api.patch<unknown>(`/pricing/price-rules/${ruleId}`, input).then((r) => unwrapItem<PriceRule>(r)),
  deletePriceRule: (ruleId: string) => api.delete<void>(`/pricing/price-rules/${ruleId}`),
  discountLimits: () => api.get<unknown>("/pricing/discount-limits").then((r) => unwrapList<DiscountLimit>(r)),
  createDiscountLimit: (input: CreateDiscountLimitInput) =>
    api.post<unknown>("/pricing/discount-limits", input).then((r) => unwrapItem<DiscountLimit>(r)),
  updateDiscountLimit: (id: string, input: Partial<{ maxDiscountPct: string; active: boolean; effectiveTo: string }>) =>
    api.patch<unknown>(`/pricing/discount-limits/${id}`, input).then((r) => unwrapItem<DiscountLimit>(r)),
  taxes: () => api.get<unknown>("/pricing/taxes").then((r) => unwrapList<Tax>(r)),
  createTax: (input: CreateTaxInput) => api.post<unknown>("/pricing/taxes", input).then((r) => unwrapItem<Tax>(r)),
  updateTax: (id: string, input: Partial<{ rate: string; active: boolean; effectiveTo: string }>) =>
    api.patch<unknown>(`/pricing/taxes/${id}`, input).then((r) => unwrapItem<Tax>(r)),
  subscriptionPlans: () => api.get<unknown>("/pricing/subscription-plans").then((r) => unwrapList<SubscriptionPlan>(r)),
  createSubscriptionPlan: (input: CreateSubscriptionPlanInput) =>
    api.post<unknown>("/pricing/subscription-plans", input).then((r) => unwrapItem<SubscriptionPlan>(r)),
  updateSubscriptionPlan: (id: string, input: Partial<{ name: string; active: boolean; cancellationRules: Record<string, unknown> }>) =>
    api.patch<unknown>(`/pricing/subscription-plans/${id}`, input).then((r) => unwrapItem<SubscriptionPlan>(r)),
};

// ─── Inventory ────────────────────────────────────────────────────────────

export interface CreateWarehouseInput {
  name: string;
  address?: string;
  leadTimeDays?: number;
  shippingCostWeight?: number;
}

export interface AdjustInventoryInput {
  productId: string;
  variantId?: string;
  quantity: string;
  reason: string;
}

export interface ReceiptInput {
  warehouseId: string;
  items: Array<{ productId: string; variantId?: string; quantity: string }>;
  reference?: string;
}

export const inventoryApi = {
  warehouses: () => api.get<unknown>("/inventory/warehouses").then((r) => unwrapList<Warehouse>(r)),
  createWarehouse: (input: CreateWarehouseInput) =>
    api.post<unknown>("/inventory/warehouses", input).then((r) => unwrapItem<Warehouse>(r)),
  updateWarehouse: (id: string, input: Partial<{ name: string; address: string; active: boolean }>) =>
    api.patch<unknown>(`/inventory/warehouses/${id}`, input).then((r) => unwrapItem<Warehouse>(r)),
  balances: (warehouseId: string) =>
    api.get<unknown>(`/inventory/warehouses/${warehouseId}/balances`).then((r) => unwrapList<InventoryBalance>(r)),
  adjust: (warehouseId: string, input: AdjustInventoryInput) =>
    api.post<unknown>(`/inventory/warehouses/${warehouseId}/adjust`, input).then((r) => unwrapItem<InventoryBalance>(r)),
  stockMovements: () => api.get<unknown>("/inventory/stock-movements").then((r) => unwrapList<StockMovement>(r)),
  receipt: (input: ReceiptInput) =>
    api.post<unknown>("/inventory/stock-movements/receipt", input).then((r) => unwrapItem<StockMovement>(r)),
};

// ─── Fulfillment ──────────────────────────────────────────────────────────

export interface OverrideAllocationInput {
  allocations: Array<{ warehouseId: string; quoteLineId: string; quantity: string }>;
  reason: string;
}

export const fulfillmentApi = {
  preview: (orderId: string) =>
    api.get<unknown>(`/fulfillment/orders/${orderId}/fulfillment/preview`).then((r) => unwrapItem<FulfillmentPlan>(r)),
  reserve: (orderId: string, planId: string) =>
    api
      .post<unknown>(`/fulfillment/orders/${orderId}/fulfillment/reserve`, { planId })
      .then((r) => unwrapItem<FulfillmentPlan>(r)),
  override: (orderId: string, input: OverrideAllocationInput) =>
    api
      .post<unknown>(`/fulfillment/orders/${orderId}/fulfillment/override`, input)
      .then((r) => unwrapItem<FulfillmentPlan>(r)),
  shipments: (orderId: string) =>
    api.get<unknown>(`/fulfillment/orders/${orderId}/shipments`).then((r) => unwrapList<Shipment>(r)),
  ship: (shipmentId: string, trackingNumber?: string) =>
    api.post<unknown>(`/fulfillment/shipments/${shipmentId}/ship`, { trackingNumber }).then((r) => unwrapItem<Shipment>(r)),
  backorders: () => api.get<unknown>("/fulfillment/backorders").then((r) => unwrapList<Backorder>(r)),
  consolidateBackorder: (backorderId: string) =>
    api.post<unknown>(`/fulfillment/backorders/${backorderId}/consolidate`).then((r) => unwrapItem<Backorder>(r)),
};

// ─── Orders ───────────────────────────────────────────────────────────────

export const ordersApi = {
  list: () => api.get<unknown>("/orders").then((r) => unwrapList<Order>(r)),
  get: (orderId: string) => api.get<unknown>(`/orders/${orderId}`).then((r) => unwrapItem<Order>(r)),
  confirmFromQuote: (quoteId: string, revision: number) =>
    api.post<unknown>(`/orders/quotes/${quoteId}/confirm`, { revision }).then((r) => unwrapItem<Order>(r)),
  billing: (orderId: string) => api.get<unknown>(`/orders/${orderId}/billing`).then((r) => unwrapItem<Invoice[]>(r)),
};

// ─── Subscriptions ────────────────────────────────────────────────────────

export interface SubscriptionChangeInput {
  quantity?: number;
  planId?: string;
  effectiveDate?: string;
}

export const subscriptionsApi = {
  list: () => api.get<unknown>("/subscriptions").then((r) => unwrapList<Subscription>(r)),
  get: (subscriptionId: string) =>
    api.get<unknown>(`/subscriptions/${subscriptionId}`).then((r) => unwrapItem<Subscription>(r)),
  previewChange: (subscriptionId: string, input: SubscriptionChangeInput) =>
    api.post<unknown>(`/subscriptions/${subscriptionId}/preview-change`, input),
  change: (subscriptionId: string, input: SubscriptionChangeInput) =>
    api.post<unknown>(`/subscriptions/${subscriptionId}/change`, input).then((r) => unwrapItem<Subscription>(r)),
  cancel: (subscriptionId: string, input: { effectiveDate?: string; reason?: string }) =>
    api.post<unknown>(`/subscriptions/${subscriptionId}/cancel`, input).then((r) => unwrapItem<Subscription>(r)),
  schedules: (subscriptionId: string) =>
    api.get<unknown>(`/subscriptions/${subscriptionId}/schedules`).then((r) => unwrapList<BillingSchedule>(r)),
};

// ─── Billing ──────────────────────────────────────────────────────────────

export interface RecordPaymentInput {
  amount: string;
  method: "BANK_TRANSFER" | "CREDIT_CARD" | "CHECK" | "OTHER";
  reference?: string;
  paymentDate?: string;
}

export const billingApi = {
  invoices: () => api.get<unknown>("/billing/invoices").then((r) => unwrapList<Invoice>(r)),
  invoice: (invoiceId: string) => api.get<unknown>(`/billing/invoices/${invoiceId}`).then((r) => unwrapItem<Invoice>(r)),
  issueInvoice: (invoiceId: string) =>
    api.post<unknown>(`/billing/invoices/${invoiceId}/issue`).then((r) => unwrapItem<Invoice>(r)),
  payments: (invoiceId: string) =>
    api.get<unknown>(`/billing/invoices/${invoiceId}/payments`).then((r) => unwrapList<Payment>(r)),
  recordPayment: (invoiceId: string, input: RecordPaymentInput) =>
    api.post<unknown>(`/billing/invoices/${invoiceId}/payments`, input).then((r) => unwrapItem<Payment>(r)),
  creditNotes: () => api.get<unknown>("/billing/credit-notes").then((r) => unwrapList<CreditNote>(r)),
  applyCreditNote: (creditNoteId: string, invoiceId: string) =>
    api.post<unknown>(`/billing/credit-notes/${creditNoteId}/apply`, { invoiceId }).then((r) => unwrapItem<CreditNote>(r)),
};

// ─── Negotiation (customer portal) ─────────────────────────────────────────

export const negotiationApi = {
  portalQuote: (quoteId: string) => api.get<unknown>(`/negotiation/portal/${quoteId}`).then((r) => unwrapItem<Quote>(r)),
  createChangeRequest: (
    quoteId: string,
    input: { message?: string; requestedChanges: ChangeRequestedChange[] },
  ) => api.post<unknown>(`/negotiation/portal/${quoteId}/change-request`, input).then((r) => unwrapItem<ChangeRequest>(r)),
  changeRequests: (quoteId: string) =>
    api.get<unknown>(`/negotiation/portal/${quoteId}/change-requests`).then((r) => unwrapList<ChangeRequest>(r)),
  counteroffer: (
    requestId: string,
    input: { message?: string; proposedChanges: Array<{ quoteLineId: string; quantity?: string; unitPrice?: string; discountPercent?: string }> },
  ) => api.post<unknown>(`/negotiation/change-requests/${requestId}/counteroffer`, input).then((r) => unwrapItem<Counteroffer>(r)),
  acceptChangeRequest: (requestId: string) =>
    api.post<unknown>(`/negotiation/change-requests/${requestId}/accept`).then((r) => unwrapItem<ChangeRequest>(r)),
  rejectChangeRequest: (requestId: string, reason?: string) =>
    api.post<unknown>(`/negotiation/change-requests/${requestId}/reject`, { reason }).then((r) => unwrapItem<ChangeRequest>(r)),
  acceptCounteroffer: (counterofferId: string) =>
    api.post<unknown>(`/negotiation/portal/counteroffers/${counterofferId}/accept`).then((r) => unwrapItem<Counteroffer>(r)),
  rejectCounteroffer: (counterofferId: string, reason?: string) =>
    api.post<unknown>(`/negotiation/portal/counteroffers/${counterofferId}/reject`, { reason }).then((r) => unwrapItem<Counteroffer>(r)),
};

// ─── Deal Health ──────────────────────────────────────────────────────────

export const dealHealthApi = {
  alerts: () => api.get<unknown>("/deal-health/alerts").then((r) => unwrapList<Alert>(r)),
  alert: (alertId: string) => api.get<unknown>(`/deal-health/alerts/${alertId}`).then((r) => unwrapItem<Alert>(r)),
  acknowledge: (alertId: string) =>
    api.post<unknown>(`/deal-health/alerts/${alertId}/acknowledge`).then((r) => unwrapItem<Alert>(r)),
  snooze: (alertId: string, until: string) =>
    api.post<unknown>(`/deal-health/alerts/${alertId}/snooze`, { until }).then((r) => unwrapItem<Alert>(r)),
  snapshots: (quoteId: string) =>
    api.get<unknown>(`/deal-health/quotes/${quoteId}/snapshots`).then((r) => unwrapList<DealHealthSnapshot>(r)),
  createSnapshot: (quoteId: string, reason?: string) =>
    api
      .post<unknown>(`/deal-health/quotes/${quoteId}/snapshots`, { reason })
      .then((r) => unwrapItem<DealHealthSnapshot>(r)),
  snapshot: (quoteId: string, snapshotId: string) =>
    api
      .get<unknown>(`/deal-health/quotes/${quoteId}/snapshots/${snapshotId}`)
      .then((r) => unwrapItem<DealHealthSnapshot>(r)),
  healthScore: (quoteId: string) =>
    api.get<unknown>(`/deal-health/quotes/${quoteId}/health-score`).then((r) => unwrapItem<HealthScore>(r)),
};

// ─── Reporting ────────────────────────────────────────────────────────────

export interface CreateExportJobInput {
  reportType: "QUOTES" | "ORDERS" | "INVOICES" | "CUSTOMERS" | "INVENTORY";
  format: "CSV" | "XLSX" | "PDF";
  filters?: Record<string, unknown>;
}

export const reportingApi = {
  list: () => api.get<unknown>("/reporting/exports").then((r) => unwrapList<ExportJob>(r)),
  create: (input: CreateExportJobInput) =>
    api.post<unknown>("/reporting/exports", input).then((r) => unwrapItem<ExportJob>(r)),
  get: (jobId: string) => api.get<unknown>(`/reporting/exports/${jobId}`).then((r) => unwrapItem<ExportJob>(r)),
  download: (jobId: string) => api.get<{ url?: string }>(`/reporting/exports/${jobId}/download`),
  remove: (jobId: string) => api.delete<void>(`/reporting/exports/${jobId}`),
};

// ─── helpers ──────────────────────────────────────────────────────────────

function toQuery(params?: Record<string, string | undefined>): string {
  if (!params) return "";
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
  if (entries.length === 0) return "";
  const search = new URLSearchParams(entries as [string, string][]);
  return `?${search.toString()}`;
}
