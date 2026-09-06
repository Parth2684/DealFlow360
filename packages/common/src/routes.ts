import { API_V1_PREFIX } from "./constants.js";

const withPrefix = (path: string) => `${API_V1_PREFIX}${path}` as const;
const segment = (value: string) => encodeURIComponent(value);

/** Client-facing route builders matching the root openapi.yaml path inventory. */
export const apiRoutes = {
  customerAccess: {
    context: withPrefix("/portal/registration-context"),
    request: withPrefix("/portal/account-requests"),
    list: withPrefix("/customer-access/requests"),
    decision: (id: string) =>
      withPrefix(`/customer-access/requests/${segment(id)}/decision`),
    retryEmail: (id: string) =>
      withPrefix(`/customer-access/requests/${segment(id)}/retry-email`),
    login: withPrefix("/portal/password-login"),
    password: withPrefix("/portal/password"),
  },
  team: {
    list: withPrefix("/team/members"),
    member: (userId: string) => withPrefix(`/team/members/${segment(userId)}`),
  },
  health: withPrefix("/health"),
  auth: {
    signup: withPrefix("/auth/signup"),
    login: withPrefix("/auth/login"),
    logout: withPrefix("/auth/logout"),
    me: withPrefix("/auth/me"),
  },
  quotes: {
    list: withPrefix("/quotes"),
    create: withPrefix("/quotes"),
    detail: (quoteId: string) => withPrefix(`/quotes/${segment(quoteId)}`),
    lines: (quoteId: string) => withPrefix(`/quotes/${segment(quoteId)}/lines`),
    calculate: (quoteId: string) =>
      withPrefix(`/quotes/${segment(quoteId)}/calculate`),
    submit: (quoteId: string) =>
      withPrefix(`/quotes/${segment(quoteId)}/submit`),
    recommendations: (quoteId: string) =>
      withPrefix(`/quotes/${segment(quoteId)}/recommendations`),
    dismissRecommendation: (quoteId: string, productId: string) =>
      withPrefix(
        `/quotes/${segment(quoteId)}/recommendations/${segment(productId)}/dismiss`,
      ),
    addRecommendation: (quoteId: string, productId: string) =>
      withPrefix(
        `/quotes/${segment(quoteId)}/recommendations/${segment(productId)}/add`,
      ),
  },
  approvals: {
    list: withPrefix("/approvals"),
    decide: (requestId: string) =>
      withPrefix(`/approvals/${segment(requestId)}/decide`),
  },
  catalog: {
    products: withPrefix("/products"),
    product: (productId: string) =>
      withPrefix(`/products/${segment(productId)}`),
    productCategories: withPrefix("/product-categories"),
    productCategory: (categoryId: string) =>
      withPrefix(`/product-categories/${segment(categoryId)}`),
    customers: withPrefix("/customers"),
    warehouses: withPrefix("/warehouses"),
    subscriptionPlans: withPrefix("/subscription-plans"),
  },
  customers: {
    tiers: withPrefix("/customer-accounts/tiers"),
    tier: (tierId: string) =>
      withPrefix(`/customer-accounts/tiers/${segment(tierId)}`),
    accounts: withPrefix("/customer-accounts/accounts"),
    account: (customerId: string) =>
      withPrefix(`/customer-accounts/accounts/${segment(customerId)}`),
    contacts: (customerId: string) =>
      withPrefix(`/customer-accounts/accounts/${segment(customerId)}/contacts`),
    contact: (customerId: string, contactId: string) =>
      withPrefix(
        `/customer-accounts/accounts/${segment(customerId)}/contacts/${segment(contactId)}`,
      ),
  },
  pricing: {
    priceLists: withPrefix("/pricing/price-lists"),
    priceList: (priceListId: string) =>
      withPrefix(`/pricing/price-lists/${segment(priceListId)}`),
    priceRules: (priceListId: string) =>
      withPrefix(`/pricing/price-lists/${segment(priceListId)}/rules`),
    priceRule: (ruleId: string) =>
      withPrefix(`/pricing/price-rules/${segment(ruleId)}`),
    discountLimits: withPrefix("/pricing/discount-limits"),
    discountLimit: (limitId: string) =>
      withPrefix(`/pricing/discount-limits/${segment(limitId)}`),
    taxes: withPrefix("/pricing/taxes"),
    tax: (taxId: string) => withPrefix(`/pricing/taxes/${segment(taxId)}`),
    subscriptionPlans: withPrefix("/pricing/subscription-plans"),
    subscriptionPlan: (planId: string) =>
      withPrefix(`/pricing/subscription-plans/${segment(planId)}`),
  },
  inventory: {
    warehouses: withPrefix("/inventory/warehouses"),
    warehouse: (warehouseId: string) =>
      withPrefix(`/inventory/warehouses/${segment(warehouseId)}`),
    balances: (warehouseId: string) =>
      withPrefix(`/inventory/warehouses/${segment(warehouseId)}/balances`),
    adjust: (warehouseId: string) =>
      withPrefix(`/inventory/warehouses/${segment(warehouseId)}/adjust`),
    movements: withPrefix("/inventory/stock-movements"),
    receipt: withPrefix("/inventory/stock-movements/receipt"),
  },
  fulfillment: {
    preview: (orderId: string) =>
      withPrefix(`/fulfillment/orders/${segment(orderId)}/fulfillment/preview`),
    reserve: (orderId: string) =>
      withPrefix(`/fulfillment/orders/${segment(orderId)}/fulfillment/reserve`),
    override: (orderId: string) =>
      withPrefix(
        `/fulfillment/orders/${segment(orderId)}/fulfillment/override`,
      ),
    shipments: (orderId: string) =>
      withPrefix(`/fulfillment/orders/${segment(orderId)}/shipments`),
    ship: (shipmentId: string) =>
      withPrefix(`/fulfillment/shipments/${segment(shipmentId)}/ship`),
    backorders: withPrefix("/fulfillment/backorders"),
    consolidateBackorder: (backorderId: string) =>
      withPrefix(`/fulfillment/backorders/${segment(backorderId)}/consolidate`),
  },
  orders: {
    list: withPrefix("/orders"),
    detail: (orderId: string) => withPrefix(`/orders/${segment(orderId)}`),
    confirmQuote: (quoteId: string) =>
      withPrefix(`/orders/quotes/${segment(quoteId)}/confirm`),
    billing: (orderId: string) =>
      withPrefix(`/orders/${segment(orderId)}/billing`),
  },
  subscriptions: {
    list: withPrefix("/subscriptions"),
    detail: (subscriptionId: string) =>
      withPrefix(`/subscriptions/${segment(subscriptionId)}`),
    previewChange: (subscriptionId: string) =>
      withPrefix(`/subscriptions/${segment(subscriptionId)}/preview-change`),
    change: (subscriptionId: string) =>
      withPrefix(`/subscriptions/${segment(subscriptionId)}/change`),
    cancel: (subscriptionId: string) =>
      withPrefix(`/subscriptions/${segment(subscriptionId)}/cancel`),
    schedules: (subscriptionId: string) =>
      withPrefix(`/subscriptions/${segment(subscriptionId)}/schedules`),
  },
  billing: {
    invoices: withPrefix("/billing/invoices"),
    invoice: (invoiceId: string) =>
      withPrefix(`/billing/invoices/${segment(invoiceId)}`),
    issueInvoice: (invoiceId: string) =>
      withPrefix(`/billing/invoices/${segment(invoiceId)}/issue`),
    payments: (invoiceId: string) =>
      withPrefix(`/billing/invoices/${segment(invoiceId)}/payments`),
    creditNotes: withPrefix("/billing/credit-notes"),
    applyCreditNote: (creditNoteId: string) =>
      withPrefix(`/billing/credit-notes/${segment(creditNoteId)}/apply`),
  },
  negotiation: {
    workspace: (quoteId: string) =>
      withPrefix(`/negotiation/quotes/${segment(quoteId)}`),
    comments: (quoteId: string) =>
      withPrefix(`/negotiation/quotes/${segment(quoteId)}/comments`),
    portalQuote: (quoteId: string) =>
      withPrefix(`/negotiation/portal/${segment(quoteId)}`),
    createChangeRequest: (quoteId: string) =>
      withPrefix(`/negotiation/portal/${segment(quoteId)}/change-request`),
    changeRequests: (quoteId: string) =>
      withPrefix(`/negotiation/portal/${segment(quoteId)}/change-requests`),
    counteroffer: (requestId: string) =>
      withPrefix(
        `/negotiation/change-requests/${segment(requestId)}/counteroffer`,
      ),
    acceptChangeRequest: (requestId: string) =>
      withPrefix(`/negotiation/change-requests/${segment(requestId)}/accept`),
    rejectChangeRequest: (requestId: string) =>
      withPrefix(`/negotiation/change-requests/${segment(requestId)}/reject`),
    acceptCounteroffer: (counterofferId: string) =>
      withPrefix(
        `/negotiation/portal/counteroffers/${segment(counterofferId)}/accept`,
      ),
    rejectCounteroffer: (counterofferId: string) =>
      withPrefix(
        `/negotiation/portal/counteroffers/${segment(counterofferId)}/reject`,
      ),
  },
  dealHealth: {
    alerts: withPrefix("/deal-health/alerts"),
    alert: (alertId: string) =>
      withPrefix(`/deal-health/alerts/${segment(alertId)}`),
    acknowledge: (alertId: string) =>
      withPrefix(`/deal-health/alerts/${segment(alertId)}/acknowledge`),
    snooze: (alertId: string) =>
      withPrefix(`/deal-health/alerts/${segment(alertId)}/snooze`),
    snapshots: (quoteId: string) =>
      withPrefix(`/deal-health/quotes/${segment(quoteId)}/snapshots`),
    snapshot: (quoteId: string, snapshotId: string) =>
      withPrefix(
        `/deal-health/quotes/${segment(quoteId)}/snapshots/${segment(snapshotId)}`,
      ),
    healthScore: (quoteId: string) =>
      withPrefix(`/deal-health/quotes/${segment(quoteId)}/health-score`),
  },
  reporting: {
    exports: withPrefix("/reporting/exports"),
    export: (jobId: string) =>
      withPrefix(`/reporting/exports/${segment(jobId)}`),
    download: (jobId: string) =>
      withPrefix(`/reporting/exports/${segment(jobId)}/download`),
    file: (jobId: string) =>
      withPrefix(`/reporting/exports/${segment(jobId)}/file`),
  },
  notifications: {
    list: withPrefix("/notifications"),
    read: (notificationId: string) =>
      withPrefix(`/notifications/${segment(notificationId)}/read`),
  },
} as const;

/**
 * Additive aliases for Implementation Plan routes not present in openapi.yaml.
 * Keeping these separate makes contract drift visible instead of silently
 * changing an OpenAPI-defined path.
 */
export const planApiRoutes = {
  auth: {
    refresh: withPrefix("/auth/refresh"),
    requestPortalMagicLink: withPrefix("/portal/magic-links"),
    exchangePortalSession: withPrefix("/portal/session/exchange"),
    portalLogout: withPrefix("/portal/session/logout"),
  },
  quotes: {
    update: (quoteId: string) => withPrefix(`/quotes/${segment(quoteId)}`),
    line: (quoteId: string, lineId: string) =>
      withPrefix(`/quotes/${segment(quoteId)}/lines/${segment(lineId)}`),
    send: (quoteId: string) => withPrefix(`/quotes/${segment(quoteId)}/send`),
    transitionStage: (quoteId: string) =>
      withPrefix(`/quotes/${segment(quoteId)}/stage`),
    versions: (quoteId: string) =>
      withPrefix(`/quotes/${segment(quoteId)}/versions`),
    versionDiff: (quoteId: string) =>
      withPrefix(`/quotes/${segment(quoteId)}/version-diff`),
    timeline: (quoteId: string) =>
      withPrefix(`/quotes/${segment(quoteId)}/timeline`),
    savedFilters: withPrefix("/quotes/saved-filters"),
    savedFilter: (filterId: string) =>
      withPrefix(`/quotes/saved-filters/${segment(filterId)}`),
  },
  approvals: {
    inbox: withPrefix("/approvals/inbox"),
    detail: (requestId: string) =>
      withPrefix(`/approvals/${segment(requestId)}`),
    delegate: (requestId: string, stepId: string) =>
      withPrefix(
        `/approvals/${segment(requestId)}/steps/${segment(stepId)}/delegate`,
      ),
    approve: (requestId: string) =>
      withPrefix(`/approval-requests/${segment(requestId)}/approve`),
    reject: (requestId: string) =>
      withPrefix(`/approval-requests/${segment(requestId)}/reject`),
    requestRevision: (requestId: string) =>
      withPrefix(`/approval-requests/${segment(requestId)}/request-revision`),
  },
  configuration: {
    approvalPolicies: withPrefix("/approval-policies"),
    approvalPolicy: (policyId: string) =>
      withPrefix(`/approval-policies/${segment(policyId)}`),
    recommendationRules: withPrefix("/recommendation-rules"),
    recommendationRule: (ruleId: string) =>
      withPrefix(`/recommendation-rules/${segment(ruleId)}`),
    promotions: withPrefix("/promotions"),
    promotion: (promotionId: string) =>
      withPrefix(`/promotions/${segment(promotionId)}`),
  },
  catalog: {
    productPicker: withPrefix("/catalog/product-picker"),
    productVariants: (productId: string) =>
      withPrefix(`/products/${segment(productId)}/variants`),
    productVariant: (productId: string, variantId: string) =>
      withPrefix(
        `/products/${segment(productId)}/variants/${segment(variantId)}`,
      ),
  },
  inventory: {
    incoming: (warehouseId: string) =>
      withPrefix(`/inventory/warehouses/${segment(warehouseId)}/incoming`),
  },
  subscriptions: {
    previewCancellation: (subscriptionId: string) =>
      withPrefix(
        `/subscriptions/${segment(subscriptionId)}/preview-cancellation`,
      ),
  },
  fulfillment: {
    preview: (orderId: string) =>
      withPrefix(`/orders/${segment(orderId)}/fulfillment/preview`),
    reserve: (orderId: string) =>
      withPrefix(`/orders/${segment(orderId)}/fulfillment/reserve`),
    override: (orderId: string) =>
      withPrefix(`/orders/${segment(orderId)}/fulfillment/override`),
    consolidateBackorder: (backorderId: string) =>
      withPrefix(`/backorders/${segment(backorderId)}/consolidate`),
  },
  portal: {
    session: withPrefix("/portal/session"),
    quotes: withPrefix("/portal/quotes"),
    quote: (quoteId: string) =>
      withPrefix(`/portal/quotes/${segment(quoteId)}`),
    comments: (quoteId: string) =>
      withPrefix(`/portal/quotes/${segment(quoteId)}/comments`),
    changeRequests: (quoteId: string) =>
      withPrefix(`/portal/quotes/${segment(quoteId)}/change-requests`),
    customerCounterproposals: (quoteId: string) =>
      withPrefix(`/portal/quotes/${segment(quoteId)}/counteroffers`),
    confirm: (quoteId: string) =>
      withPrefix(`/portal/quotes/${segment(quoteId)}/confirm`),
    versions: (quoteId: string) =>
      withPrefix(`/portal/quotes/${segment(quoteId)}/versions`),
    versionDiff: (quoteId: string) =>
      withPrefix(`/portal/quotes/${segment(quoteId)}/version-diff`),
  },
  dealHealth: {
    dashboard: withPrefix("/dashboard/deal-health"),
    nudge: (alertId: string) => withPrefix(`/alerts/${segment(alertId)}/nudge`),
  },
  reporting: {
    summary: withPrefix("/reports/summary"),
    exports: withPrefix("/reports/exports"),
    export: (exportId: string) =>
      withPrefix(`/reports/exports/${segment(exportId)}`),
    savedFilters: withPrefix("/reports/saved-filters"),
    savedFilter: (filterId: string) =>
      withPrefix(`/reports/saved-filters/${segment(filterId)}`),
  },
  billing: {
    invoices: withPrefix("/invoices"),
    recordPayment: (invoiceId: string) =>
      withPrefix(`/invoices/${segment(invoiceId)}/payments`),
  },
  events: {
    stream: withPrefix("/events/stream"),
  },
  notifications: {
    list: withPrefix("/notifications"),
    read: (notificationId: string) =>
      withPrefix(`/notifications/${segment(notificationId)}/read`),
  },
} as const;
