import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import { Errors } from "@repo/contracts";

export function validateBody<T extends z.ZodType>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body);
    next();
  };
}

export function validateQuery<T extends z.ZodType>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.query = schema.parse(req.query) as Request["query"];
    next();
  };
}

export function validateParams<T extends z.ZodType>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.params = schema.parse(req.params) as Request["params"];
    next();
  };
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) {
    return next(Errors.unauthorized());
  }
  next();
}
