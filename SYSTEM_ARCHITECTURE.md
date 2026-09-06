# System Architecture — DealFlow360

> A complete technical blueprint of the DealFlow360 monorepo, covering every layer from
> the build system through the frontend, backend, database, and shared infrastructure.

---

## Table of Contents

1. [High-Level Overview](#1-high-level-overview)
2. [Monorepo Topology](#2-monorepo-topology)
3. [Technology Stack](#3-technology-stack)
4. [Build & Orchestration Layer — Turborepo](#4-build--orchestration-layer--turborepo)
5. [Frontend — Next.js (`apps/web`)](#5-frontend--nextjs-appsweb)
6. [Backend — Express.js (`apps/api`)](#6-backend--expressjs-appsapi)
7. [Database Layer (`packages/database`)](#7-database-layer-packagesdatabase)
8. [Shared Packages](#8-shared-packages)
9. [Dependency Graph](#9-dependency-graph)
10. [Data Flow Architecture](#10-data-flow-architecture)
11. [Authentication Architecture](#11-authentication-architecture)
12. [Environment & Configuration](#12-environment--configuration)
13. [Development Workflow](#13-development-workflow)
14. [Deployment Architecture](#14-deployment-architecture)
15. [Security Considerations](#15-security-considerations)

---

## 1. High-Level Overview

DealFlow360 is a **full-stack TypeScript monorepo** built for deal pipeline management.
It uses a clean separation-of-concerns architecture where:

- The **frontend** (Next.js) handles the UI and user interaction
- The **backend** (Express.js) exposes a RESTful API layer
- The **database** (PostgreSQL via Prisma ORM) stores all persistent data
- **Shared packages** eliminate code duplication across applications

```
┌──────────────────────────────────────────────────────────────────┐
│                        DealFlow360 Monorepo                      │
│                                                                  │
│   ┌────────────────┐          ┌────────────────┐                │
│   │   apps/web     │  HTTP    │   apps/api     │                │
│   │   (Next.js)    │ ───────► │   (Express.js) │                │
│   │   Port 3001    │          │   Port 3000    │                │
│   └───────┬────────┘          └───────┬────────┘                │
│           │                           │                          │
│           │     ┌─────────────────────┘                          │
│           │     │                                                │
│           ▼     ▼                                                │
│   ┌────────────────────────┐                                    │
│   │   packages/database    │                                    │
│   │   (Prisma ORM)         │                                    │
│   └───────────┬────────────┘                                    │
│               │                                                  │
│               ▼                                                  │
│   ┌────────────────────────┐                                    │
│   │      PostgreSQL        │                                    │
│   │   (Docker / Hosted)    │                                    │
│   └────────────────────────┘                                    │
│                                                                  │
│   ┌──────────────────────────────────────────────────────┐      │
│   │                 Shared Packages                       │      │
│   │  @repo/ui  ·  @repo/common  ·  @repo/tailwind-config │      │
│   │  @repo/eslint-config  ·  @repo/typescript-config      │      │
│   └──────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Monorepo Topology

The project follows the standard **Turborepo `apps/` + `packages/`** convention:

```
DealFlow360/
├── apps/
│   ├── api/                    # Express.js REST API server
│   │   ├── src/
│   │   │   └── index.ts        # Server entry point
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── eslint.config.js
│   │
│   └── web/                    # Next.js frontend application
│       ├── app/
│       │   ├── layout.tsx      # Root layout (Geist font)
│       │   ├── page.tsx        # Landing page
│       │   ├── globals.css     # Global styles + Tailwind import
│       │   └── favicon.ico
│       ├── public/             # Static assets
│       ├── next.config.ts
│       ├── postcss.config.js
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── database/               # Prisma ORM + PostgreSQL adapter
│   │   ├── prisma/
│   │   │   └── schema.prisma   # Data model definitions
│   │   ├── src/
│   │   │   ├── client.ts       # Singleton PrismaClient instance
│   │   │   └── index.ts        # Public exports
│   │   ├── prisma7.config.ts   # Prisma 7 configuration
│   │   └── package.json
│   │
│   ├── common/                 # Shared types, utilities, constants
│   │   ├── src/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── ui/                     # Shared React component library
│   │   ├── src/
│   │   │   ├── card.tsx
│   │   │   ├── gradient.tsx
│   │   │   ├── turborepo-logo.tsx
│   │   │   └── styles.css
│   │   └── package.json
│   │
│   ├── tailwind-config/        # Shared Tailwind CSS theme
│   │   ├── shared-styles.css   # Custom theme tokens
│   │   ├── postcss.config.js
│   │   └── package.json
│   │
│   ├── eslint-config/          # Shared ESLint rules
│   │   ├── base.js             # Base configuration
│   │   ├── next.js             # Next.js-specific rules
│   │   ├── react-internal.js   # Internal React package rules
│   │   └── package.json
│   │
│   └── typescript-config/      # Shared TypeScript settings
│       ├── base.json           # Base tsconfig (ES2022, strict)
│       ├── nextjs.json         # Next.js tsconfig preset
│       ├── react-library.json  # React library tsconfig preset
│       └── package.json
│
├── package.json                # Root workspace config
├── turbo.json                  # Turborepo task definitions
├── bun.lock                    # Dependency lockfile
└── .gitignore
```

### Key Design Principle

> Applications (`apps/`) are independently deployable units.
> Packages (`packages/`) are shared libraries consumed by one or more applications.
> No package ever depends on an application — the dependency arrow always points downward.

---

## 3. Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Monorepo** | Turborepo | ^2.10.12 | Task orchestration, caching, dependency graph |
| **Runtime** | Bun | ≥1.4.0 | Package manager, script runner, bundler |
| **Frontend** | Next.js | 16.3.1 | React framework with SSR/SSG, App Router |
| **UI Framework** | React | 19.2.8 | Component-based UI rendering |
| **Styling** | Tailwind CSS | 4.3.3 | Utility-first CSS framework |
| **Typography** | Geist Sans | 1.7.2 | System font for the UI |
| **Backend** | Express.js | 5.2.1 | HTTP API server |
| **Validation** | Zod | ^4.5.4 | Runtime schema validation |
| **Auth** | JSON Web Tokens | ^9.0.3 | Stateless authentication tokens |
| **Password Hashing** | bcrypt | ^6.0.0 | Secure password storage |
| **Cookie Parsing** | cookie-parser | ^1.4.7 | HTTP cookie handling |
| **ORM** | Prisma | 7.10.0 | Type-safe database queries and migrations |
| **DB Adapter** | @prisma/adapter-pg | ^7.10.0 | PostgreSQL wire protocol adapter |
| **Database** | PostgreSQL | Latest | Relational data store |
| **DB Driver** | pg | ^8.23.0 | Node.js PostgreSQL client |
| **Language** | TypeScript | ^7.0.2 | Static type safety across the monorepo |
| **Linting** | ESLint | ^10.x | Code quality enforcement |
| **Formatting** | Prettier | 3.9.6 | Consistent code formatting |
| **Containerization** | Docker | — | Local PostgreSQL environment |

---

## 4. Build & Orchestration Layer — Turborepo

Turborepo sits at the top of the architecture, orchestrating every task across the monorepo.

### Task Configuration (`turbo.json`)

```mermaid
graph TD
    A["turbo run build"] --> B["^db:generate"]
    A --> C["^build"]
    B --> D["Prisma Client Generated"]
    D --> E["apps/web build"]
    D --> F["apps/api build"]
    C --> E
    C --> F

    G["turbo run dev"] --> H["^db:generate"]
    H --> I["apps/web dev (port 3001)"]
    H --> J["apps/api dev (port 3000)"]

    style A fill:#4f46e5,color:#fff
    style G fill:#4f46e5,color:#fff
```

### Task Definitions

| Task | Dependencies | Cached | Outputs |
|------|-------------|--------|---------|
| `build` | `^build`, `^db:generate` | ✅ Yes | `dist/**`, `.next/**` |
| `dev` | `^db:generate` | ❌ No (persistent) | — |
| `lint` | `^lint` | ✅ Yes | — |
| `check-types` | `^build`, `^check-types` | ✅ Yes | — |
| `db:generate` | — | ❌ No | — |
| `db:migrate` | — | ❌ No | — |
| `db:deploy` | — | ❌ No | — |

> **Why database tasks are uncached:** Database commands have side effects (generating
> code, mutating schemas, applying migrations). Returning a cached result would skip
> the actual operation and leave the system in an inconsistent state.

### The `^` Prefix

The `^` prefix in `dependsOn` means *"run this task in my dependency packages first."*
This ensures that when `apps/web` builds, its dependency `packages/database` has already
run `db:generate`, making the Prisma client available at compile time.

---

## 5. Frontend — Next.js (`apps/web`)

### Architecture

| Aspect | Detail |
|--------|--------|
| **Framework** | Next.js 16.3.1 with App Router |
| **React** | v19.2.8 (React Server Components capable) |
| **Rendering** | Server-side rendering (SSR) + Static generation (SSG) |
| **Styling** | Tailwind CSS 4.3.3 via `@repo/tailwind-config` |
| **Font** | Geist Sans (applied at root layout) |
| **Port** | `3001` (Next.js default with API on 3000) |

### Application Structure

```
apps/web/app/
├── layout.tsx      ← Root layout: imports @repo/ui styles + Geist font
├── page.tsx        ← Home page: uses @repo/ui Card, Gradient, Logo
├── globals.css     ← Tailwind import + CSS custom properties (dark mode)
└── favicon.ico
```

### Key Integration Points

1. **Shared UI Components** — Imports from `@repo/ui` (Card, Gradient, TurborepoLogo)
2. **Shared Styles** — `globals.css` imports `@repo/tailwind-config` for consistent theming
3. **Database Access** — Has `@repo/db` as a dev dependency for direct Prisma queries
   (e.g., Server Components can query the database without going through the API)
4. **Type Safety** — Extends `@repo/typescript-config/nextjs.json`

### CSS Architecture

```
@repo/tailwind-config/shared-styles.css     (theme tokens: blue-1000, purple-1000, red-1000)
         │
         ▼
apps/web/app/globals.css                    (imports tailwind + shared config)
         │
         ▼
@repo/ui/src/styles.css                     (component-level styles, imported in layout.tsx)
```

### Dark Mode Support

The app uses CSS custom properties with `prefers-color-scheme` media queries:

| Mode | Foreground | Background |
|------|-----------|------------|
| Light | `rgb(0, 0, 0)` | `rgb(214, 219, 220)` → `rgb(255, 255, 255)` gradient |
| Dark | `rgb(255, 255, 255)` | `rgb(0, 0, 0)` → `rgb(0, 0, 0)` solid |

---

## 6. Backend — Express.js (`apps/api`)

### Architecture

| Aspect | Detail |
|--------|--------|
| **Framework** | Express.js 5.2.1 |
| **Runtime** | Bun (hot-reload via `bun --watch`) |
| **Port** | `3000` |
| **Build** | `bun build` → `dist/server.js` (minified, Bun target) |
| **Validation** | Zod ^4.5.4 |
| **Auth** | JWT (jsonwebtoken ^9.0.3) + bcrypt ^6.0.0 |

### Entry Point (`src/index.ts`)

The API server is currently minimal — a single Express app with a health-check endpoint:

```typescript
// apps/api/src/index.ts
import express from "express";
import dotenv from "dotenv";

dotenv.config();
const app = express();

app.get('/', (req, res) => {
  res.json({ message: 'Hello World', ip: req.ip });
});

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
```

### Planned Middleware Stack

Based on installed dependencies, the API is structured for:

```
Request
  │
  ▼
┌─────────────────┐
│  cookie-parser   │  ← Parse JWT from HttpOnly cookies
├─────────────────┤
│  express.json()  │  ← Parse JSON request bodies
├─────────────────┤
│  Auth Middleware  │  ← Verify JWT, attach user to req
├─────────────────┤
│  Zod Validation  │  ← Validate request body/params/query
├─────────────────┤
│  Route Handler   │  ← Business logic + Prisma queries
├─────────────────┤
│  Error Handler   │  ← Centralized error responses
└─────────────────┘
  │
  ▼
Response
```

### Dependency on Shared Packages

```
apps/api
  ├── @repo/db                  → Database access (Prisma client + types)
  ├── @repo/eslint-config       → Linting rules
  └── @repo/typescript-config   → TypeScript settings
```

---

## 7. Database Layer (`packages/database`)

### Overview

The database package is the **single source of truth** for all data access in the monorepo.
Neither `apps/web` nor `apps/api` configures Prisma independently — they both import from
`@repo/db`.

### Prisma Architecture

```mermaid
graph LR
    A["schema.prisma"] -->|prisma generate| B["Generated Client"]
    C["prisma7.config.ts"] -->|configures| A
    B --> D["src/client.ts"]
    D -->|singleton pattern| E["Exported PrismaClient"]
    E --> F["apps/web"]
    E --> G["apps/api"]

    style A fill:#2563eb,color:#fff
    style E fill:#16a34a,color:#fff
```

### Schema Definition

```prisma
// packages/database/prisma/schema.prisma

generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
}
```

> **Note:** The schema currently contains only the generator and datasource blocks.
> Data models (User, Deal, Stage, etc.) will be added as features are implemented
> per the Implementation Plan.

### Singleton Client Pattern

```typescript
// packages/database/src/client.ts

import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

**Why this pattern matters:**
- In development, Next.js hot-reloads modules on every change
- Without the global cache, each reload creates a new `PrismaClient`, exhausting
  database connections
- The singleton attaches the client to `globalThis`, which survives hot reloads

### Prisma 7 Configuration

```typescript
// packages/database/prisma7.config.ts
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DATABASE_URL") },
});
```

### Public API (`src/index.ts`)

```typescript
export { prisma } from "./client";               // Singleton instance
export * from "../generated/prisma/client";       // All generated types
```

This means any consumer can do:
```typescript
import { prisma, User, Deal } from "@repo/db";
```

---

## 8. Shared Packages

### 8.1 `@repo/ui` — Component Library

A pre-built React component library consumed by `apps/web`.

| Component | File | Purpose |
|-----------|------|---------|
| `Card` | `src/card.tsx` | Clickable card with title, description, hover animation |
| `Gradient` | `src/gradient.tsx` | Decorative gradient background element |
| `TurborepoLogo` | `src/turborepo-logo.tsx` | SVG logo component |

**Build pipeline:**
```
src/styles.css → tailwindcss → dist/index.css    (styles)
src/*.tsx       → tsc         → dist/*.js          (components)
```

**Usage:** `ui:` prefix for Tailwind classes scopes styles to the UI package namespace.

---

### 8.2 `@repo/common` — Shared Utilities

Intended for cross-application shared code that doesn't belong to UI or database layers:
- TypeScript types and interfaces
- Constants and enums
- Utility functions
- Validation helpers

Currently a placeholder — will grow as features are implemented.

---

### 8.3 `@repo/tailwind-config` — Theme Configuration

Centralizes Tailwind CSS theming across the monorepo.

**Custom Theme Tokens:**

| Token | Value | Purpose |
|-------|-------|---------|
| `--color-blue-1000` | `#2a8af6` | Primary blue accent |
| `--color-purple-1000` | `#a853ba` | Secondary purple accent |
| `--color-red-1000` | `#e92a67` | Danger / attention red |

**Consumed by:** `apps/web/app/globals.css` via `@import "@repo/tailwind-config"`

---

### 8.4 `@repo/eslint-config` — Linting Rules

Provides three configuration presets:

| Preset | File | Used By |
|--------|------|---------|
| Base | `base.js` | All packages and apps |
| Next.js | `next.js` | `apps/web` |
| React Internal | `react-internal.js` | `packages/ui` |

**Base rules include:**
- ESLint recommended
- TypeScript ESLint recommended
- Prettier compatibility
- Turbo plugin (`turbo/no-undeclared-env-vars`)
- `eslint-plugin-only-warn` (converts errors to warnings during dev)

---

### 8.5 `@repo/typescript-config` — TypeScript Settings

Provides three `tsconfig` presets:

| Preset | File | Settings |
|--------|------|----------|
| Base | `base.json` | `ES2022`, `strict`, `NodeNext` modules, declarations enabled |
| Next.js | `nextjs.json` | Extends base + Next.js-specific JSX, plugins |
| React Library | `react-library.json` | Extends base + React JSX for packages |

---

## 9. Dependency Graph

```mermaid
graph TB
    subgraph Applications
        WEB["apps/web<br/>(Next.js)"]
        API["apps/api<br/>(Express.js)"]
    end

    subgraph "Shared Packages"
        DB["@repo/db<br/>(Prisma)"]
        UI["@repo/ui<br/>(Components)"]
        COMMON["@repo/common<br/>(Utilities)"]
        TW["@repo/tailwind-config"]
        ES["@repo/eslint-config"]
        TS["@repo/typescript-config"]
    end

    subgraph Infrastructure
        PG["PostgreSQL"]
    end

    WEB --> UI
    WEB --> DB
    WEB --> TW
    WEB --> ES
    WEB --> TS

    API --> DB
    API --> ES
    API --> TS

    UI --> TW
    UI --> ES
    UI --> TS

    COMMON --> TS

    DB --> PG

    style WEB fill:#0070f3,color:#fff
    style API fill:#68a063,color:#fff
    style DB fill:#5b21b6,color:#fff
    style PG fill:#336791,color:#fff
```

### Dependency Direction Rules

1. **Apps depend on packages** — never the reverse
2. **Packages can depend on other packages** — but no circular dependencies
3. **Only `@repo/db` touches the database** — apps import from it, never from Prisma directly
4. **Config packages have no runtime dependencies** — they export pure configuration

---

## 10. Data Flow Architecture

### Request Lifecycle (API Route)

```mermaid
sequenceDiagram
    participant Browser
    participant NextJS as Next.js (web)
    participant Express as Express (api)
    participant Prisma as Prisma Client
    participant PG as PostgreSQL

    Browser->>NextJS: User interaction
    NextJS->>Express: HTTP request (fetch/axios)
    Express->>Express: cookie-parser → auth middleware
    Express->>Express: Zod validation
    Express->>Prisma: prisma.model.method()
    Prisma->>PG: SQL query via @prisma/adapter-pg
    PG-->>Prisma: Result rows
    Prisma-->>Express: Typed objects
    Express-->>NextJS: JSON response
    NextJS-->>Browser: Rendered UI
```

### Server Component Data Flow (Direct DB Access)

```mermaid
sequenceDiagram
    participant Browser
    participant RSC as React Server Component
    participant Prisma as Prisma Client
    participant PG as PostgreSQL

    Browser->>RSC: Page request
    RSC->>Prisma: prisma.model.findMany()
    Prisma->>PG: SQL query
    PG-->>Prisma: Result rows
    Prisma-->>RSC: Typed objects
    RSC-->>Browser: Rendered HTML (streamed)
```

> **Two data paths exist by design:**
> - **API route** — for mutations, authenticated endpoints, and client-side data fetching
> - **Server Component** — for read-heavy pages where the frontend can query the DB directly

---

## 11. Authentication Architecture

Based on the installed dependencies (`bcrypt`, `jsonwebtoken`, `cookie-parser`), the
authentication system follows a **JWT-in-HttpOnly-cookie** pattern:

```mermaid
graph LR
    A["User submits<br/>credentials"] --> B["Express API"]
    B --> C["bcrypt.compare()<br/>verify password"]
    C -->|valid| D["jwt.sign()<br/>create token"]
    D --> E["Set HttpOnly cookie<br/>via cookie-parser"]
    E --> F["Subsequent requests<br/>carry cookie automatically"]
    F --> G["Auth middleware<br/>jwt.verify()"]
    G -->|valid| H["Route handler<br/>req.user available"]
    G -->|invalid| I["401 Unauthorized"]

    style D fill:#f59e0b,color:#000
    style E fill:#10b981,color:#fff
```

### Password Storage

| Step | Tool | Purpose |
|------|------|---------|
| Registration | `bcrypt.hash(password, saltRounds)` | Hash + salt the password |
| Login | `bcrypt.compare(input, stored)` | Constant-time comparison |

### Token Flow

| Step | Tool | Purpose |
|------|------|---------|
| Issue | `jwt.sign(payload, secret)` | Create signed token with user ID |
| Transport | HttpOnly cookie | Browser can't access via JS (XSS protection) |
| Verify | `jwt.verify(token, secret)` | Validate signature + expiry on each request |

---

## 12. Environment & Configuration

### Environment Variables

| Variable | Package | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `@repo/db` | PostgreSQL connection string |
| `NODE_ENV` | All | Controls singleton caching, optimizations |
| `JWT_SECRET` | `apps/api` | Secret key for signing/verifying JWTs |

### Connection String Format

```
postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE
```

**Default development values:**
```
postgresql://postgres:password@localhost:5432/postgres
```

### `.env` File Locations

Environment files are loaded at the package level via `dotenv`:
- `packages/database/.env` — `DATABASE_URL`
- `apps/api/.env` — `DATABASE_URL`, `JWT_SECRET`, etc.

> **Security:** `.env.local`, `.env.development.local`, `.env.test.local`, and
> `.env.production.local` are all gitignored. Never commit real credentials.

---

## 13. Development Workflow

### Starting Development

```bash
# 1. Start PostgreSQL
docker run --name my-postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -d postgres

# 2. Install dependencies (from repo root)
bun install

# 3. Generate Prisma client
bun run db:generate

# 4. Apply migrations
bun run db:migrate

# 5. Start all apps concurrently
bun run dev
```

### What `bun run dev` Does

Turborepo runs all `dev` scripts in parallel, with dependency ordering:

```
1. packages/database   → db:generate (Prisma client)
2. packages/ui         → tsc --watch + tailwindcss --watch
3. apps/web            → next dev (port 3001)
4. apps/api            → bun --watch src/index.ts (port 3000)
```

### Database Migration Workflow

```
Edit schema.prisma
       │
       ▼
bun run db:migrate          ← Creates + applies migration (development)
       │
       ▼
Migration SQL file generated in prisma/migrations/
       │
       ▼
Commit migration to Git
       │
       ▼
bun run db:deploy           ← Applies existing migrations (production)
```

### Build Pipeline

```
bun run build
       │
       ▼
Turborepo resolves dependency graph
       │
       ├── packages/database  → db:generate
       ├── packages/ui        → tsc + tailwindcss → dist/
       ├── packages/common    → tsc → dist/
       │
       ▼  (after dependencies)
       │
       ├── apps/web           → next build → .next/
       └── apps/api           → bun build → dist/server.js
```

---

## 14. Deployment Architecture

### Production Build Outputs

| App | Build Command | Output | Artifact |
|-----|-------------|--------|----------|
| `apps/web` | `next build` | `.next/` | Standalone Next.js server |
| `apps/api` | `bun build src/index.ts --outfile dist/server.js --target bun --minify` | `dist/server.js` | Single minified Bun binary |

### Suggested Deployment Topology

```
┌─────────────────────────────────────────────────────────────┐
│                     Reverse Proxy / CDN                      │
│              (Vercel / Nginx / Cloudflare)                   │
└──────────┬─────────────────────────────────┬────────────────┘
           │                                 │
    ┌──────▼──────┐                   ┌──────▼──────┐
    │  Next.js    │                   │  Express    │
    │  (SSR/SSG)  │                   │  (API)      │
    │  /          │                   │  /api/*     │
    └──────┬──────┘                   └──────┬──────┘
           │                                 │
           └────────────┬────────────────────┘
                        │
               ┌────────▼────────┐
               │   PostgreSQL    │
               │  (Managed DB)   │
               └─────────────────┘
```

| Component | Recommended Host | Notes |
|-----------|-----------------|-------|
| Next.js | Vercel / Node server | Zero-config on Vercel |
| Express API | Railway / Render / VPS | Single `dist/server.js` file |
| PostgreSQL | Supabase / Neon / RDS | Managed PostgreSQL with connection pooling |

---

## 15. Security Considerations

| Concern | Mitigation | Implementation |
|---------|-----------|----------------|
| **Password Storage** | bcrypt hashing with salt | `bcrypt.hash()` / `bcrypt.compare()` |
| **Token Security** | HttpOnly cookies (not localStorage) | `cookie-parser` + `Set-Cookie` header |
| **XSS Protection** | React auto-escapes output + HttpOnly cookies | Built-in to React + Express |
| **SQL Injection** | Prisma parameterized queries | Never raw SQL without `$queryRaw` |
| **Input Validation** | Zod schema validation on all API inputs | Middleware-level validation |
| **Secret Management** | Environment variables, never committed | `.env` files in `.gitignore` |
| **CSRF** | Cookie `SameSite` attribute | Set to `Strict` or `Lax` |
| **Environment Leakage** | Turbo ESLint rule | `turbo/no-undeclared-env-vars` |

---

> **This document is a living artifact.** As DealFlow360 grows — new models in the Prisma
> schema, new API routes, new pages in the frontend — this architecture document should be
> updated to reflect the current state of the system.
