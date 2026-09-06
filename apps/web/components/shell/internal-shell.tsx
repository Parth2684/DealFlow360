"use client";

import type { CurrentUserResponse } from "@repo/common";
import { Button, Drawer } from "@repo/ui";
import { useState, type ReactNode } from "react";

import { OrganizationFormattingProvider } from "../foundation/organization-formatting";
import type { SystemHealthState } from "../../lib/auth/session";
import { GlobalSearch } from "./global-search";
import { InternalNavigation } from "./internal-navigation";
import { NotificationCenter } from "./notification-center";
import { SystemStatus } from "./system-status";
import { ThemeToggle } from "./theme-toggle";
import { UserControl } from "./user-control";

export interface InternalShellProps {
  children: ReactNode;
  health: SystemHealthState;
  session: CurrentUserResponse;
}

export function InternalShell({
  children,
  health,
  session,
}: InternalShellProps) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const { capabilities } = session.user;
  const cacheScope = `${session.organization.id}:${session.user.id}`;
  const canSearch = capabilities.some((capability) =>
    ["quotation.read", "customer.read", "fulfillment.read"].includes(
      capability,
    ),
  );
  const canReadNotifications = capabilities.includes("quotation.read");

  return (
    <OrganizationFormattingProvider
      formatting={{
        locale: session.organization.locale,
        timezone: session.organization.timezone,
      }}
    >
      <div className="min-h-dvh bg-canvas lg:flex">
        <a
          className="sr-only rounded-control bg-surface px-sm py-xs text-body-sm font-semibold text-foreground-strong focus:not-sr-only focus:fixed focus:left-md focus:top-md focus:z-30"
          href="#main-content"
        >
          Skip to Main Content
        </a>

        <aside className="hidden h-dvh w-64 shrink-0 lg:sticky lg:top-0 lg:block">
          <InternalNavigation capabilities={session.user.capabilities} />
        </aside>

        <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
          {/* Below sm the search drops to its own full-width row so the
              control cluster stays on a single compact line. */}
          <header className="sticky top-0 z-20 flex flex-wrap items-center gap-xs border-b border-border bg-surface/85 px-page py-xs backdrop-blur-md">
            <Button
              aria-expanded={navigationOpen}
              className="lg:hidden"
              onClick={() => setNavigationOpen(true)}
              size="compact"
              variant="secondary"
            >
              Menu
            </Button>

            {canSearch ? (
              <div className="order-last flex w-full min-w-0 items-center sm:order-none sm:w-auto sm:flex-1">
                <GlobalSearch
                  cacheScope={cacheScope}
                  capabilities={capabilities}
                />
              </div>
            ) : (
              <p className="m-0 min-w-0 flex-1 truncate text-body-sm font-semibold text-foreground-muted">
                Governed Workspace
              </p>
            )}

            <div className="ml-auto flex min-w-0 items-center gap-xs">
              <div className="hidden min-w-0 sm:flex">
                <SystemStatus
                  formatting={{
                    locale: session.organization.locale,
                    timezone: session.organization.timezone,
                  }}
                  health={health}
                />
              </div>
              {canReadNotifications ? (
                <NotificationCenter cacheScope={cacheScope} />
              ) : null}
              <ThemeToggle />
              <UserControl session={session} />
            </div>
          </header>

          <main className="min-w-0 flex-1 px-page py-lg" id="main-content">
            <div className="mx-auto w-full max-w-app animate-rise-in motion-reduce:animate-none">
              {children}
            </div>
          </main>
        </div>

        <Drawer
          closeLabel="Close Navigation"
          description="Open an available DealFlow360 workspace."
          onOpenChange={setNavigationOpen}
          open={navigationOpen}
          side="left"
          title="Workspace Navigation"
        >
          <div className="-m-sm h-full">
            <InternalNavigation
              capabilities={session.user.capabilities}
              onNavigate={() => setNavigationOpen(false)}
              showBrand={false}
            />
          </div>
        </Drawer>
      </div>
    </OrganizationFormattingProvider>
  );
}
