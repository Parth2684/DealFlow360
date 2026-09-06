export const WORKER_EVENT_TYPES = {
  billingScheduleDue: "worker.billing-schedule.due",
  invoiceDue: "worker.invoice.due",
  dealHealthRefresh: "worker.deal-health.refresh",
  approvalReminder: "worker.approval.reminder",
  approvalEscalation: "worker.approval.escalation",
  approvalDelegationExpire: "worker.approval-delegation.expire",
  backorderRecheck: "worker.backorder.recheck",
  exportGenerate: "worker.export.generate",
} as const;

export type WorkerEventType =
  (typeof WORKER_EVENT_TYPES)[keyof typeof WORKER_EVENT_TYPES];

export interface ClaimedOutboxEvent {
  id: string;
  organizationId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Prisma.JsonValue;
}

export function isWorkerEventType(value: string): value is WorkerEventType {
  return (Object.values(WORKER_EVENT_TYPES) as string[]).includes(value);
}
import type { Prisma } from "@repo/db";
