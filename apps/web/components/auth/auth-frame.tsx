import { Badge, DealFlowBrand } from "@repo/ui";
import type { ReactNode } from "react";

import type { SystemHealthState } from "../../lib/auth/session";
import { ThemeToggle } from "../shell/theme-toggle";


const healthLabels: Record<SystemHealthState["status"], string> = {
  degraded: "API Degraded",
  offline: "API Offline",
  ok: "API Available",
};

export interface AuthFrameProps {
  children: ReactNode;
  description: string;
  health: SystemHealthState;
  title: string;
}

export function AuthFrame({
  children,
  description,
  health,
  title,
}: AuthFrameProps) {
  const healthTone =
    health.status === "ok"
      ? "success"
      : health.status === "degraded"
        ? "warning"
        : "danger";

  return (
    <div className="grid min-h-dvh bg-canvas lg:grid-cols-[1.05fr_1fr]">
      <a
        className="sr-only rounded-control bg-surface px-sm py-xs text-body-sm font-semibold text-foreground-strong focus:not-sr-only focus:fixed focus:left-md focus:top-md focus:z-20"
        href="#main-content"
      >
        Skip to Main Content
      </a>

      <aside className="relative hidden overflow-hidden bg-sidebar px-page py-2xl text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
        {/* A soft brand wash keeps the panel from reading as a flat block. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -top-40 size-[32rem] rounded-pill bg-brand/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-48 -left-32 size-[28rem] rounded-pill bg-brand/10 blur-3xl"
        />

        <DealFlowBrand className="relative [&>span:last-child]:text-sidebar-foreground" img_src="/logo.png" />
        <div className="relative grid max-w-[36rem] gap-md">
          <p className="m-0 text-caption font-semibold uppercase tracking-wide text-sidebar-foreground-muted">
            Governed quote-to-cash operations
          </p>
          <p className="m-0 text-balance text-display font-semibold text-sidebar-foreground">
            Price, approve, fulfill, and bill from one accountable workspace.
          </p>
          <p className="m-0 max-w-reading text-pretty text-body text-sidebar-foreground-muted">
            DealFlow360 keeps commercial decisions, inventory commitments, and
            customer changes tied to the same record.
          </p>
        </div>
        <Badge className="relative w-fit" tone={healthTone}>
          {healthLabels[health.status]}
        </Badge>
      </aside>

      <main
        className="flex min-w-0 flex-col px-page pb-2xl pt-lg lg:justify-center lg:py-2xl"
        id="main-content"
      >
        <div className="mx-auto grid w-full max-w-[28rem] gap-lg">
          <div className="flex items-center justify-between gap-sm lg:hidden">
            <DealFlowBrand img_src="/logo.png" />
            <Badge tone={healthTone}>{healthLabels[health.status]}</Badge>
          </div>
          <div className="flex items-start justify-between gap-md">
            <header className="grid gap-xs">
              <h1 className="m-0 scroll-mt-24 text-balance text-heading font-semibold text-foreground-strong">
                {title}
              </h1>
              <p className="m-0 text-pretty text-body-sm text-foreground-muted">
                {description}
              </p>
            </header>
            <ThemeToggle />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
