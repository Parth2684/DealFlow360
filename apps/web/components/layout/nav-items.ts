import type { LucideIcon } from "lucide-react";
import {
  FileText,
  KanbanSquare,
  ClipboardCheck,
  Boxes,
  Truck,
  RefreshCw,
  Receipt,
  HeartPulse,
  BarChart3,
  Settings,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/quotations", label: "Quotations", icon: FileText },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/approvals", label: "Approvals", icon: ClipboardCheck },
  { href: "/orders", label: "Orders", icon: Boxes },
  { href: "/fulfillment", label: "Fulfillment", icon: Truck },
  { href: "/subscriptions", label: "Subscriptions", icon: RefreshCw },
  { href: "/billing", label: "Billing", icon: Receipt },
  { href: "/deal-health", label: "Deal Health", icon: HeartPulse },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];
