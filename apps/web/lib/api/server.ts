import { ProblemDetailsSchema, type ProblemDetails } from "@repo/common";
import { cookies } from "next/headers";
import type { z } from "zod";

const DEFAULT_API_INTERNAL_URL = "http://localhost:3000";

function internalApiUrl(path: string): URL {
  if (path !== "/api/v1" && !path.startsWith("/api/v1/")) {
    throw new TypeError("Server API requests must use an /api/v1 path.");
  }

  const configured =
    process.env.API_INTERNAL_URL?.trim() || DEFAULT_API_INTERNAL_URL;
  const base = configured.endsWith("/") ? configured : `${configured}/`;
  return new URL(path, base);
}

async function forwardedCookieHeader(): Promise<string> {
  const store = await cookies();
  return store
    .getAll()
    .map(({ name, value }) => `${name}=${encodeURIComponent(value)}`)
    .join("; ");
}

export class ServerApiError extends Error {
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.name = "ServerApiError";
    this.problem = problem;
  }
}

async function problemFromResponse(
  response: Response,
): Promise<ProblemDetails> {
  const payload: unknown = await response.json().catch(() => null);
  const parsed = ProblemDetailsSchema.safeParse(payload);

  if (parsed.success) return parsed.data;

  return {
    type: "about:blank",
    title: "API Request Failed",
    status: response.status >= 400 ? response.status : 500,
    detail: "The API returned an unreadable error response. Try again.",
  };
}

export async function serverApiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  const cookieHeader = await forwardedCookieHeader();

  headers.set("Accept", "application/json");
  if (cookieHeader) headers.set("Cookie", cookieHeader);

  return fetch(internalApiUrl(path), {
    ...init,
    cache: "no-store",
    headers,
  });
}

export async function serverApiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  const response = await serverApiFetch(path, init);

  if (!response.ok)
    throw new ServerApiError(await problemFromResponse(response));

  const payload: unknown =
    response.status === 204 ? undefined : await response.json();
  return schema.parse(payload);
}
