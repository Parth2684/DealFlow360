import { prisma } from "@repo/db";
import { ApprovalRequestDtoSchema } from "@repo/common";
import { mapQuoteSummary, quoteInclude } from "./modules/quotations/mappers.js";

function jsonObject(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
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

function requiredRoute(record: {
  steps: Array<{
    sequence: number;
    requiredRole: string;
    requiredCapability: string;
  }>;
}) {
  return record.steps.map((step) => ({
    sequence: step.sequence,
    role: step.requiredRole,
    capability: step.requiredCapability,
    reason: `Required by the ${step.requiredRole.toLowerCase().replaceAll("_", " ")} approval step`,
  }));
}

async function run() {
  const records = await prisma.approvalRequest.findMany({
    include: {
      quote: { include: quoteInclude },
      quoteVersion: true,
      policyMatches: { include: { approvalPolicy: true } },
      steps: {
        include: {
          assignee: true,
          delegate: true,
          delegateAssignedBy: true,
          decisions: { include: { actor: true } },
        },
      },
      decisions: { include: { actor: true } },
    },
  });

  for (const record of records) {
    const currentFingerprint =
      record.quote.currentVersion?.termsFingerprint ?? record.termsFingerprint;
    const mapped = {
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
          step.delegate === null
            ? null
            : {
                id: step.delegate.id,
                name: `${step.delegate.firstName} ${step.delegate.lastName}`,
                email: step.delegate.email,
                assignedAt: step.delegateAssignedAt?.toISOString() ?? "",
                expiresAt: step.delegateExpiresAt?.toISOString() ?? "",
                assignedBy: {
                  id: step.delegateAssignedBy!.id,
                  name: `${step.delegateAssignedBy!.firstName} ${step.delegateAssignedBy!.lastName}`,
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
    };

    try {
      ApprovalRequestDtoSchema.parse(mapped);
      console.log(`Record ${record.id} passed validation!`);
    } catch (e: unknown) {
      console.error(`Record ${record.id} failed validation!`);
      console.error(
        JSON.stringify(e instanceof Error ? e.message : e, null, 2),
      );
    }
  }
}
run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
