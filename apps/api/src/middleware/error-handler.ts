import type { NextFunction, Request, Response } from "express";
import { AppError } from "@repo/contracts";
import { ZodError } from "zod";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    res.status(err.status).json(err.toProblemDetails(req.originalUrl));
    return;
  }

  if (err instanceof ZodError) {
    const validationError = new AppError(
      422,
      "Unprocessable Entity",
      "Validation failed",
      "validation",
      err.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    );
    res
      .status(422)
      .json(validationError.toProblemDetails(req.originalUrl));
    return;
  }

  console.error("[api error]", err);
  const internal = new AppError(
    500,
    "Internal Server Error",
    "An unexpected error occurred",
    "internal",
  );
  res.status(500).json(internal.toProblemDetails(req.originalUrl));
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    type: "https://dealflow360.dev/errors/not_found",
    title: "Not Found",
    status: 404,
    detail: `Route ${req.method} ${req.path} not found`,
    instance: req.originalUrl,
  });
}

export function requestIdMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  req.requestId = crypto.randomUUID();
  next();
}
