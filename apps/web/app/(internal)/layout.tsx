import { ButtonLink } from "@repo/ui";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { StateScreen } from "../../components/foundation/state-screen";
import { InternalShell } from "../../components/shell/internal-shell";
import {
  getInternalSessionState,
  getSystemHealthState,
  hasInternalWorkspaceAccess,
} from "../../lib/auth/session";

export const dynamic = "force-dynamic";

export default async function InternalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [sessionState, health] = await Promise.all([
    getInternalSessionState(),
    getSystemHealthState(),
  ]);

  if (sessionState.status === "anonymous") redirect("/login");
  if (sessionState.status === "unavailable") {
    return (
      <StateScreen
        action={
          <ButtonLink href="/workspace" variant="secondary">
            Reload Workspace
          </ButtonLink>
        }
        description={sessionState.message}
        eyebrow="Session Check Unavailable"
        title="The Workspace Is Temporarily Unavailable"
        tone="danger"
      />
    );
  }
  if (!hasInternalWorkspaceAccess(sessionState.session)) redirect("/forbidden");

  return (
    <InternalShell health={health} session={sessionState.session}>
      {children}
    </InternalShell>
  );
}
