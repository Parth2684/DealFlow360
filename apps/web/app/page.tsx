import { redirect } from "next/navigation";

import {
  hasInternalSessionCookie,
  hasPortalSessionCookie,
} from "../lib/auth/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [hasInternalSession, hasPortalSession] = await Promise.all([
    hasInternalSessionCookie(),
    hasPortalSessionCookie(),
  ]);

  if (hasInternalSession) redirect("/workspace");
  if (hasPortalSession) redirect("/portal");
  redirect("/login");
}
