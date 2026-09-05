import type { Prisma, PrismaClient } from "@repo/db";

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

export async function writeOutboxEvent(
  tx: TransactionClient,
  data: {
    organizationId: string;
    eventType: string;
    payload: Prisma.InputJsonValue;
    dedupeKey?: string;
    availableAt?: Date;
  },
) {
  return tx.outboxEvent.create({
    data: {
      organizationId: data.organizationId,
      eventType: data.eventType,
      payload: data.payload,
      dedupeKey: data.dedupeKey,
      availableAt: data.availableAt ?? new Date(),
    },
  });
}

export async function writeAuditEvent(
  tx: TransactionClient,
  data: {
    organizationId: string;
    actorId?: string;
    entityType: string;
    entityId: string;
    eventType: string;
    beforeSummary?: Prisma.InputJsonValue;
    afterSummary?: Prisma.InputJsonValue;
    metadata?: Prisma.InputJsonValue;
  },
) {
  return tx.auditEvent.create({ data });
}

export async function writeDealEvent(
  tx: TransactionClient,
  data: {
    organizationId: string;
    quoteId?: string;
    eventType: string;
    title: string;
    description?: string;
    visibility?: "INTERNAL" | "CUSTOMER" | "BOTH";
    actorId?: string;
    metadata?: Prisma.InputJsonValue;
  },
) {
  return tx.dealEvent.create({
    data: {
      visibility: "INTERNAL",
      ...data,
    },
  });
}
