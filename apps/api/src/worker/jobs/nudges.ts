import { prisma } from "@repo/db";

import { jsonInput, type TransactionClient } from "../../shared/activity.js";

const EMAIL_ADAPTER_ERROR = "Email delivery adapter is not configured";

export async function settleQueuedNudge(
  transaction: TransactionClient,
  nudgeId: string,
  organizationId?: string,
): Promise<boolean> {
  const nudge = await transaction.nudge.findFirst({
    where: {
      id: nudgeId,
      ...(organizationId === undefined ? {} : { organizationId }),
    },
    include: {
      alert: true,
      recipientContact: { include: { portalIdentity: true } },
    },
  });
  if (nudge === null || nudge.status !== "QUEUED") return false;
  const now = new Date();
  if (nudge.channel === "EMAIL") {
    const failed = await transaction.nudge.updateMany({
      where: {
        id: nudge.id,
        organizationId: nudge.organizationId,
        status: "QUEUED",
      },
      data: {
        status: "FAILED",
        failedAt: now,
        errorMessage: EMAIL_ADAPTER_ERROR,
      },
    });
    return failed.count === 1;
  }

  const portalIdentityId = nudge.recipientContact?.portalIdentity?.id;
  if (nudge.recipientUserId === null && portalIdentityId === undefined) {
    const failed = await transaction.nudge.updateMany({
      where: {
        id: nudge.id,
        organizationId: nudge.organizationId,
        status: "QUEUED",
      },
      data: {
        status: "FAILED",
        failedAt: now,
        errorMessage: "The in-app nudge has no reachable recipient",
      },
    });
    return failed.count === 1;
  }
  const claimed = await transaction.nudge.updateMany({
    where: {
      id: nudge.id,
      organizationId: nudge.organizationId,
      status: "QUEUED",
    },
    data: { status: "SENT", sentAt: now, errorMessage: null },
  });
  if (claimed.count !== 1) return false;
  await transaction.notification.create({
    data: {
      organizationId: nudge.organizationId,
      recipientUserId: nudge.recipientUserId,
      recipientPortalIdentityId: portalIdentityId,
      channel: "IN_APP",
      type: "DEAL_HEALTH_NUDGE",
      title: nudge.alert.title,
      body: nudge.message,
      data: jsonInput({ alertId: nudge.alertId, quoteId: nudge.alert.quoteId }),
      status: "SENT",
      sentAt: now,
    },
  });
  return true;
}

export async function settleQueuedNudgeBatch(
  batchSize: number,
): Promise<number> {
  const candidates = await prisma.nudge.findMany({
    where: { status: "QUEUED" },
    orderBy: [{ requestedAt: "asc" }, { id: "asc" }],
    select: { id: true },
    take: batchSize,
  });
  let settled = 0;
  for (const candidate of candidates) {
    const changed = await prisma.$transaction((transaction) =>
      settleQueuedNudge(transaction, candidate.id),
    );
    if (changed) settled += 1;
  }
  return settled;
}
