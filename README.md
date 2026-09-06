# DealFlow360

DealFlow360 is an explainable quotation-to-cash workspace for complex B2B sales. It combines governed pricing, sequential approvals, multi-warehouse fulfillment, customer negotiation, hybrid billing, deal-health alerts, and reporting in one auditable workflow.

## Repository map

| Workspace                    | Responsibility                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------- |
| `apps/web`                   | Next.js App Router user interface on port `3001`                                 |
| `apps/api`                   | Express REST API and background worker on port `3000`                            |
| `packages/database`          | Prisma schema, migrations, generated client, seed, and singleton database client |
| `packages/common`            | Shared Zod contracts, types, constants, utilities, and route builders            |
| `packages/ui`                | Presentational React components only                                             |
| `packages/tailwind-config`   | Shared visual tokens and Tailwind theme                                          |
| `packages/eslint-config`     | Shared ESLint rules                                                              |
| `packages/typescript-config` | Shared strict TypeScript settings                                                |

The frontend communicates only with the API. Prisma is confined to `packages/database`, while all request and response shapes shared by the API and frontend come from `packages/common`.

## Requirements

- [Bun 1.4.1](https://bun.sh/) as the only package manager
- Node.js 24 or newer for tooling compatibility
- PostgreSQL with permission to create and migrate the `dealflow360` schema

## Local setup

1. Install the pinned workspace dependencies.

   ```powershell
   bun install --frozen-lockfile
   ```

2. Create local environment files from the examples.

   ```powershell
   Copy-Item packages/database/.env.example packages/database/.env
   Copy-Item apps/api/.env.example apps/api/.env
   Copy-Item apps/web/.env.example apps/web/.env.local
   ```

3. Set the same `DATABASE_URL` and `DATABASE_SCHEMA` in `packages/database/.env` and `apps/api/.env`. The default schema is `dealflow360` so the application does not modify PostgreSQL's public schema.

4. To enable password sign-in for the deterministic demo users, set `DEMO_PASSWORD` in `packages/database/.env` to a private value between 12 and 128 characters. The seed never contains a hard-coded password.

5. Generate the Prisma client, apply the committed migrations, and load the demo data.

   ```powershell
   bun run db:generate
   bun run db:deploy
   bun run db:seed
   ```

6. Start the web app, API, and worker through Turborepo.

   ```powershell
   bun run dev
   ```

Open `http://localhost:3001`. The web application proxies same-origin `/api/v1` requests to `API_INTERNAL_URL`, which defaults to `http://localhost:3000`.

## Demo identities

After seeding, use the private value you supplied through `DEMO_PASSWORD` with one of these internal identities:

| Role                 | Email                                   |
| -------------------- | --------------------------------------- |
| Administrator        | `admin@demo.dealflow360.local`          |
| Sales representative | `representative@demo.dealflow360.local` |
| Sales manager        | `manager@demo.dealflow360.local`        |
| Finance              | `finance@demo.dealflow360.local`        |
| Operations           | `operations@demo.dealflow360.local`     |
| Customer user        | `customer@demo.dealflow360.local`       |

Customers request an account at `/portal/request-access`. Administrators review requests under **Administration → Customer Requests**, approve or decline them, and retry failed emails. Approval sends the customer their email and a generated password through Nodemailer; only an Argon2id hash is stored. Customers sign in at `/portal/login` and can change the password under Account Security. Existing contacts may also use passwordless links. Set `SMTP_USER` and `SMTP_PASS` in `apps/api/.env` (Gmail defaults; use an app password). See [customer access and SMTP setup](docs/CUSTOMER_ACCESS.md).

The default seed includes seven connected quotations covering draft, approval, ready to share, shared, negotiation, customer acceptance, and confirmed-order workflows, plus stock, subscription billing, and paid/overdue invoices. Rerunning it preserves existing quotation progress. The old per-table volume fixture is opt-in with `SEED_STRESS_DATA=true`; it is intended only for stress testing. No migrations are needed to use the updated seed against the existing database.

See [the route and workflow guide](docs/ROUTES.md) for all web pages and API operations. With the seeded API and web servers running locally, `bun run scripts/smoke-web.ts` from `apps/api` checks the internal pages using a temporary session that is removed afterward.

## Commands

| Command               | Purpose                                                            |
| --------------------- | ------------------------------------------------------------------ |
| `bun run dev`         | Run the API, worker, and frontend in watch mode                    |
| `bun run build`       | Build every workspace in dependency order                          |
| `bun run lint`        | Run shared ESLint rules across the monorepo                        |
| `bun run check-types` | Run strict TypeScript checks across the monorepo                   |
| `bun run test`        | Run the repository's Bun test tasks when test execution is desired |
| `bun run db:validate` | Validate the Prisma schema and configuration                       |
| `bun run db:generate` | Regenerate the Prisma client                                       |
| `bun run db:deploy`   | Apply committed migrations                                         |
| `bun run db:migrate`  | Create a development migration after an intentional schema change  |
| `bun run db:seed`     | Upsert deterministic demo fixtures                                 |
| `bun run demo:reset`  | Recreate only the known demo organization in the configured schema |

`demo:reset` is intentionally guarded and refuses unsafe production or broad-schema targets.

## API and architecture references

- The authoritative method and path inventory is [`../openapi.yaml`](../openapi.yaml).
- Product behavior and delivery requirements are in [`../ImplementationPlan.md`](../ImplementationPlan.md).
- Implementation history is append-only in [`../PROGRESS.md`](../PROGRESS.md).
- Viva-oriented explanations live in [`../TECHNICAL_DOCUMENTATION.md`](../TECHNICAL_DOCUMENTATION.md).
- API-specific environment and runtime details are in [`apps/api/README.md`](apps/api/README.md).

## Security notes

- Internal and portal sessions use separate HTTP-only cookies and scopes.
- Mutating cookie-authenticated requests require a CSRF token.
- API authorization remains authoritative even when the interface hides unavailable actions.
- Organization and object ownership filters are applied to database access.
- Passwords, raw magic-link tokens, and payment secrets must never be committed or logged.
- Production startup requires secure cookies and HTTPS-aware deployment settings.
