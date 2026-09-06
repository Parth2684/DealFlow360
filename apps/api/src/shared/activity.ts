import type { DomainEventType } from "@repo/common";
import type { Prisma } from "@repo/db";

import { toJsonValue } from "./http.js";
import type { InternalPrincipal, PortalPrincipal } from "./types.js";

export type TransactionClient = Prisma.TransactionClient;
export type Actor = InternalPrincipal | PortalPrincipal;

export function jsonInput(value: unknown): Prisma.InputJsonValue {
  return toJsonValue(value) as Prisma.InputJsonValue;
}

export async function recordActivity(
  transaction: TransactionClient,
  input: {
    organizationId: string;
    actor?: Actor;
    eventType: DomainEventType;
    entityType: string;
    entityId: string;
    entityVersion?: number;
    termsFingerprint?: string;
    reason?: string;
    before?: unknown;
    after?: unknown;
    metadata?: unknown;
    quoteId?: string;
    title?: string;
    message?: string;
    customerVisible?: boolean;
  },
): Promise<void> {
  const actorType =
    input.actor?.kind === "portal" ? "PORTAL" : input.actor ? "USER" : "SYSTEM";
  const actorId =
    input.actor?.kind === "portal"
      ? input.actor.portalIdentityId
      : input.actor?.userId;
  const actorName =
    input.actor?.kind === "internal"
      ? `${input.actor.firstName} ${input.actor.lastName}`
      : input.actor?.email;
  await transaction.auditEvent.create({
    data: {
      organizationId: input.organizationId,
      actorType,
      actorId,
      actorName,
      entityType: input.entityType,
      entityId: input.entityId,
      entityVersion: input.entityVersion,
      termsFingerprint: input.termsFingerprint,
      eventType: input.eventType,
      reason: input.reason,
      beforeSummary:
        input.before === undefined ? undefined : jsonInput(input.before),
      afterSummary:
        input.after === undefined ? undefined : jsonInput(input.after),
      metadata: jsonInput(input.metadata ?? {}),
    },
  });
  if (input.quoteId !== undefined) {
    await transaction.dealEvent.create({
      data: {
        organizationId: input.organizationId,
        quoteId: input.quoteId,
        visibility: input.customerVisible ? "BOTH" : "INTERNAL",
        eventType: input.eventType,
        title: input.title ?? input.eventType,
        message: input.message,
        actorType,
        actorId,
        sourceEntityType: input.entityType,
        sourceEntityId: input.entityId,
        sourceVersion: input.entityVersion,
        metadata: jsonInput(input.metadata ?? {}),
      },
    });
  }
  await transaction.outboxEvent.create({
    data: {
      organizationId: input.organizationId,
      eventType: input.eventType,
      aggregateType: input.entityType,
      aggregateId: input.entityId,
      deduplicationKey: `${input.eventType}:${input.entityId}:${crypto.randomUUID()}`,
      payload: jsonInput({
        entityType: input.entityType,
        entityId: input.entityId,
        quoteId: input.quoteId,
        version: input.entityVersion,
      }),
    },
  });
}
