"use client";

import type { Capability } from "@repo/common";
import { Badge, DealFlowBrand } from "@repo/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  isNavigationItemActive,
  navigationForCapabilities,
} from "../../lib/navigation";

export interface InternalNavigationProps {
  capabilities: readonly Capability[];
  onNavigate?: () => void;
  showBrand?: boolean;
}

export function InternalNavigation({
  capabilities,
  onNavigate,
  showBrand = true,
}: InternalNavigationProps) {
  const pathname = usePathname();
  const groups = navigationForCapabilities(capabilities);

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      {showBrand ? (
        <div className="border-b border-sidebar-border px-md py-sm">
          <DealFlowBrand className="[&>span:last-child]:text-sidebar-foreground" />
        </div>
      ) : null}
      <nav
        aria-label="Primary workspace navigation"
        className="min-h-0 flex-1 overflow-y-auto px-sm py-md"
      >
        <div className="grid gap-lg">
          {groups.map((group) => (
            <section className="grid gap-xxs" key={group.label}>
              <h2 className="m-0 px-xs pb-xxs text-caption font-semibold uppercase tracking-wide text-sidebar-foreground-muted">
                {group.label}
              </h2>
              <ul className="m-0 grid list-none gap-xxs p-0">
                {group.items.map((item) => {
                  const active = isNavigationItemActive(item, pathname);

                  return (
                    <li key={item.href}>
                      {item.available ? (
                        <Link
                          aria-current={active ? "page" : undefined}
                          className={
                            active
                              ? "relative flex min-h-touch items-center rounded-control bg-brand px-sm py-xs text-body-sm font-semibold text-on-brand shadow-sm transition-colors duration-150 ease-product before:absolute before:inset-y-xs before:-left-sm before:w-xxs before:rounded-pill before:bg-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                              : "flex min-h-touch items-center rounded-control px-sm py-xs text-body-sm font-medium text-sidebar-foreground-muted transition-colors duration-150 ease-product hover:bg-sidebar-raised hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                          }
                          href={item.href}
                          onClick={onNavigate}
                        >
                          <span className="min-w-0 truncate">{item.label}</span>
                        </Link>
                      ) : (
                        <span
                          aria-disabled="true"
                          className="flex min-h-touch items-center justify-between gap-xs rounded-control px-sm py-xs text-body-sm text-sidebar-foreground-muted opacity-70"
                        >
                          <span className="min-w-0 truncate">{item.label}</span>
                          <Badge className="shrink-0" tone="neutral">
                            Soon
                          </Badge>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </nav>
    </div>
  );
}
