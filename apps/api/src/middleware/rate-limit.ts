import type { NextFunction, Request, Response } from "express";

import { HttpError } from "../shared/errors.js";

interface Counter {
  count: number;
  resetAt: number;
}

const MAX_TRACKED_KEYS = 10_000;

export function rateLimit(options: {
  windowMs: number;
  maximum: number;
  namespace: string;
}) {
  const counters = new Map<string, Counter>();

  return (request: Request, response: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = `${options.namespace}:${request.ip ?? "unknown"}`;
    const previous = counters.get(key);
    const counter =
      previous === undefined || previous.resetAt <= now
        ? { count: 0, resetAt: now + options.windowMs }
        : previous;
    counter.count += 1;
    counters.set(key, counter);

    if (counters.size > MAX_TRACKED_KEYS) {
      for (const [trackedKey, tracked] of counters) {
        if (tracked.resetAt <= now || counters.size > MAX_TRACKED_KEYS) {
          counters.delete(trackedKey);
        }
      }
    }

    response.setHeader("RateLimit-Limit", String(options.maximum));
    response.setHeader(
      "RateLimit-Remaining",
      String(Math.max(0, options.maximum - counter.count)),
    );
    response.setHeader(
      "RateLimit-Reset",
      String(Math.ceil(counter.resetAt / 1000)),
    );

    if (counter.count > options.maximum) {
      response.setHeader(
        "Retry-After",
        String(Math.max(1, Math.ceil((counter.resetAt - now) / 1000))),
      );
      next(
        new HttpError(
          429,
          "Too many requests",
          "Try again after the rate limit resets",
          {
            code: "RATE_LIMITED",
          },
        ),
      );
      return;
    }

    next();
  };
}

export const loginRateLimit = rateLimit({
  namespace: "login",
  maximum: 10,
  windowMs: 15 * 60_000,
});

export const portalRateLimit = rateLimit({
  namespace: "portal",
  maximum: 30,
  windowMs: 15 * 60_000,
});

export const exportRateLimit = rateLimit({
  namespace: "export",
  maximum: 10,
  windowMs: 60_000,
});
