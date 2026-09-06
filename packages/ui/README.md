# @repo/ui

Accessible, presentational React components for DealFlow360. This package owns no
business rules, permissions, API calls, or server state.

## Usage

Import the generated stylesheet once in the consuming application layout:

```tsx
import "@repo/ui/styles.css";
```

Components are available from the package root or focused subpaths:

```tsx
import { Badge, Button, DataTable } from "@repo/ui";
import { Field, FieldLabel, Input } from "@repo/ui/field";
```

All component utilities use the `ui:` prefix and resolve through semantic tokens
owned by `@repo/tailwind-config`. Consumers can follow the system color preference
or set `data-theme="light"` or `data-theme="dark"` on the document root.

## Commands

Run from the monorepo root:

```bash
bun install --frozen-lockfile
bun run --cwd packages/ui lint
bun run --cwd packages/ui check-types
bun run --cwd packages/ui build
```

`build` removes stale generated output, compiles the prefixed Tailwind stylesheet,
and emits JavaScript plus type declarations into `dist`.

## Component policy

- Keep components domain-neutral and controlled where interaction is required.
- Use native HTML semantics before adding ARIA roles.
- Use Phosphor for interface icons. Do not mix icon families.
- Use semantic color, spacing, radius, and typography utilities only.
- Keep motion limited to direct interaction feedback and loading state.
