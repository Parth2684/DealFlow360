import { Router, type Request, type Response } from "express";

import {
  AssignApprovalDelegateRequestSchema,
  ApprovalDecisionRequestSchema,
  ApprovalInboxQuerySchema,
  ApprovalRequestDtoSchema,
  ApprovalRouteStepDtoSchema,
  ApproveApprovalRequestSchema,
  ClearApprovalDelegateRequestSchema,
  RejectApprovalRequestSchema,
  RequestRevisionApprovalRequestSchema,
  hasCapability,
  type ApprovalDecisionAction,
} from "@repo/common";
import { prisma, Prisma } from "@repo/db";

import {
  authenticateInternal,
  internalPrincipal,
  requireCapability,
  requireCsrf,
} from "../../middleware/auth.js";
import {
  jsonInput,
  recordActivity,
  type TransactionClient,
} from "../../shared/activity.js";
import {
  approvalAuthority,
  principalCanActForApproval,
} from "../../shared/approval-authority.js";
import { conflict, forbidden, notFound } from "../../shared/errors.js";
import {
  cursorArgs,
  pageFromRows,
  parseBody,
  parsePathId,
  parseQuery,
  toJsonValue,
} from "../../shared/http.js";
import type { InternalPrincipal } from "../../shared/types.js";
import { mapQuoteSummary, quoteInclude } from "../quotations/mappers.js";
import { hasOrganizationWideQuoteAccess } from "../quotations/service.js";

const approvalInclude = {
  quote: { include: quoteInclude },
  quoteVersion: true,
  policyMatches: {
    include: { approvalPolicy: true },
    orderBy: { createdAt: "asc" },
  },
  steps: {
    include: {
      assignee: true,
      delegate: true,
      delegateAssignedBy: true,
      approvalStepTemplate: true,
      decisions: { include: { actor: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { sequence: "asc" },
  },
} satisfies Prisma.ApprovalRequestInclude;

type ApprovalRecord = Prisma.ApprovalRequestGetPayload<{
  include: typeof approvalInclude;
}>;

function jsonObject(value: unknown): Record<string, unknown> {
  const converted = toJsonValue(value);
  return converted !== null &&
    typeof converted === "object" &&
    !Array.isArray(converted)
    ? (converted as Record<string, unknown>)
    : {};
}

function decisionExplanations(value: unknown): string[] {
  const object = jsonObject(value);
  const reasons = object["reasons"];
  if (Array.isArray(reasons)) {
    return reasons.filter(
      (reason): reason is string => typeof reason === "string",
    );
  }
  return Object.values(object).filter(
    (reason): reason is string => typeof reason === "string",
  );
}

function requiredRoute(record: ApprovalRecord) {
  const parsed = ApprovalRouteStepDtoSchema.array().safeParse(
    toJsonValue(record.requiredRoute),
  );
  if (parsed.success) return parsed.data;
  return record.steps.map((step) => ({
    sequence: step.sequence,
    role: step.requiredRole,
    capability: step.requiredCapability,
    reason: `Required by the ${step.requiredRole.toLowerCase().replaceAll("_", " ")} approval step`,
  }));
}

function mapApproval(record: ApprovalRecord) {
  const currentFingerprint =
    record.quote.currentVersion?.termsFingerprint ?? record.termsFingerprint;
  return ApprovalRequestDtoSchema.parse({
    id: record.id,
    quoteId: record.quoteId,
    quoteVersionId: record.quoteVersionId,
    quote: mapQuoteSummary(record.quote),
    termsFingerprint: record.termsFingerprint,
    currentTermsFingerprint: currentFingerprint,
    termsChanged:
      record.quote.currentVersionId !== record.quoteVersionId ||
      currentFingerprint !== record.termsFingerprint,
    status: record.status,
    currentSequence: record.currentSequence,
    requiredRoute: requiredRoute(record),
    decisionExplanation: decisionExplanations(record.decisionExplanation),
    policyMatches: record.policyMatches.map((match) => ({
      policyId: match.approvalPolicyId,
      policyCode: match.approvalPolicy.code,
      policyName: match.approvalPolicy.name,
      policyVersion: match.policyVersion,
      matchedFacts: jsonObject(match.matchedFacts),
      reason: match.reason,
    })),
    steps: record.steps.map((step) => ({
      id: step.id,
      sequence: step.sequence,
      requiredCapability: step.requiredCapability,
      requiredRole: step.requiredRole,
      assignee:
        step.assignee === null
          ? null
          : {
              id: step.assignee.id,
              name: `${step.assignee.firstName} ${step.assignee.lastName}`,
            },
      delegate:
        step.delegate === null ||
        step.delegateAssignedAt === null ||
        step.delegateExpiresAt === null ||
        step.delegateAssignedBy === null ||
        step.delegateReason === null
          ? null
          : {
              id: step.delegate.id,
              name: `${step.delegate.firstName} ${step.delegate.lastName}`,
              email: step.delegate.email,
              assignedAt: step.delegateAssignedAt.toISOString(),
              expiresAt: step.delegateExpiresAt.toISOString(),
              assignedBy: {
                id: step.delegateAssignedBy.id,
                name: `${step.delegateAssignedBy.firstName} ${step.delegateAssignedBy.lastName}`,
              },
              reason: step.delegateReason,
            },
      status: step.status,
      dueAt: step.dueAt?.toISOString() ?? null,
      activatedAt: step.activatedAt?.toISOString() ?? null,
      completedAt: step.completedAt?.toISOString() ?? null,
      decisions: step.decisions.map((decision) => ({
        id: decision.id,
        approvalStepId: decision.approvalStepId,
        actorId: decision.actorId,
        actorName: `${decision.actor.firstName} ${decision.actor.lastName}`,
        action: decision.action,
        reason: decision.reason,
        createdAt: decision.createdAt.toISOString(),
      })),
    })),
    requestedAt: record.requestedAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
    updatedAt: record.updatedAt.toISOString(),
  });
}

function mayReadApproval(
  principal: InternalPrincipal,
  request: ApprovalRecord,
): boolean {
  if (hasOrganizationWideQuoteAccess(principal)) return true;
  if (!principal.roles.includes("SALES_REP")) return false;
  return (
    request.quote.ownerId === principal.userId ||
    (request.quote.salesTeamId !== null &&
      principal.salesTeamIds.includes(request.quote.salesTeamId))
  );
}

type ApprovalStepRecord = ApprovalRecord["steps"][number];

function assertApprovalCanBeDelegated(
  principal: InternalPrincipal,
  approval: ApprovalRecord,
  step: ApprovalStepRecord,
) {
  if (!mayReadApproval(principal, approval)) notFound("Approval request");
  if (
    approval.quote.currentVersionId !== approval.quoteVersionId ||
    approval.quote.currentVersion?.termsFingerprint !==
      approval.termsFingerprint
  ) {
    conflict(
      "The approval terms changed before delegation was updated",
      "TERMS_CHANGED",
    );
  }
  if (
    !["PENDING", "IN_PROGRESS"].includes(approval.status) ||
    step.status !== "ACTIVE" ||
    approval.currentSequence !== step.sequence
  ) {
    conflict(
      "Only the active step of an open approval can be delegated",
      "APPROVAL_STEP_NOT_ACTIVE",
    );
  }
  const authority = approvalAuthority(
    step.requiredRole,
    step.requiredCapability,
  );
  if (authority === null) {
    conflict(
      "The active approval step has an invalid role/capability authority",
      "INVALID_APPROVAL_POLICY",
    );
  }
  if (!principalCanActForApproval(principal, authority)) {
    forbidden(
      `The ${authority.requiredRole} role and ${authority.requiredCapability} capability are required to manage this delegation`,
    );
  }
  return authority;
}

async function eligibleDelegate(
  transaction: TransactionClient,
  approval: ApprovalRecord,
  step: ApprovalStepRecord,
  delegateEmail: string,
) {
  const authority = approvalAuthority(
    step.requiredRole,
    step.requiredCapability,
  );
  if (authority === null) {
    conflict(
      "The approval step cannot be delegated",
      "INVALID_APPROVAL_POLICY",
    );
  }
  const delegate = await transaction.user.findFirst({
    where: {
      organizationId: approval.organizationId,
      email: delegateEmail,
      status: "ACTIVE",
    },
    include: {
      roleAssignments: {
        where: { active: true, organizationId: approval.organizationId },
      },
    },
  });
  if (delegate === null) {
    conflict(
      "The delegate is not an active eligible user in this organization",
      "DELEGATE_NOT_ELIGIBLE",
    );
  }
  const roles = [...new Set(delegate.roleAssignments.map((item) => item.role))];
  const hasScopedRole = delegate.roleAssignments.some(
    (assignment) =>
      assignment.role === "ADMIN" ||
      (assignment.role === authority.requiredRole &&
        (authority.requiredRole !== "SALES_MANAGER" ||
          approval.quote.salesTeamId === null ||
          assignment.salesTeamId === null ||
          assignment.salesTeamId === approval.quote.salesTeamId)),
  );
  if (!hasScopedRole || !hasCapability(roles, authority.requiredCapability)) {
    conflict(
      "The delegate does not hold the step's required role and capability",
      "DELEGATE_NOT_ELIGIBLE",
    );
  }
  if (delegate.id === step.assigneeId) {
    conflict(
      "The assigned approver cannot also be their own delegate",
      "DELEGATE_MATCHES_ASSIGNEE",
    );
  }
  if (delegate.id === approval.quoteVersion.createdById) {
    conflict(
      "The quote author cannot be delegated approval authority for their own terms",
      "DELEGATE_ROLE_SEPARATION",
    );
  }
  if (
    approval.steps.some((candidate) =>
      candidate.decisions.some((decision) => decision.actorId === delegate.id),
    )
  ) {
    conflict(
      "A prior decision-maker cannot be delegated another step in this approval chain",
      "DELEGATE_ROLE_SEPARATION",
    );
  }
  return delegate;
}

async function reloadApproval(
  transaction: TransactionClient,
  approvalId: string,
): Promise<ApprovalRecord> {
  const approval = await transaction.approvalRequest.findUnique({
    where: { id: approvalId },
    include: approvalInclude,
  });
  if (approval === null) notFound("Approval request");
  return approval;
}

async function assignApprovalDelegate(
  principal: InternalPrincipal,
  requestId: string,
  stepId: string,
  input: {
    delegateEmail: string;
    expiresAt: string;
    reason: string;
  },
): Promise<ApprovalRecord> {
  return prisma.$transaction(async (transaction) => {
    const approval = await transaction.approvalRequest.findFirst({
      where: { id: requestId, organizationId: principal.organizationId },
      include: approvalInclude,
    });
    if (approval === null) notFound("Approval request");
    const step = approval.steps.find((candidate) => candidate.id === stepId);
    if (step === undefined) notFound("Approval step");
    assertApprovalCanBeDelegated(principal, approval, step);
    const now = new Date();
    const expiresAt = new Date(input.expiresAt);
    if (expiresAt <= now) {
      conflict(
        "The delegation expiry must be in the future",
        "DELEGATION_EXPIRY_INVALID",
      );
    }
    const delegate = await eligibleDelegate(
      transaction,
      approval,
      step,
      input.delegateEmail,
    );
    if (
      step.delegateId === delegate.id &&
      step.delegateExpiresAt?.getTime() === expiresAt.getTime() &&
      step.delegateReason === input.reason
    ) {
      return approval;
    }
    const changed = await transaction.approvalStep.updateMany({
      where: {
        id: step.id,
        organizationId: principal.organizationId,
        approvalRequestId: approval.id,
        status: "ACTIVE",
        delegateId: step.delegateId,
        delegateAssignedAt: step.delegateAssignedAt,
        delegateExpiresAt: step.delegateExpiresAt,
      },
      data: {
        delegateId: delegate.id,
        delegateAssignedAt: now,
        delegateExpiresAt: expiresAt,
        delegateAssignedById: principal.userId,
        delegateReason: input.reason,
      },
    });
    if (changed.count !== 1) {
      conflict(
        "The delegation changed while this request was being applied",
        "DELEGATION_CONFLICT",
      );
    }
    await transaction.approvalRequest.update({
      where: { id: approval.id },
      data: { updatedAt: now },
    });
    await transaction.notification.create({
      data: {
        organizationId: principal.organizationId,
        recipientUserId: delegate.id,
        channel: "IN_APP",
        type: "APPROVAL_DELEGATED",
        title: `Approval delegated for ${approval.quote.quoteNumber}`,
        body: `You can act on approval step ${step.sequence} until ${expiresAt.toISOString()}.`,
        data: jsonInput({
          approvalRequestId: approval.id,
          approvalStepId: step.id,
          quoteId: approval.quoteId,
          expiresAt,
        }),
      },
    });
    await recordActivity(transaction, {
      organizationId: principal.organizationId,
      actor: principal,
      eventType: "approval.delegated",
      entityType: "ApprovalStep",
      entityId: step.id,
      entityVersion: approval.quoteVersion.revisionNumber,
      quoteId: approval.quoteId,
      title: "Approval delegated",
      reason: input.reason,
      before: {
        delegateId: step.delegateId,
        expiresAt: step.delegateExpiresAt,
      },
      after: { delegateId: delegate.id, expiresAt },
      metadata: {
        approvalRequestId: approval.id,
        assignedById: principal.userId,
      },
    });
    return reloadApproval(transaction, approval.id);
  });
}

async function clearApprovalDelegate(
  principal: InternalPrincipal,
  requestId: string,
  stepId: string,
  reason: string,
): Promise<ApprovalRecord> {
  return prisma.$transaction(async (transaction) => {
    const approval = await transaction.approvalRequest.findFirst({
      where: { id: requestId, organizationId: principal.organizationId },
      include: approvalInclude,
    });
    if (approval === null) notFound("Approval request");
    const step = approval.steps.find((candidate) => candidate.id === stepId);
    if (step === undefined) notFound("Approval step");
    assertApprovalCanBeDelegated(principal, approval, step);
    if (step.delegateId === null) return approval;
    const clearedAt = new Date();
    const changed = await transaction.approvalStep.updateMany({
      where: {
        id: step.id,
        organizationId: principal.organizationId,
        approvalRequestId: approval.id,
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
      conflict(
        "The delegation changed while this request was being applied",
        "DELEGATION_CONFLICT",
      );
    }
    await transaction.approvalRequest.update({
      where: { id: approval.id },
      data: { updatedAt: clearedAt },
    });
    const recipients = new Set(
      [step.assigneeId, step.delegateId].filter(
        (value): value is string => value !== null,
      ),
    );
    if (recipients.size > 0) {
      await transaction.notification.createMany({
        data: [...recipients].map((recipientUserId) => ({
          organizationId: principal.organizationId,
          recipientUserId,
          channel: "IN_APP" as const,
          type: "APPROVAL_DELEGATION_CLEARED",
          title: `Approval delegation cleared for ${approval.quote.quoteNumber}`,
          body: `The temporary delegate for approval step ${step.sequence} was cleared.`,
          data: jsonInput({
            approvalRequestId: approval.id,
            approvalStepId: step.id,
            quoteId: approval.quoteId,
          }),
        })),
      });
    }
    await recordActivity(transaction, {
      organizationId: principal.organizationId,
      actor: principal,
      eventType: "approval.delegation.cleared",
      entityType: "ApprovalStep",
      entityId: step.id,
      entityVersion: approval.quoteVersion.revisionNumber,
      quoteId: approval.quoteId,
      title: "Approval delegation cleared",
      reason,
      before: {
        delegateId: step.delegateId,
        assignedAt: step.delegateAssignedAt,
        expiresAt: step.delegateExpiresAt,
        assignedById: step.delegateAssignedById,
        reason: step.delegateReason,
      },
      after: { delegateId: null },
      metadata: { approvalRequestId: approval.id },
    });
    return reloadApproval(transaction, approval.id);
  });
}

async function decide(
  principal: InternalPrincipal,
  requestId: string,
  action: ApprovalDecisionAction,
  comment: string | undefined,
): Promise<ApprovalRecord> {
  const result = await prisma.$transaction(async (transaction) => {
    const approval = await transaction.approvalRequest.findFirst({
      where: { id: requestId, organizationId: principal.organizationId },
      include: approvalInclude,
    });
    if (approval === null) notFound("Approval request");
    if (!mayReadApproval(principal, approval)) notFound("Approval request");
    const currentFingerprint = approval.quote.currentVersion?.termsFingerprint;
    if (
      approval.quote.currentVersionId !== approval.quoteVersionId ||
      currentFingerprint !== approval.termsFingerprint
    ) {
      await transaction.approvalStep.updateMany({
        where: {
          organizationId: principal.organizationId,
          approvalRequestId: approval.id,
          status: { in: ["WAITING", "ACTIVE"] },
        },
        data: { status: "SUPERSEDED", completedAt: new Date() },
      });
      await transaction.approvalRequest.update({
        where: { id: approval.id },
        data: {
          status: "SUPERSEDED",
          currentSequence: null,
          completedAt: new Date(),
        },
      });
      await recordActivity(transaction, {
        organizationId: principal.organizationId,
        actor: principal,
        eventType: "approval.superseded",
        entityType: "ApprovalRequest",
        entityId: approval.id,
        entityVersion: approval.quoteVersion.revisionNumber,
        termsFingerprint: approval.termsFingerprint,
        quoteId: approval.quoteId,
        title: "Approval invalidated by changed terms",
      });
      return { stale: true as const };
    }
    if (approval.status !== "IN_PROGRESS" && approval.status !== "PENDING") {
      conflict(
        `This approval request is ${approval.status}`,
        "APPROVAL_CLOSED",
      );
    }
    const step = approval.steps.find(
      (candidate) =>
        candidate.sequence === approval.currentSequence &&
        candidate.status === "ACTIVE",
    );
    if (step === undefined)
      conflict("The approval request has no active step", "NO_ACTIVE_STEP");
    const authority = approvalAuthority(
      step.requiredRole,
      step.requiredCapability,
    );
    if (authority === null) {
      conflict(
        "The active approval step has an invalid role/capability authority",
        "INVALID_APPROVAL_POLICY",
      );
    }
    if (!principalCanActForApproval(principal, authority)) {
      forbidden(
        `The ${authority.requiredRole} role and ${authority.requiredCapability} capability are required`,
      );
    }
    const decisionAt = new Date();
    const isUnexpiredDelegate =
      step.delegateId === principal.userId &&
      step.delegateAssignedAt !== null &&
      step.delegateAssignedAt <= decisionAt &&
      step.delegateExpiresAt !== null &&
      step.delegateExpiresAt > decisionAt &&
      step.delegateAssignedById !== null &&
      step.delegateReason !== null;
    if (
      step.assigneeId !== null &&
      step.assigneeId !== principal.userId &&
      !isUnexpiredDelegate
    ) {
      forbidden("This approval step is assigned to another user");
    }
    if (approval.quoteVersion.createdById === principal.userId) {
      forbidden("A quote author cannot approve their own commercial terms");
    }
    if (
      approval.steps.some((candidate) =>
        candidate.decisions.some(
          (decision) => decision.actorId === principal.userId,
        ),
      )
    ) {
      forbidden(
        "One person cannot act at more than one step in the same approval chain",
      );
    }
    const claimed = await transaction.approvalStep.updateMany({
      where: {
        id: step.id,
        organizationId: principal.organizationId,
        status: "ACTIVE",
      },
      data: {
        status:
          action === "APPROVE"
            ? "APPROVED"
            : action === "REJECT"
              ? "REJECTED"
              : "REVISION_REQUIRED",
        completedAt: new Date(),
      },
    });
    if (claimed.count !== 1)
      conflict("Another decision already closed this step", "DECISION_RACE");
    await transaction.approvalDecision.create({
      data: {
        organizationId: principal.organizationId,
        approvalRequestId: approval.id,
        approvalStepId: step.id,
        actorId: principal.userId,
        action,
        reason: comment,
      },
    });

    if (action === "APPROVE") {
      const next = approval.steps.find(
        (candidate) =>
          candidate.sequence > step.sequence && candidate.status === "WAITING",
      );
      if (next !== undefined) {
        const dueAfterHours = next.approvalStepTemplate?.dueAfterHours;
        const activatedAt = new Date();
        await transaction.approvalStep.update({
          where: { id: next.id },
          data: {
            status: "ACTIVE",
            activatedAt,
            dueAt:
              dueAfterHours === null || dueAfterHours === undefined
                ? null
                : new Date(activatedAt.getTime() + dueAfterHours * 3_600_000),
          },
        });
        await transaction.approvalRequest.update({
          where: { id: approval.id },
          data: { status: "IN_PROGRESS", currentSequence: next.sequence },
        });
        if (next.assigneeId !== null) {
          await transaction.notification.create({
            data: {
              organizationId: principal.organizationId,
              recipientUserId: next.assigneeId,
              channel: "IN_APP",
              type: "APPROVAL_STEP_ACTIVATED",
              title: `Approval needed for ${approval.quote.quoteNumber}`,
              body: "The next approval step is ready for your decision.",
              data: jsonInput({
                approvalRequestId: approval.id,
                quoteId: approval.quoteId,
              }),
            },
          });
        }
      } else {
        const accepted = await transaction.customerAcceptance.findFirst({
          where: {
            organizationId: principal.organizationId,
            quoteVersionId: approval.quoteVersionId,
            acceptedFingerprint: approval.termsFingerprint,
          },
          select: { id: true },
        });
        await transaction.approvalRequest.update({
          where: { id: approval.id },
          data: {
            status: "APPROVED",
            currentSequence: null,
            completedAt: new Date(),
          },
        });
        await transaction.quoteVersion.update({
          where: { id: approval.quoteVersionId },
          data: {
            status: accepted === null ? "APPROVED" : "CUSTOMER_ACCEPTED",
          },
        });
        const quoteUpdated = await transaction.quote.updateMany({
          where: {
            id: approval.quoteId,
            organizationId: principal.organizationId,
            currentVersionId: approval.quoteVersionId,
          },
          data: {
            stage: accepted === null ? "READY_TO_SEND" : "CUSTOMER_ACCEPTED",
            revision: { increment: 1 },
          },
        });
        if (quoteUpdated.count !== 1)
          conflict("The quote changed during approval", "TERMS_CHANGED");
      }
    } else {
      await transaction.approvalStep.updateMany({
        where: {
          organizationId: principal.organizationId,
          approvalRequestId: approval.id,
          status: "WAITING",
        },
        data: { status: "SKIPPED", completedAt: new Date() },
      });
      const requestStatus =
        action === "REJECT" ? "REJECTED" : "REVISION_REQUIRED";
      await transaction.approvalRequest.update({
        where: { id: approval.id },
        data: {
          status: requestStatus,
          currentSequence: null,
          completedAt: new Date(),
        },
      });
      await transaction.quoteVersion.update({
        where: { id: approval.quoteVersionId },
        data: {
          status: action === "REJECT" ? "REJECTED" : "REVISION_REQUIRED",
        },
      });
      const quoteUpdated = await transaction.quote.updateMany({
        where: {
          id: approval.quoteId,
          organizationId: principal.organizationId,
          currentVersionId: approval.quoteVersionId,
        },
        data: { stage: "REVISION_REQUIRED", revision: { increment: 1 } },
      });
      if (quoteUpdated.count !== 1)
        conflict("The quote changed during approval", "TERMS_CHANGED");
    }
    await recordActivity(transaction, {
      organizationId: principal.organizationId,
      actor: principal,
      eventType: "approval.completed",
      entityType: "ApprovalDecision",
      entityId: step.id,
      entityVersion: approval.quoteVersion.revisionNumber,
      termsFingerprint: approval.termsFingerprint,
      reason: comment,
      metadata: { action, sequence: step.sequence },
      quoteId: approval.quoteId,
      title: `${step.requiredRole.toLowerCase().replaceAll("_", " ")} ${action.toLowerCase().replaceAll("_", " ")}`,
      message: comment,
    });
    const updated = await transaction.approvalRequest.findUnique({
      where: { id: approval.id },
      include: approvalInclude,
    });
    if (updated === null) notFound("Approval request");
    return { stale: false as const, approval: updated };
  });
  if (result.stale) {
    conflict(
      "The approved commercial terms changed; this request was superseded",
      "TERMS_CHANGED",
    );
  }
  return result.approval;
}

export function createApprovalRouter(): Router {
  const router = Router();

  const listApprovals = async (request: Request, response: Response) => {
    const principal = internalPrincipal(response);
    const query = parseQuery(ApprovalInboxQuerySchema, request);
    const now = new Date();
    const queueWhere: Prisma.ApprovalRequestWhereInput =
      query.queue === "manager" || query.queue === "finance"
        ? {
            status: { in: ["PENDING", "IN_PROGRESS"] },
            steps: {
              some: {
                status: "ACTIVE",
                requiredRole:
                  query.queue === "manager" ? "SALES_MANAGER" : "FINANCE",
              },
            },
          }
        : query.queue === "completed"
          ? {
              status: {
                in: ["APPROVED", "REJECTED", "REVISION_REQUIRED", "SUPERSEDED"],
              },
            }
          : query.queue === "overdue"
            ? {
                status: { in: ["PENDING", "IN_PROGRESS"] },
                steps: { some: { status: "ACTIVE", dueAt: { lt: now } } },
              }
            : {};
    const rows = await prisma.approvalRequest.findMany({
      where: {
        organizationId: principal.organizationId,
        AND: [queueWhere],
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(query.overdueOnly
          ? { steps: { some: { status: "ACTIVE", dueAt: { lt: now } } } }
          : {}),
        ...(!hasOrganizationWideQuoteAccess(principal)
          ? {
              quote: {
                OR: [
                  { ownerId: principal.userId },
                  ...(principal.salesTeamIds.length === 0
                    ? []
                    : [{ salesTeamId: { in: principal.salesTeamIds } }]),
                ],
              },
            }
          : {}),
      },
      include: approvalInclude,
      orderBy: [{ requestedAt: "desc" }, { id: "desc" }],
      ...cursorArgs(query.cursor, query.limit),
    });
    response.json(pageFromRows(rows.map(mapApproval), query.limit));
  };

  router.get(
    "/approvals",
    authenticateInternal,
    requireCapability("approval.read"),
    listApprovals,
  );
  router.get(
    "/approvals/inbox",
    authenticateInternal,
    requireCapability("approval.read"),
    listApprovals,
  );

  router.get(
    "/approvals/:requestId",
    authenticateInternal,
    requireCapability("approval.read"),
    async (request, response) => {
      const principal = internalPrincipal(response);
      const approval = await prisma.approvalRequest.findFirst({
        where: {
          id: parsePathId(request, "requestId"),
          organizationId: principal.organizationId,
        },
        include: approvalInclude,
      });
      if (approval === null || !mayReadApproval(principal, approval))
        notFound("Approval request");
      response.json(mapApproval(approval));
    },
  );

  router.put(
    "/approvals/:requestId/steps/:stepId/delegate",
    authenticateInternal,
    requireCapability("approval.read"),
    requireCsrf,
    async (request, response) => {
      const principal = internalPrincipal(response);
      const input = parseBody(AssignApprovalDelegateRequestSchema, request);
      const approval = await assignApprovalDelegate(
        principal,
        parsePathId(request, "requestId"),
        parsePathId(request, "stepId"),
        input,
      );
      response.json(mapApproval(approval));
    },
  );

  router.delete(
    "/approvals/:requestId/steps/:stepId/delegate",
    authenticateInternal,
    requireCapability("approval.read"),
    requireCsrf,
    async (request, response) => {
      const principal = internalPrincipal(response);
      const input = parseBody(ClearApprovalDelegateRequestSchema, request);
      const approval = await clearApprovalDelegate(
        principal,
        parsePathId(request, "requestId"),
        parsePathId(request, "stepId"),
        input.reason,
      );
      response.json(mapApproval(approval));
    },
  );

  router.post(
    "/approvals/:requestId/decide",
    authenticateInternal,
    requireCapability("approval.read"),
    requireCsrf,
    async (request, response) => {
      const principal = internalPrincipal(response);
      const input = parseBody(ApprovalDecisionRequestSchema, request);
      response.json(
        mapApproval(
          await decide(
            principal,
            parsePathId(request, "requestId"),
            input.action,
            input.comment,
          ),
        ),
      );
    },
  );

  router.post(
    "/approval-requests/:requestId/approve",
    authenticateInternal,
    requireCapability("approval.read"),
    requireCsrf,
    async (request, response) => {
      const principal = internalPrincipal(response);
      const input = parseBody(ApproveApprovalRequestSchema, request);
      response.json(
        mapApproval(
          await decide(
            principal,
            parsePathId(request, "requestId"),
            "APPROVE",
            input.comment,
          ),
        ),
      );
    },
  );

  router.post(
    "/approval-requests/:requestId/reject",
    authenticateInternal,
    requireCapability("approval.read"),
    requireCsrf,
    async (request, response) => {
      const principal = internalPrincipal(response);
      const input = parseBody(RejectApprovalRequestSchema, request);
      response.json(
        mapApproval(
          await decide(
            principal,
            parsePathId(request, "requestId"),
            "REJECT",
            input.comment,
          ),
        ),
      );
    },
  );

  router.post(
    "/approval-requests/:requestId/request-revision",
    authenticateInternal,
    requireCapability("approval.read"),
    requireCsrf,
    async (request, response) => {
      const principal = internalPrincipal(response);
      const input = parseBody(RequestRevisionApprovalRequestSchema, request);
      response.json(
        mapApproval(
          await decide(
            principal,
            parsePathId(request, "requestId"),
            "REQUEST_REVISION",
            input.comment,
          ),
        ),
      );
    },
  );

  return router;
}
