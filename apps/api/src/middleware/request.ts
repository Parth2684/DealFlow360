import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env.js";
import { HttpError } from "../shared/errors.js";

export function requestContext(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const incoming = request.get("x-request-id");
  const traceId = incoming?.trim() || crypto.randomUUID();
  response.locals.traceId = traceId;
  response.setHeader("X-Request-Id", traceId);
  next();
}

export function exactOriginCors(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const origin = request.get("origin");
  if (origin !== undefined && origin !== env.WEB_ORIGIN) {
    next(
      new HttpError(
        403,
        "Origin not allowed",
        "The request origin is not trusted",
        {
          code: "ORIGIN_NOT_ALLOWED",
        },
      ),
    );
    return;
  }

  if (origin === env.WEB_ORIGIN) {
    response.setHeader("Access-Control-Allow-Origin", env.WEB_ORIGIN);
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader(
      "Access-Control-Expose-Headers",
      "X-Demo-Magic-Token, X-Request-Id",
    );
    response.setHeader("Vary", "Origin");
  }

  if (request.method === "OPTIONS") {
    response.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Idempotency-Key, X-CSRF-Token, X-Request-Id",
    );
    response.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, PUT, DELETE, OPTIONS",
    );
    response.status(204).end();
    return;
  }

  next();
}
