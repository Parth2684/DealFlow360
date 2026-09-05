/**
 * Thin fetch wrapper around the DealFlow360 Express API.
 *
 * The API is a separate service (apps/api) authenticated with an httpOnly
 * `session` cookie (see openapi.yaml components.securitySchemes.cookieAuth).
 * In the browser, requests go through the Next.js rewrite configured in
 * next.config.ts (same-origin `/api/v1/*`) so the cookie travels automatically.
 * On the server (Server Components, layouts), we call the API directly and
 * forward the incoming request's cookies by hand, since there is no browser
 * to do it for us.
 */

const SERVER_API_URL = process.env.API_URL ?? "http://localhost:3000/api/v1";
const BROWSER_API_BASE = "/api/v1";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function extractMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.message === "string") return record.message;
    if (typeof record.error === "string") return record.error;
  }
  return fallback;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isServer = typeof window === "undefined";
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  let url: string;
  if (isServer) {
    url = `${SERVER_API_URL}${path}`;
    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      const cookieHeader = cookieStore.toString();
      if (cookieHeader) headers.set("cookie", cookieHeader);
    } catch {
      // Not in a request context (e.g. build time) — proceed without cookies.
    }
  } else {
    url = `${BROWSER_API_BASE}${path}`;
  }

  const res = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    throw new ApiError(extractMessage(body, res.statusText), res.status, body);
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: data !== undefined ? JSON.stringify(data) : undefined,
    }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(data) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/**
 * The OpenAPI spec does not pin down list-response envelopes. Tolerate a bare
 * array or a `{ data | items | results: [...] }` wrapper so the UI keeps
 * working regardless of which convention the API ends up using.
 */
export function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["data", "items", "results"]) {
      if (Array.isArray(record[key])) return record[key] as T[];
    }
  }
  return [];
}

/** Same idea for a single-record envelope (`{ data: {...} }` vs. a bare object). */
export function unwrapItem<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in (payload as Record<string, unknown>)) {
    const data = (payload as Record<string, unknown>).data;
    if (data && typeof data === "object") return data as T;
  }
  return payload as T;
}
