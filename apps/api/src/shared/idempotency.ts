import type { Request } from "express";

import { IDEMPOTENCY_HEADER, IdempotencyKeySchema } from "@repo/common";
import { prisma } from "@repo/db";

import { conflict, HttpError } from "./errors.js";
import { toJsonValue } from "./http.js";
import { jsonInput, type Actor, type TransactionClient } from "./activity.js";
import { stableFingerprint } from "./security.js";

export interface IdempotentResult<T> {
  status: number;
  body: T;
  entityType?: string;
  entityId?: string;
}

export async function runIdempotent<T>(
  request: Request,
  actor: Actor,
  command: string,
  requestValue: unknown,
  operation: (transaction: TransactionClient) => Promise<IdempotentResult<T>>,
): Promise<IdempotentResult<T>> {
  const keyResult = IdempotencyKeySchema.safeParse(
    request.get(IDEMPOTENCY_HEADER),
  );
  if (!keyResult.success) {
    throw new HttpError(
      400,
      "Idempotency key required",
      `${IDEMPOTENCY_HEADER} must contain between 8 and 191 characters`,
      { code: "IDEMPOTENCY_KEY_REQUIRED" },
    );
  }
  const key = keyResult.data;
  const actorType = actor.kind === "portal" ? "PORTAL" : "USER";
  const actorId =
    actor.kind === "portal" ? actor.portalIdentityId : actor.userId;
  const organizationId = actor.organizationId;
  const requestFingerprint = stableFingerprint(requestValue);
  const unique = {
    organizationId_actorType_actorId_command_key: {
      organizationId,
      actorType,
      actorId,
      command,
      key,
    },
  } as const;

  const existing = await prisma.idempotencyRecord.findUnique({ where: unique });
  if (existing !== null) {
    if (existing.requestFingerprint !== requestFingerprint) {
      conflict(
        "This idempotency key was already used with a different request",
        "IDEMPOTENCY_KEY_REUSED",
      );
    }
    if (existing.status === "COMPLETED" && existing.responseStatus !== null) {
      return {
        status: existing.responseStatus,
        body: existing.responseBody as T,
        entityType: existing.resultEntityType ?? undefined,
        entityId: existing.resultEntityId ?? undefined,
      };
    }
    conflict(
      "An identical command is already in progress",
      "COMMAND_IN_PROGRESS",
    );
  }

  try {
    return await prisma.$transaction(async (transaction) => {
      const record = await transaction.idempotencyRecord.create({
        data: {
          organizationId,
          actorType,
          actorId,
          command,
          key,
          requestFingerprint,
          expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
        },
      });
      const result = await operation(transaction);
      const serializedBody = toJsonValue(result.body) as T;
      await transaction.idempotencyRecord.update({
        where: { id: record.id },
        data: {
          status: "COMPLETED",
          resultEntityType: result.entityType,
          resultEntityId: result.entityId,
          responseStatus: result.status,
          responseBody: jsonInput(serializedBody),
        },
      });
      return { ...result, body: serializedBody };
    });
  } catch (error) {
    const raced = await prisma.idempotencyRecord.findUnique({ where: unique });
    if (
      raced !== null &&
      raced.requestFingerprint === requestFingerprint &&
      raced.status === "COMPLETED" &&
      raced.responseStatus !== null
    ) {
      return {
        status: raced.responseStatus,
        body: raced.responseBody as T,
        entityType: raced.resultEntityType ?? undefined,
        entityId: raced.resultEntityId ?? undefined,
      };
    }
    throw error;
  }
}
