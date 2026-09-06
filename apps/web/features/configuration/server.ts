import {
  createCursorPageSchema,
  type CurrentUserResponse,
  type CursorPage,
} from "@repo/common";
import { redirect } from "next/navigation";
import type { z } from "zod";

import { serverApiRequest } from "../../lib/api/server";
import { getInternalSessionState } from "../../lib/auth/session";

export function firstSearchValue(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate?.trim().slice(0, 200) ?? "";
}

export async function requireConfigurationAccess(
  nextPath: string,
): Promise<CurrentUserResponse> {
  const sessionState = await getInternalSessionState();
  if (sessionState.status === "anonymous") {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  if (sessionState.status === "unavailable") {
    throw new Error(sessionState.message);
  }
  if (
    !sessionState.session.user.capabilities.includes("configuration.manage") &&
    !(
      nextPath === "/settings/customers" &&
      sessionState.session.user.capabilities.includes("customer.manage")
    )
  ) {
    redirect("/forbidden");
  }
  return sessionState.session;
}

/**
 * Configuration list endpoints are cursor based but do not accept a search
 * query. Load the tenant-scoped collection so the settings table can search
 * the whole data set instead of only the first page.
 */
export async function loadConfigurationItems<T>(
  path: string,
  itemSchema: z.ZodType<T>,
): Promise<T[]> {
  const pageSchema = createCursorPageSchema(itemSchema);
  const items: T[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;

  do {
    const parameters = new URLSearchParams({ limit: "100" });
    if (cursor) parameters.set("cursor", cursor);
    const page: CursorPage<T> = await serverApiRequest(
      `${path}?${parameters.toString()}`,
      pageSchema,
    );
    items.push(...page.items);

    const nextCursor = page.pageInfo.nextCursor ?? undefined;
    if (nextCursor && seenCursors.has(nextCursor)) {
      throw new Error("The configuration API returned a repeated cursor.");
    }
    if (nextCursor) seenCursors.add(nextCursor);
    cursor = page.pageInfo.hasNextPage ? nextCursor : undefined;
  } while (cursor);

  return items;
}
