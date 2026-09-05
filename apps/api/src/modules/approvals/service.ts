import { prisma } from "@repo/db";
import {
  Capabilities,
  Errors,
  OutboxEventTypes,
  ApprovalDecisionActions,
  type ApprovalDecisionInput,
} from "@repo/contracts";
import { writeAuditEvent, writeDealEvent, writeOutboxEvent } from "../../shared/outbox.js";
import type { AuthContext } from "../../shared/context.js";

export class ApprovalService {
  async inbox(auth: AuthContext) {
    const canManager = auth.capabilities.includes(Capabilities.APPROVAL_MANAGER_ACT);
    const canFinance = auth.capabilities.includes(Capabilities.APPROVAL_FINANCE_ACT);

    if (!canManager && !canFinance) throw Errors.forbidden();

    const capabilities = [
      ...(canManager ? [Capabilities.APPROVAL_MANAGER_ACT] : []),
      ...(canFinance ? [Capabilities.APPROVAL_FINANCE_ACT] : []),
    ];

    const steps = await prisma.approvalStep.findMany({
      where: {
        organizationId: auth.organizationId,
        status: "ACTIVE",
        requiredCapability: { in: capabilities },
        approvalRequest: {
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
      },
      include: {
        approvalRequest: {
          include: {
            quoteVersion: {
              include: {
                quote: { include: { customerAccount: true, owner: true } },
              },
            },
          },
        },
      },
      orderBy: { dueAt: "asc" },
    });

    return steps.map((step) => {
      const req = step.approvalRequest;
      const version = req.quoteVersion;
      const quote = version.quote;
      return {
        id: req.id,
        stepId: step.id,
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        customerName: quote.customerAccount.name,
        total: String(version.total),
        status: req.status,
        routeReason: req.routeReason,
        termsFingerprint: req.termsFingerprint,
        currentStep: {
          id: step.id,
          sequence: step.sequence,
          requiredCapability: step.requiredCapability,
          status: step.status,
          dueAt: step.dueAt?.toISOString() ?? null,
        },
        riskSummary: req.explainerData,
        ownerName: `${quote.owner.firstName} ${quote.owner.lastName}`,
        createdAt: req.createdAt.toISOString(),
      };
    });
  }

  async decide(
    auth: AuthContext,
    requestId: string,
    input: ApprovalDecisionInput,
  ) {
    const request = await prisma.approvalRequest.findFirst({
      where: { id: requestId, organizationId: auth.organizationId },
      include: {
        steps: { orderBy: { sequence: "asc" } },
        quoteVersion: { include: { quote: true } },
      },
    });
    if (!request) throw Errors.notFound("Approval request");

    const activeStep = request.steps.find((s) => s.status === "ACTIVE");
    if (!activeStep) throw Errors.conflict("No active approval step");

    if (!auth.capabilities.includes(activeStep.requiredCapability as typeof Capabilities.APPROVAL_MANAGER_ACT)) {
      throw Errors.forbidden("You cannot act on this approval step");
    }

    if (request.quoteVersion.quote.ownerId === auth.userId) {
      throw Errors.forbidden("Cannot approve your own quotation");
    }

    if (request.termsFingerprint !== request.quoteVersion.termsFingerprint) {
      throw Errors.conflict("Approval request has been superseded by changed terms");
    }

    await prisma.$transaction(async (tx) => {
      await tx.approvalDecision.create({
        data: {
          organizationId: auth.organizationId,
          approvalRequestId: request.id,
          approvalStepId: activeStep.id,
          actorId: auth.userId,
          action: input.action,
          reason: input.reason,
        },
      });

      if (input.action === ApprovalDecisionActions.APPROVE) {
        await tx.approvalStep.update({
          where: { id: activeStep.id },
          data: { status: "APPROVED", completedAt: new Date() },
        });

        const nextStep = request.steps.find(
          (s) => s.sequence > activeStep.sequence && s.status === "PENDING",
        );

        if (nextStep) {
          await tx.approvalStep.update({
            where: { id: nextStep.id },
            data: { status: "ACTIVE", activatedAt: new Date() },
          });
          await tx.approvalRequest.update({
            where: { id: request.id },
            data: { status: "IN_PROGRESS" },
          });
        } else {
          await tx.approvalRequest.update({
            where: { id: request.id },
            data: { status: "APPROVED" },
          });
          await tx.quoteVersion.update({
            where: { id: request.quoteVersionId },
            data: { status: "APPROVED" },
          });
          await tx.quote.update({
            where: { id: request.quoteVersion.quoteId },
            data: { stage: "READY_TO_SEND" },
          });

          await writeOutboxEvent(tx, {
            organizationId: auth.organizationId,
            eventType: OutboxEventTypes.APPROVAL_COMPLETED,
            payload: { requestId: request.id, quoteId: request.quoteVersion.quoteId },
          });
        }
      } else if (input.action === ApprovalDecisionActions.REJECT) {
        await tx.approvalStep.update({
          where: { id: activeStep.id },
          data: { status: "REJECTED", completedAt: new Date() },
        });
        await tx.approvalRequest.update({
          where: { id: request.id },
          data: { status: "REJECTED" },
        });
        await tx.quote.update({
          where: { id: request.quoteVersion.quoteId },
          data: { stage: "REVISION_REQUIRED" },
        });
        await tx.quoteVersion.update({
          where: { id: request.quoteVersionId },
          data: { status: "REJECTED" },
        });
      } else {
        await tx.approvalStep.update({
          where: { id: activeStep.id },
          data: { status: "REVISION_REQUESTED", completedAt: new Date() },
        });
        await tx.approvalRequest.update({
          where: { id: request.id },
          data: { status: "REVISION_REQUESTED" },
        });
        await tx.quote.update({
          where: { id: request.quoteVersion.quoteId },
          data: { stage: "REVISION_REQUIRED" },
        });
      }

      await writeAuditEvent(tx, {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        entityType: "approval_request",
        entityId: request.id,
        eventType: `approval.${input.action.toLowerCase()}`,
        metadata: { reason: input.reason, stepId: activeStep.id },
      });

      await writeDealEvent(tx, {
        organizationId: auth.organizationId,
        quoteId: request.quoteVersion.quoteId,
        eventType: `approval.${input.action.toLowerCase()}`,
        title: `Approval ${input.action.toLowerCase().replace("_", " ")}`,
        description: input.reason,
        actorId: auth.userId,
        visibility: "INTERNAL",
      });
    });

    return { success: true, action: input.action };
  }
}

export const approvalService = new ApprovalService();
