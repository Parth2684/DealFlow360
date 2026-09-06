import { Badge, ButtonLink, DealFlowBrand } from "@repo/ui";
import type { ReactNode } from "react";

import type { SystemHealthState } from "../../lib/auth/session";
import { PortalSignOut } from "./portal-sign-out";
import { SystemStatus } from "./system-status";
import { ThemeToggle } from "./theme-toggle";

export interface PortalShellProps {
  children: ReactNode;
  health: SystemHealthState;
}

export function PortalShell({ children, health }: PortalShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <a
        className="sr-only rounded-control bg-surface px-sm py-xs text-body-sm font-semibold text-foreground-strong focus:not-sr-only focus:fixed focus:left-md focus:top-md focus:z-30"
        href="#main-content"
      >
        Skip to Main Content
      </a>
      <header className="sticky top-0 z-20 border-b border-border bg-surface/85 px-page py-sm backdrop-blur-md print:hidden">
        <div className="mx-auto flex w-full max-w-app flex-wrap items-center justify-between gap-sm">
          <div className="flex min-w-0 items-center gap-sm">
            <DealFlowBrand />
            <Badge tone="brand">Customer Portal</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-xs">
            <ButtonLink href="/portal" variant="quiet">
              My Quotations
            </ButtonLink>
            <ButtonLink href="/portal/account" variant="quiet">
              Account Security
            </ButtonLink>
            <SystemStatus health={health} />
            <ThemeToggle />
            <PortalSignOut />
          </div>
        </div>
      </header>
      <main className="flex-1 px-page py-lg print:p-0" id="main-content">
        <div className="mx-auto w-full max-w-app animate-rise-in motion-reduce:animate-none">
          {children}
        </div>
      </main>
      <footer className="border-t border-border bg-surface px-page py-sm print:hidden">
        <p className="mx-auto m-0 w-full max-w-app text-caption text-foreground-muted">
          Review quotations and stay in touch with your sales team.
        </p>
      </footer>
    </div>
  );
}
