import { Prisma } from "@repo/db";

import type { TransactionClient } from "../shared/activity.js";

export async function lockWorkerEntity(
  transaction: TransactionClient,
  organizationId: string,
  entityType: string,
  entityId: string,
): Promise<void> {
  const key = `${organizationId}:${entityType}:${entityId}`;
  await transaction.$queryRaw<Array<{ locked: unknown }>>(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0)) AS locked`,
  );
}
