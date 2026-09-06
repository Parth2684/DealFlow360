import { ApprovalRouteStepDtoSchema } from "@repo/common";
import type { Prisma } from "@repo/db";

import {
  jsonInput,
  recordActivity,
  type TransactionClient,
} from "../../shared/activity.js";
import { approvalAuthority } from "../../shared/approval-authority.js";
import { conflict } from "../../shared/errors.js";
import { toJsonValue } from "../../shared/http.js";
import type { InternalPrincipal } from "../../shared/types.js";
import { loadQuote, recalculateQuote } from "./calculation.js";
import type { QuoteRecord, VersionRecord } from "./mappers.js";
import { assertCanEditQuote } from "./service.js";

type JsonRecord = Record<string, unknown>;

interface SnapshotStep {
  templateId: string;
  sequence: number;
  requiredRole:
    | "ADMIN"
    | "SALES_REP"
    | "SALES_MANAGER"
    | "FINANCE"
    | "OPERATIONS"
    | "CUSTOMER";
  requiredCapability: string;
  assigneeStrategy: string;
  dueAfterHours: number | null;
}

interface SnapshotPolicy {
  id: string;
  code: string;
  version: number;
  name: string;
  matchedReasons: string[];
  steps: SnapshotStep[];
}

function record(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function snapshotPolicies(value: Prisma.JsonValue): SnapshotPolicy[] {
  const root = record(toJsonValue(value));
  const policies = root["matchedPolicies"];
  if (!Array.isArray(policies)) return [];
  return policies.flatMap((rawPolicy) => {
    const policy = record(rawPolicy);
    const id = text(policy["id"]);
    const code = text(policy["code"]);
    const version = integer(policy["version"]);
    const name = text(policy["name"]);
    if (id === null || code === null || version === null || name === null)
      return [];
    const rawSteps = policy["steps"];
    const steps = !Array.isArray(rawSteps)
      ? []
      : rawSteps.flatMap((rawStep) => {
          const step = record(rawStep);
          const templateId = text(step["templateId"]);
          const sequence = integer(step["sequence"]);
          const requiredRole = text(step["requiredRole"]);
          const requiredCapability = text(step["requiredCapability"]);
          const assigneeStrategy = text(step["assigneeStrategy"]);
          const dueAfterHours =
            step["dueAfterHours"] === null
              ? null
              : integer(step["dueAfterHours"]);
          const roleResult =
            ApprovalRouteStepDtoSchema.shape.role.safeParse(requiredRole);
          if (
            templateId === null ||
            sequence === null ||
            !roleResult.success ||
            requiredCapability === null ||
            assigneeStrategy === null
          ) {
            return [];
          }
          if (approvalAuthority(roleResult.data, requiredCapability) === null) {
            conflict(
              "A matched approval policy contains an invalid role/capability authority",
              "INVALID_APPROVAL_POLICY",
            );
          }
          return [
            {
              templateId,
              sequence,
              requiredRole: roleResult.data,
              requiredCapability,
              assigneeStrategy,
              dueAfterHours,
            },
          ];
        });
    const rawReasons = policy["matchedReasons"];
    const matchedReasons = Array.isArray(rawReasons)
      ? rawReasons.filter(
          (reason): reason is string => typeof reason === "string",
        )
      : [];
    return [{ id, code, version, name, matchedReasons, steps }];
  });
}

async function assigneeForStep(
  transaction: TransactionClient,
  input: {
    organizationId: string;
    salesTeamId: string | null;
    quoteCreatorId: string;
    step: SnapshotStep;
  },
): Promise<string | null> {
  if (
    input.step.assigneeStrategy === "SALES_TEAM_MANAGER" &&
    input.salesTeamId !== null
  ) {
    const team = await transaction.salesTeam.findFirst({
      where: {
        id: input.salesTeamId,
        organizationId: input.organizationId,
        status: "ACTIVE",
      },
      select: {
        manager: { select: { id: true, organizationId: true, status: true } },
      },
    });
    if (
      team?.manager !== null &&
      team?.manager !== undefined &&
      team.manager.organizationId === input.organizationId &&
      team.manager.status === "ACTIVE" &&
      team.manager.id !== input.quoteCreatorId
    ) {
      return team.manager.id;
    }
  }
  const assignment = await transaction.roleAssignment.findFirst({
    where: {
      organizationId: input.organizationId,
      role: input.step.requiredRole,
      active: true,
      userId: { not: input.quoteCreatorId },
      user: { organizationId: input.organizationId, status: "ACTIVE" },
    },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  return assignment?.userId ?? null;
}

export async function submitQuote(
  transaction: TransactionClient,
  principal: InternalPrincipal,
  quoteId: string,
  expectedRevision: number,
): Promise<{
  quote: QuoteRecord & { currentVersion: VersionRecord };
  autoApproved: boolean;
  approvalRequestId: string | null;
  explanation: string[];
}> {
  const loaded = await loadQuote(
    transaction,
    principal.organizationId,
    quoteId,
  );
  assertCanEditQuote(principal, loaded);
  if (loaded.revision !== expectedRevision) {
    conflict("The quote revision is stale", "REVISION_CONFLICT");
  }
  if (loaded.stage !== "DRAFT" && loaded.stage !== "REVISION_REQUIRED") {
    conflict(
      `A quote in ${loaded.stage} cannot be submitted`,
      "QUOTE_NOT_SUBMITTABLE",
    );
  }
  if (loaded.currentVersion.lines.length === 0) {
    conflict("A quote must contain at least one line", "QUOTE_EMPTY");
  }
  const existing = await transaction.approvalRequest.findFirst({
    where: {
      organizationId: principal.organizationId,
      quoteVersionId: loaded.currentVersion.id,
      status: { in: ["PENDING", "IN_PROGRESS", "APPROVED"] },
    },
  });
  if (existing !== null) {
    conflict("This quote version was already submitted", "ALREADY_SUBMITTED");
  }
  const quote = await recalculateQuote(
    transaction,
    principal.organizationId,
    quoteId,
  );
  const risk = quote.currentVersion.riskAssessment;
  if (risk === null)
    conflict("Risk calculation did not complete", "CALCULATION_REQUIRED");
  const requiredRoute = ApprovalRouteStepDtoSchema.array().parse(
    toJsonValue(risk.requiredRoute),
  );
  const explanation = requiredRoute.map((step) => step.reason);

  if (requiredRoute.length === 0) {
    const accepted = await transaction.customerAcceptance.findFirst({
      where: {
        organizationId: principal.organizationId,
        quoteVersionId: quote.currentVersion.id,
        acceptedFingerprint: quote.currentVersion.termsFingerprint,
      },
      select: { id: true },
    });
    await transaction.quoteVersion.update({
      where: { id: quote.currentVersion.id },
      data: {
        status: accepted === null ? "READY_TO_SEND" : "CUSTOMER_ACCEPTED",
      },
    });
    const updated = await transaction.quote.updateMany({
      where: {
        id: quote.id,
        organizationId: principal.organizationId,
        revision: expectedRevision,
      },
      data: {
        stage: accepted === null ? "READY_TO_SEND" : "CUSTOMER_ACCEPTED",
        revision: { increment: 1 },
      },
    });
    if (updated.count !== 1)
      conflict("The quote changed during submission", "REVISION_CONFLICT");
    await recordActivity(transaction, {
      organizationId: principal.organizationId,
      actor: principal,
      eventType: "quote.submitted",
      entityType: "QuoteVersion",
      entityId: quote.currentVersion.id,
      entityVersion: quote.currentVersion.revisionNumber,
      termsFingerprint: quote.currentVersion.termsFingerprint,
      quoteId: quote.id,
      title: "Quote passed policy checks",
      message: "No configured approval policy required a decision.",
    });
    return {
      quote: await loadQuote(transaction, principal.organizationId, quote.id),
      autoApproved: true,
      approvalRequestId: null,
      explanation: ["No configured approval policy was triggered"],
    };
  }

  const policies = snapshotPolicies(quote.currentVersion.policySnapshot);
  const request = await transaction.approvalRequest.create({
    data: {
      organizationId: principal.organizationId,
      quoteId: quote.id,
      quoteVersionId: quote.currentVersion.id,
      termsFingerprint: quote.currentVersion.termsFingerprint,
      status: "IN_PROGRESS",
      currentSequence: 1,
      ruleFacts: jsonInput({
        blendedExcess: risk.blendedExcess.toString(),
        maximumLineExcess: risk.maximumLineExcess.toString(),
        marginPercent: risk.postDiscountMarginPercent.toString(),
        creditExposure: risk.creditExposure.toString(),
        creditUtilizationPercent: risk.creditUtilizationPercent.toString(),
        overdueBalance: risk.overdueBalance.toString(),
      }),
      requiredRoute: jsonInput(requiredRoute),
      decisionExplanation: jsonInput({ reasons: explanation }),
    },
  });
  for (const policy of policies) {
    const stillExists = await transaction.approvalPolicy.findFirst({
      where: {
        id: policy.id,
        organizationId: principal.organizationId,
        version: policy.version,
      },
      select: { id: true },
    });
    if (stillExists === null) {
      conflict(
        "A matched approval policy changed during submission",
        "POLICY_VERSION_CHANGED",
      );
    }
    await transaction.approvalRequestPolicyMatch.create({
      data: {
        organizationId: principal.organizationId,
        approvalRequestId: request.id,
        approvalPolicyId: policy.id,
        policyVersion: policy.version,
        matchedFacts: jsonInput({ reasons: policy.matchedReasons }),
        reason:
          policy.matchedReasons.join("; ").slice(0, 500) ||
          `Matched ${policy.name}`,
      },
    });
  }
  for (const routeStep of requiredRoute) {
    const snapshotStep = policies
      .flatMap((policy) => policy.steps)
      .find(
        (candidate) =>
          candidate.requiredRole === routeStep.role &&
          candidate.requiredCapability === routeStep.capability,
      );
    if (snapshotStep === undefined) {
      conflict(
        "The approval route is missing its policy template snapshot",
        "POLICY_SNAPSHOT_INVALID",
      );
    }
    const assigneeId = await assigneeForStep(transaction, {
      organizationId: principal.organizationId,
      salesTeamId: quote.salesTeamId,
      quoteCreatorId: quote.currentVersion.createdById,
      step: snapshotStep,
    });
    const active = routeStep.sequence === 1;
    const createdStep = await transaction.approvalStep.create({
      data: {
        organizationId: principal.organizationId,
        approvalRequestId: request.id,
        approvalStepTemplateId: snapshotStep.templateId,
        sequence: routeStep.sequence,
        requiredCapability: routeStep.capability,
        requiredRole: routeStep.role,
        assigneeId,
        status: active ? "ACTIVE" : "WAITING",
        activatedAt: active ? new Date() : null,
        dueAt:
          active && snapshotStep.dueAfterHours !== null
            ? new Date(Date.now() + snapshotStep.dueAfterHours * 3_600_000)
            : null,
      },
    });
    if (active && createdStep.assigneeId !== null) {
      await transaction.notification.create({
        data: {
          organizationId: principal.organizationId,
          recipientUserId: createdStep.assigneeId,
          channel: "IN_APP",
          type: "APPROVAL_STEP_ACTIVATED",
          title: `Approval needed for ${quote.quoteNumber}`,
          body: "A quote is ready for your approval decision.",
          data: jsonInput({ approvalRequestId: request.id, quoteId: quote.id }),
        },
      });
    }
  }
  await transaction.quoteVersion.update({
    where: { id: quote.currentVersion.id },
    data: { status: "PENDING_APPROVAL" },
  });
  const updated = await transaction.quote.updateMany({
    where: {
      id: quote.id,
      organizationId: principal.organizationId,
      revision: expectedRevision,
    },
    data: { stage: "PENDING_APPROVAL", revision: { increment: 1 } },
  });
  if (updated.count !== 1)
    conflict("The quote changed during submission", "REVISION_CONFLICT");
  await recordActivity(transaction, {
    organizationId: principal.organizationId,
    actor: principal,
    eventType: "quote.submitted",
    entityType: "QuoteVersion",
    entityId: quote.currentVersion.id,
    entityVersion: quote.currentVersion.revisionNumber,
    termsFingerprint: quote.currentVersion.termsFingerprint,
    quoteId: quote.id,
    title: "Quote submitted",
    message: "Policy evaluation created a sequential approval route.",
  });
  await recordActivity(transaction, {
    organizationId: principal.organizationId,
    actor: principal,
    eventType: "approval.requested",
    entityType: "ApprovalRequest",
    entityId: request.id,
    entityVersion: quote.currentVersion.revisionNumber,
    termsFingerprint: quote.currentVersion.termsFingerprint,
    quoteId: quote.id,
    title: "Approval requested",
    message: explanation.join("; "),
  });
  return {
    quote: await loadQuote(transaction, principal.organizationId, quote.id),
    autoApproved: false,
    approvalRequestId: request.id,
    explanation,
  };
}

export async function sendQuote(
  transaction: TransactionClient,
  principal: InternalPrincipal,
  quoteId: string,
  expectedRevision: number,
): Promise<QuoteRecord & { currentVersion: VersionRecord }> {
  const quote = await loadQuote(transaction, principal.organizationId, quoteId);
  assertCanEditQuote(principal, quote);
  if (quote.revision !== expectedRevision)
    conflict("The quote revision is stale", "REVISION_CONFLICT");
  if (quote.stage !== "READY_TO_SEND") {
    conflict("Only a ready-to-send quote may be sent", "QUOTE_NOT_READY");
  }
  if (quote.expiresAt !== null && quote.expiresAt <= new Date()) {
    conflict("The quote has expired", "QUOTE_EXPIRED");
  }
  const contact = await transaction.customerContact.findFirst({
    where: {
      organizationId: principal.organizationId,
      customerAccountId: quote.customerAccountId,
      status: "ACTIVE",
      portalEnabled: true,
      customerAccount: { status: "ACTIVE" },
    },
  });
  if (!contact)
    conflict(
      "Add an active customer contact with portal access before sharing this quotation.",
      "CUSTOMER_CONTACT_REQUIRED",
    );
  const updated = await transaction.quote.updateMany({
    where: {
      id: quote.id,
      organizationId: principal.organizationId,
      revision: expectedRevision,
    },
    data: { stage: "SENT", revision: { increment: 1 } },
  });
  if (updated.count !== 1)
    conflict("The quote changed while it was sent", "REVISION_CONFLICT");
  await transaction.negotiationThread.upsert({
    where: {
      organizationId_quoteId: {
        organizationId: principal.organizationId,
        quoteId: quote.id,
      },
    },
    update: { status: "OPEN", closedAt: null },
    create: {
      organizationId: principal.organizationId,
      quoteId: quote.id,
      customerAccountId: quote.customerAccountId,
    },
  });
  await recordActivity(transaction, {
    organizationId: principal.organizationId,
    actor: principal,
    eventType: "quote.sent",
    entityType: "Quote",
    entityId: quote.id,
    entityVersion: quote.currentRevision,
    termsFingerprint: quote.currentVersion.termsFingerprint,
    quoteId: quote.id,
    title: "Quote sent to customer",
    customerVisible: true,
  });
  return loadQuote(transaction, principal.organizationId, quote.id);
}
