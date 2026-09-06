import { env } from "../../config/env.js";
import {
  jsonInput,
  recordActivity,
  type TransactionClient,
} from "../../shared/activity.js";
import { WORKER_EVENT_TYPES, type ClaimedOutboxEvent } from "../job-events.js";
import { lockWorkerEntity } from "../locks.js";

const activeAlertStatuses = ["OPEN", "ACKNOWLEDGED", "SNOOZED"] as const;

export async function deliverApprovalSlaSignal(
  transaction: TransactionClient,
  event: ClaimedOutboxEvent,
): Promise<void> {
  await lockWorkerEntity(
    transaction,
    event.organizationId,
    "approval-step",
    event.aggregateId,
  );
  const step = await transaction.approvalStep.findFirst({
    where: { id: event.aggregateId, organizationId: event.organizationId },
    include: {
      approvalRequest: {
        include: {
          quote: {
            select: {
              id: true,
              quoteNumber: true,
              ownerId: true,
              salesTeamId: true,
              salesTeam: { select: { managerId: true } },
            },
          },
        },
      },
    },
  });
  const now = new Date();
  if (
    step === null ||
    step.status !== "ACTIVE" ||
    step.dueAt === null ||
    step.dueAt > now ||
    !["PENDING", "IN_PROGRESS"].includes(step.approvalRequest.status)
  ) {
    return;
  }

  const overdueHours = Math.max(
    0,
    Math.floor((now.getTime() - step.dueAt.getTime()) / 3_600_000),
  );
  const escalated = event.eventType === WORKER_EVENT_TYPES.approvalEscalation;
  if (escalated && overdueHours < env.APPROVAL_ESCALATION_AFTER_HOURS) {
    throw new Error(
      "The approval escalation was dispatched before its threshold",
    );
  }
  const quote = step.approvalRequest.quote;
  await lockWorkerEntity(
    transaction,
    event.organizationId,
    "deal-health",
    quote.id,
  );
  const severity = escalated ? ("CRITICAL" as const) : ("WARNING" as const);
  const title = escalated
    ? "Approval SLA escalated"
    : "Approval decision is due";
  const message = escalated
    ? `Approval step ${step.sequence} is ${overdueHours} hours overdue and requires escalation`
    : `Approval step ${step.sequence} has reached its SLA due time`;
  const facts = jsonInput({
    approvalRequestId: step.approvalRequestId,
    approvalStepId: step.id,
    sequence: step.sequence,
    dueAt: step.dueAt,
    overdueHours,
    escalationThresholdHours: env.APPROVAL_ESCALATION_AFTER_HOURS,
    requiredRole: step.requiredRole,
    requiredCapability: step.requiredCapability,
  });
  const existingAlert = await transaction.alert.findFirst({
    where: {
      organizationId: event.organizationId,
      quoteId: quote.id,
      type: "APPROVAL_SLA",
      reasonCode: "APPROVAL_OVERDUE",
      status: { in: [...activeAlertStatuses] },
    },
  });
  let alertId: string;
  let alertWasCreated = false;
  if (existingAlert === null) {
    const alert = await transaction.alert.create({
      data: {
        organizationId: event.organizationId,
        quoteId: quote.id,
        type: "APPROVAL_SLA",
        severity,
        status: "OPEN",
        reasonCode: "APPROVAL_OVERDUE",
        title,
        message,
        facts,
      },
    });
    alertId = alert.id;
    alertWasCreated = true;
    await recordActivity(transaction, {
      organizationId: event.organizationId,
      eventType: "alert.created",
      entityType: "Alert",
      entityId: alert.id,
      entityVersion: alert.revision,
      quoteId: quote.id,
      title,
      message,
      metadata: {
        approvalRequestId: step.approvalRequestId,
        approvalStepId: step.id,
      },
    });
  } else {
    alertId = existingAlert.id;
    await transaction.alert.update({
      where: { id: existingAlert.id },
      data: {
        severity,
        title,
        message,
        facts,
        status:
          existingAlert.status === "SNOOZED" &&
          (existingAlert.snoozedUntil === null ||
            existingAlert.snoozedUntil <= now)
            ? "OPEN"
            : existingAlert.status,
        resolvedAt: null,
        revision: { increment: 1 },
      },
    });
  }

  const recipientIds = new Set<string>();
  if (step.assigneeId !== null) recipientIds.add(step.assigneeId);
  if (
    step.delegateId !== null &&
    step.delegateAssignedAt !== null &&
    step.delegateAssignedAt <= now &&
    step.delegateExpiresAt !== null &&
    step.delegateExpiresAt > now &&
    step.delegateAssignedById !== null &&
    step.delegateReason !== null
  ) {
    recipientIds.add(step.delegateId);
  }
  if (escalated) {
    if (
      quote.salesTeam?.managerId !== null &&
      quote.salesTeam?.managerId !== undefined
    ) {
      recipientIds.add(quote.salesTeam.managerId);
    }
    const authorities = await transaction.roleAssignment.findMany({
      where: {
        organizationId: event.organizationId,
        active: true,
        role: { in: ["ADMIN", "SALES_MANAGER"] },
        user: { organizationId: event.organizationId, status: "ACTIVE" },
      },
      select: { userId: true, role: true, salesTeamId: true },
      take: 50,
    });
    for (const authority of authorities) {
      if (
        authority.role === "ADMIN" ||
        authority.salesTeamId === null ||
        authority.salesTeamId === quote.salesTeamId
      ) {
        recipientIds.add(authority.userId);
      }
    }
  }
  if (!alertWasCreated) recipientIds.add(quote.ownerId);
  if (alertWasCreated) recipientIds.delete(quote.ownerId);
  if (recipientIds.size > 0) {
    await transaction.notification.createMany({
      data: [...recipientIds].map((recipientUserId) => ({
        organizationId: event.organizationId,
        recipientUserId,
        channel: "IN_APP" as const,
        type: escalated ? "APPROVAL_SLA_ESCALATED" : "APPROVAL_SLA_REMINDER",
        title,
        body: message,
        data: jsonInput({
          alertId,
          quoteId: quote.id,
          approvalRequestId: step.approvalRequestId,
          approvalStepId: step.id,
          overdueHours,
        }),
        status: "QUEUED" as const,
      })),
    });
  }
}

export async function expireApprovalDelegation(
  transaction: TransactionClient,
  event: ClaimedOutboxEvent,
): Promise<void> {
  await lockWorkerEntity(
    transaction,
    event.organizationId,
    "approval-step",
    event.aggregateId,
  );
  const step = await transaction.approvalStep.findFirst({
    where: { id: event.aggregateId, organizationId: event.organizationId },
    include: {
      delegate: true,
      approvalRequest: {
        include: {
          quote: { select: { id: true, quoteNumber: true } },
          quoteVersion: { select: { revisionNumber: true } },
        },
      },
    },
  });
  const expiredAt = new Date();
  if (
    step === null ||
    step.status !== "ACTIVE" ||
    step.delegateId === null ||
    step.delegateAssignedAt === null ||
    step.delegateExpiresAt === null ||
    step.delegateExpiresAt > expiredAt ||
    !["PENDING", "IN_PROGRESS"].includes(step.approvalRequest.status)
  ) {
    return;
  }
  const changed = await transaction.approvalStep.updateMany({
    where: {
      id: step.id,
      organizationId: event.organizationId,
      status: "ACTIVE",
      delegateId: step.delegateId,
      delegateAssignedAt: step.delegateAssignedAt,
      delegateExpiresAt: step.delegateExpiresAt,
    },
    data: {
      delegateId: null,
      delegateAssignedAt: null,
      delegateExpiresAt: null,
      delegateAssignedById: null,
      delegateReason: null,
    },
  });
  if (changed.count !== 1) {
    throw new Error("The approval delegation changed while it was expiring");
  }
  await transaction.approvalRequest.update({
    where: { id: step.approvalRequestId },
    data: { updatedAt: expiredAt },
  });
  const recipients = new Set(
    [step.assigneeId, step.delegateId].filter(
      (value): value is string => value !== null,
    ),
  );
  if (recipients.size > 0) {
    await transaction.notification.createMany({
      data: [...recipients].map((recipientUserId) => ({
        organizationId: event.organizationId,
        recipientUserId,
        channel: "IN_APP" as const,
        type: "APPROVAL_DELEGATION_EXPIRED",
        title: `Approval delegation expired for ${step.approvalRequest.quote.quoteNumber}`,
        body: `The temporary delegate for approval step ${step.sequence} has expired.`,
        data: jsonInput({
          approvalRequestId: step.approvalRequestId,
          approvalStepId: step.id,
          quoteId: step.approvalRequest.quote.id,
          expiredAt,
        }),
        status: "QUEUED" as const,
      })),
    });
  }
  await recordActivity(transaction, {
    organizationId: event.organizationId,
    eventType: "approval.delegation.expired",
    entityType: "ApprovalStep",
    entityId: step.id,
    entityVersion: step.approvalRequest.quoteVersion.revisionNumber,
    quoteId: step.approvalRequest.quote.id,
    title: "Approval delegation expired",
    reason: step.delegateReason ?? undefined,
    before: {
      delegateId: step.delegateId,
      delegateEmail: step.delegate?.email,
      assignedAt: step.delegateAssignedAt,
      expiresAt: step.delegateExpiresAt,
      assignedById: step.delegateAssignedById,
    },
    after: { delegateId: null, expiredAt },
    metadata: {
      approvalRequestId: step.approvalRequestId,
      scheduledEventId: event.id,
    },
  });
}
