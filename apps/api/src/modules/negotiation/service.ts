import { prisma } from "@repo/db";
import { Errors, OutboxEventTypes, QuoteStages } from "@repo/contracts";
import { writeAuditEvent, writeDealEvent, writeOutboxEvent } from "../../shared/outbox.js";
import type { AuthContext } from "../../shared/context.js";

export class NegotiationService {
  async getPortalQuote(auth: AuthContext, quoteId: string) {
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, organizationId: auth.organizationId },
      include: {
        currentVersion: {
          include: {
            lines: {
              include: { product: true, variant: true },
            },
          },
        },
        customerAccount: true,
      },
    });

    if (!quote?.currentVersion) throw Errors.notFound("Quote");

    if (quote.stage !== QuoteStages.SENT && quote.stage !== QuoteStages.UNDER_NEGOTIATION) {
      throw Errors.conflict("Quote is not available for negotiation");
    }

    return {
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      customerAccountId: quote.customerAccountId,
      customerName: quote.customerAccount?.name ?? null,
      stage: quote.stage,
      currentVersion: {
        id: quote.currentVersion.id,
        revisionNumber: quote.currentVersion.revisionNumber,
        currency: quote.currentVersion.currency,
        subtotal: String(quote.currentVersion.subtotal),
        taxTotal: String(quote.currentVersion.taxTotal),
        discountTotal: String(quote.currentVersion.discountTotal),
        total: String(quote.currentVersion.total),
        paymentTermsDays: quote.currentVersion.paymentTermsDays,
        lines: quote.currentVersion.lines.map((l: any) => ({
          id: l.id,
          productName: l.productName,
          productType: l.productType,
          sku: l.sku,
          quantity: String(l.quantity),
          unitPrice: String(l.unitPrice),
          discountPercent: String(l.discountPercent),
          lineTotal: String(l.lineTotal),
          billingType: l.billingType,
        })),
      },
      expiresAt: quote.expiresAt?.toISOString() ?? null,
      createdAt: quote.createdAt.toISOString(),
    };
  }

  async createChangeRequest(
    auth: AuthContext,
    quoteId: string,
    input: {
      message: string;
      requestedChanges: Array<{
        quoteLineId: string;
        action: "REMOVE" | "CHANGE_QUANTITY" | "CHANGE_PRICE";
        quantity?: string;
        unitPrice?: string;
      }>;
    },
  ) {
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, organizationId: auth.organizationId },
    });

    if (!quote) throw Errors.notFound("Quote");

    if (quote.stage !== QuoteStages.SENT && quote.stage !== QuoteStages.UNDER_NEGOTIATION) {
      throw Errors.conflict("Quote is not available for negotiation");
    }

    const request = await prisma.$transaction(async (tx: any) => {
      // Update quote stage if needed
      if (quote.stage === QuoteStages.SENT) {
        await tx.quote.update({
          where: { id: quoteId },
          data: { stage: QuoteStages.UNDER_NEGOTIATION },
        });
      }

      const changeRequest = await tx.changeRequest.create({
        data: {
          organizationId: auth.organizationId,
          quoteId,
          requestedBy: auth.userId,
          message: input.message,
          requestedChanges: input.requestedChanges,
          status: "PENDING",
        },
      });

      await writeAuditEvent(tx, {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        entityType: "change_request",
        entityId: changeRequest.id,
        eventType: "change_request.created",
        afterSummary: { quoteId, message: input.message },
      });

      await writeOutboxEvent(tx, {
        organizationId: auth.organizationId,
        eventType: OutboxEventTypes.CUSTOMER_COUNTERED,
        payload: { quoteId, requestId: changeRequest.id },
      });

      await writeDealEvent(tx, {
        organizationId: auth.organizationId,
        quoteId,
        eventType: "negotiation.requested",
        title: "Customer requested changes",
        description: input.message,
        actorId: auth.userId,
        visibility: "INTERNAL",
      });

      return changeRequest;
    });

    return this.getChangeRequest(auth, request.id);
  }

  async listChangeRequests(auth: AuthContext, quoteId: string) {
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, organizationId: auth.organizationId },
    });

    if (!quote) throw Errors.notFound("Quote");

    const requests = await prisma.changeRequest.findMany({
      where: { organizationId: auth.organizationId, quoteId },
      include: {
        requestedByUser: true,
        counteroffers: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return requests.map((r: any) => ({
      id: r.id,
      quoteId: r.quoteId,
      requestedBy: r.requestedBy,
      requestedByName: r.requestedByUser ? `${r.requestedByUser.firstName} ${r.requestedByUser.lastName}` : null,
      message: r.message,
      requestedChanges: r.requestedChanges,
      status: r.status,
      counteroffers: r.counteroffers.map((c: any) => ({
        id: c.id,
        message: c.message,
        proposedChanges: c.proposedChanges,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
      })),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async createCounteroffer(
    auth: AuthContext,
    requestId: string,
    input: {
      message: string;
      proposedChanges: Array<{
        quoteLineId: string;
        quantity?: string;
        unitPrice?: string;
        discountPercent?: string;
      }>;
    },
  ) {
    const request = await prisma.changeRequest.findFirst({
      where: { id: requestId, organizationId: auth.organizationId },
    });

    if (!request) throw Errors.notFound("Change request");

    if (request.status !== "PENDING") {
      throw Errors.conflict("Change request is not pending");
    }

    const counteroffer = await prisma.$transaction(async (tx: any) => {
      const co = await tx.counteroffer.create({
        data: {
          organizationId: auth.organizationId,
          changeRequestId: requestId,
          proposedBy: auth.userId,
          message: input.message,
          proposedChanges: input.proposedChanges,
          status: "PENDING",
        },
      });

      await writeAuditEvent(tx, {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        entityType: "counteroffer",
        entityId: co.id,
        eventType: "counteroffer.created",
        afterSummary: { requestId, message: input.message },
      });

      await writeOutboxEvent(tx, {
        organizationId: auth.organizationId,
        eventType: OutboxEventTypes.DEAL_ACTIVITY_RECORDED,
        payload: { type: "counteroffer_created", counterofferId: co.id },
      });

      await writeDealEvent(tx, {
        organizationId: auth.organizationId,
        quoteId: request.quoteId,
        eventType: "negotiation.counteroffered",
        title: "Counteroffer sent",
        description: input.message,
        actorId: auth.userId,
        visibility: "INTERNAL",
      });

      return co;
    });

    return this.getCounteroffer(auth, counteroffer.id);
  }

  async acceptChangeRequest(auth: AuthContext, requestId: string) {
    const request = await prisma.changeRequest.findFirst({
      where: { id: requestId, organizationId: auth.organizationId },
    });

    if (!request) throw Errors.notFound("Change request");

    if (request.status !== "PENDING") {
      throw Errors.conflict("Change request is not pending");
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.changeRequest.update({
        where: { id: requestId },
        data: { status: "ACCEPTED" },
      });

      // Apply the requested changes to the quote
      for (const change of request.requestedChanges as any[]) {
        if (change.action === "REMOVE") {
          await tx.quoteLine.delete({
            where: { id: change.quoteLineId },
          });
        } else if (change.action === "CHANGE_QUANTITY" && change.quantity) {
          await tx.quoteLine.update({
            where: { id: change.quoteLineId },
            data: { quantity: change.quantity },
          });
        } else if (change.action === "CHANGE_PRICE" && change.unitPrice) {
          await tx.quoteLine.update({
            where: { id: change.quoteLineId },
            data: { unitPrice: change.unitPrice },
          });
        }
      }

      await writeAuditEvent(tx, {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        entityType: "change_request",
        entityId: requestId,
        eventType: "change_request.accepted",
        afterSummary: { requestId },
      });

      await writeDealEvent(tx, {
        organizationId: auth.organizationId,
        quoteId: request.quoteId,
        eventType: "negotiation.accepted",
        title: "Change request accepted",
        actorId: auth.userId,
        visibility: "INTERNAL",
      });
    });

    return { success: true };
  }

  async rejectChangeRequest(auth: AuthContext, requestId: string, reason: string) {
    const request = await prisma.changeRequest.findFirst({
      where: { id: requestId, organizationId: auth.organizationId },
    });

    if (!request) throw Errors.notFound("Change request");

    if (request.status !== "PENDING") {
      throw Errors.conflict("Change request is not pending");
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.changeRequest.update({
        where: { id: requestId },
        data: { status: "REJECTED", rejectionReason: reason },
      });

      await writeAuditEvent(tx, {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        entityType: "change_request",
        entityId: requestId,
        eventType: "change_request.rejected",
        afterSummary: { requestId, reason },
      });

      await writeDealEvent(tx, {
        organizationId: auth.organizationId,
        quoteId: request.quoteId,
        eventType: "negotiation.rejected",
        title: "Change request rejected",
        description: reason,
        actorId: auth.userId,
        visibility: "INTERNAL",
      });
    });

    return { success: true };
  }

  async acceptCounteroffer(auth: AuthContext, counterofferId: string) {
    const counteroffer = await prisma.counteroffer.findFirst({
      where: { id: counterofferId, organizationId: auth.organizationId },
      include: { changeRequest: true },
    });

    if (!counteroffer) throw Errors.notFound("Counteroffer");

    if (counteroffer.status !== "PENDING") {
      throw Errors.conflict("Counteroffer is not pending");
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.counteroffer.update({
        where: { id: counterofferId },
        data: { status: "ACCEPTED" },
      });

      await tx.changeRequest.update({
        where: { id: counteroffer.changeRequestId },
        data: { status: "ACCEPTED" },
      });

      // Apply the counteroffer changes to the quote
      for (const change of counteroffer.proposedChanges as any[]) {
        const updateData: any = {};
        if (change.quantity) updateData.quantity = change.quantity;
        if (change.unitPrice) updateData.unitPrice = change.unitPrice;
        if (change.discountPercent !== undefined) updateData.discountPercent = change.discountPercent;

        if (Object.keys(updateData).length > 0) {
          await tx.quoteLine.update({
            where: { id: change.quoteLineId },
            data: updateData,
          });
        }
      }

      await writeAuditEvent(tx, {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        entityType: "counteroffer",
        entityId: counterofferId,
        eventType: "counteroffer.accepted",
        afterSummary: { counterofferId },
      });

      await writeOutboxEvent(tx, {
        organizationId: auth.organizationId,
        eventType: OutboxEventTypes.CUSTOMER_ACCEPTED,
        payload: { counterofferId, quoteId: counteroffer.changeRequest.quoteId },
      });

      await writeDealEvent(tx, {
        organizationId: auth.organizationId,
        quoteId: counteroffer.changeRequest.quoteId,
        eventType: "negotiation.completed",
        title: "Counteroffer accepted",
        actorId: auth.userId,
        visibility: "BOTH",
      });
    });

    return { success: true };
  }

  async rejectCounteroffer(auth: AuthContext, counterofferId: string, reason: string) {
    const counteroffer = await prisma.counteroffer.findFirst({
      where: { id: counterofferId, organizationId: auth.organizationId },
      include: { changeRequest: true },
    });

    if (!counteroffer) throw Errors.notFound("Counteroffer");

    if (counteroffer.status !== "PENDING") {
      throw Errors.conflict("Counteroffer is not pending");
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.counteroffer.update({
        where: { id: counterofferId },
        data: { status: "REJECTED", rejectionReason: reason },
      });

      await writeAuditEvent(tx, {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        entityType: "counteroffer",
        entityId: counterofferId,
        eventType: "counteroffer.rejected",
        afterSummary: { counterofferId, reason },
      });

      await writeDealEvent(tx, {
        organizationId: auth.organizationId,
        quoteId: counteroffer.changeRequest.quoteId,
        eventType: "negotiation.rejected",
        title: "Counteroffer rejected",
        description: reason,
        actorId: auth.userId,
        visibility: "INTERNAL",
      });
    });

    return { success: true };
  }

  private async getChangeRequest(auth: AuthContext, requestId: string) {
    const request = await prisma.changeRequest.findFirst({
      where: { id: requestId, organizationId: auth.organizationId },
      include: { requestedByUser: true },
    });

    if (!request) throw Errors.notFound("Change request");

    return {
      id: request.id,
      quoteId: request.quoteId,
      requestedBy: request.requestedBy,
      requestedByName: request.requestedByUser ? `${request.requestedByUser.firstName} ${request.requestedByUser.lastName}` : null,
      message: request.message,
      requestedChanges: request.requestedChanges,
      status: request.status,
      rejectionReason: request.rejectionReason,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    };
  }

  private async getCounteroffer(auth: AuthContext, counterofferId: string) {
    const counteroffer = await prisma.counteroffer.findFirst({
      where: { id: counterofferId, organizationId: auth.organizationId },
      include: { proposedByUser: true, changeRequest: true },
    });

    if (!counteroffer) throw Errors.notFound("Counteroffer");

    return {
      id: counteroffer.id,
      changeRequestId: counteroffer.changeRequestId,
      proposedBy: counteroffer.proposedBy,
      proposedByName: counteroffer.proposedByUser ? `${counteroffer.proposedByUser.firstName} ${counteroffer.proposedByUser.lastName}` : null,
      message: counteroffer.message,
      proposedChanges: counteroffer.proposedChanges,
      status: counteroffer.status,
      rejectionReason: counteroffer.rejectionReason,
      createdAt: counteroffer.createdAt.toISOString(),
      updatedAt: counteroffer.updatedAt.toISOString(),
    };
  }
}

export const negotiationService = new NegotiationService();
