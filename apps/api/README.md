# DealFlow360 API

Express 5 modular-monolith API for DealFlow360. The public contract is the
repository-root `openapi.yaml`; all 98 documented method/path operations are
mounted below `/api/v1`. Additive routes required by the Implementation Plan
reuse the same domain handlers where their semantics match.

## Run

From the monorepo root:

```bash
bun install --frozen-lockfile
bun run dev --filter=api
```

The API workspace's `dev` command starts both the HTTP server and the database
worker. They can also be run independently:

```bash
bun run --cwd apps/api dev:server
bun run --cwd apps/api dev:worker
```

`bun run build` emits `dist/index.js` and `dist/worker-main.js`. Use
`bun run --cwd apps/api start` and `bun run --cwd apps/api start:worker` to run
the built entries from the monorepo root.

Copy `.env.example` to a local `.env` and set `DATABASE_URL` and
`DATABASE_SCHEMA` to the same database and schema used by
`packages/database/.env`. `WEB_ORIGIN` is an exact allowed origin, not a wildcard.
`API_PUBLIC_URL` identifies the HTTP listener in startup output. Worker cadence
and bounded batch size are controlled by `WORKER_POLL_INTERVAL_MS` and
`WORKER_BATCH_SIZE`.
Billing-schedule, invoice-due, health, approval, backorder, and cleanup scans
have separate `WORKER_*_INTERVAL_MS` settings;
`APPROVAL_ESCALATION_AFTER_HOURS` controls the point at which a due approval
becomes an escalation.

## Modules

- `src/modules/auth` owns internal sessions, refresh rotation, portal magic
  links, and the separate portal session boundary.
- `src/modules/configuration` owns tenant-scoped customer, catalog, pricing,
  tax, warehouse, approval-policy, and recommendation-rule configuration.
- `src/modules/quotations` owns immutable commercial versions, authoritative
  pricing/tax/margin/risk/fingerprint calculation, recommendations, submission,
  sending, diffs, and timelines.
- `src/modules/approvals` owns sequential approval decisions and reapproval.
- `src/modules/negotiation` owns redacted portal reads, safe customer-visible
  version history/diffs, discussions, customer change requests, seller
  counteroffers, and exact-fingerprint acceptance.
- `src/modules/operations` owns order confirmation, inventory movements,
  fulfillment, reservations, shipments, and backorders.
- `src/modules/billing` owns subscriptions, proration, invoices, payments, and
  credits.
- `src/modules/insights` owns health snapshots/alerts, nudges, dashboards,
  exports, notifications, and the authenticated SSE feed.

The plan alias `POST /api/v1/portal/quotes/:quoteId/counteroffers` is explicitly
contracted as a customer counterproposal. Because the persistence model requires
a seller-authored `Counteroffer` to belong to an existing `ChangeRequest`, this
customer-originated route transactionally creates and returns an umbrella
`CustomerCounterproposalDto` (an intentionally named `ChangeRequest` contract).
It does not fabricate an internal seller identity. The request must carry the
visible `quoteRevision` and `termsFingerprint`; the handler compare-and-swaps
both against the current shared terms before it persists the proposal.

## Security and request rules

Internal and portal sessions use separate opaque, hashed database tokens. Cookie
paths are `/` so Next.js server routes can enforce sessions. Browser mutations
must send the matching `X-CSRF-Token`; financial, inventory, fulfillment,
subscription, and portal-confirmation commands additionally require an
`Idempotency-Key`. Authorization combines central capabilities with tenant and
object ownership/team/customer scope.

Responses include defensive no-cache, MIME-sniffing, referrer, and frame headers.
Errors use `application/problem+json`; malformed and oversized JSON are reported
as 400 and 413 problem responses. Portal DTOs are deliberately independent from
internal quote DTOs and exclude cost, margin, risk, warehouse, and audit fields.

## Worker behavior

`src/worker/runtime.ts` atomically claims bounded outbox batches, reclaims stale
leases, increments attempts, records truncated errors, applies exponential
backoff, and dead-letters events at their configured maximum. Notification
creation and the final `PROCESSED` transition share one transaction, so replay
does not duplicate its database side effect. A separate bounded pass delivers
in-app notification rows and marks email rows failed rather than pretending an
external email integration exists. A periodic cleanup revokes expired internal,
refresh, portal, and magic-link tokens, expires report jobs, and removes expired
idempotency records.

Scheduled scans enqueue stable, tenant-scoped outbox jobs rather than performing
untracked side effects. Their handlers therefore inherit the same compare-and-
swap claim, bounded retry, error record, exponential backoff, and dead-letter
behavior:

- Due recurring billing schedules take a per-subscription advisory lock and
  atomically create a draft recurring invoice and customer-safe line snapshots,
  mark the source schedule generated, advance the subscription period, and
  create the next unique schedule. Month-end anchors are clamped rather than
  overflowing into the following month. Billing dates are interpreted in the
  subscription's snapshotted organization timezone, while event timestamps stay
  UTC. `nextBillingAt` is the real instant at which the next local billing date
  starts, including daylight-saving changes. Each schedule also snapshots its
  line quantities and prices. A mid-period quantity change therefore produces
  only its prorated adjustment in the current period; the immutable base
  schedule still bills the old quantity, while the next schedule snapshots and
  bills the new quantity. A final failed attempt marks the source billing
  schedule `FAILED` while preserving the outbox error.
- A separate bounded invoice scan compares each due calendar date with the
  customer's organization-local date. After the full due day ends, it claims a
  deterministic invoice-state job, compare-and-swaps `ISSUED` or
  `PARTIALLY_PAID` to `OVERDUE`, updates the customer overdue balance, and
  records `invoice.due` in the audit, deal timeline, outbox, and notification
  flow. Payments and applied credits preserve a remaining overdue status and
  reduce that balance transactionally.
- Deal health is refreshed periodically for non-terminal quotes. Snapshot and
  alert writes share a per-quote advisory lock; active stalled-deal, discount,
  approval-SLA, promise-slippage, and credit alerts are updated rather than
  duplicated, and cleared rule breaches are resolved.
- Due approval steps receive one reminder for their due timestamp and one later
  escalation after the configured threshold. Assignees/delegates receive the
  reminder; the matching sales-team manager and scoped manager/admin authorities
  receive escalation notifications. The related approval-SLA alert is reused.
  `PUT /approvals/:requestId/steps/:stepId/delegate` assigns an eligible
  same-organization delegate by email with required expiry and reason;
  `DELETE` on the same path clears it. Assignment time, assigning user, expiry,
  and reason are durable. Decisions accept the delegate only inside that exact
  validity window, and a bounded deterministic expiry job clears elapsed
  delegations with audit, outbox, and notification evidence. Legacy delegate
  IDs without provenance are never treated as active authority.
- Backorders are rechecked when their stock-balance fingerprint changes. A
  newly actionable backorder creates one alert and notifies operations; loss of
  eligibility resolves that alert. The existing `consolidate` command now means
  “consume replenishment”: it locks the backorder, compare-and-swaps current
  stock, creates reservations, creates or appends ready shipments, and reduces
  the remaining quantity to partially allocated or fulfilled. This replaces an
  earlier same-order-line merge interpretation that could never be reached with
  the one-backorder-per-line workflow.
- Queued in-app nudges are delivered transactionally. Queued email nudges and
  email notifications transition to `FAILED` with the truthful
  `Email delivery adapter is not configured` error instead of remaining queued
  or pretending delivery.

CSV, XLSX, and PDF report jobs are queued with an outbox event and generated by
the bounded worker. Generation strictly validates report-specific filters and
the report's domain capability, then checks a 10,000-row limit. Heavy query and
render work runs outside Prisma's short interactive transaction; a compact
transaction stores the immutable bytes in the tenant-scoped `export_artifacts`
table and compare-and-swap marks the requester's job complete. The
documented
`/reporting/exports/:jobId/download` endpoint remains a JSON status response and,
when ready, returns the same-origin `/api/v1/reporting/exports/:jobId/file`
path. That authenticated, requester-only file route streams the stored UTF-8
CSV, standards-based Open XML workbook, or paginated PDF without re-querying
live business data. CSV cells neutralize leading formula and control prefixes,
and XLSX values are written as inline strings so user content cannot become a
formula. Cancellation and expiry delete the private artifact row; a larger
deployment can replace this bounded database storage with private object storage.

Saved report filters are strict, tenant- and user-scoped records under
`/api/v1/reports/saved-filters`; updates use `updatedAt` as an optimistic
concurrency precondition. The quote-aware product picker lives at
`/api/v1/catalog/product-picker` and resolves the customer's tier, quote
currency, quantity break, price list, variant surcharge, and scoped warehouse
availability on the server.

Quotation list filters have a separate tenant- and user-scoped CRUD surface at
`/api/v1/quotes/saved-filters`. Their stored shape contains the shared search,
stage, sort, and direction values used by both table and pipeline views. An
update must carry the previously read `updatedAt`; a stale write returns a
conflict so the UI can reload and require review instead of overwriting another
session's changes.

Product variants and promotions have additive Implementation Plan command
routes under `/api/v1/products/:productId/variants` and
`/api/v1/promotions`. Both are organization-scoped configuration resources,
require CSRF plus `configuration.manage` for writes, and use revision checks so
stale admin drawers cannot overwrite newer values. A variant surcharge affects
only future server-side price resolutions; immutable quote snapshots retain the
price already accepted. Promotion products are tenant-validated, boosts are
limited to the normalized 0-to-1 ranking range, and equal-priority promotions
cannot target the same product during overlapping effective periods.

## Explainable commercial and inventory intelligence

Discount anomaly is a deterministic representative benchmark, not an AI claim.
The API compares a quote's blended excess with up to 50 recent risk snapshots
owned by the same representative. Its threshold is the historical mean plus the
larger of one percentage point or twice the mean absolute deviation; cold-start
representatives use a documented one-point baseline. The sample, mean,
deviation, threshold, and method are persisted in `QuoteVersion.riskFacts`.
Decision Explainer only emits a `thresholdSafeSuggestion` after adjusting every
line over its applicable ceiling, recalculating totals/margin/credit/anomaly,
and replaying the complete active approval-policy set. Its multi-line
adjustments and zero-route proof are returned in the shared contract; otherwise
the suggestion is `null` rather than being mislabeled safe.

Fulfillment previews return `promiseDateConfidence` with a level and score,
estimated promise instant, projected shortage and shipment split, per-warehouse
inputs, stable reason codes, and a plain-language explanation. The inputs
separately expose current availability, active reservations, incoming quantity
and ETA, warehouse lead time, and split complexity. Incoming stock is managed by
the idempotent, revision-guarded
`PUT /api/v1/inventory/warehouses/:warehouseId/incoming` command. The database
requires a future ETA for positive incoming stock.

Inventory-Smart Upsell remains explainable rules-and-ranking. Its five stored
weights are affinity, margin, promotion, current availability, and stock age,
and must sum to one. Stock age is measured from `stockedSince`, the oldest date
of the current uninterrupted positive on-hand run; receipts preserve it,
depletion clears it, and the next positive receipt starts a new run. Hardware
with no available stock is excluded. The response discloses component scores,
weighted stock age, current availability, incoming ETA, reasons, and the exact
weight snapshot used for ranking.

External email delivery remains an explicit integration point because no email
provider or credentials are configured. Object storage is optional rather than
required for the current bounded export design.

## Credits and partial refunds

The implemented subscription quantity-reduction and eligible cancellation
flows calculate the unused-period amount on the server and persist an issued
`CreditNote` plus `CreditNoteLine` tied to the subscription change and source
invoice. Applying that credit to an outstanding invoice reduces both invoice
balance and customer exposure; for overdue invoices it also reduces the overdue
balance. This fulfills the plan's internal partial-refund accounting workflow.
It deliberately does not claim to send cash or reverse a card charge: external
payment-provider refunds remain a P2 adapter because the repository defines no
provider, credential, or external refund identifier.

Cancellation behavior is also plan-configured rather than inferred by the
client. `cancellationRules.noticeDays` sets the earliest organization-local
effective date, and `refundRules.unusedDays` is either `credit` or `no_credit`.
Preview and apply invoke the same calculation, persist the rule snapshot and
plain-language explanation, and reject a request that violates notice or uses
an invalid stored rule.

Finance routing consumes payment history in addition to current exposure and
overdue balance. Quote recalculation evaluates settled invoices in the
organization timezone, counts late-paid invoices and failed payment attempts,
calculates an on-time rate when history exists, stores those facts in the quote
risk snapshot, and exposes them through the shared DTO. Approval policies can
use `latePaidInvoiceCountAtLeast`, `failedPaymentCountAtLeast`, or
`onTimePaymentRateBelow`; the deterministic demo includes one genuinely
late-paid invoice for the overdue customer while the safe customer has no
adverse payment-history fact.
