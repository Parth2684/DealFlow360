# Application routes

Express operations are mounted under `/api/v1`. Internal routes validate an internal session and their required capabilities. Customer portal routes use a separate account- or quote-scoped portal session. Unknown API paths return 404.

## User journeys

- Customers request portal access with their contact email, open My Quotations, and select a shared quotation by number. They can comment, request changes, and accept the displayed terms. No record identifiers need to be typed.
- Sales opens Customers → customer → New Quotation, adds catalog products, submits approval, and shares the approved quote in the portal. Customer conversations and commercial requests appear on the quotation.
- After customer acceptance, sales confirms an order. Orders link to fulfillment and billing. Operations reserves stock and records shipments. Finance issues invoices and records payments. Subscriptions link to their order billing workspace.
- Inventory provides stock receipts, adjustments, and incoming stock using named warehouses and products. Administrators manage staff and roles under Settings → Team.

Sharing a quotation publishes it in the customer portal. New customers request accounts at /portal/request-access; administrators approve or decline under /settings/customer-requests. Nodemailer sends decisions and credentials using SMTP_USER and SMTP_PASS. See [SMTP and customer access setup](CUSTOMER_ACCESS.md).

## Web pages

- `/`
- `/approvals`
- `/approvals/[requestId]`
- `/customers`
- `/customers/[customerId]`
- `/deal-health`
- `/forbidden`
- `/inventory`
- `/invoices`
- `/invoices/[invoiceId]`
- `/login`
- `/orders`
- `/orders/[orderId]`
- `/orders/[orderId]/billing`
- `/orders/[orderId]/fulfillment`
- `/pipeline`
- `/portal`
- `/portal/account`
- `/portal/login`
- `/portal/quotations/[quoteId]`
- `/portal/request-access`
- `/quotations`
- `/quotations/[quoteId]`
- `/quotations/new`
- `/reports`
- `/settings/approval-chains`
- `/settings/customer-requests`
- `/settings/customers`
- `/settings/discount-policies`
- `/settings/price-lists`
- `/settings/products`
- `/settings/promotions`
- `/settings/recommendations`
- `/settings/subscription-plans`
- `/settings/team`
- `/settings/warehouses`
- `/signup`
- `/subscriptions`
- `/workspace`

## Express operations

| Method | Path                                                                 |
| ------ | -------------------------------------------------------------------- |
| GET    | `/api/v1/health`                                                     |
| GET    | `/api/v1/portal/session`                                             |
| POST   | `/api/v1/auth/signup`                                                |
| POST   | `/api/v1/auth/login`                                                 |
| POST   | `/api/v1/auth/logout`                                                |
| GET    | `/api/v1/auth/me`                                                    |
| POST   | `/api/v1/auth/refresh`                                               |
| POST   | `/api/v1/portal/magic-links`                                         |
| POST   | `/api/v1/portal/session/exchange`                                    |
| POST   | `/api/v1/portal/session/logout`                                      |
| GET    | `/api/v1/team/members`                                               |
| POST   | `/api/v1/team/members`                                               |
| PATCH  | `/api/v1/team/members/:userId`                                       |
| GET    | `/api/v1/portal/registration-context`                                |
| POST   | `/api/v1/portal/account-requests`                                    |
| GET    | `/api/v1/customer-access/requests`                                   |
| POST   | `/api/v1/customer-access/requests/:requestId/decision`               |
| POST   | `/api/v1/customer-access/requests/:requestId/retry-email`            |
| POST   | `/api/v1/portal/password-login`                                      |
| POST   | `/api/v1/portal/password`                                            |
| GET    | `/api/v1/products`                                                   |
| POST   | `/api/v1/products`                                                   |
| PATCH  | `/api/v1/products/:productId`                                        |
| GET    | `/api/v1/products/:productId/variants`                               |
| POST   | `/api/v1/products/:productId/variants`                               |
| PATCH  | `/api/v1/products/:productId/variants/:variantId`                    |
| GET    | `/api/v1/product-categories`                                         |
| POST   | `/api/v1/product-categories`                                         |
| PATCH  | `/api/v1/product-categories/:categoryId`                             |
| GET    | `/api/v1/customers`                                                  |
| GET    | `/api/v1/warehouses`                                                 |
| POST   | `/api/v1/warehouses`                                                 |
| PATCH  | `/api/v1/warehouses/:warehouseId`                                    |
| GET    | `/api/v1/subscription-plans`                                         |
| POST   | `/api/v1/subscription-plans`                                         |
| PATCH  | `/api/v1/subscription-plans/:planId`                                 |
| GET    | `/api/v1/customer-accounts/tiers`                                    |
| POST   | `/api/v1/customer-accounts/tiers`                                    |
| PATCH  | `/api/v1/customer-accounts/tiers/:tierId`                            |
| GET    | `/api/v1/customer-accounts/accounts`                                 |
| POST   | `/api/v1/customer-accounts/accounts`                                 |
| GET    | `/api/v1/customer-accounts/accounts/:customerId`                     |
| PATCH  | `/api/v1/customer-accounts/accounts/:customerId`                     |
| GET    | `/api/v1/customer-accounts/accounts/:customerId/contacts`            |
| POST   | `/api/v1/customer-accounts/accounts/:customerId/contacts`            |
| PATCH  | `/api/v1/customer-accounts/accounts/:customerId/contacts/:contactId` |
| GET    | `/api/v1/pricing/price-lists`                                        |
| POST   | `/api/v1/pricing/price-lists`                                        |
| PATCH  | `/api/v1/pricing/price-lists/:priceListId`                           |
| GET    | `/api/v1/pricing/price-lists/:priceListId/rules`                     |
| POST   | `/api/v1/pricing/price-lists/:priceListId/rules`                     |
| PATCH  | `/api/v1/pricing/price-rules/:ruleId`                                |
| DELETE | `/api/v1/pricing/price-rules/:ruleId`                                |
| GET    | `/api/v1/pricing/discount-limits`                                    |
| POST   | `/api/v1/pricing/discount-limits`                                    |
| PATCH  | `/api/v1/pricing/discount-limits/:limitId`                           |
| GET    | `/api/v1/pricing/taxes`                                              |
| POST   | `/api/v1/pricing/taxes`                                              |
| PATCH  | `/api/v1/pricing/taxes/:taxId`                                       |
| GET    | `/api/v1/pricing/subscription-plans`                                 |
| POST   | `/api/v1/pricing/subscription-plans`                                 |
| PATCH  | `/api/v1/pricing/subscription-plans/:planId`                         |
| GET    | `/api/v1/price-lists`                                                |
| POST   | `/api/v1/price-lists`                                                |
| PATCH  | `/api/v1/price-lists/:priceListId`                                   |
| GET    | `/api/v1/discount-limits`                                            |
| POST   | `/api/v1/discount-limits`                                            |
| PATCH  | `/api/v1/discount-limits/:limitId`                                   |
| GET    | `/api/v1/approval-policies`                                          |
| GET    | `/api/v1/approval-policies/:policyId`                                |
| POST   | `/api/v1/approval-policies`                                          |
| PATCH  | `/api/v1/approval-policies/:policyId`                                |
| GET    | `/api/v1/promotions`                                                 |
| GET    | `/api/v1/promotions/:promotionId`                                    |
| POST   | `/api/v1/promotions`                                                 |
| PATCH  | `/api/v1/promotions/:promotionId`                                    |
| GET    | `/api/v1/recommendation-rules`                                       |
| GET    | `/api/v1/recommendation-rules/:ruleId`                               |
| POST   | `/api/v1/recommendation-rules`                                       |
| PATCH  | `/api/v1/recommendation-rules/:ruleId`                               |
| GET    | `/api/v1/inventory/warehouses`                                       |
| POST   | `/api/v1/inventory/warehouses`                                       |
| PATCH  | `/api/v1/inventory/warehouses/:warehouseId`                          |
| GET    | `/api/v1/catalog/product-picker`                                     |
| GET    | `/api/v1/quotes`                                                     |
| GET    | `/api/v1/quotes/saved-filters`                                       |
| POST   | `/api/v1/quotes/saved-filters`                                       |
| PATCH  | `/api/v1/quotes/saved-filters/:filterId`                             |
| DELETE | `/api/v1/quotes/saved-filters/:filterId`                             |
| POST   | `/api/v1/quotes`                                                     |
| GET    | `/api/v1/quotes/:quoteId`                                            |
| PATCH  | `/api/v1/quotes/:quoteId`                                            |
| PATCH  | `/api/v1/quotes/:quoteId/stage`                                      |
| POST   | `/api/v1/quotes/:quoteId/lines`                                      |
| PATCH  | `/api/v1/quotes/:quoteId/lines/:lineId`                              |
| DELETE | `/api/v1/quotes/:quoteId/lines/:lineId`                              |
| POST   | `/api/v1/quotes/:quoteId/calculate`                                  |
| POST   | `/api/v1/quotes/:quoteId/submit`                                     |
| POST   | `/api/v1/quotes/:quoteId/send`                                       |
| GET    | `/api/v1/quotes/:quoteId/versions`                                   |
| GET    | `/api/v1/quotes/:quoteId/version-diff`                               |
| GET    | `/api/v1/quotes/:quoteId/recommendations`                            |
| POST   | `/api/v1/quotes/:quoteId/recommendations/:productId/dismiss`         |
| POST   | `/api/v1/quotes/:quoteId/recommendations/:productId/add`             |
| GET    | `/api/v1/quotes/:quoteId/timeline`                                   |
| GET    | `/api/v1/approvals`                                                  |
| GET    | `/api/v1/approvals/inbox`                                            |
| GET    | `/api/v1/approvals/:requestId`                                       |
| PUT    | `/api/v1/approvals/:requestId/steps/:stepId/delegate`                |
| DELETE | `/api/v1/approvals/:requestId/steps/:stepId/delegate`                |
| POST   | `/api/v1/approvals/:requestId/decide`                                |
| POST   | `/api/v1/approval-requests/:requestId/approve`                       |
| POST   | `/api/v1/approval-requests/:requestId/reject`                        |
| POST   | `/api/v1/approval-requests/:requestId/request-revision`              |
| GET    | `/api/v1/inventory/warehouses/:warehouseId/balances`                 |
| POST   | `/api/v1/inventory/warehouses/:warehouseId/adjust`                   |
| PUT    | `/api/v1/inventory/warehouses/:warehouseId/incoming`                 |
| GET    | `/api/v1/inventory/stock-movements`                                  |
| POST   | `/api/v1/inventory/stock-movements/receipt`                          |
| GET    | `/api/v1/orders`                                                     |
| GET    | `/api/v1/orders/:orderId`                                            |
| POST   | `/api/v1/orders/quotes/:quoteId/confirm`                             |
| GET    | `/api/v1/orders/:orderId/billing`                                    |
| GET    | `/api/v1/fulfillment/orders/:orderId/fulfillment/preview`            |
| POST   | `/api/v1/orders/:orderId/fulfillment/preview`                        |
| POST   | `/api/v1/fulfillment/orders/:orderId/fulfillment/reserve`            |
| POST   | `/api/v1/orders/:orderId/fulfillment/reserve`                        |
| POST   | `/api/v1/fulfillment/orders/:orderId/fulfillment/override`           |
| POST   | `/api/v1/orders/:orderId/fulfillment/override`                       |
| GET    | `/api/v1/fulfillment/orders/:orderId/shipments`                      |
| POST   | `/api/v1/fulfillment/shipments/:shipmentId/ship`                     |
| GET    | `/api/v1/fulfillment/backorders`                                     |
| POST   | `/api/v1/fulfillment/backorders/:backorderId/consolidate`            |
| POST   | `/api/v1/backorders/:backorderId/consolidate`                        |
| GET    | `/api/v1/subscriptions`                                              |
| GET    | `/api/v1/subscriptions/:subscriptionId`                              |
| POST   | `/api/v1/subscriptions/:subscriptionId/preview-change`               |
| POST   | `/api/v1/subscriptions/:subscriptionId/preview-cancellation`         |
| POST   | `/api/v1/subscriptions/:subscriptionId/change`                       |
| POST   | `/api/v1/subscriptions/:subscriptionId/cancel`                       |
| GET    | `/api/v1/subscriptions/:subscriptionId/schedules`                    |
| GET    | `/api/v1/billing/invoices`                                           |
| GET    | `/api/v1/invoices`                                                   |
| GET    | `/api/v1/billing/invoices/:invoiceId`                                |
| POST   | `/api/v1/billing/invoices/:invoiceId/issue`                          |
| GET    | `/api/v1/billing/invoices/:invoiceId/payments`                       |
| POST   | `/api/v1/billing/invoices/:invoiceId/payments`                       |
| POST   | `/api/v1/invoices/:invoiceId/payments`                               |
| GET    | `/api/v1/billing/credit-notes`                                       |
| POST   | `/api/v1/billing/credit-notes/:creditNoteId/apply`                   |
| GET    | `/api/v1/negotiation/quotes/:quoteId`                                |
| POST   | `/api/v1/negotiation/quotes/:quoteId/comments`                       |
| GET    | `/api/v1/portal/quotes`                                              |
| GET    | `/api/v1/negotiation/portal/:quoteId`                                |
| GET    | `/api/v1/portal/quotes/:quoteId`                                     |
| GET    | `/api/v1/portal/quotes/:quoteId/versions`                            |
| GET    | `/api/v1/portal/quotes/:quoteId/version-diff`                        |
| POST   | `/api/v1/negotiation/portal/:quoteId/change-request`                 |
| POST   | `/api/v1/portal/quotes/:quoteId/change-requests`                     |
| POST   | `/api/v1/portal/quotes/:quoteId/counteroffers`                       |
| GET    | `/api/v1/negotiation/portal/:quoteId/change-requests`                |
| GET    | `/api/v1/portal/quotes/:quoteId/comments`                            |
| POST   | `/api/v1/portal/quotes/:quoteId/comments`                            |
| POST   | `/api/v1/negotiation/change-requests/:requestId/counteroffer`        |
| POST   | `/api/v1/negotiation/change-requests/:requestId/accept`              |
| POST   | `/api/v1/negotiation/change-requests/:requestId/reject`              |
| POST   | `/api/v1/negotiation/portal/counteroffers/:counterofferId/accept`    |
| POST   | `/api/v1/negotiation/portal/counteroffers/:counterofferId/reject`    |
| POST   | `/api/v1/portal/quotes/:quoteId/confirm`                             |
| GET    | `/api/v1/deal-health/alerts`                                         |
| GET    | `/api/v1/deal-health/alerts/:alertId`                                |
| POST   | `/api/v1/deal-health/alerts/:alertId/acknowledge`                    |
| POST   | `/api/v1/deal-health/alerts/:alertId/snooze`                         |
| GET    | `/api/v1/deal-health/quotes/:quoteId/snapshots`                      |
| POST   | `/api/v1/deal-health/quotes/:quoteId/snapshots`                      |
| GET    | `/api/v1/deal-health/quotes/:quoteId/snapshots/:snapshotId`          |
| GET    | `/api/v1/deal-health/quotes/:quoteId/health-score`                   |
| POST   | `/api/v1/alerts/:alertId/nudge`                                      |
| GET    | `/api/v1/dashboard/deal-health`                                      |
| GET    | `/api/v1/reports/summary`                                            |
| GET    | `/api/v1/reports/saved-filters`                                      |
| POST   | `/api/v1/reports/saved-filters`                                      |
| PATCH  | `/api/v1/reports/saved-filters/:filterId`                            |
| DELETE | `/api/v1/reports/saved-filters/:filterId`                            |
| GET    | `/api/v1/reporting/exports`                                          |
| GET    | `/api/v1/reports/exports`                                            |
| POST   | `/api/v1/reporting/exports`                                          |
| POST   | `/api/v1/reports/exports`                                            |
| GET    | `/api/v1/reporting/exports/:jobId`                                   |
| GET    | `/api/v1/reports/exports/:exportId`                                  |
| DELETE | `/api/v1/reporting/exports/:jobId`                                   |
| GET    | `/api/v1/reporting/exports/:jobId/download`                          |
| GET    | `/api/v1/reporting/exports/:jobId/file`                              |
| GET    | `/api/v1/notifications`                                              |
| POST   | `/api/v1/notifications/:notificationId/read`                         |
| GET    | `/api/v1/events/stream`                                              |
