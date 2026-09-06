import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import type { ProblemDetails, ValidationIssue } from "@repo/common";

export class HttpError extends Error {
  readonly status: number;
  readonly title: string;
  readonly code?: string;
  readonly errors?: ValidationIssue[];

  constructor(
    status: number,
    title: string,
    detail?: string,
    options?: { code?: string; errors?: ValidationIssue[] },
  ) {
    super(detail ?? title);
    this.name = "HttpError";
    this.status = status;
    this.title = title;
    this.code = options?.code;
    this.errors = options?.errors;
  }
}

export function notFound(entity: string): never {
  throw new HttpError(404, `${entity} not found`, undefined, {
    code: "NOT_FOUND",
  });
}

export function conflict(detail: string, code = "CONFLICT"): never {
  throw new HttpError(409, "Conflict", detail, { code });
}

export function forbidden(
  detail = "You do not have access to this resource",
): never {
  throw new HttpError(403, "Forbidden", detail, { code: "FORBIDDEN" });
}

export function unauthorized(detail = "Authentication is required"): never {
  throw new HttpError(401, "Unauthorized", detail, { code: "UNAUTHORIZED" });
}

function issuesFromZod(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((part) =>
      typeof part === "symbol" ? (part.description ?? "symbol") : part,
    ),
    message: issue.message,
    code: issue.code,
  }));
}

export function errorHandler(
  error: unknown,
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  void next;
  const traceId = response.locals.traceId;
  let problem: ProblemDetails;
  const parserStatus =
    error !== null && typeof error === "object"
      ? Reflect.get(error, "status")
      : undefined;

  if (parserStatus === 413) {
    problem = {
      type: "about:blank",
      title: "Payload too large",
      status: 413,
      detail: "The JSON request body exceeds the allowed size",
      instance: request.originalUrl,
      code: "PAYLOAD_TOO_LARGE",
      traceId,
    };
  } else if (parserStatus === 400 && error instanceof SyntaxError) {
    problem = {
      type: "about:blank",
      title: "Invalid JSON",
      status: 400,
      detail: "The request body is not valid JSON",
      instance: request.originalUrl,
      code: "INVALID_JSON",
      traceId,
    };
  } else if (error instanceof HttpError) {
    problem = {
      type: "about:blank",
      title: error.title,
      status: error.status,
      detail: error.message,
      instance: request.originalUrl,
      code: error.code,
      traceId,
      errors: error.errors,
    };
  } else if (error instanceof ZodError) {
    problem = {
      type: "about:blank",
      title: "Validation failed",
      status: 422,
      detail: "The request did not match the API contract",
      instance: request.originalUrl,
      code: "VALIDATION_FAILED",
      traceId,
      errors: issuesFromZod(error),
    };
  } else if (
    error &&
    typeof error === "object" &&
    ["P2002", "P2003", "P2025", "P2034"].includes(
      String(Reflect.get(error, "code")),
    )
  ) {
    const code = String(Reflect.get(error, "code"));
    problem = {
      type: "about:blank",
      instance: request.originalUrl,
      traceId,
      status: code === "P2025" ? 404 : code === "P2003" ? 422 : 409,
      title: code === "P2025" ? "Record not found" : "Unable to save changes",
      detail:
        code === "P2002"
          ? "A record with these details already exists."
          : code === "P2003"
            ? "A related record is missing or still in use."
            : code === "P2034"
              ? "Another request changed this record. Reload and try again."
              : "This record no longer exists.",
      code:
        code === "P2002"
          ? "DUPLICATE_RECORD"
          : code === "P2034"
            ? "REVISION_CONFLICT"
            : "INVALID_REFERENCE",
    };
  } else {
    const detail =
      process.env.NODE_ENV === "production"
        ? "An unexpected server error occurred"
        : error instanceof Error
          ? error.message
          : "Unknown error";
    problem = {
      type: "about:blank",
      title: "Internal server error",
      status: 500,
      detail,
      instance: request.originalUrl,
      code: "INTERNAL_ERROR",
      traceId,
    };
  }

  response
    .status(problem.status)
    .type("application/problem+json")
    .json(problem);
}
