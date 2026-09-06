import type { Capability } from "@repo/common";
import { redirect } from "next/navigation";
import { getInternalSessionState } from "../../lib/auth/session";

export async function requireAccess(...capabilities: Capability[]) {
  const state = await getInternalSessionState();
  if (state.status === "anonymous") redirect("/login");
  if (state.status === "unavailable") throw new Error(state.message);
  if (
    !capabilities.some((capability) =>
      state.session.user.capabilities.includes(capability),
    )
  )
    redirect("/forbidden");
  return state.session;
}
