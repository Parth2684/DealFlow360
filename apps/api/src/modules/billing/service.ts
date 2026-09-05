import { prisma } from "@repo/db";
import { Errors, OutboxEventTypes } from "@repo/contracts";
import { d } from "../../shared/decimal";
import { writeAuditEvent, writeDealEvent, writeOutboxEvent } from "../../shared/outbox";
import type { AuthContext } from "../../shared/context";

export class BillingService {
  async listInvoices(auth: AuthContext) {
    const invoices = await prisma.invoice.findMany({
      where: { organizationId: auth.organizationId },
      include: {
        customerAccount: true,
        order: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return invoices.map((inv: any) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerAccountId: inv.customerAccountId,
      customerName: inv.customerAccount?.name ?? null,
      orderId: inv.orderId,
      orderNumber: inv.order?.orderNumber ?? null,
      type: inv.type,
      status: inv.status,
      currency: inv.currency,
      total: String(inv.total),
      paidAmount: String(inv.paidAmount),
      balance: String(inv.balance),
      dueDate: inv.dueDate?.toISOString() ?? null,
      issuedAt: inv.issuedAt?.toISOString() ?? null,
      createdAt: inv.createdAt.toISOString(),
    }));
  }

  async getInvoice(auth: AuthContext, invoiceId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId: auth.organizationId },
      include: {
        customerAccount: true,
        order: true,
        lines: {
          include: {
            product: true,
          },
        },
        payments: true,
        appliedCreditNotes: {
          include: { creditNote: true },
        },
      },
    });

    if (!invoice) throw Errors.notFound("Invoice");

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerAccountId: invoice.customerAccountId,
      customerName: invoice.customerAccount?.name ?? null,
      orderId: invoice.orderId,
      orderNumber: invoice.order?.orderNumber ?? null,
      type: invoice.type,
      status: invoice.status,
      currency: invoice.currency,
      subtotal: String(invoice.subtotal),
      taxTotal: String(invoice.taxTotal),
      discountTotal: String(invoice.discountTotal),
      total: String(invoice.total),
      paidAmount: String(invoice.paidAmount),
      balance: String(invoice.balance),
      dueDate: invoice.dueDate?.toISOString() ?? null,
      issuedAt: invoice.issuedAt?.toISOString() ?? null,
      paymentTermsDays: invoice.paymentTermsDays,
      lines: invoice.lines.map((l: any) => ({
        id: l.id,
        productId: l.productId,
        productName: l.product?.name ?? null,
        description: l.description,
        quantity: String(l.quantity),
        unitPrice: String(l.unitPrice),
        discountPercent: String(l.discountPercent),
        taxRate: String(l.taxRate),
        lineTotal: String(l.lineTotal),
      })),
      payments: invoice.payments.map((p: any) => ({
        id: p.id,
        amount: String(p.amount),
        method: p.method,
        reference: p.reference,
        paymentDate: p.paymentDate.toISOString(),
      })),
      appliedCreditNotes: invoice.appliedCreditNotes.map((ac: any) => ({
        id: ac.id,
        creditNoteId: ac.creditNoteId,
        creditNoteNumber: ac.creditNote?.creditNoteNumber ?? null,
        amount: String(ac.amount),
      })),
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
    };
  }

  async issueInvoice(auth: AuthContext, invoiceId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId: auth.organizationId },
      include: { customerAccount: true, order: true },
    });

    if (!invoice) throw Errors.notFound("Invoice");

    if (invoice.status !== "DRAFT") {
      throw Errors.conflict("Invoice must be in draft status to issue");
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: "ISSUED",
          issuedAt: new Date(),
        },
      });

      // Update customer exposure
      const newExposure = d(invoice.customerAccount.currentExposure).add(d(invoice.total));
      await tx.customerAccount.update({
        where: { id: invoice.customerAccountId },
        data: { currentExposure: newExposure },
      });

      await writeAuditEvent(tx, {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        entityType: "invoice",
        entityId: invoiceId,
        eventType: "invoice.issued",
        afterSummary: { invoiceNumber: invoice.invoiceNumber, total: String(invoice.total) },
      });

      await writeOutboxEvent(tx, {
        organizationId: auth.organizationId,
        eventType: OutboxEventTypes.INVOICE_CREATED,
        payload: { invoiceId },
      });

      await writeDealEvent(tx, {
        organizationId: auth.organizationId,
        quoteId: invoice.order?.quoteId,
        eventType: "invoice.issued",
        title: `Invoice ${invoice.invoiceNumber} issued`,
        actorId: auth.userId,
        visibility: "INTERNAL",
      });
    });

    return this.getInvoice(auth, invoiceId);
  }

  async listPayments(auth: AuthContext, invoiceId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId: auth.organizationId },
    });

    if (!invoice) throw Errors.notFound("Invoice");

    const payments = await prisma.payment.findMany({
      where: { organizationId: auth.organizationId, invoiceId },
      orderBy: { paymentDate: "desc" },
    });

    return payments.map((p: any) => ({
      id: p.id,
      invoiceId: p.invoiceId,
      amount: String(p.amount),
      method: p.method,
      reference: p.reference,
      paymentDate: p.paymentDate.toISOString(),
      status: p.status,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  async recordPayment(
    auth: AuthContext,
    invoiceId: string,
    input: {
      amount: string;
      method: "BANK_TRANSFER" | "CREDIT_CARD" | "CHECK" | "OTHER";
      reference?: string;
      paymentDate?: string;
    },
  ) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId: auth.organizationId },
      include: { customerAccount: true },
    });

    if (!invoice) throw Errors.notFound("Invoice");

    if (invoice.status === "PAID") {
      throw Errors.conflict("Invoice is already fully paid");
    }

    const amount = d(input.amount);
    const balance = d(invoice.balance);

    if (amount.gt(balance)) {
      throw Errors.badRequest("Payment amount exceeds invoice balance");
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const payment = await tx.payment.create({
        data: {
          organizationId: auth.organizationId,
          invoiceId,
          amount: input.amount,
          method: input.method,
          reference: input.reference ?? null,
          paymentDate: input.paymentDate ? new Date(input.paymentDate) : new Date(),
          status: "APPLIED",
        },
      });

      const newPaidAmount = d(invoice.paidAmount).add(amount);
      const newBalance = balance.sub(amount);
      const newStatus = newBalance.equals(0) ? "PAID" : "PARTIALLY_PAID";

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: newPaidAmount,
          balance: newBalance,
          status: newStatus,
        },
      });

      // Update customer exposure and overdue balance
      const newExposure = d(invoice.customerAccount.currentExposure).sub(amount);
      await tx.customerAccount.update({
        where: { id: invoice.customerAccountId },
        data: { currentExposure: newExposure },
      });

      await writeAuditEvent(tx, {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        entityType: "payment",
        entityId: payment.id,
        eventType: "payment.recorded",
        afterSummary: { amount: input.amount, method: input.method },
      });

      await writeOutboxEvent(tx, {
        organizationId: auth.organizationId,
        eventType: OutboxEventTypes.PAYMENT_RECORDED,
        payload: { paymentId: payment.id, invoiceId },
      });

      await writeDealEvent(tx, {
        organizationId: auth.organizationId,
        eventType: "payment.recorded",
        title: `Payment of ${input.amount} recorded`,
        actorId: auth.userId,
        visibility: "INTERNAL",
      });

      return payment;
    });

    return this.listPayments(auth, invoiceId);
  }

  async listCreditNotes(auth: AuthContext) {
    const creditNotes = await prisma.creditNote.findMany({
      where: { organizationId: auth.organizationId },
      include: {
        customerAccount: true,
        subscription: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return creditNotes.map((cn: any) => ({
      id: cn.id,
      creditNoteNumber: cn.creditNoteNumber,
      customerAccountId: cn.customerAccountId,
      customerName: cn.customerAccount?.name ?? null,
      subscriptionId: cn.subscriptionId,
      amount: String(cn.amount),
      reason: cn.reason,
      status: cn.status,
      appliedAmount: String(cn.appliedAmount),
      balance: String(cn.balance),
      createdAt: cn.createdAt.toISOString(),
    }));
  }

  async applyCreditNote(auth: AuthContext, creditNoteId: string, invoiceId: string) {
    const creditNote = await prisma.creditNote.findFirst({
      where: { id: creditNoteId, organizationId: auth.organizationId },
    });

    if (!creditNote) throw Errors.notFound("Credit note");

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId: auth.organizationId },
    });

    if (!invoice) throw Errors.notFound("Invoice");

    if (creditNote.status !== "ISSUED") {
      throw Errors.conflict("Credit note must be issued to apply");
    }

    if (invoice.status === "PAID" || invoice.status === "CANCELLED") {
      throw Errors.conflict("Invoice cannot accept credit notes in current status");
    }

    const creditAmount = d(creditNote.balance);
    const invoiceBalance = d(invoice.balance);

    if (creditAmount.gt(invoiceBalance)) {
      throw Errors.badRequest("Credit note amount exceeds invoice balance");
    }

    await prisma.$transaction(async (tx: any) => {
      // Create application record
      await tx.creditNoteApplication.create({
        data: {
          organizationId: auth.organizationId,
          creditNoteId,
          invoiceId,
          amount: creditAmount,
        },
      });

      // Update credit note
      const newAppliedAmount = d(creditNote.appliedAmount).add(creditAmount);
      const newCreditBalance = d(creditNote.balance).sub(creditAmount);
      const newCreditStatus = newCreditBalance.equals(0) ? "FULLY_APPLIED" : "PARTIALLY_APPLIED";

      await tx.creditNote.update({
        where: { id: creditNoteId },
        data: {
          appliedAmount: newAppliedAmount,
          balance: newCreditBalance,
          status: newCreditStatus,
        },
      });

      // Update invoice
      const newInvoiceBalance = invoiceBalance.sub(creditAmount);
      const newInvoiceStatus = newInvoiceBalance.equals(0) ? "PAID" : "PARTIALLY_PAID";

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          balance: newInvoiceBalance,
          status: newInvoiceStatus,
        },
      });

      await writeAuditEvent(tx, {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        entityType: "credit_note_application",
        entityId: creditNoteId,
        eventType: "credit_note.applied",
        afterSummary: { creditNoteId, invoiceId, amount: creditAmount.toString() },
      });

      await writeOutboxEvent(tx, {
        organizationId: auth.organizationId,
        eventType: OutboxEventTypes.DEAL_ACTIVITY_RECORDED,
        payload: { type: "credit_applied", creditNoteId, invoiceId },
      });
    });

    return { success: true };
  }
}

export const billingService = new BillingService();
