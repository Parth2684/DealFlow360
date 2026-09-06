import { prisma, Prisma } from "@repo/db";

import { env } from "../config/env.js";
import {
  addBillingDays,
  billingDateHasStarted,
  isPastBillingDueDate,
  utcDate,
} from "../modules/billing/periods.js";
import { jsonInput } from "../shared/activity.js";
import { stableFingerprint } from "../shared/security.js";
import { WORKER_EVENT_TYPES } from "./job-events.js";

interface ScanResult {
  cursor: string | null;
  enqueued: number;
}

export interface SchedulerState {
  billingCursor: string | null;
  invoiceCursor: string | null;
  healthCursor: string | null;
  approvalCursor: string | null;
  delegationCursor: string | null;
  backorderCursor: string | null;
  lastBillingAt: number;
  lastInvoiceAt: number;
  lastHealthAt: number;
  lastApprovalAt: number;
  lastDelegationAt: number;
  lastBackorderAt: number;
}

export function createSchedulerState(): SchedulerState {
  return {
    billingCursor: null,
    invoiceCursor: null,
    healthCursor: null,
    approvalCursor: null,
    delegationCursor: null,
    backorderCursor: null,
    lastBillingAt: 0,
    lastInvoiceAt: 0,
    lastHealthAt: 0,
    lastApprovalAt: 0,
    lastDelegationAt: 0,
    lastBackorderAt: 0,
  };
}

async function scanDueInvoices(
  cursor: string | null,
  now: Date,
): Promise<ScanResult> {
  const records = await prisma.invoice.findMany({
    where: {
      status: { in: ["ISSUED", "PARTIALLY_PAID"] },
      balanceDue: { gt: 0 },
      dueDate: { lte: addBillingDays(utcDate(now), 1) },
    },
    orderBy: { id: "asc" },
    ...(cursor === null ? {} : { cursor: { id: cursor }, skip: 1 }),
    take: env.WORKER_BATCH_SIZE,
    select: {
      id: true,
      organizationId: true,
      customerAccountId: true,
      dueDate: true,
      balanceDue: true,
      revision: true,
      organization: { select: { timezone: true } },
    },
  });
  const dueRecords = records.filter((record) => {
    try {
      return isPastBillingDueDate(
        record.dueDate,
        now,
        record.organization.timezone,
      );
    } catch {
      // Enqueue invalid tenant configuration so normal retry/dead-letter
      // handling records the failure without blocking other organizations.
      return true;
    }
  });
  const enqueued = await enqueue(
    dueRecords.map((record) => {
      const stateFingerprint = stableFingerprint({
        invoiceId: record.id,
        dueDate: record.dueDate.toISOString(),
        balanceDue: record.balanceDue.toString(),
        revision: record.revision,
        timezone: record.organization.timezone,
      });
      return {
        organizationId: record.organizationId,
        eventType: WORKER_EVENT_TYPES.invoiceDue,
        aggregateType: "Invoice",
        aggregateId: record.id,
        deduplicationKey: `scheduled:invoice-due:${record.id}:${stateFingerprint.slice(0, 32)}`,
        payload: jsonInput({
          invoiceId: record.id,
          customerAccountId: record.customerAccountId,
          dueDate: record.dueDate,
          expectedBalanceDue: record.balanceDue.toString(),
          expectedRevision: record.revision,
          timezone: record.organization.timezone,
          stateFingerprint,
        }),
        availableAt: now,
      };
    }),
  );
  return {
    cursor: nextCursor(records, env.WORKER_BATCH_SIZE),
    enqueued,
  };
}

function nextCursor(
  records: readonly { id: string }[],
  batchSize: number,
): string | null {
  return records.length === batchSize
    ? (records[records.length - 1]?.id ?? null)
    : null;
}

async function enqueue(
  events: Prisma.OutboxEventCreateManyInput[],
): Promise<number> {
  if (events.length === 0) return 0;
  const created = await prisma.outboxEvent.createMany({
    data: events,
    skipDuplicates: true,
  });
  return created.count;
}

async function scanBillingSchedules(
  cursor: string | null,
  now: Date,
): Promise<ScanResult> {
  const records = await prisma.billingSchedule.findMany({
    where: {
      generationStatus: "PENDING",
      invoiceId: null,
      periodEnd: { lte: addBillingDays(utcDate(now), 1) },
    },
    orderBy: { id: "asc" },
    ...(cursor === null ? {} : { cursor: { id: cursor }, skip: 1 }),
    take: env.WORKER_BATCH_SIZE,
    select: {
      id: true,
      organizationId: true,
      subscriptionId: true,
      periodStart: true,
      periodEnd: true,
      subscription: { select: { timezone: true } },
    },
  });
  const dueRecords = records.filter((record) => {
    try {
      return billingDateHasStarted(
        record.periodEnd,
        now,
        record.subscription.timezone,
      );
    } catch {
      return true;
    }
  });
  const enqueued = await enqueue(
    dueRecords.map((record) => {
      const stateFingerprint = stableFingerprint({
        billingScheduleId: record.id,
        periodStart: record.periodStart.toISOString(),
        periodEnd: record.periodEnd.toISOString(),
        timezone: record.subscription.timezone,
      });
      return {
        organizationId: record.organizationId,
        eventType: WORKER_EVENT_TYPES.billingScheduleDue,
        aggregateType: "BillingSchedule",
        aggregateId: record.id,
        deduplicationKey: `scheduled:billing:${record.id}:${stateFingerprint.slice(0, 32)}`,
        payload: jsonInput({
          billingScheduleId: record.id,
          subscriptionId: record.subscriptionId,
          periodStart: record.periodStart,
          periodEnd: record.periodEnd,
          timezone: record.subscription.timezone,
          stateFingerprint,
        }),
        availableAt: now,
      };
    }),
  );
  return {
    cursor: nextCursor(records, env.WORKER_BATCH_SIZE),
    enqueued,
  };
}

async function scanDealHealth(
  cursor: string | null,
  now: Date,
): Promise<ScanResult> {
  const refreshCutoff = new Date(now.getTime() - env.WORKER_HEALTH_INTERVAL_MS);
  const records = await prisma.quote.findMany({
    where: {
      currentVersionId: { not: null },
      stage: { notIn: ["EXPIRED", "CANCELLED"] },
      dealHealthSnapshots: { none: { calculatedAt: { gt: refreshCutoff } } },
    },
    orderBy: { id: "asc" },
    ...(cursor === null ? {} : { cursor: { id: cursor }, skip: 1 }),
    take: env.WORKER_BATCH_SIZE,
    select: {
      id: true,
      organizationId: true,
      currentVersionId: true,
      dealHealthSnapshots: {
        orderBy: { calculatedAt: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });
  const enqueued = await enqueue(
    records.map((record) => {
      const priorSnapshotId = record.dealHealthSnapshots[0]?.id ?? "initial";
      return {
        organizationId: record.organizationId,
        eventType: WORKER_EVENT_TYPES.dealHealthRefresh,
        aggregateType: "Quote",
        aggregateId: record.id,
        deduplicationKey: `scheduled:health:${record.id}:${priorSnapshotId}`,
        payload: jsonInput({
          quoteId: record.id,
          currentVersionId: record.currentVersionId,
          priorSnapshotId:
            priorSnapshotId === "initial" ? null : priorSnapshotId,
        }),
        availableAt: now,
      };
    }),
  );
  return {
    cursor: nextCursor(records, env.WORKER_BATCH_SIZE),
    enqueued,
  };
}

async function scanApprovalSla(
  cursor: string | null,
  now: Date,
): Promise<ScanResult> {
  const records = await prisma.approvalStep.findMany({
    where: {
      status: "ACTIVE",
      dueAt: { lte: now },
      approvalRequest: { status: { in: ["PENDING", "IN_PROGRESS"] } },
    },
    orderBy: { id: "asc" },
    ...(cursor === null ? {} : { cursor: { id: cursor }, skip: 1 }),
    take: env.WORKER_BATCH_SIZE,
    select: {
      id: true,
      organizationId: true,
      approvalRequestId: true,
      dueAt: true,
    },
  });
  const escalationCutoff = new Date(
    now.getTime() - env.APPROVAL_ESCALATION_AFTER_HOURS * 3_600_000,
  );
  const enqueued = await enqueue(
    records.flatMap((record) => {
      if (record.dueAt === null) return [];
      const escalated = record.dueAt <= escalationCutoff;
      const eventType = escalated
        ? WORKER_EVENT_TYPES.approvalEscalation
        : WORKER_EVENT_TYPES.approvalReminder;
      const level = escalated ? "escalation" : "reminder";
      return [
        {
          organizationId: record.organizationId,
          eventType,
          aggregateType: "ApprovalStep",
          aggregateId: record.id,
          deduplicationKey: `scheduled:approval:${record.id}:${level}:${record.dueAt.toISOString()}`,
          payload: jsonInput({
            approvalStepId: record.id,
            approvalRequestId: record.approvalRequestId,
            dueAt: record.dueAt,
            level,
          }),
          availableAt: now,
        },
      ];
    }),
  );
  return {
    cursor: nextCursor(records, env.WORKER_BATCH_SIZE),
    enqueued,
  };
}

async function scanExpiredApprovalDelegations(
  cursor: string | null,
  now: Date,
): Promise<ScanResult> {
  const records = await prisma.approvalStep.findMany({
    where: {
      status: "ACTIVE",
      delegateId: { not: null },
      delegateExpiresAt: { lte: now },
      approvalRequest: { status: { in: ["PENDING", "IN_PROGRESS"] } },
    },
    orderBy: { id: "asc" },
    ...(cursor === null ? {} : { cursor: { id: cursor }, skip: 1 }),
    take: env.WORKER_BATCH_SIZE,
    select: {
      id: true,
      organizationId: true,
      approvalRequestId: true,
      delegateId: true,
      delegateAssignedAt: true,
      delegateExpiresAt: true,
    },
  });
  const enqueued = await enqueue(
    records.flatMap((record) => {
      if (
        record.delegateId === null ||
        record.delegateAssignedAt === null ||
        record.delegateExpiresAt === null
      ) {
        return [];
      }
      const stateFingerprint = stableFingerprint({
        approvalStepId: record.id,
        delegateId: record.delegateId,
        assignedAt: record.delegateAssignedAt.toISOString(),
        expiresAt: record.delegateExpiresAt.toISOString(),
      });
      return [
        {
          organizationId: record.organizationId,
          eventType: WORKER_EVENT_TYPES.approvalDelegationExpire,
          aggregateType: "ApprovalStep",
          aggregateId: record.id,
          deduplicationKey: `scheduled:approval-delegation:${record.id}:${stateFingerprint.slice(0, 32)}`,
          payload: jsonInput({
            approvalStepId: record.id,
            approvalRequestId: record.approvalRequestId,
            delegateId: record.delegateId,
            assignedAt: record.delegateAssignedAt,
            expiresAt: record.delegateExpiresAt,
            stateFingerprint,
          }),
          availableAt: now,
        },
      ];
    }),
  );
  return {
    cursor: nextCursor(records, env.WORKER_BATCH_SIZE),
    enqueued,
  };
}

async function scanBackorders(
  cursor: string | null,
  now: Date,
): Promise<ScanResult> {
  const records = await prisma.backorder.findMany({
    where: { status: { in: ["OPEN", "PARTIALLY_ALLOCATED"] } },
    orderBy: { id: "asc" },
    ...(cursor === null ? {} : { cursor: { id: cursor }, skip: 1 }),
    take: env.WORKER_BATCH_SIZE,
    select: {
      id: true,
      organizationId: true,
      orderLineId: true,
      remainingQuantity: true,
      updatedAt: true,
      orderLine: { select: { productId: true, variantId: true } },
    },
  });
  if (records.length === 0) return { cursor: null, enqueued: 0 };
  const balances = await prisma.inventoryBalance.findMany({
    where: {
      warehouse: { status: "ACTIVE" },
      OR: records.map((record) => ({
        organizationId: record.organizationId,
        productId: record.orderLine.productId,
        variantId: record.orderLine.variantId,
      })),
    },
    select: {
      id: true,
      organizationId: true,
      productId: true,
      variantId: true,
      revision: true,
      available: true,
    },
    orderBy: { id: "asc" },
  });
  const enqueued = await enqueue(
    records.map((record) => {
      const matchingBalances = balances.filter(
        (balance) =>
          balance.organizationId === record.organizationId &&
          balance.productId === record.orderLine.productId &&
          balance.variantId === record.orderLine.variantId,
      );
      const stateFingerprint = stableFingerprint({
        backorderUpdatedAt: record.updatedAt.toISOString(),
        remainingQuantity: record.remainingQuantity.toString(),
        balances: matchingBalances.map((balance) => ({
          id: balance.id,
          revision: balance.revision,
          available: balance.available.toString(),
        })),
      });
      return {
        organizationId: record.organizationId,
        eventType: WORKER_EVENT_TYPES.backorderRecheck,
        aggregateType: "Backorder",
        aggregateId: record.id,
        deduplicationKey: `scheduled:backorder:${record.id}:${stateFingerprint.slice(0, 32)}`,
        payload: jsonInput({
          backorderId: record.id,
          inventoryStateFingerprint: stateFingerprint,
        }),
        availableAt: now,
      };
    }),
  );
  return {
    cursor: nextCursor(records, env.WORKER_BATCH_SIZE),
    enqueued,
  };
}

async function runScheduledScan(
  name: string,
  task: () => Promise<ScanResult>,
  apply: (result: ScanResult) => void,
): Promise<void> {
  try {
    apply(await task());
  } catch (error) {
    console.error(`Scheduled ${name} scan failed`, error);
  }
}

export async function enqueueDueScheduledWork(
  state: SchedulerState,
  now = new Date(),
): Promise<void> {
  const timestamp = now.getTime();
  if (
    state.billingCursor !== null ||
    timestamp - state.lastBillingAt >= env.WORKER_BILLING_INTERVAL_MS
  ) {
    state.lastBillingAt = timestamp;
    await runScheduledScan(
      "billing",
      () => scanBillingSchedules(state.billingCursor, now),
      (result) => {
        state.billingCursor = result.cursor;
      },
    );
  }
  if (
    state.invoiceCursor !== null ||
    timestamp - state.lastInvoiceAt >= env.WORKER_INVOICE_INTERVAL_MS
  ) {
    state.lastInvoiceAt = timestamp;
    await runScheduledScan(
      "invoice-due",
      () => scanDueInvoices(state.invoiceCursor, now),
      (result) => {
        state.invoiceCursor = result.cursor;
      },
    );
  }
  if (
    state.healthCursor !== null ||
    timestamp - state.lastHealthAt >= env.WORKER_HEALTH_INTERVAL_MS
  ) {
    state.lastHealthAt = timestamp;
    await runScheduledScan(
      "deal-health",
      () => scanDealHealth(state.healthCursor, now),
      (result) => {
        state.healthCursor = result.cursor;
      },
    );
  }
  if (
    state.approvalCursor !== null ||
    timestamp - state.lastApprovalAt >= env.WORKER_APPROVAL_INTERVAL_MS
  ) {
    state.lastApprovalAt = timestamp;
    await runScheduledScan(
      "approval",
      () => scanApprovalSla(state.approvalCursor, now),
      (result) => {
        state.approvalCursor = result.cursor;
      },
    );
  }
  if (
    state.delegationCursor !== null ||
    timestamp - state.lastDelegationAt >= env.WORKER_APPROVAL_INTERVAL_MS
  ) {
    state.lastDelegationAt = timestamp;
    await runScheduledScan(
      "approval-delegation-expiry",
      () => scanExpiredApprovalDelegations(state.delegationCursor, now),
      (result) => {
        state.delegationCursor = result.cursor;
      },
    );
  }
  if (
    state.backorderCursor !== null ||
    timestamp - state.lastBackorderAt >= env.WORKER_BACKORDER_INTERVAL_MS
  ) {
    state.lastBackorderAt = timestamp;
    await runScheduledScan(
      "backorder",
      () => scanBackorders(state.backorderCursor, now),
      (result) => {
        state.backorderCursor = result.cursor;
      },
    );
  }
}
