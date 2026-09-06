import type { Request, Response } from "express";

import { PORTAL_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@repo/common";

import { env } from "../config/env.js";

export const REFRESH_COOKIE_NAME = "refresh_token";
export const CSRF_COOKIE_NAME = "csrf_token";
export const PORTAL_CSRF_COOKIE_NAME = "portal_csrf_token";

export function readCookies(
  request: Request,
): Readonly<Record<string, string>> {
  const header = request.headers.cookie;
  if (header === undefined) return {};
  return Object.fromEntries(
    header.split(";").flatMap((entry) => {
      const separator = entry.indexOf("=");
      if (separator < 0) return [];
      const key = entry.slice(0, separator).trim();
      const rawValue = entry.slice(separator + 1).trim();
      try {
        return [[key, decodeURIComponent(rawValue)]];
      } catch {
        return [];
      }
    }),
  );
}

function baseCookie(maxAgeMs: number, httpOnly: boolean) {
  return {
    httpOnly,
    secure: env.COOKIE_SECURE,
    sameSite: "lax" as const,
    // Root scope is deliberate: Next.js server components receive these cookies
    // while rendering application routes and can forward them to the API.
    path: "/",
    maxAge: maxAgeMs,
  };
}

export function setInternalCookies(
  response: Response,
  values: { session: string; refresh: string; csrf: string },
): void {
  response.cookie(
    SESSION_COOKIE_NAME,
    values.session,
    baseCookie(env.SESSION_TTL_HOURS * 3_600_000, true),
  );
  response.cookie(
    REFRESH_COOKIE_NAME,
    values.refresh,
    baseCookie(env.REFRESH_TTL_DAYS * 86_400_000, true),
  );
  response.cookie(
    CSRF_COOKIE_NAME,
    values.csrf,
    baseCookie(env.SESSION_TTL_HOURS * 3_600_000, false),
  );
}

export function clearInternalCookies(response: Response): void {
  for (const name of [
    SESSION_COOKIE_NAME,
    REFRESH_COOKIE_NAME,
    CSRF_COOKIE_NAME,
  ]) {
    response.clearCookie(name, { path: "/" });
  }
}

export function setPortalCookies(
  response: Response,
  values: { session: string; csrf: string },
): void {
  const maxAge = env.PORTAL_SESSION_TTL_MINUTES * 60_000;
  response.cookie(
    PORTAL_SESSION_COOKIE_NAME,
    values.session,
    baseCookie(maxAge, true),
  );
  response.cookie(
    PORTAL_CSRF_COOKIE_NAME,
    values.csrf,
    baseCookie(maxAge, false),
  );
}

export function clearPortalCookies(response: Response): void {
  for (const name of [PORTAL_SESSION_COOKIE_NAME, PORTAL_CSRF_COOKIE_NAME]) {
    response.clearCookie(name, { path: "/" });
  }
}
