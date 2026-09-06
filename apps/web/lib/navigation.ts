import type { Capability } from "@repo/common";

export interface NavigationItem {
  activePathPrefixes?: readonly string[];
  available: boolean;
  capability?: Capability;
  href: string;
  label: string;
}

export interface NavigationGroup {
  items: readonly NavigationItem[];
  label: string;
}

export const INTERNAL_NAVIGATION: readonly NavigationGroup[] = [
  {
    label: "Work",
    items: [
      { available: true, href: "/workspace", label: "Workspace" },
      {
        available: true,
        capability: "customer.read",
        href: "/customers",
        label: "Customers",
      },
      {
        available: true,
        capability: "billing.read",
        href: "/orders",
        label: "Orders",
      },
      {
        available: true,
        capability: "billing.read",
        href: "/invoices",
        label: "Invoices",
      },
      {
        available: true,
        capability: "subscription.read",
        href: "/subscriptions",
        label: "Subscriptions",
      },
      {
        available: true,
        capability: "inventory.read",
        href: "/inventory",
        label: "Inventory",
      },
      {
        available: true,
        capability: "quotation.read",
        href: "/quotations",
        label: "Quotations",
      },
      {
        available: true,
        capability: "quotation.read",
        href: "/pipeline",
        label: "Pipeline",
      },
      {
        available: true,
        capability: "approval.read",
        href: "/approvals",
        label: "Approvals",
      },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        available: true,
        capability: "dealHealth.read",
        href: "/deal-health",
        label: "Deal Health",
      },
      {
        available: true,
        capability: "reporting.read",
        href: "/reports",
        label: "Reports",
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        available: true,
        capability: "configuration.manage",
        href: "/settings/customer-requests",
        label: "Customer Requests",
      },
      {
        available: true,
        capability: "configuration.manage",
        href: "/settings/team",
        label: "Team Members",
      },
      {
        activePathPrefixes: ["/settings"],
        available: true,
        capability: "configuration.manage",
        href: "/settings/products",
        label: "Configuration",
      },
    ],
  },
] as const;

export function navigationForCapabilities(
  capabilities: readonly Capability[],
): readonly NavigationGroup[] {
  const granted = new Set(capabilities);
  return INTERNAL_NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => item.capability === undefined || granted.has(item.capability),
    ),
  })).filter((group) => group.items.length > 0);
}

export function isNavigationItemActive(
  item: NavigationItem,
  pathname: string,
): boolean {
  if (pathname === item.href) return true;
  if (item.href !== "/workspace" && pathname.startsWith(`${item.href}/`)) {
    return true;
  }
  return (item.activePathPrefixes ?? []).some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
