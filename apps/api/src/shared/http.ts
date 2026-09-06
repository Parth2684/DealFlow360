import type { Request } from "express";
import type { ZodType } from "zod";

import { IdSchema, type CursorPage } from "@repo/common";

import { HttpError } from "./errors.js";

export function parseBody<T>(schema: ZodType<T>, request: Request): T {
  return schema.parse(request.body ?? {});
}

export function parseQuery<T>(schema: ZodType<T>, request: Request): T {
  return schema.parse(request.query);
}

export function parseId(value: string | undefined, label = "id"): string {
  const result = IdSchema.safeParse(value);
  if (!result.success) {
    throw new HttpError(422, "Validation failed", `Invalid ${label}`, {
      code: "VALIDATION_FAILED",
      errors: result.error.issues.map((issue) => ({
        path: [label],
        message: issue.message,
        code: issue.code,
      })),
    });
  }
  return result.data;
}

export function parsePathId(request: Request, name: string): string {
  const value = request.params[name];
  return parseId(Array.isArray(value) ? value[0] : value, name);
}

function decimalLike(value: object): string | undefined {
  const constructor = Reflect.get(value, "constructor");
  const name = typeof constructor === "function" ? constructor.name : undefined;
  if (name !== "Decimal") return undefined;
  const toString = Reflect.get(value, "toString");
  return typeof toString === "function"
    ? (Reflect.apply(toString, value, []) as string)
    : undefined;
}

/** Convert persistence-only values into stable JSON wire values. */
export function toJsonValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(toJsonValue);
  if (typeof value !== "object") return value;

  const decimal = decimalLike(value);
  if (decimal !== undefined) return decimal;

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [key, toJsonValue(nested)]),
  );
}

export function pageFromRows<T extends { id: string }>(
  rows: T[],
  requestedLimit: number,
): CursorPage<T> {
  const hasNextPage = rows.length > requestedLimit;
  const items = hasNextPage ? rows.slice(0, requestedLimit) : rows;
  return {
    items,
    pageInfo: {
      hasNextPage,
      nextCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null,
    },
  };
}

export function cursorArgs(cursor: string | undefined, limit: number) {
  return {
    take: limit + 1,
    ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
  };
}
