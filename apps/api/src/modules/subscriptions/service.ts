import { prisma } from "@repo/db";
import { Errors, OutboxEventTypes } from "@repo/contracts";
import { d } from "../../shared/decimal.js";
import { writeAuditEvent, writeDealEvent, writeOutboxEvent } from "../../shared/outbox.js";
import type { AuthContext } from "../../shared/context.js";

export class SubscriptionService {
  async list(auth: AuthContext) {
    const subscriptions = await prisma.subscription.findMany({
      where: { organizationId: auth.organizationId },
      include: {
        customerAccount: true,
        items: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return subscriptions.map((s: any) => ({
      id: s.id,
      subscriptionNumber: s.subscriptionNumber,
      customerAccountId: s.customerAccountId,
      customerName: s.customerAccount?.name ?? null,
      status: s.status,
      interval: s.interval,
      intervalCount: s.intervalCount,
      currency: s.currency,
      total: String(s.total),
      startDate: s.startDate.toISOString(),
      endDate: s.endDate?.toISOString() ?? null,
      items: s.items.map((i: any) => ({
        productId: i.productId,
        productName: i.product?.name ?? null,
        quantity: String(i.quantity),
        unitPrice: String(i.unitPrice),
      })),
    }));
  }

  async get(auth: AuthContext, subscriptionId: string) {
    const subscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, organizationId: auth.organizationId },
      include: {
        customerAccount: true,
        items: {
          include: { product: true, subscriptionPlan: true },
        },
        billingSchedules: {
          orderBy: { periodStart: "asc" },
        },
      },
    });

    if (!subscription) throw Errors.notFound("Subscription");

    return {
      id: subscription.id,
      subscriptionNumber: subscription.subscriptionNumber,
      customerAccountId: subscription.customerAccountId,
      customerName: subscription.customerAccount?.name ?? null,
      status: subscription.status,
      interval: subscription.interval,
      intervalCount: subscription.intervalCount,
      currency: subscription.currency,
      total: String(subscription.total),
      startDate: subscription.startDate.toISOString(),
      endDate: subscription.endDate?.toISOString() ?? null,
      prorationConvention: subscription.prorationConvention,
      cancellationRules: subscription.cancellationRules,
      items: subscription.items.map((i: any) => ({
        id: i.id,
        productId: i.productId,
        productName: i.product?.name ?? null,
        quantity: String(i.quantity),
        unitPrice: String(i.unitPrice),
        subscriptionPlanId: i.subscriptionPlanId,
        subscriptionPlanName: i.subscriptionPlan?.name ?? null,
      })),
      billingSchedules: subscription.billingSchedules.map((s: any) => ({
        id: s.id,
        periodStart: s.periodStart.toISOString(),
        periodEnd: s.periodEnd.toISOString(),
        dueDate: s.dueDate.toISOString(),
        amount: String(s.amount),
        status: s.status,
        invoiceId: s.invoiceId,
      })),
    };
  }

  async previewChange(
    auth: AuthContext,
    subscriptionId: string,
    input: {
      quantity?: number;
      planId?: string;
    },
  ) {
    const subscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, organizationId: auth.organizationId },
      include: { items: true },
    });

    if (!subscription) throw Errors.notFound("Subscription");

    const currentTotal = d(subscription.total);
    let newTotal = currentTotal;

    if (input.quantity !== undefined) {
      const item = subscription.items[0];
      if (item) {
        const currentQuantity = d(item.quantity);
        const unitPrice = d(item.unitPrice);
        const quantityDelta = d(input.quantity).sub(currentQuantity);
        const amountDelta = unitPrice.mul(quantityDelta);
        newTotal = currentTotal.add(amountDelta);
      }
    }

    if (input.planId) {
      const plan = await prisma.subscriptionPlan.findFirst({
        where: { id: input.planId, organizationId: auth.organizationId },
      });
      if (!plan) throw Errors.notFound("Subscription plan");
      // Would calculate plan change impact
    }

    const totalDelta = newTotal.sub(currentTotal);
    const isIncrease = totalDelta.gt(0);

    // Calculate proration (simplified calendar days)
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - today.getDate();
    const prorationRatio = d(daysRemaining).div(d(daysInMonth));
    const proratedDelta = totalDelta.mul(prorationRatio);

    return {
      currentTotal: currentTotal.toString(),
      newTotal: newTotal.toString(),
      totalDelta: totalDelta.toString(),
      proratedDelta: proratedDelta.toString(),
      isIncrease,
      effectiveDate: today.toISOString(),
      prorationConvention: subscription.prorationConvention,
    };
  }

  async change(
    auth: AuthContext,
    subscriptionId: string,
    input: {
      quantity?: number;
      planId?: string;
      effectiveDate: string;
    },
  ) {
    const subscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, organizationId: auth.organizationId },
      include: { items: true },
    });

    if (!subscription) throw Errors.notFound("Subscription");

    if (subscription.status !== "ACTIVE") {
      throw Errors.conflict("Subscription must be active to change");
    }

    const preview = await this.previewChange(auth, subscriptionId, {
      quantity: input.quantity,
      planId: input.planId,
    });

    await prisma.$transaction(async (tx: any) => {
      // Update subscription items if quantity changed
      if (input.quantity !== undefined && subscription.items[0]) {
        const item = subscription.items[0];
        const unitPrice = d(item.unitPrice);
        const newTotal = d(input.quantity).mul(unitPrice);

        await tx.subscriptionItem.update({
          where: { id: item.id },
          data: {
            quantity: input.quantity.toString(),
          },
        });

        await tx.subscription.update({
          where: { id: subscriptionId },
          data: {
            total: newTotal,
          },
        });

        // Create credit note or debit for proration
        if (!d(preview.proratedDelta).equals(0)) {
          const creditNote = await tx.creditNote.create({
            data: {
              organizationId: auth.organizationId,
              subscriptionId,
              amount: preview.proratedDelta,
              reason: d(preview.proratedDelta).lt(0) ? "Proration credit" : "Proration debit",
              status: "DRAFT",
            },
          });

          await writeAuditEvent(tx, {
            organizationId: auth.organizationId,
            actorId: auth.userId,
            entityType: "credit_note",
            entityId: creditNote.id,
            eventType: "credit_note.created",
            afterSummary: { amount: preview.proratedDelta, reason: "Proration" },
          });
        }
      }

      await writeAuditEvent(tx, {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        entityType: "subscription",
        entityId: subscriptionId,
        eventType: "subscription.changed",
        beforeSummary: { total: String(subscription.total) },
        afterSummary: { total: preview.newTotal },
      });

      await writeOutboxEvent(tx, {
        organizationId: auth.organizationId,
        eventType: OutboxEventTypes.SUBSCRIPTION_CHANGED,
        payload: { subscriptionId },
      });

      await writeDealEvent(tx, {
        organizationId: auth.organizationId,
        eventType: "subscription.changed",
        title: "Subscription changed",
        description: `Total changed from ${preview.currentTotal} to ${preview.newTotal}`,
        actorId: auth.userId,
        visibility: "INTERNAL",
      });
    });

    return this.get(auth, subscriptionId);
  }

  async cancel(
    auth: AuthContext,
    subscriptionId: string,
    input: {
      effectiveDate: string;
      reason: string;
    },
  ) {
    const subscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, organizationId: auth.organizationId },
    });

    if (!subscription) throw Errors.notFound("Subscription");

    if (subscription.status !== "ACTIVE") {
      throw Errors.conflict("Subscription must be active to cancel");
    }

    const effectiveDate = new Date(input.effectiveDate);

    await prisma.$transaction(async (tx: any) => {
      await tx.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: "CANCELLED",
          endDate: effectiveDate,
        },
      });

      // Cancel pending billing schedules
      await tx.billingSchedule.updateMany({
        where: {
          subscriptionId,
          periodStart: { gte: effectiveDate },
          status: "PENDING",
        },
        data: {
          status: "SKIPPED",
        },
      });

      await writeAuditEvent(tx, {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        entityType: "subscription",
        entityId: subscriptionId,
        eventType: "subscription.cancelled",
        beforeSummary: { status: "ACTIVE" },
        afterSummary: { status: "CANCELLED", endDate: input.effectiveDate },
      });

      await writeOutboxEvent(tx, {
        organizationId: auth.organizationId,
        eventType: OutboxEventTypes.DEAL_ACTIVITY_RECORDED,
        payload: { type: "subscription_cancelled", subscriptionId },
      });

      await writeDealEvent(tx, {
        organizationId: auth.organizationId,
        eventType: "subscription.cancelled",
        title: "Subscription cancelled",
        description: input.reason,
        actorId: auth.userId,
        visibility: "INTERNAL",
      });
    });

    return { success: true };
  }

  async listSchedules(auth: AuthContext, subscriptionId: string) {
    const subscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, organizationId: auth.organizationId },
    });

    if (!subscription) throw Errors.notFound("Subscription");

    const schedules = await prisma.billingSchedule.findMany({
      where: { subscriptionId },
      orderBy: { periodStart: "asc" },
    });

    return schedules.map((s: any) => ({
      id: s.id,
      periodStart: s.periodStart.toISOString(),
      periodEnd: s.periodEnd.toISOString(),
      dueDate: s.dueDate.toISOString(),
      amount: String(s.amount),
      status: s.status,
      invoiceId: s.invoiceId,
      generatedAt: s.generatedAt?.toISOString() ?? null,
    }));
  }
}

export const subscriptionService = new SubscriptionService();
