import {
  CSRF_HEADER,
  ProblemDetailsSchema,
  RefreshSessionResponseSchema,
  planApiRoutes,
  type ProblemDetails,
} from "@repo/common";
import type { z } from "zod";

export type BrowserApiScope = "internal" | "portal" | "public";

export interface BrowserApiOptions<T> extends Omit<
  RequestInit,
  "body" | "credentials"
> {
  json?: unknown;
  retryAuth?: boolean;
  schema: z.ZodType<T>;
  scope?: BrowserApiScope;
}

export interface BrowserApiResponse<T> {
  data: T;
  headers: Headers;
  status: number;
}

export class ApiProblemError extends Error {
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.name = "ApiProblemError";
    this.problem = problem;
  }
}

function cookieValue(name: string): string | undefined {
  const prefix = `${name}=`;
  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  if (!entry) return undefined;

  try {
    return decodeURIComponent(entry.slice(prefix.length));
  } catch {
    return undefined;
  }
}

function isUnsafe(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method);
}

function csrfCookie(scope: BrowserApiScope): string | undefined {
  if (scope === "internal") return cookieValue("csrf_token");
  if (scope === "portal") return cookieValue("portal_csrf_token");
  return undefined;
}

function sameOriginApiPath(path: string): string {
  try {
    const url = new URL(path, window.location.origin);
    const isApiPath =
      url.pathname === "/api/v1" || url.pathname.startsWith("/api/v1/");

    if (url.origin === window.location.origin && isApiPath) {
      return `${url.pathname}${url.search}`;
    }
  } catch {
    // The caller receives the same safe problem response for every invalid path.
  }

  throw new ApiProblemError({
    type: "about:blank",
    title: "Invalid API Path",
    status: 400,
    detail: "Browser API requests must use a same-origin /api/v1 path.",
  });
}

async function apiProblem(response: Response): Promise<ApiProblemError> {
  const payload: unknown = await response.json().catch(() => null);
  const parsed = ProblemDetailsSchema.safeParse(payload);

  return new ApiProblemError(
    parsed.success
      ? parsed.data
      : {
          type: "about:blank",
          title: "Request Failed",
          status: response.status >= 400 ? response.status : 500,
          detail: "The service returned an unreadable response. Try again.",
        },
  );
}

async function requestOnce<T>(
  path: string,
  options: BrowserApiOptions<T>,
): Promise<Response> {
  const {
    json,
    retryAuth,
    schema,
    scope = "internal",
    ...requestInit
  } = options;
  void retryAuth;
  void schema;
  const method = (requestInit.method ?? "GET").toUpperCase();
  const headers = new Headers(requestInit.headers);

  headers.set("Accept", "application/json");
  if (json !== undefined) headers.set("Content-Type", "application/json");

  if (isUnsafe(method)) {
    const csrf = csrfCookie(scope);
    if (csrf) headers.set(CSRF_HEADER, csrf);
  }

  return fetch(sameOriginApiPath(path), {
    ...requestInit,
    body: json === undefined ? undefined : JSON.stringify(json),
    credentials: "include",
    headers,
    method,
  });
}

async function refreshInternalSession(): Promise<boolean> {
  const csrf = csrfCookie("internal");
  if (!csrf) return false;

  const response = await requestOnce(planApiRoutes.auth.refresh, {
    json: {},
    method: "POST",
    retryAuth: false,
    schema: RefreshSessionResponseSchema,
    scope: "internal",
  });

  return response.ok;
}

export async function browserApiResponse<T>(
  path: string,
  options: BrowserApiOptions<T>,
): Promise<BrowserApiResponse<T>> {
  let response: Response;

  try {
    response = await requestOnce(path, options);
    if (
      response.status === 401 &&
      (options.scope ?? "internal") === "internal" &&
      options.retryAuth !== false &&
      path !== planApiRoutes.auth.refresh &&
      (await refreshInternalSession())
    ) {
      response = await requestOnce(path, options);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    if (error instanceof ApiProblemError) throw error;
    throw new ApiProblemError({
      type: "about:blank",
      title: "Service Unavailable",
      status: 503,
      detail:
        "DealFlow360 could not reach the API. Check the service and try again.",
    });
  }

  if (!response.ok) throw await apiProblem(response);

  const data =
    response.status === 204
      ? options.schema.parse(undefined)
      : options.schema.parse((await response.json()) as unknown);

  return { data, headers: response.headers, status: response.status };
}

export async function browserApiRequest<T>(
  path: string,
  options: BrowserApiOptions<T>,
): Promise<T> {
  return (await browserApiResponse(path, options)).data;
}
