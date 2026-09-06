import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { PortalShell } from "../../../components/shell/portal-shell";
import {
  getSystemHealthState,
  getPortalSession,
} from "../../../lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ProtectedPortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [hasPortalSession, health] = await Promise.all([
    getPortalSession(),
    getSystemHealthState(),
  ]);

  if (!hasPortalSession) redirect("/portal/login");

  return <PortalShell health={health}>{children}</PortalShell>;
}
