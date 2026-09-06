# DealFlow360 Web

This workspace is the Next.js App Router frontend for DealFlow360. It renders the internal quote-to-cash workspace and the customer portal, and it consumes the REST API only. It never imports Prisma or talks to PostgreSQL directly.

## Local Runtime

- Web application: `http://localhost:3001`
- API service: `http://localhost:3000`
- Browser API requests: same-origin `/api/v1/*`, rewritten to the API service by Next.js
- Server Component API requests: `API_INTERNAL_URL`

Copy `.env.example` to `.env.local` when the API runs somewhere other than the documented local default. `API_INTERNAL_URL` must be an origin without the `/api/v1` suffix.

Use Bun from the repository root:

```bash
bun install --frozen-lockfile
bun run dev
bun run lint
bun run check-types
bun run build
```

The production build does not require a live API. Protected Server Components handle an unavailable API explicitly at request time.

## Route Boundaries

- `/login` and `/signup` authenticate internal users.
- `/portal/login` requests or exchanges a customer magic link.
- `/workspace` is the protected internal landing route.
- `/quotations`, `/quotations/new`, and `/quotations/[quoteId]` provide the
  list, quote creation, and governed three-panel builder.
- `/pipeline` and `/approvals/[requestId]` provide keyboard-accessible deal
  movement and sequential decision workspaces.
- `/orders/[orderId]/fulfillment` and `/orders/[orderId]/billing` keep the
  operational and financial views of one confirmed order separate.
- `/deal-health` and `/reports` provide URL-backed analysis, alert actions,
  background CSV/XLSX/PDF exports, and personal saved filters.
- `/settings/*` provides customer/tier/contact, product/category/variant/tax,
  price-list/rule, promotion, discount-policy, approval-chain, warehouse,
  subscription-plan, and recommendation-rule CRUD.
- `/portal` is the protected customer landing route, while
  `/portal/quotations/[quoteId]` uses a separate customer-safe DTO and layout.
- Internal and portal routes have separate layouts, cookie guards, navigation, and sign-out behavior.

Navigation is capability-filtered, and every displayed destination has an
implemented route. The API still enforces the same capability and object scope;
hiding an action in the browser is never treated as authorization.

## Foundation Contracts

- `lib/api/server.ts` forwards request cookies to the API with `cache: "no-store"` and validates successful responses with shared Zod schemas.
- `lib/api/browser.ts` sends credentials, applies the correct readable CSRF cookie to unsafe requests, parses RFC 7807 errors, and retries an internal request once after refreshing the session.
- `lib/auth/session.ts` exposes cached Server Component helpers for the current internal principal, cookie presence, and API health.
- `components/foundation/app-providers.tsx` owns the browser Query Client.
- `lib/navigation.ts` is the capability-aware internal navigation registry.
- `features/quotations/product-browser.tsx` consumes the quote-aware product
  picker, so price-list resolution and warehouse availability remain
  server-provided facts.
- `features/shared/use-idempotency-key.ts` prevents accidental duplicate
  submission of confirmation, reservation, billing, and payment commands.
