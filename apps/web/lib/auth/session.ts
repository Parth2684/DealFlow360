import {
  CurrentUserResponseSchema,
  HealthResponseSchema,
  PORTAL_SESSION_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  apiRoutes,
  planApiRoutes,
  PortalSessionResponseSchema,
  type CurrentUserResponse,
} from "@repo/common";
import { cookies } from "next/headers";
import { cache } from "react";

import {
  ServerApiError,
  serverApiFetch,
  serverApiRequest,
} from "../api/server";

export type InternalSessionState =
  | { status: "authenticated"; session: CurrentUserResponse }
  | { status: "anonymous" }
  | { status: "unavailable"; message: string };

export interface SystemHealthState {
  checkedAt: string;
  status: "ok" | "degraded" | "offline";
}

export const getInternalSessionState = cache(
  async (): Promise<InternalSessionState> => {
    try {
      const session = await serverApiRequest(
        apiRoutes.auth.me,
        CurrentUserResponseSchema,
      );
      return { status: "authenticated", session };
    } catch (error) {
      if (error instanceof ServerApiError && error.problem.status === 401) {
        return { status: "anonymous" };
      }

      return {
        status: "unavailable",
        message:
          "The API is unavailable, so DealFlow360 cannot verify this session. Check the API service and reload.",
      };
    }
  },
);

export const getSystemHealthState = cache(
  async (): Promise<SystemHealthState> => {
    const checkedAt = new Date().toISOString();

    try {
      const response = await serverApiFetch(apiRoutes.health);
      const body: unknown = await response.json();
      const health = HealthResponseSchema.safeParse(body);

      if (!health.success) return { checkedAt, status: "offline" };
      return { checkedAt, status: health.data.status };
    } catch {
      return { checkedAt, status: "offline" };
    }
  },
);

export async function hasInternalSessionCookie(): Promise<boolean> {
  return (await cookies()).has(SESSION_COOKIE_NAME);
}

export async function hasPortalSessionCookie(): Promise<boolean> {
  return (await cookies()).has(PORTAL_SESSION_COOKIE_NAME);
}

export const getPortalSession = cache(async () => {
  try {
    return await serverApiRequest(
      planApiRoutes.portal.session,
      PortalSessionResponseSchema,
    );
  } catch (error) {
    if (error instanceof ServerApiError && error.problem.status === 401)
      return null;
    throw error;
  }
});

export function hasInternalWorkspaceAccess(
  session: CurrentUserResponse,
): boolean {
  return session.user.capabilities.some(
    (capability) => !capability.startsWith("portal."),
  );
}
