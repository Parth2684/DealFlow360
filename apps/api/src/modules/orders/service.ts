import { prisma } from "@repo/db";
import { Errors, OutboxEventTypes, QuoteStages } from "@repo/contracts";
import { writeAuditEvent, writeDealEvent, writeOutboxEvent } from "../../shared/outbox.js";
import type { AuthContext } from "../../shared/context.js";

export class OrderService {
  async list(auth: AuthContext) {
    const orders = await prisma.order.findMany({
      where: { organizationId: auth.organizationId },
      include: {
        customerAccount: true,
        quote: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return orders.map((o: any) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      quoteId: o.quoteId,
      quoteNumber: o.quote?.quoteNumber ?? null,
      customerAccountId: o.customerAccountId,
      customerName: o.customerAccount?.name ?? null,
      status: o.status,
      total: String(o.total),
      createdAt: o.createdAt.toISOString(),
    }));
  }

  async get(auth: AuthContext, orderId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, organizationId: auth.organizationId },
      include: {
        customerAccount: true,
        quote: true,
        lines: {
          include: {
            quoteLine: {
              include: { product: true, variant: true },
            },
          },
        },
      },
    });
    if (!order) throw Errors.notFound("Order");

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      quoteId: order.quoteId,
      quoteNumber: order.quote?.quoteNumber ?? null,
      customerAccountId: order.customerAccountId,
      customerName: order.customerAccount?.name ?? null,
      status: order.status,
      currency: order.currency,
      subtotal: String(order.subtotal),
      taxTotal: String(order.taxTotal),
      discountTotal: String(order.discountTotal),
      total: String(order.total),
      costTotal: String(order.costTotal),
      grossMargin: String(order.grossMargin),
      marginPercent: String(order.marginPercent),
      paymentTermsDays: order.paymentTermsDays,
      termsFingerprint: order.termsFingerprint,
      lines: order.lines.map((l: any) => ({
        id: l.id,
        quoteLineId: l.quoteLineId,
        productName: l.quoteLine?.productName ?? null,
        productType: l.quoteLine?.productType ?? null,
        sku: l.quoteLine?.sku ?? null,
        quantity: String(l.quantity),
        unitPrice: String(l.unitPrice),
        discountPercent: String(l.discountPercent),
        discountAmount: String(l.discountAmount),
        taxRate: String(l.taxRate),
        taxAmount: String(l.taxAmount),
        lineTotal: String(l.lineTotal),
        billingType: l.quoteLine?.billingType ?? null,
      })),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }

  async confirmFromQuote(auth: AuthContext, quoteId: string, expectedRevision: number) {
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, organizationId: auth.organizationId },
      include: {
        currentVersion: {
          include: {
            lines: true,
          },
        },
        customerAccount: true,
      },
    });

    if (!quote?.currentVersion) throw Errors.notFound("Quote");

    if (quote.revision !== expectedRevision) {
      throw Errors.conflict("Quote has been modified since last revision");
    }

    if (quote.currentVersion.status !== "APPROVED") {
      throw Errors.conflict("Quote must be approved before confirmation");
    }

    if (quote.stage !== QuoteStages.READY_TO_SEND && quote.stage !== QuoteStages.SENT) {
      throw Errors.conflict("Quote must be ready to send or sent");
    }

    const orderNumber = await this.getNextOrderNumber(auth.organizationId);

    const result = await prisma.$transaction(async (tx: any) => {
      // Create order
      const order = await tx.order.create({
        data: {
          organizationId: auth.organizationId,
          quoteId: quote.id,
          customerAccountId: quote.customerAccountId,
          orderNumber,
          status: "CONFIRMED",
          currency: quote.currentVersion.currency,
          subtotal: quote.currentVersion.subtotal,
          taxTotal: quote.currentVersion.taxTotal,
          discountTotal: quote.currentVersion.discountTotal,
          total: quote.currentVersion.total,
          costTotal: quote.currentVersion.costTotal,
          grossMargin: quote.currentVersion.grossMargin,
          marginPercent: quote.currentVersion.marginPercent,
          paymentTermsDays: quote.currentVersion.paymentTermsDays,
          termsFingerprint: quote.currentVersion.termsFingerprint,
        },
      });

      // Create order lines
      for (const line of quote.currentVersion.lines) {
        await tx.orderLine.create({
          data: {
            organizationId: auth.organizationId,
            orderId: order.id,
            quoteLineId: line.id,
            productId: line.productId,
            variantId: line.variantId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            unitCost: line.unitCost,
            discountPercent: line.discountPercent,
            discountAmount: line.discountAmount,
            taxRate: line.taxRate,
            taxAmount: line.taxAmount,
            lineTotal: line.lineTotal,
            billingType: line.billingType,
          },
        });
      }

      // Update quote stage
      await tx.quote.update({
        where: { id: quoteId },
        data: { stage: QuoteStages.CONFIRMED },
      });

      await writeAuditEvent(tx, {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        entityType: "order",
        entityId: order.id,
        eventType: "order.confirmed",
        afterSummary: { orderNumber, quoteId },
      });

      await writeOutboxEvent(tx, {
        organizationId: auth.organizationId,
        eventType: OutboxEventTypes.ORDER_CONFIRMED,
        payload: { orderId: order.id, quoteId },
      });

      await writeDealEvent(tx, {
        organizationId: auth.organizationId,
        quoteId,
        eventType: "order.confirmed",
        title: "Order confirmed from quote",
        actorId: auth.userId,
        visibility: "INTERNAL",
      });

      return order.id;
    });

    return this.get(auth, result);
  }

  async getBilling(auth: AuthContext, orderId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, organizationId: auth.organizationId },
      include: {
        lines: {
          include: {
            quoteLine: true,
          },
        },
        invoices: {
          where: { status: { in: ["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID"] } },
          orderBy: { createdAt: "asc" },
        },
        subscriptions: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!order) throw Errors.notFound("Order");

    const oneTimeLines = order.lines.filter((l: any) => l.quoteLine?.billingType === "ONE_TIME");
    const recurringLines = order.lines.filter((l: any) => l.quoteLine?.billingType === "RECURRING");

    const oneTimeTotal = oneTimeLines.reduce((sum: number, l: any) => sum + Number(l.lineTotal), 0);
    const recurringTotal = recurringLines.reduce((sum: number, l: any) => sum + Number(l.lineTotal), 0);

    return {
      orderId,
      orderNumber: order.orderNumber,
      oneTimeCharges: {
        lines: oneTimeLines.map((l: any) => ({
          id: l.id,
          productName: l.quoteLine?.productName ?? null,
          quantity: String(l.quantity),
          lineTotal: String(l.lineTotal),
        })),
        total: oneTimeTotal.toString(),
        invoices: order.invoices.filter((i: any) => i.type === "ONE_TIME").map((i: any) => ({
          id: i.id,
          invoiceNumber: i.invoiceNumber,
          status: i.status,
          total: String(i.total),
          dueDate: i.dueDate?.toISOString() ?? null,
        })),
      },
      recurringCharges: {
        lines: recurringLines.map((l: any) => ({
          id: l.id,
          productName: l.quoteLine?.productName ?? null,
          quantity: String(l.quantity),
          lineTotal: String(l.lineTotal),
          subscriptionPlanId: l.quoteLine?.subscriptionPlanId ?? null,
        })),
        total: recurringTotal.toString(),
        subscriptions: order.subscriptions.map((s: any) => ({
          id: s.id,
          status: s.status,
          interval: s.interval,
          intervalCount: s.intervalCount,
          startDate: s.startDate.toISOString(),
          items: s.items.map((item: any) => ({
            productId: item.productId,
            quantity: String(item.quantity),
            unitPrice: String(item.unitPrice),
          })),
        })),
      },
    };
  }

  private async getNextOrderNumber(organizationId: string): Promise<string> {
    const lastOrder = await prisma.order.findFirst({
      where: { organizationId },
      orderBy: { orderNumber: "desc" },
    });

    if (!lastOrder) return "ORD-000001";

    const lastNum = parseInt(lastOrder.orderNumber.replace("ORD-", ""), 10);
    return `ORD-${String(lastNum + 1).padStart(6, "0")}`;
  }
}

export const orderService = new OrderService();
