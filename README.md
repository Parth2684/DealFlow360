# TurboRepo Starter — Express, Next.js, Prisma & Tailwind

A production-oriented **Turborepo monorepo starter** for building full-stack TypeScript applications with a Next.js frontend, Express.js backend, PostgreSQL database, Prisma ORM, shared UI components, and centralized tooling/configuration.

The repository is structured so that applications remain independent while common code, database access, UI components, and development configuration can be shared across the entire monorepo.

---

## ✨ Features

* **Turborepo monorepo** for managing multiple applications and packages
* **Next.js** application for the frontend
* **Express.js** application for backend APIs
* **PostgreSQL** database
* **Prisma ORM** for database access and migrations
* **`@prisma/adapter-pg`** for PostgreSQL connectivity
* **Shared database package** so applications don't need to configure Prisma independently
* **Shared UI package** containing reusable React components
* **Tailwind CSS** configuration shared across the monorepo
* **Shared TypeScript configuration**
* **Shared ESLint configuration**
* **Common package** for reusable application-level utilities/types
* **Bun** as the package manager and runtime
* **Environment variable support** with `.env` files
* **Turborepo task dependencies** for automatically generating Prisma clients before dependent tasks run
* **Turborepo caching** for faster builds and checks
* **PostgreSQL support through Docker**

---

# 📁 Project Structure

The repository follows the standard Turborepo `apps/` and `packages/` structure:

```text
turbo-starter/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   ├── package.json
│   │   └── ...
│   │
│   └── web/
│       ├── app/
│       ├── public/
│       ├── package.json
│       └── ...
│
├── packages/
│   ├── common/
│   │   ├── src/
│   │   └── package.json
│   │
│   ├── database/
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── src/
│   │   └── package.json
│   │
│   ├── eslint-config/
│   │   ├── package.json
│   │   └── ...
│   │
│   ├── tailwind-config/
│   │   ├── package.json
│   │   └── ...
│   │
│   ├── typescript-config/
│   │   ├── package.json
│   │   └── ...
│   │
│   └── ui/
│       ├── src/
│       ├── package.json
│       └── ...
│
├── package.json
├── turbo.json
├── bun.lock
└── README.md
```

The important distinction is:

* `apps/` contains applications that can be run independently.
* `packages/` contains reusable libraries, configurations, and infrastructure shared by those applications.

---

# 🏗️ Architecture

At a high level, the repository looks like this:

```text
                         ┌─────────────────────┐
                         │     Turborepo       │
                         │   Task Orchestrator │
                         └──────────┬──────────┘
                                    │
                 ┌──────────────────┴──────────────────┐
                 │                                     │
          ┌──────▼──────┐                       ┌──────▼──────┐
          │  apps/web   │                       │  apps/api   │
          │   Next.js   │                       │   Express   │
          └──────┬──────┘                       └──────┬──────┘
                 │                                     │
                 │                                     │
                 └──────────────┬──────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │ packages/database     │
                    │       Prisma          │
                    └───────────┬───────────┘
                                │
                       ┌────────▼────────┐
                       │   PostgreSQL    │
                       └─────────────────┘


Shared across applications:

    ┌─────────────────────────────────────────┐
    │                 packages/               │
    │                                         │
    │  ui             → React components      │
    │  common         → Shared utilities      │
    │  database       → Prisma + DB access    │
    │  eslint-config  → ESLint configuration  │
    │  tailwind-config→ Tailwind configuration│
    │  typescript-config → TS configuration   │
    └─────────────────────────────────────────┘
```

This keeps infrastructure and shared code out of individual applications.

For example, instead of configuring Prisma separately inside both the API and web applications, Prisma lives inside:

```text
packages/database
```

Applications can then import the shared database client.

---

# 🛠️ Tech Stack

| Technology                            | Purpose                                    |
| ------------------------------------- | ------------------------------------------ |
| [Turborepo](https://turbo.build/repo) | Monorepo management and task orchestration |
| [Next.js](https://nextjs.org/)        | Frontend application                       |
| [React](https://react.dev/)           | UI framework                               |
| [Express.js](https://expressjs.com/)  | Backend API                                |
| [Prisma](https://www.prisma.io/)      | Database ORM                               |
| PostgreSQL                            | Relational database                        |
| `@prisma/adapter-pg`                  | Prisma PostgreSQL adapter                  |
| TypeScript                            | Application language                       |
| Tailwind CSS                          | Styling                                    |
| ESLint                                | Code linting                               |
| Prettier                              | Code formatting                            |
| Bun                                   | Package manager/runtime                    |
| Docker                                | Local PostgreSQL environment               |

---

# 🚀 Getting Started

## Prerequisites

Make sure you have the following installed:

* Git
* Bun
* Docker

You can verify the installations:

```bash
git --version
bun --version
docker --version
```

You also need a PostgreSQL database.

The easiest way to run PostgreSQL locally is with Docker.

---

# 📦 Installation

Clone the repository:

```bash
git clone https://github.com/Parth2684/turbo-starter.git
```

Move into the project:

```bash
cd turbo-starter
```

Install all workspace dependencies:

```bash
bun install
```

Because this is a Turborepo, running `bun install` from the repository root installs dependencies for the entire workspace.

You do not need to separately install dependencies inside `apps/web`, `apps/api`, or individual packages.

---

# 🐘 PostgreSQL Setup

The database package uses PostgreSQL through Prisma.

The expected database connection string is:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/postgres
```

The connection string follows this structure:

```text
postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE
```

For the default development setup:

```text
Username: postgres
Password: password
Host:     localhost
Port:     5432
Database: postgres
```

## Start PostgreSQL with Docker

Run:

```bash
docker run --name my-postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -d postgres
```

This command:

* Creates a PostgreSQL container named `my-postgres`
* Sets the PostgreSQL password to `password`
* Exposes PostgreSQL on port `5432`
* Runs PostgreSQL in detached mode

Check that the container is running:

```bash
docker ps
```

You should see the `my-postgres` container.

---

## Stopping PostgreSQL

To stop the container:

```bash
docker stop my-postgres
```

Start it again later with:

```bash
docker start my-postgres
```

You do **not** need to recreate the container every time.

---

## Removing PostgreSQL

If you want to completely remove the container:

```bash
docker rm -f my-postgres
```

> Removing the container also removes the database data stored inside that container unless you configured a persistent Docker volume.

For serious development, consider using a Docker volume so database data survives container recreation.

---

# 🔐 Environment Variables

The database package expects:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/postgres
```

Create the appropriate `.env` file according to where the database package expects environment variables in the repository.

A typical setup is:

```text
DATABASE_URL=postgresql://postgres:password@localhost:5432/postgres
```

### Important

Do not commit real production credentials to Git.

Add your environment files to `.gitignore`:

```gitignore
.env
.env.local
.env.production
```

For production deployments, use the environment-variable system provided by your hosting platform.

---

# 🧬 Prisma

Prisma is located in:

```text
packages/database
```

The Prisma schema is:

```text
packages/database/prisma/schema.prisma
```

This package acts as the central database layer for the monorepo.

Instead of having:

```text
apps/web/prisma
apps/api/prisma
```

the repository has a single:

```text
packages/database/prisma
```

This means database models, migrations, and Prisma configuration are centralized.

---

# 🔄 Prisma Client Generation

After installing dependencies or changing the Prisma schema, generate the Prisma client:

```bash
bun run db:generate
```

This invokes the Turborepo `db:generate` task.

You can also run the task directly from the database package if needed:

```bash
bun --filter database db:generate
```

The generated Prisma client is required by applications that use the database package.

This is why the Turborepo configuration makes other tasks depend on `db:generate`.

---

# 🗃️ Creating Database Migrations

After changing:

```text
packages/database/prisma/schema.prisma
```

create a development migration:

```bash
bun run db:migrate
```

Prisma will compare your schema with the current database state and create a migration.

A migration represents a versioned change to the database schema.

For example:

```text
packages/database/
└── prisma/
    ├── schema.prisma
    └── migrations/
        ├── 202609040001_initial/
        │   └── migration.sql
        └── ...
```

Commit migrations to Git.

They are part of your application's source code and allow other developers and environments to reproduce the database schema.

---

# 🚢 Applying Migrations

For environments where migrations already exist, use:

```bash
bun run db:deploy
```

`db:deploy` applies existing migrations without creating new ones.

A common distinction is:

```text
db:migrate
    ↓
Create + apply development migration

db:deploy
    ↓
Apply existing migrations
```

Use `db:migrate` while actively developing the schema.

Use `db:deploy` when deploying an application using migrations that have already been created and committed.

---

# 🖥️ Next.js Application

The frontend lives in:

```text
apps/web
```

It is a Next.js application.

The application can consume shared packages such as:

```text
@repo/ui
@repo/common
@repo/database
```

depending on what the application requires.

The UI package is especially useful for keeping reusable React components outside the application itself.

---

# 🎨 UI Package

Reusable UI components live inside:

```text
packages/ui
```

For example:

```text
packages/ui/
└── src/
    ├── card.tsx
    ├── gradient.tsx
    ├── turborepo-logo.tsx
    └── ...
```

These components can then be imported into the Next.js application.

Example:

```tsx
import { Card } from "@repo/ui";
```

This allows multiple applications to consume the same UI primitives.

Instead of duplicating a component:

```text
apps/web/components/Card.tsx
apps/admin/components/Card.tsx
apps/dashboard/components/Card.tsx
```

you can maintain one implementation:

```text
packages/ui/src/card.tsx
```

and share it across applications.

---

# 🎨 Tailwind CSS

Tailwind configuration is centralized in:

```text
packages/tailwind-config
```

This allows applications and packages to share the same styling conventions.

Instead of maintaining separate Tailwind configurations for every application, the monorepo can consume the shared configuration.

This becomes particularly useful as the repository grows and more applications are added.

For example:

```text
apps/
├── web/
├── admin/
└── dashboard/
```

can all use the same Tailwind configuration.

---

# 🧹 ESLint Configuration

Shared ESLint configuration lives in:

```text
packages/eslint-config
```

Applications can extend the shared configuration instead of maintaining independent linting rules.

This gives the repository a single source of truth for code-quality rules.

For example:

```text
packages/eslint-config
        │
        ├──────────► apps/web
        │
        ├──────────► apps/api
        │
        └──────────► packages/*
```

When common linting rules change, they can be updated centrally.

---

# 🔷 TypeScript Configuration

Shared TypeScript configurations live in:

```text
packages/typescript-config
```

This package contains reusable `tsconfig` configurations.

Applications and packages can extend these configurations rather than duplicating compiler settings.

This keeps things such as:

* compiler options
* module configuration
* strictness
* target settings
* declaration settings

consistent throughout the repository.

---

# 📦 Common Package

The:

```text
packages/common
```

package is intended for code that is shared across applications but does not belong specifically to the UI or database layer.

Typical examples include:

* Shared TypeScript types
* Constants
* Utility functions
* Validation helpers
* Shared application-level logic

For example:

```text
packages/common/
└── src/
    ├── constants.ts
    ├── types.ts
    └── utils.ts
```

Applications can import these utilities rather than duplicating them.

---

# ⚡ Turborepo

Turborepo is responsible for orchestrating tasks across the monorepo.

The configuration is stored in:

```text
turbo.json
```

The current configuration is:

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build", "^db:generate"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**", "!.next/dev/**"]
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "check-types": {
      "dependsOn": ["^build", "^check-types"]
    },
    "dev": {
      "dependsOn": ["^db:generate"],
      "cache": false,
      "persistent": true
    },
    "db:generate": {
      "cache": false
    },
    "db:migrate": {
      "cache": false
    },
    "db:deploy": {
      "cache": false
    }
  }
}
```

---

# 🧠 Understanding `dependsOn`

One of the most important parts of this configuration is:

```json
"dependsOn": ["^build", "^db:generate"]
```

The `^` means Turborepo should execute the task in dependencies before executing it for the current package.

For example, if:

```text
apps/web
   ↓
@repo/ui
   ↓
some shared dependency
```

the build order can be determined automatically.

The database dependency is also important.

Before an application that depends on Prisma is built, Turborepo can make sure that:

```text
db:generate
```

has run.

---

# 🧬 Why `db:generate` Is a Dependency

Prisma generates code from:

```text
schema.prisma
```

If the Prisma schema changes, the generated Prisma client may need to change as well.

Therefore:

```text
schema.prisma
       ↓
db:generate
       ↓
generated Prisma Client
       ↓
application build
```

The Turborepo configuration reflects this dependency.

The same principle applies to development:

```json
"dev": {
  "dependsOn": ["^db:generate"],
  "cache": false,
  "persistent": true
}
```

This helps ensure the Prisma client exists before applications start.

---

# 🚫 Why Database Tasks Are Not Cached

Database operations are configured with:

```json
"cache": false
```

for:

```text
db:generate
db:migrate
db:deploy
```

This is intentional.

Database commands have side effects and should not be treated like ordinary deterministic build artifacts.

For example:

```bash
bun run db:migrate
```

should actually interact with the database rather than returning a cached result from a previous execution.

---

# 🔨 Build Configuration

The build task contains:

```json
"inputs": ["$TURBO_DEFAULT$", ".env*"]
```

This means Turborepo considers environment files when determining whether a build can use an existing cache entry.

The build outputs are:

```json
"outputs": [
  "dist/**",
  ".next/**",
  "!.next/cache/**",
  "!.next/dev/**"
]
```

This tells Turborepo which generated files should be considered build outputs.

The Next.js cache directories are excluded:

```text
!.next/cache/**
!.next/dev/**
```

because they are not intended to be treated as reproducible build outputs.

---

# 🔥 Development

Once PostgreSQL is running and the environment variables are configured, start the entire monorepo with:

```bash
bun run dev
```

Turborepo will start the development tasks for the relevant workspaces.

Typically:

```text
Next.js
    ↓
apps/web

Express
    ↓
apps/api
```

The API listens on port `3000`.

The Next.js application typically runs on port `3001` when `3000` is already occupied by the API.

The exact port is determined by the configuration of each application.

---

# 🏃 Running Individual Applications

You don't always need to run the entire monorepo.

To run only the web application:

```bash
bun --filter web dev
```

To run only the API:

```bash
bun --filter api dev
```

This is useful when working on a specific part of the system.

---

# 🌐 Express API

The Express application lives in:

```text
apps/api
```

It provides the backend HTTP API.

The starter currently includes a basic endpoint:

```http
GET /
```

which returns a response containing a greeting and the client's IP address.

The API is intended to serve as the starting point for adding:

* REST endpoints
* Authentication
* Middleware
* Request validation
* Database operations
* Business logic
* External service integrations

As the application grows, keep business logic separate from route definitions rather than putting everything inside Express handlers.

---

# 🗄️ Using the Database from the API

The database package is designed to be imported by applications that need database access.

Conceptually:

```text
apps/api
    │
    │ imports
    ▼
packages/database
    │
    │ Prisma
    ▼
PostgreSQL
```

This means the Express application does not need to create its own Prisma setup.

The database connection and Prisma configuration remain centralized.

This also makes it easier to add another application later:

```text
apps/
├── api
├── web
└── worker
```

All three can use:

```text
packages/database
```

without duplicating database configuration.

---

# 🧪 Type Checking

Run TypeScript checks across the repository:

```bash
bun run check-types
```

The Turborepo configuration ensures dependencies are handled appropriately before type checking.

This is useful for catching:

* Invalid imports
* Incorrect types
* Missing properties
* Invalid function arguments
* Broken package boundaries
* Type errors introduced by shared packages

Run this before committing significant changes.

---

# 🧹 Linting

Run ESLint across the repository:

```bash
bun run lint
```

Turborepo executes the lint task across the workspaces and respects package dependencies.

Because ESLint configuration is shared through:

```text
packages/eslint-config
```

linting rules remain consistent across applications and packages.

---

# 🏗️ Building

Build all applications and packages:

```bash
bun run build
```

The build process uses Turborepo to determine the correct dependency order.

A simplified execution flow looks like:

```text
db:generate
      ↓
shared packages
      ↓
applications
      ↓
build artifacts
```

Turborepo can cache successful builds, allowing subsequent builds to skip work when inputs have not changed.

---

# 🧰 Useful Commands

## Install dependencies

```bash
bun install
```

## Start development

```bash
bun run dev
```

## Build everything

```bash
bun run build
```

## Lint everything

```bash
bun run lint
```

## Type-check everything

```bash
bun run check-types
```

## Generate Prisma Client

```bash
bun run db:generate
```

## Create and apply a Prisma migration

```bash
bun run db:migrate
```

## Deploy existing migrations

```bash
bun run db:deploy
```

---

# 🔄 Recommended Development Workflow

When starting development on a fresh clone:

### 1. Clone the repository

```bash
git clone https://github.com/Parth2684/turbo-starter.git
cd turbo-starter
```

### 2. Install dependencies

```bash
bun install
```

### 3. Start PostgreSQL

```bash
docker run --name my-postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -d postgres
```

### 4. Configure the database URL

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/postgres
```

### 5. Generate Prisma Client

```bash
bun run db:generate
```

### 6. Run migrations

If the project already contains migrations:

```bash
bun run db:deploy
```

For active schema development:

```bash
bun run db:migrate
```

### 7. Start the monorepo

```bash
bun run dev
```

At this point both the frontend and backend can be developed together.

---

# 🧑‍💻 Adding a New Package

When the repository grows, shared functionality should generally be extracted into `packages/`.

For example, to add a validation package:

```text
packages/
└── validation/
    ├── src/
    ├── package.json
    └── tsconfig.json
```

Applications can then depend on the package through the workspace.

The same approach can be used for:

```text
packages/
├── auth/
├── validation/
├── logger/
├── config/
├── database/
└── ui/
```

The goal is to keep reusable functionality outside individual applications.

---

# ➕ Adding a New Application

Applications belong in:

```text
apps/
```

For example:

```text
apps/
├── web/
├── api/
├── admin/
└── worker/
```

Each application should have its own `package.json` and application-specific configuration.

Shared functionality should remain in `packages/`.

For example:

```text
apps/admin
      │
      ├── @repo/ui
      ├── @repo/common
      └── @repo/database
```

This allows the new application to reuse the existing infrastructure without copying code.

---

# 📐 Monorepo Guidelines

A useful rule for deciding where code belongs is:

### Put it in `apps/` if:

The code represents a runnable application.

Examples:

```text
Next.js application
Express API
Background worker
Admin dashboard
```

### Put it in `packages/` if:

The code is reusable by multiple applications.

Examples:

```text
UI components
Database client
TypeScript configuration
ESLint configuration
Tailwind configuration
Shared types
Utilities
Validation
Authentication
```

This separation prevents applications from becoming tightly coupled and keeps shared functionality reusable.

---

# 🔐 Production Considerations

This repository is intended as a starter and provides a development-friendly PostgreSQL configuration.

Before deploying to production:

* Use a managed PostgreSQL database or production-grade database infrastructure.
* Use a strong database password.
* Never commit `.env` files containing secrets.
* Configure production environment variables through your deployment platform.
* Run existing Prisma migrations with:

```bash
bun run db:deploy
```

* Do not use development migration commands as part of your production deployment process.
* Configure CORS appropriately for the API.
* Add authentication and authorization where required.
* Add request validation.
* Add proper logging and error handling.
* Configure HTTPS at the deployment/infrastructure layer.
* Review Prisma connection pooling and database limits for your hosting environment.

---

# 🧩 Why This Structure?

The main goal of this starter is to provide a clean foundation without forcing every application to reinvent its infrastructure.

Instead of:

```text
web/
    prisma/
    ui/
    eslint/
    tailwind/

api/
    prisma/
    ui/
    eslint/
    tailwind/
```

the monorepo centralizes shared functionality:

```text
apps/
├── web
└── api

packages/
├── database
├── ui
├── common
├── eslint-config
├── tailwind-config
└── typescript-config
```

This makes the repository easier to maintain as the number of applications increases.

---

# 🚦 Quick Start

If you already have Docker and Bun installed, the shortest path to running the project is:

```bash
git clone https://github.com/Parth2684/turbo-starter.git
cd turbo-starter

bun install

docker run --name my-postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -d postgres
```

Set:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/postgres
```

Then:

```bash
bun run db:generate
bun run db:deploy
bun run dev
```

For a new development database where you need to create migrations from schema changes:

```bash
bun run db:migrate
```

---

# 📄 License

Add your preferred license here.

For example:

```text
MIT License
```

---

## 💡 Summary

This starter gives you a full-stack TypeScript monorepo with:

```text
                    TurboRepo
                       │
          ┌────────────┴────────────┐
          │                         │
       Next.js                  Express.js
          │                         │
          └────────────┬────────────┘
                       │
                Shared Packages
                       │
       ┌───────────────┼────────────────┐
       │               │                │
      UI            Common          Database
       │                                │
    Tailwind                         Prisma
                                        │
                                   PostgreSQL
```

The result is a scalable starting point for building full-stack applications while keeping frontend, backend, database access, UI, and configuration cleanly separated.
