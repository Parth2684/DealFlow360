import { Router, type Request, type Response } from "express";

import {
  AlertDtoSchema,
  AlertListQuerySchema,
  apiRoutes,
  CONFIGURATION_STATUSES,
  CreateDealHealthSnapshotRequestSchema,
  CreateExportJobRequestSchema,
  CreateNudgeRequestSchema,
  CreateSavedReportFilterRequestSchema,
  DealHealthDashboardDtoSchema,
  DealHealthDashboardQuerySchema,
  DealHealthSnapshotDtoSchema,
  DomainEventTypeSchema,
  ExportDownloadDtoSchema,
  ExportJobDtoSchema,
  DOMAIN_EVENT_TYPES,
  formatEnumLabel,
  INVOICE_STATUSES,
  ListQuerySchema,
  NotificationDtoSchema,
  NudgeDtoSchema,
  ORDER_STATUSES,
  QUOTE_STAGES,
  REPORT_TYPES,
  ReportAggregationDtoSchema,
  ReportAggregationQuerySchema,
  RealtimeInvalidationEventDtoSchema,
  SavedReportFilterDtoSchema,
  SavedReportFilterListQuerySchema,
  SavedReportFilterPageDtoSchema,
  ServerSentEventSchema,
  SnoozeAlertRequestSchema,
  UpdateSavedReportFilterRequestSchema,
  type DomainEventType,
  type RealtimeInvalidationTopic,
  type ReportType,
} from "@repo/common";
import { prisma, Prisma } from "@repo/db";

import {
  authenticateInternal,
  internalPrincipal,
  requireCapability,
  requireCsrf,
} from "../../middleware/auth.js";
import { exportRateLimit } from "../../middleware/rate-limit.js";
import { jsonInput, recordActivity } from "../../shared/activity.js";
import {
  conflict,
  forbidden,
  HttpError,
  notFound,
} from "../../shared/errors.js";
import {
  cursorArgs,
  pageFromRows,
  parseBody,
  parsePathId,
  parseQuery,
  toJsonValue,
} from "../../shared/http.js";
import type { InternalPrincipal } from "../../shared/types.js";
import { WORKER_EVENT_TYPES } from "../../worker/job-events.js";
import { orderVisibilityWhere } from "../operations/access.js";
import {
  addBillingDays,
  startOfBillingDateInstant,
} from "../billing/periods.js";
import { hasOrganizationWideQuoteAccess } from "../quotations/service.js";
import {
  calculateHealth,
  levelFromScore,
  mapHealthCalculation,
  persistHealthSnapshot,
} from "./health.js";
import {
  EXPORT_FAILURE_MESSAGE,
  persistedExportStorage,
  validateExportFilters,
} from "./exports.js";

const alertInclude = {
  quote: { select: { quoteNumber: true } },
  acknowledgedBy: true,
} satisfies Prisma.AlertInclude;

type AlertRecord = Prisma.AlertGetPayload<{ include: typeof alertInclude }>;

function jsonObject(value: unknown): Record<string, unknown> {
  const converted = toJsonValue(value);
  return converted !== null &&
    typeof converted === "object" &&
    !Array.isArray(converted)
    ? (converted as Record<string, unknown>)
    : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function mapAlert(alert: AlertRecord) {
  return AlertDtoSchema.parse({
    id: alert.id,
    quoteId: alert.quoteId,
    quoteNumber: alert.quote?.quoteNumber ?? null,
    type: alert.type,
    severity: alert.severity,
    status: alert.status,
    reasonCode: alert.reasonCode,
    title: alert.title,
    message: alert.message,
    facts: jsonObject(alert.facts),
    acknowledgedByName:
      alert.acknowledgedBy === null
        ? null
        : `${alert.acknowledgedBy.firstName} ${alert.acknowledgedBy.lastName}`,
    acknowledgedAt: alert.acknowledgedAt?.toISOString() ?? null,
    snoozedUntil: alert.snoozedUntil?.toISOString() ?? null,
    resolvedAt: alert.resolvedAt?.toISOString() ?? null,
    detectedAt: alert.detectedAt.toISOString(),
    revision: alert.revision,
    updatedAt: alert.updatedAt.toISOString(),
  });
}

function mapHistoricalSnapshot(snapshot: {
  id: string;
  quoteId: string | null;
  reason: string;
  healthScore: Prisma.Decimal;
  stalledDays: number;
  discountAnomalyScore: Prisma.Decimal;
  approvalSlaHoursOverdue: number;
  promiseSlippageDays: number;
  creditExposure: Prisma.Decimal;
  facts: Prisma.JsonValue;
  calculatedAt: Date;
}) {
  const facts = jsonObject(snapshot.facts);
  return DealHealthSnapshotDtoSchema.parse({
    id: snapshot.id,
    quoteId: snapshot.quoteId,
    reason: snapshot.reason,
    healthScore: snapshot.healthScore.toString(),
    riskLevel: levelFromScore(snapshot.healthScore),
    stalledDays: snapshot.stalledDays,
    discountAnomalyScore: snapshot.discountAnomalyScore.toString(),
    approvalSlaHoursOverdue: snapshot.approvalSlaHoursOverdue,
    promiseSlippageDays: snapshot.promiseSlippageDays,
    creditExposure: snapshot.creditExposure.toString(),
    facts,
    explanation: stringArray(facts["explanation"]),
    calculatedAt: snapshot.calculatedAt.toISOString(),
  });
}

function mapExport(job: {
  id: string;
  reportType: "QUOTES" | "ORDERS" | "INVOICES" | "CUSTOMERS" | "INVENTORY";
  format: "CSV" | "XLSX" | "PDF";
  filters: Prisma.JsonValue;
  status:
    "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "EXPIRED" | "CANCELLED";
  progress: number;
  resultLocation: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const effectiveStatus =
    job.status === "COMPLETED" &&
    job.expiresAt !== null &&
    job.expiresAt <= new Date()
      ? "EXPIRED"
      : job.status;
  return ExportJobDtoSchema.parse({
    id: job.id,
    reportType: job.reportType,
    format: job.format,
    filters: jsonObject(job.filters),
    status: effectiveStatus,
    progress: job.progress,
    downloadUrl:
      effectiveStatus === "COMPLETED" &&
      persistedExportStorage.isPersistedLocation(
        job.resultLocation,
        job.format,
      ) &&
      (job.expiresAt === null || job.expiresAt > new Date())
        ? apiRoutes.reporting.file(job.id)
        : null,
    errorMessage: effectiveStatus === "FAILED" ? EXPORT_FAILURE_MESSAGE : null,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    expiresAt: job.expiresAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  });
}

function mapNotification(notification: {
  id: string;
  channel: "IN_APP" | "EMAIL";
  type: string;
  title: string;
  body: string;
  data: Prisma.JsonValue;
  status: "QUEUED" | "SENT" | "FAILED" | "CANCELLED";
  readAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
}) {
  return NotificationDtoSchema.parse({
    id: notification.id,
    channel: notification.channel,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    data: jsonObject(notification.data),
    status: notification.status,
    readAt: notification.readAt?.toISOString() ?? null,
    sentAt: notification.sentAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  });
}

function mapSavedReportFilter(filter: {
  id: string;
  name: string;
  reportType: "QUOTES" | "ORDERS" | "INVOICES" | "CUSTOMERS" | "INVENTORY";
  filters: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}) {
  return SavedReportFilterDtoSchema.parse({
    id: filter.id,
    name: filter.name,
    reportType: filter.reportType,
    filters: jsonObject(filter.filters),
    createdAt: filter.createdAt.toISOString(),
    updatedAt: filter.updatedAt.toISOString(),
  });
}

function invalidationTopics(
  eventType: DomainEventType,
): RealtimeInvalidationTopic[] {
  if (eventType.startsWith("quote.")) {
    return eventType.includes("negotiation")
      ? ["QUOTATIONS", "NEGOTIATION", "REPORTING", "INSIGHTS"]
      : ["QUOTATIONS", "REPORTING", "INSIGHTS"];
  }
  if (eventType.startsWith("approval.")) {
    return ["APPROVALS", "QUOTATIONS", "REPORTING", "INSIGHTS"];
  }
  if (eventType.startsWith("customer.")) {
    return ["NEGOTIATION", "QUOTATIONS", "REPORTING", "INSIGHTS"];
  }
  if (eventType === "order.confirmed") {
    return ["FULFILLMENT", "BILLING", "QUOTATIONS", "REPORTING", "INSIGHTS"];
  }
  if (
    eventType === "stock.reserved" ||
    eventType === "backorder.created" ||
    eventType === "inventory.replenished"
  ) {
    return ["INVENTORY", "FULFILLMENT", "REPORTING", "INSIGHTS"];
  }
  if (
    eventType.startsWith("subscription.") ||
    eventType.startsWith("invoice.") ||
    eventType === "payment.recorded"
  ) {
    return ["BILLING", "REPORTING", "INSIGHTS"];
  }
  return ["INSIGHTS"];
}

function savedFilterNameConflict(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    conflict(
      "A saved report filter already uses this name",
      "SAVED_FILTER_NAME_CONFLICT",
    );
  }
  throw error;
}

function parameterId(request: Request, primary: string, alias: string): string {
  return request.params[primary] === undefined
    ? parsePathId(request, alias)
    : parsePathId(request, primary);
}

function quoteVisibilityWhere(
  principal: InternalPrincipal,
): Prisma.QuoteWhereInput {
  if (hasOrganizationWideQuoteAccess(principal)) return {};
  return {
    OR: [
      { ownerId: principal.userId },
      ...(principal.salesTeamIds.length === 0
        ? []
        : [{ salesTeamId: { in: principal.salesTeamIds } }]),
    ],
  };
}

function customerVisibilityWhere(
  principal: InternalPrincipal,
): Prisma.CustomerAccountWhereInput {
  if (hasOrganizationWideQuoteAccess(principal)) return {};
  return {
    OR: [
      { assignedRepId: principal.userId },
      ...(principal.salesTeamIds.length === 0
        ? []
        : [{ salesTeamId: { in: principal.salesTeamIds } }]),
    ],
  };
}

function invoiceVisibilityWhere(
  principal: InternalPrincipal,
): Prisma.InvoiceWhereInput {
  if (hasOrganizationWideQuoteAccess(principal)) return {};
  return { order: { is: orderVisibilityWhere(principal) } };
}

function reportDateFilter(
  from: string | undefined,
  to: string | undefined,
  timeZone: string,
): Prisma.DateTimeFilter | undefined {
  if (from === undefined && to === undefined) return undefined;
  try {
    return {
      ...(from === undefined
        ? {}
        : {
            gte: startOfBillingDateInstant(
              new Date(`${from}T00:00:00.000Z`),
              timeZone,
            ),
          }),
      ...(to === undefined
        ? {}
        : {
            lt: startOfBillingDateInstant(
              addBillingDays(new Date(`${to}T00:00:00.000Z`), 1),
              timeZone,
            ),
          }),
    };
  } catch (error) {
    if (error instanceof RangeError) {
      throw new HttpError(
        422,
        "Invalid report date range",
        "Choose dates that exist in the organization timezone",
        { code: "INVALID_REPORT_DATE_RANGE" },
      );
    }
    throw error;
  }
}

function quoteWarehouseWhere(
  warehouseId: string | undefined,
): Prisma.QuoteWhereInput {
  if (warehouseId === undefined) return {};
  return {
    orders: {
      some: {
        OR: [
          {
            fulfillmentPlans: {
              some: { allocations: { some: { warehouseId } } },
            },
          },
          { shipments: { some: { warehouseId } } },
          { lines: { some: { stockReservations: { some: { warehouseId } } } } },
        ],
      },
    },
  };
}

function orderWarehouseWhere(
  warehouseId: string | undefined,
): Prisma.OrderWhereInput {
  if (warehouseId === undefined) return {};
  return {
    OR: [
      {
        fulfillmentPlans: {
          some: { allocations: { some: { warehouseId } } },
        },
      },
      { shipments: { some: { warehouseId } } },
      { lines: { some: { stockReservations: { some: { warehouseId } } } } },
    ],
  };
}

function alertVisibilityWhere(
  principal: InternalPrincipal,
): Prisma.AlertWhereInput {
  if (hasOrganizationWideQuoteAccess(principal)) return {};
  return { quote: { is: quoteVisibilityWhere(principal) } };
}

const REPORT_READ_CAPABILITY = {
  QUOTES: "quotation.read",
  ORDERS: "fulfillment.read",
  INVOICES: "billing.read",
  CUSTOMERS: "customer.read",
  INVENTORY: "inventory.read",
} as const satisfies Record<
  ReportType,
  InternalPrincipal["capabilities"][number]
>;

function readableReportTypes(principal: InternalPrincipal): ReportType[] {
  return REPORT_TYPES.filter((reportType) =>
    principal.capabilities.includes(REPORT_READ_CAPABILITY[reportType]),
  );
}

function assertMayReadReport(
  principal: InternalPrincipal,
  reportType: ReportType,
): void {
  if (!principal.capabilities.includes(REPORT_READ_CAPABILITY[reportType])) {
    forbidden(
      `Your role cannot access ${reportType.toLowerCase()} report data`,
    );
  }
}

async function validateOrganizationExportFilters(
  organizationId: string,
  reportType: ReportType,
  filters: unknown,
): Promise<void> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { timezone: true },
  });
  if (organization === null) notFound("Organization");
  validateExportFilters(reportType, filters, {
    timeZone: organization.timezone,
  });
}

function exportVisibilityWhere(
  principal: InternalPrincipal,
): Prisma.ExportJobWhereInput {
  return {
    requestedById: principal.userId,
    reportType: { in: readableReportTypes(principal) },
  };
}

async function expireCompletedExport(
  exportJobId: string,
  organizationId: string,
  now: Date,
): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    const changed = await transaction.exportJob.updateMany({
      where: {
        id: exportJobId,
        organizationId,
        status: "COMPLETED",
        expiresAt: { lte: now },
      },
      data: { status: "EXPIRED", resultLocation: null },
    });
    if (changed.count === 1) {
      await transaction.exportArtifact.deleteMany({
        where: { exportJobId, organizationId },
      });
    }
  });
}

export function createInsightsRouter(): Router {
  const router = Router();

  router.get(
    "/deal-health/alerts",
    authenticateInternal,
    requireCapability("dealHealth.read"),
    async (request, response) => {
      const principal = internalPrincipal(response);
      const query = parseQuery(AlertListQuerySchema, request);
      const rows = await prisma.alert.findMany({
        where: {
          organizationId: principal.organizationId,
          ...alertVisibilityWhere(principal),
          ...(query.status === undefined ? {} : { status: query.status }),
          ...(query.type === undefined ? {} : { type: query.type }),
          ...(query.severity === undefined ? {} : { severity: query.severity }),
          ...(query.quoteId === undefined ? {} : { quoteId: query.quoteId }),
        },
        include: alertInclude,
        orderBy: [{ detectedAt: "desc" }, { id: "desc" }],
        ...cursorArgs(query.cursor, query.limit),
      });
      response.json(pageFromRows(rows.map(mapAlert), query.limit));
    },
  );

  router.get(
    "/deal-health/alerts/:alertId",
    authenticateInternal,
    requireCapability("dealHealth.read"),
    async (request, response) => {
      const principal = internalPrincipal(response);
      const alert = await prisma.alert.findFirst({
        where: {
          id: parsePathId(request, "alertId"),
          organizationId: principal.organizationId,
          ...alertVisibilityWhere(principal),
        },
        include: alertInclude,
      });
      if (alert === null) notFound("Alert");
      response.json(mapAlert(alert));
    },
  );

  router.post(
    "/deal-health/alerts/:alertId/acknowledge",
    authenticateInternal,
    requireCapability("dealHealth.manage"),
    requireCsrf,
    async (request, response) => {
      const principal = internalPrincipal(response);
      const alertId = parsePathId(request, "alertId");
      const alert = await prisma.$transaction(async (transaction) => {
        const existing = await transaction.alert.findFirst({
          where: {
            id: alertId,
            organizationId: principal.organizationId,
            ...alertVisibilityWhere(principal),
          },
        });
        if (existing === null) notFound("Alert");
        if (existing.status === "RESOLVED")
          conflict("A resolved alert cannot be acknowledged", "ALERT_CLOSED");
        const acknowledged = await transaction.alert.updateMany({
          where: {
            id: existing.id,
            organizationId: principal.organizationId,
            ...alertVisibilityWhere(principal),
            revision: existing.revision,
            status: { not: "RESOLVED" },
          },
          data: {
            status: "ACKNOWLEDGED",
            acknowledgedById: principal.userId,
            acknowledgedAt: new Date(),
            revision: { increment: 1 },
          },
        });
        if (acknowledged.count !== 1) {
          conflict("The alert changed or is closed", "REVISION_CONFLICT");
        }
        const updated = await transaction.alert.findUnique({
          where: { id: existing.id },
          include: alertInclude,
        });
        if (updated === null) notFound("Alert");
        return updated;
      });
      response.json(mapAlert(alert));
    },
  );

  router.post(
    "/deal-health/alerts/:alertId/snooze",
    authenticateInternal,
    requireCapability("dealHealth.manage"),
    requireCsrf,
    async (request, response) => {
      const principal = internalPrincipal(response);
      const input = parseBody(SnoozeAlertRequestSchema, request);
      const until = new Date(input.until);
      if (until <= new Date()) {
        throw new HttpError(
          422,
          "Invalid snooze time",
          "Snooze time must be in the future",
          {
            code: "VALIDATION_FAILED",
          },
        );
      }
      const alertId = parsePathId(request, "alertId");
      const alert = await prisma.$transaction(async (transaction) => {
        const updated = await transaction.alert.updateMany({
          where: {
            id: alertId,
            organizationId: principal.organizationId,
            ...alertVisibilityWhere(principal),
            status: { not: "RESOLVED" },
            ...(input.revision === undefined
              ? {}
              : { revision: input.revision }),
          },
          data: {
            status: "SNOOZED",
            snoozedUntil: until,
            revision: { increment: 1 },
          },
        });
        if (updated.count !== 1)
          conflict("The alert changed or is closed", "REVISION_CONFLICT");
        const result = await transaction.alert.findUnique({
          where: { id: alertId },
          include: alertInclude,
        });
        if (result === null) notFound("Alert");
        return result;
      });
      response.json(mapAlert(alert));
    },
  );

  router.get(
    "/deal-health/quotes/:quoteId/snapshots",
    authenticateInternal,
    requireCapability("dealHealth.read"),
    async (request, response) => {
      const principal = internalPrincipal(response);
      const quoteId = parsePathId(request, "quoteId");
      await prisma.$transaction((transaction) =>
        calculateHealth(transaction, principal, quoteId),
      );
      const snapshots = await prisma.dealHealthSnapshot.findMany({
        where: { organizationId: principal.organizationId, quoteId },
        orderBy: { calculatedAt: "desc" },
      });
      response.json(snapshots.map(mapHistoricalSnapshot));
    },
  );

  router.post(
    "/deal-health/quotes/:quoteId/snapshots",
    authenticateInternal,
    requireCapability("dealHealth.manage"),
    requireCsrf,
    async (request, response) => {
      const principal = internalPrincipal(response);
      const input = parseBody(CreateDealHealthSnapshotRequestSchema, request);
      const snapshot = await prisma.$transaction((transaction) =>
        persistHealthSnapshot(
          transaction,
          principal,
          parsePathId(request, "quoteId"),
          input.reason,
        ),
      );
      response.status(201).json(snapshot);
    },
  );

  router.get(
    "/deal-health/quotes/:quoteId/snapshots/:snapshotId",
    authenticateInternal,
    requireCapability("dealHealth.read"),
    async (request, response) => {
      const principal = internalPrincipal(response);
      const quoteId = parsePathId(request, "quoteId");
      await prisma.$transaction((transaction) =>
        calculateHealth(transaction, principal, quoteId),
      );
      const snapshot = await prisma.dealHealthSnapshot.findFirst({
        where: {
          id: parsePathId(request, "snapshotId"),
          quoteId,
          organizationId: principal.organizationId,
        },
      });
      if (snapshot === null) notFound("Deal-health snapshot");
      response.json(mapHistoricalSnapshot(snapshot));
    },
  );

  router.get(
    "/deal-health/quotes/:quoteId/health-score",
    authenticateInternal,
    requireCapability("dealHealth.read"),
    async (request, response) => {
      const principal = internalPrincipal(response);
      const calculation = await prisma.$transaction((transaction) =>
        calculateHealth(
          transaction,
          principal,
          parsePathId(request, "quoteId"),
        ),
      );
      response.json(mapHealthCalculation(calculation));
    },
  );

  router.post(
    "/alerts/:alertId/nudge",
    authenticateInternal,
    requireCapability("dealHealth.manage"),
    requireCsrf,
    async (request, response) => {
      const principal = internalPrincipal(response);
      const input = parseBody(CreateNudgeRequestSchema, request);
      const nudge = await prisma.$transaction(async (transaction) => {
        const alert = await transaction.alert.findFirst({
          where: {
            id: parsePathId(request, "alertId"),
            organizationId: principal.organizationId,
            ...alertVisibilityWhere(principal),
          },
          include: {
            quote: {
              select: {
                customerAccountId: true,
                ownerId: true,
                salesTeamId: true,
              },
            },
          },
        });
        if (alert === null) notFound("Alert");
        const recipientUser =
          input.recipientUserId === undefined
            ? null
            : await transaction.user.findFirst({
                where: {
                  id: input.recipientUserId,
                  organizationId: principal.organizationId,
                  status: "ACTIVE",
                },
                include: {
                  roleAssignments: {
                    where: {
                      active: true,
                      organizationId: principal.organizationId,
                    },
                  },
                },
              });
        const recipientContact =
          input.recipientContactId === undefined
            ? null
            : await transaction.customerContact.findFirst({
                where: {
                  id: input.recipientContactId,
                  organizationId: principal.organizationId,
                  status: "ACTIVE",
                },
                include: { portalIdentity: true },
              });
        if (input.recipientUserId !== undefined && recipientUser === null)
          notFound("Nudge recipient user");
        if (input.recipientContactId !== undefined && recipientContact === null)
          notFound("Nudge recipient contact");
        if (
          recipientContact !== null &&
          (alert.quote === null ||
            recipientContact.customerAccountId !==
              alert.quote.customerAccountId)
        ) {
          forbidden(
            "The customer contact is not related to this alert's quote",
          );
        }
        if (recipientUser !== null && alert.quote !== null) {
          const assignedToQuote =
            recipientUser.id === alert.quote.ownerId ||
            (alert.quote.salesTeamId !== null &&
              recipientUser.roleAssignments.some(
                (assignment) =>
                  assignment.salesTeamId === alert.quote?.salesTeamId,
              ));
          const permittedSpecialistRoles =
            alert.type === "CREDIT_EXPOSURE"
              ? ["ADMIN", "FINANCE"]
              : alert.type === "PROMISE_SLIPPAGE"
                ? ["ADMIN", "OPERATIONS"]
                : ["ADMIN", "SALES_MANAGER"];
          const isRelevantSpecialist = recipientUser.roleAssignments.some(
            (assignment) => permittedSpecialistRoles.includes(assignment.role),
          );
          if (!assignedToQuote && !isRelevantSpecialist) {
            forbidden(
              "The internal recipient is not related to this alert's quote or function",
            );
          }
        }
        if (
          input.channel === "IN_APP" &&
          recipientContact !== null &&
          recipientContact.portalIdentity === null
        ) {
          conflict(
            "The customer contact has no portal identity for an in-app nudge",
            "PORTAL_IDENTITY_REQUIRED",
          );
        }
        const sentAt = input.channel === "IN_APP" ? new Date() : null;
        const created = await transaction.nudge.create({
          data: {
            organizationId: principal.organizationId,
            alertId: alert.id,
            requestedById: principal.userId,
            recipientUserId: input.recipientUserId,
            recipientContactId: input.recipientContactId,
            channel: input.channel,
            message: input.message,
            status: sentAt === null ? "QUEUED" : "SENT",
            sentAt,
          },
        });
        if (sentAt !== null) {
          await transaction.notification.create({
            data: {
              organizationId: principal.organizationId,
              recipientUserId: recipientUser?.id,
              recipientPortalIdentityId: recipientContact?.portalIdentity?.id,
              channel: "IN_APP",
              type: "DEAL_HEALTH_NUDGE",
              title: alert.title,
              body: input.message,
              data: jsonInput({ alertId: alert.id, quoteId: alert.quoteId }),
              status: "SENT",
              sentAt,
            },
          });
        }
        await recordActivity(transaction, {
          organizationId: principal.organizationId,
          actor: principal,
          eventType: "nudge.requested",
          entityType: "Nudge",
          entityId: created.id,
          quoteId: alert.quoteId ?? undefined,
          title: "Deal-health nudge requested",
          message: input.message,
        });
        return {
          created,
          recipientName:
            recipientUser === null
              ? `${recipientContact?.firstName ?? "Customer"} ${recipientContact?.lastName ?? "contact"}`
              : `${recipientUser.firstName} ${recipientUser.lastName}`,
        };
      });
      response.status(201).json(
        NudgeDtoSchema.parse({
          id: nudge.created.id,
          alertId: nudge.created.alertId,
          channel: nudge.created.channel,
          recipientName: nudge.recipientName,
          message: nudge.created.message,
          status: nudge.created.status,
          errorMessage: nudge.created.errorMessage,
          requestedAt: nudge.created.requestedAt.toISOString(),
          sentAt: nudge.created.sentAt?.toISOString() ?? null,
        }),
      );
    },
  );

  router.get(
    "/dashboard/deal-health",
    authenticateInternal,
    requireCapability("dealHealth.read"),
    async (request, response) => {
      const principal = internalPrincipal(response);
      const query = parseQuery(DealHealthDashboardQuerySchema, request);
      const organization = await prisma.organization.findUnique({
        where: { id: principal.organizationId },
        select: { timezone: true },
      });
      if (organization === null) notFound("Organization");
      const from =
        query.from === undefined
          ? undefined
          : startOfBillingDateInstant(
              new Date(`${query.from}T00:00:00.000Z`),
              organization.timezone,
            );
      const toExclusive =
        query.to === undefined
          ? undefined
          : startOfBillingDateInstant(
              addBillingDays(new Date(`${query.to}T00:00:00.000Z`), 1),
              organization.timezone,
            );
      const currentVersionFilterRequired =
        query.productId !== undefined ||
        query.categoryId !== undefined ||
        query.approvalStatus !== undefined;
      const dashboardQuoteWhere: Prisma.QuoteWhereInput = {
        AND: [
          quoteVisibilityWhere(principal),
          quoteWarehouseWhere(query.warehouseId),
          {
            ...(query.stage === undefined ? {} : { stage: query.stage }),
            ...(query.ownerId === undefined ? {} : { ownerId: query.ownerId }),
            ...(query.salesTeamId === undefined
              ? {}
              : { salesTeamId: query.salesTeamId }),
            ...(currentVersionFilterRequired
              ? {
                  currentVersion: {
                    is: {
                      ...(query.productId === undefined &&
                      query.categoryId === undefined
                        ? {}
                        : {
                            lines: {
                              some: {
                                ...(query.productId === undefined
                                  ? {}
                                  : { productId: query.productId }),
                                ...(query.categoryId === undefined
                                  ? {}
                                  : {
                                      product: { categoryId: query.categoryId },
                                    }),
                              },
                            },
                          }),
                      ...(query.approvalStatus === undefined
                        ? {}
                        : {
                            approvalRequests: {
                              some: { status: query.approvalStatus },
                            },
                          }),
                    },
                  },
                }
              : {}),
            ...(from === undefined && toExclusive === undefined
              ? {}
              : {
                  updatedAt: {
                    ...(from === undefined ? {} : { gte: from }),
                    ...(toExclusive === undefined ? {} : { lt: toExclusive }),
                  },
                }),
          },
        ],
      };
      const quotes = await prisma.quote.findMany({
        where: {
          organizationId: principal.organizationId,
          AND: [
            dashboardQuoteWhere,
            { stage: { notIn: ["CONFIRMED", "CANCELLED", "EXPIRED"] } },
          ],
        },
        include: { currentVersion: true },
      });
      const stageWeight: Readonly<Record<string, string>> = {
        DRAFT: "0.2",
        PENDING_APPROVAL: "0.4",
        REVISION_REQUIRED: "0.3",
        READY_TO_SEND: "0.6",
        SENT: "0.7",
        UNDER_NEGOTIATION: "0.8",
        CUSTOMER_ACCEPTED: "0.95",
      };
      const openPipelineValue = quotes.reduce(
        (sum, quote) => sum.plus(quote.currentVersion?.total ?? 0),
        new Prisma.Decimal(0),
      );
      const weightedPipelineValue = quotes.reduce(
        (sum, quote) =>
          sum.plus(
            (quote.currentVersion?.total ?? new Prisma.Decimal(0)).mul(
              stageWeight[quote.stage] ?? "0",
            ),
          ),
        new Prisma.Decimal(0),
      );
      const [
        approvalQueueCount,
        overdueInvoices,
        alertCounts,
        snapshots,
        pendingNegotiationCount,
        ownerOptions,
        salesTeamOptions,
        warehouseOptions,
        productOptions,
        categoryOptions,
      ] = await Promise.all([
        prisma.approvalRequest.count({
          where: {
            organizationId: principal.organizationId,
            status: { in: ["PENDING", "IN_PROGRESS"] },
            quote: dashboardQuoteWhere,
          },
        }),
        prisma.invoice.aggregate({
          where: {
            organizationId: principal.organizationId,
            status: "OVERDUE",
            balanceDue: { gt: 0 },
            order: {
              AND: [
                orderVisibilityWhere(principal),
                orderWarehouseWhere(query.warehouseId),
                { quote: dashboardQuoteWhere },
              ],
            },
          },
          _sum: { balanceDue: true },
        }),
        prisma.alert.groupBy({
          by: ["severity", "type"],
          where: {
            organizationId: principal.organizationId,
            status: { in: ["OPEN", "ACKNOWLEDGED"] },
            quote: { is: dashboardQuoteWhere },
          },
          _count: { _all: true },
        }),
        prisma.dealHealthSnapshot.findMany({
          where: {
            organizationId: principal.organizationId,
            quoteId: { not: null },
            quote: { is: dashboardQuoteWhere },
          },
          include: { quote: { include: { customerAccount: true } } },
          orderBy: { calculatedAt: "desc" },
          take: 100,
        }),
        prisma.quote.count({
          where: {
            organizationId: principal.organizationId,
            AND: [dashboardQuoteWhere, { stage: "UNDER_NEGOTIATION" }],
          },
        }),
        prisma.quote.findMany({
          where: {
            organizationId: principal.organizationId,
            ...quoteVisibilityWhere(principal),
          },
          distinct: ["ownerId"],
          select: {
            ownerId: true,
            owner: { select: { firstName: true, lastName: true } },
          },
          orderBy: { ownerId: "asc" },
          take: 250,
        }),
        prisma.salesTeam.findMany({
          where: {
            organizationId: principal.organizationId,
            status: "ACTIVE",
            ...(!hasOrganizationWideQuoteAccess(principal)
              ? { id: { in: principal.salesTeamIds } }
              : {}),
          },
          select: { id: true, name: true },
          orderBy: [{ name: "asc" }, { id: "asc" }],
          take: 250,
        }),
        prisma.warehouse.findMany({
          where: { organizationId: principal.organizationId, status: "ACTIVE" },
          select: { id: true, code: true, name: true },
          orderBy: [{ name: "asc" }, { id: "asc" }],
          take: 250,
        }),
        prisma.product.findMany({
          where: { organizationId: principal.organizationId, status: "ACTIVE" },
          select: { id: true, code: true, name: true },
          orderBy: [{ name: "asc" }, { id: "asc" }],
          take: 500,
        }),
        prisma.productCategory.findMany({
          where: { organizationId: principal.organizationId, status: "ACTIVE" },
          select: { id: true, code: true, name: true },
          orderBy: [{ name: "asc" }, { id: "asc" }],
          take: 250,
        }),
      ]);
      const alertsBySeverity = { INFO: 0, WARNING: 0, CRITICAL: 0 };
      for (const row of alertCounts)
        alertsBySeverity[row.severity] = row._count._all;
      const alertsByRequiredKpi = {
        stalledDealCount: 0,
        discountAnomalyCount: 0,
        approvalDelayCount: 0,
        deliverySlippageCount: 0,
      };
      for (const row of alertCounts) {
        switch (row.type) {
          case "STALLED_DEAL":
            alertsByRequiredKpi.stalledDealCount += row._count._all;
            break;
          case "DISCOUNT_ANOMALY":
            alertsByRequiredKpi.discountAnomalyCount += row._count._all;
            break;
          case "APPROVAL_SLA":
            alertsByRequiredKpi.approvalDelayCount += row._count._all;
            break;
          case "PROMISE_SLIPPAGE":
            alertsByRequiredKpi.deliverySlippageCount += row._count._all;
            break;
          default:
            break;
        }
      }
      const latestByQuote = new Map<string, (typeof snapshots)[number]>();
      for (const snapshot of snapshots) {
        if (snapshot.quoteId !== null && !latestByQuote.has(snapshot.quoteId)) {
          latestByQuote.set(snapshot.quoteId, snapshot);
        }
      }
      const atRiskQuotes = [...latestByQuote.values()]
        .filter((snapshot) => {
          const level = levelFromScore(snapshot.healthScore);
          return (
            level !== "LOW" &&
            (query.riskLevel === undefined || query.riskLevel === level)
          );
        })
        .sort((left, right) => left.healthScore.comparedTo(right.healthScore))
        .slice(0, 10)
        .flatMap((snapshot) =>
          snapshot.quote === null
            ? []
            : [
                {
                  quoteId: snapshot.quote.id,
                  quoteNumber: snapshot.quote.quoteNumber,
                  customerName: snapshot.quote.customerAccount.name,
                  score: snapshot.healthScore.toString(),
                  riskLevel: levelFromScore(snapshot.healthScore),
                  primaryReason: snapshot.reason,
                },
              ],
        );
      response.json(
        DealHealthDashboardDtoSchema.parse({
          generatedAt: new Date().toISOString(),
          metrics: {
            openPipelineValue: openPipelineValue.toString(),
            weightedPipelineValue: weightedPipelineValue
              .toDecimalPlaces(4)
              .toString(),
            approvalQueueCount,
            overdueInvoiceValue: (
              overdueInvoices._sum.balanceDue ?? new Prisma.Decimal(0)
            ).toString(),
            openAlertCount: Object.values(alertsBySeverity).reduce(
              (sum, value) => sum + value,
              0,
            ),
            ...alertsByRequiredKpi,
            pendingNegotiationCount,
          },
          alertsBySeverity,
          atRiskQuotes,
          filterOptions: {
            owners: ownerOptions.map((option) => ({
              id: option.ownerId,
              label: `${option.owner.firstName} ${option.owner.lastName}`,
            })),
            salesTeams: salesTeamOptions.map((option) => ({
              id: option.id,
              label: option.name,
            })),
            warehouses: warehouseOptions.map((option) => ({
              id: option.id,
              label: `${option.name} (${option.code})`,
            })),
            products: productOptions.map((option) => ({
              id: option.id,
              label: `${option.name} (${option.code})`,
            })),
            categories: categoryOptions.map((option) => ({
              id: option.id,
              label: `${option.name} (${option.code})`,
            })),
          },
        }),
      );
    },
  );

  router.get(
    "/reports/summary",
    authenticateInternal,
    requireCapability("reporting.read"),
    async (request, response) => {
      const principal = internalPrincipal(response);
      const query = parseQuery(ReportAggregationQuerySchema, request);
      assertMayReadReport(principal, query.reportType);
      const organization = await prisma.organization.findUnique({
        where: { id: principal.organizationId },
        select: { timezone: true },
      });
      if (organization === null) notFound("Organization");
      const updatedAt = reportDateFilter(
        query.from,
        query.to,
        organization.timezone,
      );
      const generatedAt = new Date().toISOString();

      if (query.reportType === "QUOTES") {
        const stages = query.stage === undefined ? QUOTE_STAGES : [query.stage];
        const buckets = (
          await Promise.all(
            stages.map(async (stage) => ({
              key: stage,
              label: formatEnumLabel(stage),
              recordCount: await prisma.quote.count({
                where: {
                  organizationId: principal.organizationId,
                  ...quoteVisibilityWhere(principal),
                  stage,
                  ...(updatedAt === undefined ? {} : { updatedAt }),
                },
              }),
            })),
          )
        ).filter((bucket) => bucket.recordCount > 0);
        const totalRecords = buckets.reduce(
          (sum, bucket) => sum + bucket.recordCount,
          0,
        );
        response.json(
          ReportAggregationDtoSchema.parse({
            reportType: query.reportType,
            generatedAt,
            measure: "RECORD_COUNT",
            totalRecords,
            totalValue: String(totalRecords),
            buckets: buckets.map((bucket) => ({
              ...bucket,
              value: String(bucket.recordCount),
            })),
          }),
        );
        return;
      }

      if (query.reportType === "ORDERS") {
        const statuses =
          query.status === undefined ? ORDER_STATUSES : [query.status];
        const buckets = (
          await Promise.all(
            statuses.map(async (status) => ({
              key: status,
              label: formatEnumLabel(status),
              recordCount: await prisma.order.count({
                where: {
                  organizationId: principal.organizationId,
                  ...orderVisibilityWhere(principal),
                  status,
                  ...(updatedAt === undefined ? {} : { updatedAt }),
                },
              }),
            })),
          )
        ).filter((bucket) => bucket.recordCount > 0);
        const totalRecords = buckets.reduce(
          (sum, bucket) => sum + bucket.recordCount,
          0,
        );
        response.json(
          ReportAggregationDtoSchema.parse({
            reportType: query.reportType,
            generatedAt,
            measure: "RECORD_COUNT",
            totalRecords,
            totalValue: String(totalRecords),
            buckets: buckets.map((bucket) => ({
              ...bucket,
              value: String(bucket.recordCount),
            })),
          }),
        );
        return;
      }

      if (query.reportType === "INVOICES") {
        const statuses =
          query.status === undefined ? INVOICE_STATUSES : [query.status];
        const buckets = (
          await Promise.all(
            statuses.map(async (status) => ({
              key: status,
              label: formatEnumLabel(status),
              recordCount: await prisma.invoice.count({
                where: {
                  organizationId: principal.organizationId,
                  ...invoiceVisibilityWhere(principal),
                  status,
                  ...(updatedAt === undefined ? {} : { updatedAt }),
                },
              }),
            })),
          )
        ).filter((bucket) => bucket.recordCount > 0);
        const totalRecords = buckets.reduce(
          (sum, bucket) => sum + bucket.recordCount,
          0,
        );
        response.json(
          ReportAggregationDtoSchema.parse({
            reportType: query.reportType,
            generatedAt,
            measure: "RECORD_COUNT",
            totalRecords,
            totalValue: String(totalRecords),
            buckets: buckets.map((bucket) => ({
              ...bucket,
              value: String(bucket.recordCount),
            })),
          }),
        );
        return;
      }

      if (query.reportType === "CUSTOMERS") {
        const statuses =
          query.status === undefined ? CONFIGURATION_STATUSES : [query.status];
        const buckets = (
          await Promise.all(
            statuses.map(async (status) => ({
              key: status,
              label: formatEnumLabel(status),
              recordCount: await prisma.customerAccount.count({
                where: {
                  organizationId: principal.organizationId,
                  ...customerVisibilityWhere(principal),
                  status,
                  ...(updatedAt === undefined ? {} : { updatedAt }),
                },
              }),
            })),
          )
        ).filter((bucket) => bucket.recordCount > 0);
        const totalRecords = buckets.reduce(
          (sum, bucket) => sum + bucket.recordCount,
          0,
        );
        response.json(
          ReportAggregationDtoSchema.parse({
            reportType: query.reportType,
            generatedAt,
            measure: "RECORD_COUNT",
            totalRecords,
            totalValue: String(totalRecords),
            buckets: buckets.map((bucket) => ({
              ...bucket,
              value: String(bucket.recordCount),
            })),
          }),
        );
        return;
      }

      const grouped = await prisma.inventoryBalance.groupBy({
        by: ["warehouseId"],
        where: {
          organizationId: principal.organizationId,
          ...(updatedAt === undefined ? {} : { updatedAt }),
        },
        _count: { _all: true },
        _sum: { available: true },
      });
      const warehouses = await prisma.warehouse.findMany({
        where: {
          organizationId: principal.organizationId,
          id: { in: grouped.map((row) => row.warehouseId) },
        },
        select: { id: true, code: true, name: true },
      });
      const warehouseById = new Map(
        warehouses.map((warehouse) => [warehouse.id, warehouse]),
      );
      const buckets = grouped
        .map((row) => {
          const warehouse = warehouseById.get(row.warehouseId);
          return {
            key: row.warehouseId,
            label: warehouse
              ? `${warehouse.name} (${warehouse.code})`
              : "Archived Warehouse",
            recordCount: row._count._all,
            value: (row._sum.available ?? new Prisma.Decimal(0)).toString(),
          };
        })
        .sort((left, right) => left.label.localeCompare(right.label));
      const totalRecords = buckets.reduce(
        (sum, bucket) => sum + bucket.recordCount,
        0,
      );
      const totalValue = buckets.reduce(
        (sum, bucket) => sum.plus(bucket.value),
        new Prisma.Decimal(0),
      );
      response.json(
        ReportAggregationDtoSchema.parse({
          reportType: query.reportType,
          generatedAt,
          measure: "AVAILABLE_QUANTITY",
          totalRecords,
          totalValue: totalValue.toString(),
          buckets,
        }),
      );
    },
  );

  router.get(
    "/reports/saved-filters",
    authenticateInternal,
    requireCapability("reporting.read"),
    async (request, response) => {
      const principal = internalPrincipal(response);
      const query = parseQuery(SavedReportFilterListQuerySchema, request);
      if (query.reportType !== undefined) {
        assertMayReadReport(principal, query.reportType);
      }
      const rows = await prisma.savedReportFilter.findMany({
        where: {
          organizationId: principal.organizationId,
          userId: principal.userId,
          reportType:
            query.reportType === undefined
              ? { in: readableReportTypes(principal) }
              : query.reportType,
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        ...cursorArgs(query.cursor, query.limit),
      });
      response.json(
        SavedReportFilterPageDtoSchema.parse(
          pageFromRows(rows.map(mapSavedReportFilter), query.limit),
        ),
      );
    },
  );

  router.post(
    "/reports/saved-filters",
    authenticateInternal,
    requireCapability("reporting.read"),
    requireCsrf,
    async (request, response) => {
      const principal = internalPrincipal(response);
      const input = parseBody(CreateSavedReportFilterRequestSchema, request);
      assertMayReadReport(principal, input.reportType);
      await validateOrganizationExportFilters(
        principal.organizationId,
        input.reportType,
        input.filters,
      );
      try {
        const created = await prisma.savedReportFilter.create({
          data: {
            organizationId: principal.organizationId,
            userId: principal.userId,
            name: input.name,
            reportType: input.reportType,
            filters: jsonInput(input.filters),
          },
        });
        response.status(201).json(mapSavedReportFilter(created));
      } catch (error) {
        savedFilterNameConflict(error);
      }
    },
  );

  router.patch(
    "/reports/saved-filters/:filterId",
    authenticateInternal,
    requireCapability("reporting.read"),
    requireCsrf,
    async (request, response) => {
      const principal = internalPrincipal(response);
      const filterId = parsePathId(request, "filterId");
      const input = parseBody(UpdateSavedReportFilterRequestSchema, request);
      const existing = await prisma.savedReportFilter.findFirst({
        where: {
          id: filterId,
          organizationId: principal.organizationId,
          userId: principal.userId,
        },
      });
      if (existing === null) notFound("Saved report filter");
      assertMayReadReport(principal, existing.reportType);
      if (input.filters !== undefined) {
        await validateOrganizationExportFilters(
          principal.organizationId,
          existing.reportType,
          input.filters,
        );
      }
      try {
        const updated = await prisma.savedReportFilter.updateMany({
          where: {
            id: existing.id,
            organizationId: principal.organizationId,
            userId: principal.userId,
            updatedAt: new Date(input.updatedAt),
          },
          data: {
            ...(input.name === undefined ? {} : { name: input.name }),
            ...(input.filters === undefined
              ? {}
              : { filters: jsonInput(input.filters) }),
          },
        });
        if (updated.count !== 1) {
          conflict(
            "The saved report filter changed after this request was prepared",
            "STALE_SAVED_FILTER",
          );
        }
        const record = await prisma.savedReportFilter.findUniqueOrThrow({
          where: { id: existing.id },
        });
        response.json(mapSavedReportFilter(record));
      } catch (error) {
        savedFilterNameConflict(error);
      }
    },
  );

  router.delete(
    "/reports/saved-filters/:filterId",
    authenticateInternal,
    requireCapability("reporting.read"),
    requireCsrf,
    async (request, response) => {
      const principal = internalPrincipal(response);
      const deleted = await prisma.savedReportFilter.deleteMany({
        where: {
          id: parsePathId(request, "filterId"),
          organizationId: principal.organizationId,
          userId: principal.userId,
          reportType: { in: readableReportTypes(principal) },
        },
      });
      if (deleted.count !== 1) notFound("Saved report filter");
      response.status(204).end();
    },
  );

  const listExports = async (request: Request, response: Response) => {
    const principal = internalPrincipal(response);
    const query = parseQuery(ListQuerySchema, request);
    const rows = await prisma.exportJob.findMany({
      where: {
        organizationId: principal.organizationId,
        ...exportVisibilityWhere(principal),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...cursorArgs(query.cursor, query.limit),
    });
    response.json(pageFromRows(rows.map(mapExport), query.limit));
  };
  const createExport = async (request: Request, response: Response) => {
    const principal = internalPrincipal(response);
    const input = parseBody(CreateExportJobRequestSchema, request);
    assertMayReadReport(principal, input.reportType);
    await validateOrganizationExportFilters(
      principal.organizationId,
      input.reportType,
      input.filters,
    );
    const job = await prisma.$transaction(async (transaction) => {
      const created = await transaction.exportJob.create({
        data: {
          organizationId: principal.organizationId,
          requestedById: principal.userId,
          reportType: input.reportType,
          format: input.format,
          filters: jsonInput({
            ...input.filters,
            ...(!hasOrganizationWideQuoteAccess(principal)
              ? {
                  accessScope: {
                    ownerId: principal.userId,
                    salesTeamIds: principal.salesTeamIds,
                  },
                }
              : {}),
          }),
          status: "QUEUED",
          progress: 0,
        },
      });
      await transaction.outboxEvent.create({
        data: {
          organizationId: principal.organizationId,
          eventType: WORKER_EVENT_TYPES.exportGenerate,
          aggregateType: "ExportJob",
          aggregateId: created.id,
          deduplicationKey: `worker:export:${created.id}`,
          payload: jsonInput({ exportJobId: created.id }),
        },
      });
      return created;
    });
    response.status(201).json(mapExport(job));
  };
  router.get(
    "/reporting/exports",
    authenticateInternal,
    requireCapability("reporting.read"),
    exportRateLimit,
    listExports,
  );
  router.get(
    "/reports/exports",
    authenticateInternal,
    requireCapability("reporting.read"),
    exportRateLimit,
    listExports,
  );
  router.post(
    "/reporting/exports",
    authenticateInternal,
    requireCapability("reporting.export"),
    exportRateLimit,
    requireCsrf,
    createExport,
  );
  router.post(
    "/reports/exports",
    authenticateInternal,
    requireCapability("reporting.export"),
    exportRateLimit,
    requireCsrf,
    createExport,
  );

  const getExport = async (request: Request, response: Response) => {
    const principal = internalPrincipal(response);
    const job = await prisma.exportJob.findFirst({
      where: {
        id: parameterId(request, "jobId", "exportId"),
        organizationId: principal.organizationId,
        ...exportVisibilityWhere(principal),
      },
    });
    if (job === null) notFound("Export job");
    response.json(mapExport(job));
  };
  router.get(
    "/reporting/exports/:jobId",
    authenticateInternal,
    requireCapability("reporting.read"),
    exportRateLimit,
    getExport,
  );
  router.get(
    "/reports/exports/:exportId",
    authenticateInternal,
    requireCapability("reporting.read"),
    exportRateLimit,
    getExport,
  );

  router.delete(
    "/reporting/exports/:jobId",
    authenticateInternal,
    requireCapability("reporting.export"),
    exportRateLimit,
    requireCsrf,
    async (request, response) => {
      const principal = internalPrincipal(response);
      const jobId = parsePathId(request, "jobId");
      const existing = await prisma.exportJob.findFirst({
        where: {
          id: jobId,
          organizationId: principal.organizationId,
          ...exportVisibilityWhere(principal),
        },
        select: { status: true },
      });
      if (existing === null) notFound("Export job");
      if (existing.status === "CANCELLED" || existing.status === "EXPIRED") {
        await prisma.exportArtifact.deleteMany({
          where: {
            exportJobId: jobId,
            organizationId: principal.organizationId,
          },
        });
        response.status(204).end();
        return;
      }
      const changed = await prisma.$transaction(async (transaction) => {
        const result = await transaction.exportJob.updateMany({
          where: {
            id: jobId,
            organizationId: principal.organizationId,
            ...exportVisibilityWhere(principal),
            status: existing.status,
          },
          data: {
            status: "CANCELLED",
            resultLocation: null,
            errorMessage: null,
            expiresAt: new Date(),
          },
        });
        if (result.count === 1) {
          await transaction.exportArtifact.deleteMany({
            where: {
              exportJobId: jobId,
              organizationId: principal.organizationId,
            },
          });
        }
        return result;
      });
      if (changed.count !== 1) {
        conflict(
          "The export job changed while cancellation was requested; refresh and retry",
          "EXPORT_STATUS_CHANGED",
        );
      }
      response.status(204).end();
    },
  );

  router.get(
    "/reporting/exports/:jobId/download",
    authenticateInternal,
    requireCapability("reporting.read"),
    exportRateLimit,
    async (request, response) => {
      const principal = internalPrincipal(response);
      const job = await prisma.exportJob.findFirst({
        where: {
          id: parsePathId(request, "jobId"),
          organizationId: principal.organizationId,
          ...exportVisibilityWhere(principal),
        },
      });
      if (job === null) notFound("Export job");
      if (
        job.status === "COMPLETED" &&
        job.expiresAt !== null &&
        job.expiresAt <= new Date()
      ) {
        await expireCompletedExport(job.id, job.organizationId, new Date());
        throw new HttpError(410, "Export expired", "Create a new export job", {
          code: "EXPORT_EXPIRED",
        });
      }
      if (job.status === "EXPIRED") {
        throw new HttpError(410, "Export expired", "Create a new export job", {
          code: "EXPORT_EXPIRED",
        });
      }
      if (job.status === "QUEUED" || job.status === "PROCESSING") {
        response.status(202).json(
          ExportDownloadDtoSchema.parse({
            status: job.status,
            downloadUrl: null,
            expiresAt: job.expiresAt?.toISOString() ?? null,
          }),
        );
        return;
      }
      if (job.status !== "COMPLETED") {
        throw new HttpError(
          409,
          "Export unavailable",
          job.status === "FAILED"
            ? EXPORT_FAILURE_MESSAGE
            : `The export is ${job.status.toLowerCase()}`,
          { code: `EXPORT_${job.status}` },
        );
      }
      if (
        !persistedExportStorage.isPersistedLocation(
          job.resultLocation,
          job.format,
        )
      ) {
        throw new HttpError(
          409,
          "Export unavailable",
          "No downloadable artifact is available for this export",
          { code: "EXPORT_ARTIFACT_UNAVAILABLE" },
        );
      }
      response.json(
        ExportDownloadDtoSchema.parse({
          status: job.status,
          downloadUrl: apiRoutes.reporting.file(job.id),
          expiresAt: job.expiresAt?.toISOString() ?? null,
        }),
      );
    },
  );

  router.get(
    "/reporting/exports/:jobId/file",
    authenticateInternal,
    requireCapability("reporting.read"),
    exportRateLimit,
    async (request, response) => {
      const principal = internalPrincipal(response);
      const job = await prisma.exportJob.findFirst({
        where: {
          id: parsePathId(request, "jobId"),
          organizationId: principal.organizationId,
          ...exportVisibilityWhere(principal),
        },
      });
      if (job === null) notFound("Export job");
      if (
        job.status === "COMPLETED" &&
        job.expiresAt !== null &&
        job.expiresAt <= new Date()
      ) {
        await expireCompletedExport(job.id, job.organizationId, new Date());
        throw new HttpError(410, "Export expired", "Create a new export job", {
          code: "EXPORT_EXPIRED",
        });
      }
      if (job.status === "EXPIRED") {
        throw new HttpError(410, "Export expired", "Create a new export job", {
          code: "EXPORT_EXPIRED",
        });
      }
      if (job.status !== "COMPLETED") {
        throw new HttpError(
          409,
          "Export unavailable",
          job.status === "FAILED"
            ? EXPORT_FAILURE_MESSAGE
            : `The export is ${job.status.toLowerCase()}`,
          { code: `EXPORT_${job.status}` },
        );
      }
      if (
        !persistedExportStorage.isPersistedLocation(
          job.resultLocation,
          job.format,
        )
      ) {
        throw new HttpError(
          409,
          "Export unavailable",
          "No downloadable artifact is available for this export",
          { code: "EXPORT_ARTIFACT_UNAVAILABLE" },
        );
      }
      const artifact = await prisma.exportArtifact.findFirst({
        where: {
          exportJobId: job.id,
          organizationId: principal.organizationId,
        },
      });
      if (artifact === null) {
        throw new HttpError(
          409,
          "Export unavailable",
          "The completed export artifact is missing",
          { code: "EXPORT_ARTIFACT_UNAVAILABLE" },
        );
      }
      response.setHeader("Content-Type", artifact.contentType);
      response.setHeader(
        "Content-Disposition",
        `attachment; filename="${artifact.filename}"`,
      );
      response.setHeader("X-Export-Row-Count", String(artifact.rowCount));
      response.status(200).send(Buffer.from(artifact.content));
    },
  );

  router.get(
    "/notifications",
    authenticateInternal,
    requireCapability("quotation.read"),
    async (request, response) => {
      const principal = internalPrincipal(response);
      const query = parseQuery(ListQuerySchema, request);
      const rows = await prisma.notification.findMany({
        where: {
          organizationId: principal.organizationId,
          recipientUserId: principal.userId,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...cursorArgs(query.cursor, query.limit),
      });
      response.json(pageFromRows(rows.map(mapNotification), query.limit));
    },
  );

  router.post(
    "/notifications/:notificationId/read",
    authenticateInternal,
    requireCapability("quotation.read"),
    requireCsrf,
    async (request, response) => {
      const principal = internalPrincipal(response);
      const notificationId = parsePathId(request, "notificationId");
      const updated = await prisma.notification.updateMany({
        where: {
          id: notificationId,
          organizationId: principal.organizationId,
          recipientUserId: principal.userId,
        },
        data: { readAt: new Date() },
      });
      if (updated.count !== 1) notFound("Notification");
      const notification = await prisma.notification.findUnique({
        where: { id: notificationId },
      });
      if (notification === null) notFound("Notification");
      response.json(mapNotification(notification));
    },
  );

  router.get(
    "/events/stream",
    authenticateInternal,
    requireCapability("quotation.read"),
    (request, response) => {
      const principal = internalPrincipal(response);
      response.status(200);
      response.setHeader("Content-Type", "text/event-stream");
      response.setHeader("Cache-Control", "no-cache, no-transform");
      response.setHeader("Connection", "keep-alive");
      response.setHeader("X-Accel-Buffering", "no");
      response.flushHeaders();
      response.write("retry: 3000\n\n");
      let notificationCursor = { createdAt: new Date(), id: "" };
      let domainCursor = { createdAt: new Date(), id: "" };
      let polling = false;
      let closed = false;
      const poll = async () => {
        if (polling || closed) return;
        polling = true;
        try {
          const notifications = await prisma.notification.findMany({
            where: {
              organizationId: principal.organizationId,
              recipientUserId: principal.userId,
              OR: [
                { createdAt: { gt: notificationCursor.createdAt } },
                {
                  createdAt: notificationCursor.createdAt,
                  id: { gt: notificationCursor.id },
                },
              ],
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: 25,
          });
          for (const notification of notifications) {
            const event = ServerSentEventSchema.parse({
              id: notification.id,
              event: "notification",
              data: mapNotification(notification),
            });
            response.write(
              `id: ${event.id}\nevent: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`,
            );
            notificationCursor = {
              createdAt: notification.createdAt,
              id: notification.id,
            };
          }
          const domainEvents = await prisma.outboxEvent.findMany({
            where: {
              organizationId: principal.organizationId,
              eventType: { in: [...DOMAIN_EVENT_TYPES] },
              OR: [
                { createdAt: { gt: domainCursor.createdAt } },
                {
                  createdAt: domainCursor.createdAt,
                  id: { gt: domainCursor.id },
                },
              ],
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: 50,
          });
          for (const domainEvent of domainEvents) {
            const eventType = DomainEventTypeSchema.parse(
              domainEvent.eventType,
            );
            const data = RealtimeInvalidationEventDtoSchema.parse({
              topics: invalidationTopics(eventType),
              occurredAt: domainEvent.createdAt.toISOString(),
            });
            const event = ServerSentEventSchema.parse({
              id: domainEvent.id,
              event: "domain-change",
              data,
            });
            response.write(
              `id: ${event.id}\nevent: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`,
            );
            domainCursor = {
              createdAt: domainEvent.createdAt,
              id: domainEvent.id,
            };
          }
        } catch {
          if (!closed)
            response.write('event: error\ndata: {"retryable":true}\n\n');
        } finally {
          polling = false;
        }
      };
      const pollTimer = setInterval(() => void poll(), 2_000);
      const heartbeatTimer = setInterval(() => {
        if (!closed) response.write(`: heartbeat ${Date.now()}\n\n`);
      }, 15_000);
      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(pollTimer);
        clearInterval(heartbeatTimer);
        if (!response.writableEnded) response.end();
      };
      request.once("close", cleanup);
      response.once("close", cleanup);
    },
  );

  return router;
}
