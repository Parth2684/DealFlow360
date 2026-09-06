# @repo/common

`@repo/common` is DealFlow360's transport contract layer. Both the Express API
and Next.js frontend import request schemas, safe response DTOs, domain enums,
capabilities, route builders, and presentation utilities from this package. It
does not import Prisma or expose persistence models.

## Contract conventions

- IDs are UUID strings.
- Money, quantities, rates, and percentages cross the API as base-10 strings
  with no more than four decimal places. Business code must not use JavaScript
  floating-point arithmetic for these values.
- Timestamps are offset-aware ISO 8601 strings. Calendar dates use `YYYY-MM-DD`.
- List endpoints use cursor pagination with `items` and `pageInfo`.
- Errors use the RFC 7807-compatible `ProblemDetails` shape.
- `PortalQuoteDtoSchema` is intentionally declared separately from the internal
  quotation DTO so internal cost, margin, risk, and audit fields cannot leak by
  an accidental object spread.
- Zod schemas validate data at runtime; `z.infer` provides the matching
  TypeScript type at compile time.

## Usage

```ts
import {
  CreateQuoteRequestSchema,
  type QuoteDto,
  apiRoutes,
} from "@repo/common";

const input = CreateQuoteRequestSchema.parse(requestBody);
const path = apiRoutes.quotes.detail("00000000-0000-0000-0000-000000000000");
```

## Commands

Run from this package or through Turborepo at the repository root:

```bash
bun run lint
bun run check-types
bun run build
```
