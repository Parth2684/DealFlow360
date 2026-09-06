import { prisma, Prisma } from "@repo/db";

import { env } from "../config/env.js";
import { jsonInput, type TransactionClient } from "../shared/activity.js";
import {
  deliverApprovalSlaSignal,
  expireApprovalDelegation,
} from "./jobs/approvals.js";
import { recheckBackorder } from "./jobs/backorders.js";
import {
  generateRecurringInvoice,
  markBillingScheduleFailed,
} from "./jobs/billing.js";
import { refreshDealHealth } from "./jobs/health.js";
import { markInvoiceOverdue } from "./jobs/invoices.js";
import { generateExport, markExportFailed } from "./jobs/exports.js";
import { settleQueuedNudge, settleQueuedNudgeBatch } from "./jobs/nudges.js";
import { WORKER_EVENT_TYPES, type ClaimedOutboxEvent } from "./job-events.js";
import { createSchedulerState, enqueueDueScheduledWork } from "./scheduler.js";

const STALE_LOCK_MS = 5 * 60_000;

function jsonObject(
  value: Prisma.JsonValue,
): Record<string, Prisma.JsonValue | undefined> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function text(value: Prisma.JsonValue | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function notificationTitle(eventType: string): string {
  return eventType
    .split(/[._-]/u)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

async function eventRecipients(
  transaction: TransactionClient,
  event: {
    organizationId: string;
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    payload: Prisma.JsonValue;
  },
): Promise<string[]> {
  const recipients = new Set<string>();
  const payload = jsonObject(event.payload);
  const quoteId = text(payload["quoteId"]);
  if (quoteId !== null) {
    const quote = await transaction.quote.findFirst({
      where: { id: quoteId, organizationId: event.organizationId },
      select: { ownerId: true },
    });
    if (quote !== null) recipients.add(quote.ownerId);
  }

  if (
    event.eventType === "approval.requested" ||
    event.aggregateType === "ApprovalRequest"
  ) {
    const steps = await transaction.approvalStep.findMany({
      where: {
        organizationId: event.organizationId,
        approvalRequestId: event.aggregateId,
        status: "ACTIVE",
      },
      select: { assigneeId: true, delegateId: true },
    });
    for (const step of steps) {
      if (step.assigneeId !== null) recipients.add(step.assigneeId);
      if (step.delegateId !== null) recipients.add(step.delegateId);
    }
  }

  const specialistRole =
    event.eventType.startsWith("invoice.") ||
    event.eventType === "payment.recorded"
      ? "FINANCE"
      : event.eventType.startsWith("stock.") ||
          event.eventType.startsWith("backorder.") ||
          event.eventType === "inventory.replenished"
        ? "OPERATIONS"
        : null;
  if (specialistRole !== null) {
    const assignments = await transaction.roleAssignment.findMany({
      where: {
        organizationId: event.organizationId,
        role: specialistRole,
        active: true,
        user: { organizationId: event.organizationId, status: "ACTIVE" },
      },
      select: { userId: true },
      take: 25,
    });
    for (const assignment of assignments) recipients.add(assignment.userId);
  }
  return [...recipients];
}

async function dispatchOutboxEvent(
  transaction: TransactionClient,
  event: ClaimedOutboxEvent,
): Promise<void> {
  if (event.eventType === WORKER_EVENT_TYPES.billingScheduleDue) {
    await generateRecurringInvoice(transaction, event);
    return;
  }
  if (event.eventType === WORKER_EVENT_TYPES.invoiceDue) {
    await markInvoiceOverdue(transaction, event);
    return;
  }
  if (event.eventType === WORKER_EVENT_TYPES.dealHealthRefresh) {
    await refreshDealHealth(transaction, event);
    return;
  }
  if (
    event.eventType === WORKER_EVENT_TYPES.approvalReminder ||
    event.eventType === WORKER_EVENT_TYPES.approvalEscalation
  ) {
    await deliverApprovalSlaSignal(transaction, event);
    return;
  }
  if (event.eventType === WORKER_EVENT_TYPES.approvalDelegationExpire) {
    await expireApprovalDelegation(transaction, event);
    return;
  }
  if (event.eventType === WORKER_EVENT_TYPES.backorderRecheck) {
    await recheckBackorder(transaction, event);
    return;
  }
  if (event.eventType === "nudge.requested") {
    await settleQueuedNudge(
      transaction,
      event.aggregateId,
      event.organizationId,
    );
    return;
  }
  if (
    event.eventType === "deal.activityRecorded" ||
    event.eventType === "approval.requested"
  ) {
    return;
  }
  const recipients = await eventRecipients(transaction, event);
  if (recipients.length === 0) return;
  await transaction.notification.createMany({
    data: recipients.map((recipientUserId) => ({
      organizationId: event.organizationId,
      recipientUserId,
      channel: "IN_APP" as const,
      type: event.eventType,
      title: notificationTitle(event.eventType),
      body: "A related DealFlow360 record has changed.",
      data: jsonInput({
        outboxEventId: event.id,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
      }),
      status: "QUEUED" as const,
    })),
  });
}

async function failClaimedEvent(
  event: ClaimedOutboxEvent,
  workerId: string,
  attempt: number,
  maxAttempts: number,
  error: unknown,
): Promise<void> {
  const deadLetter = attempt >= maxAttempts;
  const delay = Math.min(60 * 60_000, 1_000 * 2 ** Math.min(attempt, 10));
  const message = (
    error instanceof Error ? error.message : "Unknown worker error"
  ).slice(0, 2_000);
  await prisma.$transaction(async (transaction) => {
    const changed = await transaction.outboxEvent.updateMany({
      where: { id: event.id, status: "PROCESSING", lockedBy: workerId },
      data: {
        status: deadLetter ? "DEAD_LETTER" : "FAILED",
        lastError: message,
        availableAt: deadLetter ? new Date() : new Date(Date.now() + delay),
        lockedAt: null,
        lockedBy: null,
      },
    });
    if (
      changed.count === 1 &&
      deadLetter &&
      event.eventType === WORKER_EVENT_TYPES.billingScheduleDue
    ) {
      await markBillingScheduleFailed(
        transaction,
        event.organizationId,
        event.aggregateId,
      );
    }
    if (
      changed.count === 1 &&
      deadLetter &&
      event.eventType === WORKER_EVENT_TYPES.exportGenerate
    ) {
      await markExportFailed(
        transaction,
        event.organizationId,
        event.aggregateId,
      );
    }
  });
}

async function processOutboxBatch(workerId: string): Promise<number> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_LOCK_MS);
  const candidates = await prisma.outboxEvent.findMany({
    where: {
      OR: [
        { status: { in: ["PENDING", "FAILED"] }, availableAt: { lte: now } },
        { status: "PROCESSING", lockedAt: { lte: staleBefore } },
      ],
    },
    orderBy: [{ availableAt: "asc" }, { id: "asc" }],
    take: env.WORKER_BATCH_SIZE,
  });
  let processed = 0;
  for (const event of candidates) {
    if (event.attempts >= event.maxAttempts) {
      if (event.eventType === WORKER_EVENT_TYPES.exportGenerate) {
        const exportJob = await prisma.exportJob.findFirst({
          where: {
            id: event.aggregateId,
            organizationId: event.organizationId,
            status: { in: ["COMPLETED", "CANCELLED", "EXPIRED"] },
          },
          select: { id: true },
        });
        if (exportJob !== null) {
          const settled = await prisma.outboxEvent.updateMany({
            where: {
              id: event.id,
              attempts: event.attempts,
              status: event.status,
            },
            data: {
              status: "PROCESSED",
              processedAt: new Date(),
              lockedAt: null,
              lockedBy: null,
              lastError: null,
            },
          });
          processed += settled.count;
          continue;
        }
      }
      await prisma.$transaction(async (transaction) => {
        const changed = await transaction.outboxEvent.updateMany({
          where: {
            id: event.id,
            attempts: event.attempts,
            status: event.status,
          },
          data: {
            status: "DEAD_LETTER",
            lockedAt: null,
            lockedBy: null,
            lastError:
              event.lastError ??
              "The worker lease expired after the final permitted attempt",
          },
        });
        if (
          changed.count === 1 &&
          event.eventType === WORKER_EVENT_TYPES.billingScheduleDue
        ) {
          await markBillingScheduleFailed(
            transaction,
            event.organizationId,
            event.aggregateId,
          );
        }
        if (
          changed.count === 1 &&
          event.eventType === WORKER_EVENT_TYPES.exportGenerate
        ) {
          await markExportFailed(
            transaction,
            event.organizationId,
            event.aggregateId,
          );
        }
      });
      continue;
    }
    const claimed = await prisma.outboxEvent.updateMany({
      where: {
        id: event.id,
        attempts: event.attempts,
        ...(event.status === "PROCESSING"
          ? { status: "PROCESSING", lockedAt: event.lockedAt }
          : { status: event.status, availableAt: { lte: now } }),
      },
      data: {
        status: "PROCESSING",
        attempts: { increment: 1 },
        lockedAt: now,
        lockedBy: workerId,
        lastError: null,
      },
    });
    if (claimed.count !== 1) continue;
    try {
      if (event.eventType === WORKER_EVENT_TYPES.exportGenerate) {
        const current = await prisma.outboxEvent.findFirst({
          where: { id: event.id, status: "PROCESSING", lockedBy: workerId },
        });
        if (current === null) continue;
        await generateExport(current);
        const completed = await prisma.outboxEvent.updateMany({
          where: { id: current.id, status: "PROCESSING", lockedBy: workerId },
          data: {
            status: "PROCESSED",
            processedAt: new Date(),
            lockedAt: null,
            lockedBy: null,
            lastError: null,
          },
        });
        if (completed.count !== 1) {
          throw new Error("The outbox lease was lost before completion");
        }
      } else {
        await prisma.$transaction(async (transaction) => {
          const current = await transaction.outboxEvent.findFirst({
            where: { id: event.id, status: "PROCESSING", lockedBy: workerId },
          });
          if (current === null) return;
          await dispatchOutboxEvent(transaction, current);
          const completed = await transaction.outboxEvent.updateMany({
            where: { id: current.id, status: "PROCESSING", lockedBy: workerId },
            data: {
              status: "PROCESSED",
              processedAt: new Date(),
              lockedAt: null,
              lockedBy: null,
              lastError: null,
            },
          });
          if (completed.count !== 1) {
            throw new Error("The outbox lease was lost before completion");
          }
        });
      }
      processed += 1;
    } catch (error) {
      await failClaimedEvent(
        event,
        workerId,
        event.attempts + 1,
        event.maxAttempts,
        error,
      );
    }
  }
  return processed;
}

async function deliverNotificationBatch(): Promise<number> {
  const notifications = await prisma.notification.findMany({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    take: env.WORKER_BATCH_SIZE,
  });
  let delivered = 0;
  for (const notification of notifications) {
    const now = new Date();
    const update =
      notification.channel === "IN_APP"
        ? { status: "SENT" as const, sentAt: now, errorMessage: null }
        : {
            status: "FAILED" as const,
            failedAt: now,
            errorMessage: "Email delivery adapter is not configured",
          };
    const changed = await prisma.notification.updateMany({
      where: { id: notification.id, status: "QUEUED" },
      data: update,
    });
    delivered += changed.count;
  }
  return delivered;
}

async function cleanupExpiredRecords(): Promise<void> {
  const now = new Date();
  await prisma.$transaction([
    prisma.session.updateMany({
      where: { expiresAt: { lte: now }, revokedAt: null },
      data: { revokedAt: now },
    }),
    prisma.refreshToken.updateMany({
      where: { expiresAt: { lte: now }, revokedAt: null },
      data: { revokedAt: now },
    }),
    prisma.portalSession.updateMany({
      where: { expiresAt: { lte: now }, revokedAt: null },
      data: { revokedAt: now },
    }),
    prisma.magicLinkToken.updateMany({
      where: { expiresAt: { lte: now }, revokedAt: null },
      data: { revokedAt: now },
    }),
    prisma.exportArtifact.deleteMany({
      where: {
        exportJob: { status: "COMPLETED", expiresAt: { lte: now } },
      },
    }),
    prisma.exportJob.updateMany({
      where: {
        status: "COMPLETED",
        expiresAt: { lte: now },
      },
      data: { status: "EXPIRED", resultLocation: null },
    }),
    prisma.idempotencyRecord.deleteMany({ where: { expiresAt: { lte: now } } }),
  ]);
}

export interface BackgroundWorker {
  stop(): Promise<void>;
}

export function startBackgroundWorker(): BackgroundWorker {
  const workerId = `dealflow360-${process.pid}-${crypto.randomUUID()}`;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let activeCycle: Promise<void> = Promise.resolve();
  let lastCleanupAt = 0;
  const schedulerState = createSchedulerState();

  const schedule = () => {
    if (stopped) return;
    timer = setTimeout(run, env.WORKER_POLL_INTERVAL_MS);
    timer.unref();
  };
  const run = () => {
    activeCycle = (async () => {
      try {
        await enqueueDueScheduledWork(schedulerState);
        await processOutboxBatch(workerId);
        await settleQueuedNudgeBatch(env.WORKER_BATCH_SIZE);
        await deliverNotificationBatch();
        if (Date.now() - lastCleanupAt >= env.WORKER_CLEANUP_INTERVAL_MS) {
          await cleanupExpiredRecords();
          lastCleanupAt = Date.now();
        }
      } catch (error) {
        console.error("Background worker cycle failed", error);
      } finally {
        schedule();
      }
    })();
  };
  run();

  return {
    async stop() {
      stopped = true;
      if (timer !== null) clearTimeout(timer);
      await activeCycle;
    },
  };
}
