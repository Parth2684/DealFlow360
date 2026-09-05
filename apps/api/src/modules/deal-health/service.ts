import { prisma } from "@repo/db";
import { Errors } from "@repo/contracts";
import { d } from "../../shared/decimal.js";
import { writeAuditEvent } from "../../shared/outbox.js";
import type { AuthContext } from "../../shared/context.js";

export class DealHealthService {
  async listAlerts(auth: AuthContext) {
    const alerts = await prisma.alert.findMany({
      where: { organizationId: auth.organizationId, status: { in: ["ACTIVE", "SNOOZED"] } },
      include: { quote: true },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });

    return alerts.map((a: any) => ({
      id: a.id,
      quoteId: a.quoteId,
      quoteNumber: a.quote?.quoteNumber ?? null,
      type: a.type,
      severity: a.severity,
      priority: a.priority,
      title: a.title,
      description: a.description,
      status: a.status,
      acknowledgedAt: a.acknowledgedAt?.toISOString() ?? null,
      acknowledgedBy: a.acknowledgedBy,
      snoozedUntil: a.snoozedUntil?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  async getAlert(auth: AuthContext, alertId: string) {
    const alert = await prisma.alert.findFirst({
      where: { id: alertId, organizationId: auth.organizationId },
      include: { quote: true },
    });

    if (!alert) throw Errors.notFound("Alert");

    return {
      id: alert.id,
      quoteId: alert.quoteId,
      quoteNumber: alert.quote?.quoteNumber ?? null,
      type: alert.type,
      severity: alert.severity,
      priority: alert.priority,
      title: alert.title,
      description: alert.description,
      metadata: alert.metadata,
      status: alert.status,
      acknowledgedAt: alert.acknowledgedAt?.toISOString() ?? null,
      acknowledgedBy: alert.acknowledgedBy,
      snoozedUntil: alert.snoozedUntil?.toISOString() ?? null,
      createdAt: alert.createdAt.toISOString(),
      updatedAt: alert.updatedAt.toISOString(),
    };
  }

  async acknowledgeAlert(auth: AuthContext, alertId: string) {
    const alert = await prisma.alert.findFirst({
      where: { id: alertId, organizationId: auth.organizationId },
    });

    if (!alert) throw Errors.notFound("Alert");

    if (alert.status === "ACKNOWLEDGED") {
      throw Errors.conflict("Alert is already acknowledged");
    }

    await prisma.alert.update({
      where: { id: alertId },
      data: {
        status: "ACKNOWLEDGED",
        acknowledgedAt: new Date(),
        acknowledgedBy: auth.userId,
      },
    });

    await writeAuditEvent(prisma, {
      organizationId: auth.organizationId,
      actorId: auth.userId,
      entityType: "alert",
      entityId: alertId,
      eventType: "alert.acknowledged",
      afterSummary: { alertId },
    });

    return { success: true };
  }

  async snoozeAlert(auth: AuthContext, alertId: string, until: string) {
    const alert = await prisma.alert.findFirst({
      where: { id: alertId, organizationId: auth.organizationId },
    });

    if (!alert) throw Errors.notFound("Alert");

    const snoozeUntil = new Date(until);

    await prisma.alert.update({
      where: { id: alertId },
      data: {
        status: "SNOOZED",
        snoozedUntil: snoozeUntil,
      },
    });

    await writeAuditEvent(prisma, {
      organizationId: auth.organizationId,
      actorId: auth.userId,
      entityType: "alert",
      entityId: alertId,
      eventType: "alert.snoozed",
      afterSummary: { alertId, until },
    });

    return { success: true };
  }

  async listSnapshots(auth: AuthContext, quoteId: string) {
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, organizationId: auth.organizationId },
    });

    if (!quote) throw Errors.notFound("Quote");

    const snapshots = await prisma.dealSnapshot.findMany({
      where: { organizationId: auth.organizationId, quoteId },
      orderBy: { createdAt: "desc" },
    });

    return snapshots.map((s: any) => ({
      id: s.id,
      quoteId: s.quoteId,
      reason: s.reason,
      stage: s.stage,
      total: String(s.total),
      marginPercent: String(s.marginPercent),
      createdAt: s.createdAt.toISOString(),
    }));
  }

  async getSnapshot(auth: AuthContext, snapshotId: string) {
    const snapshot = await prisma.dealSnapshot.findFirst({
      where: { id: snapshotId, organizationId: auth.organizationId },
    });

    if (!snapshot) throw Errors.notFound("Deal snapshot");

    return {
      id: snapshot.id,
      quoteId: snapshot.quoteId,
      reason: snapshot.reason,
      stage: snapshot.stage,
      currency: snapshot.currency,
      subtotal: String(snapshot.subtotal),
      taxTotal: String(snapshot.taxTotal),
      discountTotal: String(snapshot.discountTotal),
      total: String(snapshot.total),
      costTotal: String(snapshot.costTotal),
      grossMargin: String(snapshot.grossMargin),
      marginPercent: String(snapshot.marginPercent),
      riskFacts: snapshot.riskFacts,
      lines: snapshot.lines,
      createdAt: snapshot.createdAt.toISOString(),
    };
  }

  async createSnapshot(auth: AuthContext, quoteId: string, reason: string) {
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, organizationId: auth.organizationId },
      include: { currentVersion: { include: { lines: true } } },
    });

    if (!quote?.currentVersion) throw Errors.notFound("Quote");

    const snapshot = await prisma.dealSnapshot.create({
      data: {
        organizationId: auth.organizationId,
        quoteId,
        reason,
        stage: quote.stage,
        currency: quote.currentVersion.currency,
        subtotal: quote.currentVersion.subtotal,
        taxTotal: quote.currentVersion.taxTotal,
        discountTotal: quote.currentVersion.discountTotal,
        total: quote.currentVersion.total,
        costTotal: quote.currentVersion.costTotal,
        grossMargin: quote.currentVersion.grossMargin,
        marginPercent: quote.currentVersion.marginPercent,
        riskFacts: quote.currentVersion.riskFacts,
        lines: quote.currentVersion.lines,
      },
    });

    await writeAuditEvent(prisma, {
      organizationId: auth.organizationId,
      actorId: auth.userId,
      entityType: "deal_snapshot",
      entityId: snapshot.id,
      eventType: "deal_snapshot.created",
      afterSummary: { quoteId, reason },
    });

    return this.getSnapshot(auth, snapshot.id);
  }

  async calculateHealthScore(auth: AuthContext, quoteId: string) {
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, organizationId: auth.organizationId },
      include: {
        currentVersion: true,
        customerAccount: true,
        approvalRequests: {
          where: { status: "PENDING" },
        },
      },
    });

    if (!quote?.currentVersion) throw Errors.notFound("Quote");

    const marginPercent = d(quote.currentVersion.marginPercent);
    const customer = quote.customerAccount;
    const pendingApprovals = quote.approvalRequests.length;

    // Calculate health score (0-100)
    let score = 100;

    // Margin penalty (below 20% reduces score)
    if (marginPercent.lt(20)) {
      score -= 20;
    } else if (marginPercent.lt(30)) {
      score -= 10;
    }

    // Credit exposure penalty
    const exposureRatio = d(customer.currentExposure).div(d(customer.creditLimit).gt(0) ? d(customer.creditLimit) : d(1));
    if (exposureRatio.gt(0.8)) {
      score -= 15;
    } else if (exposureRatio.gt(0.6)) {
      score -= 8;
    }

    // Overdue balance penalty
    if (d(customer.overdueBalance).gt(0)) {
      score -= 15;
    }

    // Pending approvals penalty
    if (pendingApprovals > 0) {
      score -= 10;
    }

    // Stage penalty
    if (quote.stage === "DRAFT") {
      score -= 5;
    } else if (quote.stage === "EXPIRED") {
      score -= 30;
    }

    // Ensure score is between 0 and 100
    score = Math.max(0, Math.min(100, score));

    // Determine health category
    let category: "HEALTHY" | "AT_RISK" | "CRITICAL";
    if (score >= 80) {
      category = "HEALTHY";
    } else if (score >= 50) {
      category = "AT_RISK";
    } else {
      category = "CRITICAL";
    }

    return {
      quoteId,
      score,
      category,
      factors: {
        marginPercent: marginPercent.toNumber(),
        creditExposureRatio: exposureRatio.toNumber(),
        overdueBalance: d(customer.overdueBalance).toNumber(),
        pendingApprovals,
        stage: quote.stage,
      },
      recommendations: this.generateRecommendations(score, marginPercent, exposureRatio, d(customer.overdueBalance), pendingApprovals),
    };
  }

  private generateRecommendations(
    score: number,
    marginPercent: any,
    exposureRatio: any,
    overdueBalance: any,
    pendingApprovals: number,
  ): string[] {
    const recommendations: string[] = [];

    if (marginPercent.lt(20)) {
      recommendations.push("Consider increasing price or reducing costs to improve margin");
    }

    if (exposureRatio.gt(0.8)) {
      recommendations.push("Customer credit exposure is high - consider collecting payments");
    }

    if (overdueBalance.gt(0)) {
      recommendations.push("Follow up on overdue payments");
    }

    if (pendingApprovals > 0) {
      recommendations.push("Follow up on pending approvals");
    }

    if (score < 50) {
      recommendations.push("Review overall deal terms and consider restructuring");
    }

    return recommendations;
  }
}

export const dealHealthService = new DealHealthService();
