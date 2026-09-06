import { z } from "zod";

import { DomainEventTypeSchema } from "./constants.js";
import {
  ActorTypeSchema,
  AlertSeveritySchema,
  AlertStatusSchema,
  AlertTypeSchema,
  ApprovalRequestStatusSchema,
  ConfigurationStatusSchema,
  ExportFormatSchema,
  ExportJobStatusSchema,
  InvoiceStatusSchema,
  NotificationChannelSchema,
  NotificationStatusSchema,
  NudgeChannelSchema,
  NudgeStatusSchema,
  OrderStatusSchema,
  QuoteStageSchema,
  ReportTypeSchema,
  RiskLevelSchema,
  VisibilitySchema,
} from "./enums.js";
import {
  createCursorPageSchema,
  DecimalStringSchema,
  IdSchema,
  IsoDateSchema,
  IsoDateTimeSchema,
  JsonObjectSchema,
  NonNegativeDecimalStringSchema,
  RevisionSchema,
} from "./primitives.js";

export const DealHealthSnapshotDtoSchema = z.object({
  id: IdSchema,
  quoteId: IdSchema.nullable(),
  reason: z.string().min(1),
  healthScore: NonNegativeDecimalStringSchema,
  riskLevel: RiskLevelSchema,
  stalledDays: z.number().int().nonnegative(),
  discountAnomalyScore: NonNegativeDecimalStringSchema,
  approvalSlaHoursOverdue: z.number().int().nonnegative(),
  promiseSlippageDays: z.number().int().nonnegative(),
  creditExposure: NonNegativeDecimalStringSchema,
  facts: JsonObjectSchema,
  explanation: z.array(z.string().min(1)),
  calculatedAt: IsoDateTimeSchema,
});
export type DealHealthSnapshotDto = z.infer<typeof DealHealthSnapshotDtoSchema>;

export const CreateDealHealthSnapshotRequestSchema = z
  .object({ reason: z.string().trim().min(1).max(160) })
  .strict();
export type CreateDealHealthSnapshotRequest = z.infer<
  typeof CreateDealHealthSnapshotRequestSchema
>;

export const AlertDtoSchema = z.object({
  id: IdSchema,
  quoteId: IdSchema.nullable(),
  quoteNumber: z.string().nullable(),
  type: AlertTypeSchema,
  severity: AlertSeveritySchema,
  status: AlertStatusSchema,
  reasonCode: z.string().min(1),
  title: z.string().min(1),
  message: z.string().min(1),
  facts: JsonObjectSchema,
  acknowledgedByName: z.string().nullable(),
  acknowledgedAt: IsoDateTimeSchema.nullable(),
  snoozedUntil: IsoDateTimeSchema.nullable(),
  resolvedAt: IsoDateTimeSchema.nullable(),
  detectedAt: IsoDateTimeSchema,
  revision: RevisionSchema,
  updatedAt: IsoDateTimeSchema,
});
export type AlertDto = z.infer<typeof AlertDtoSchema>;

export const AlertListQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: AlertStatusSchema.optional(),
  type: AlertTypeSchema.optional(),
  severity: AlertSeveritySchema.optional(),
  quoteId: IdSchema.optional(),
});
export type AlertListQuery = z.infer<typeof AlertListQuerySchema>;

export const SnoozeAlertRequestSchema = z
  .object({ until: IsoDateTimeSchema, revision: RevisionSchema.optional() })
  .strict();
export type SnoozeAlertRequest = z.infer<typeof SnoozeAlertRequestSchema>;

export const CreateNudgeRequestSchema = z
  .object({
    channel: NudgeChannelSchema,
    recipientUserId: IdSchema.optional(),
    recipientContactId: IdSchema.optional(),
    message: z.string().trim().min(1).max(4000),
  })
  .strict()
  .refine(
    (value) =>
      (value.recipientUserId === undefined) !==
      (value.recipientContactId === undefined),
    { message: "Specify exactly one nudge recipient" },
  );
export type CreateNudgeRequest = z.infer<typeof CreateNudgeRequestSchema>;

export const NudgeDtoSchema = z.object({
  id: IdSchema,
  alertId: IdSchema,
  channel: NudgeChannelSchema,
  recipientName: z.string().min(1),
  message: z.string().min(1),
  status: NudgeStatusSchema,
  errorMessage: z.string().nullable(),
  requestedAt: IsoDateTimeSchema,
  sentAt: IsoDateTimeSchema.nullable(),
});
export type NudgeDto = z.infer<typeof NudgeDtoSchema>;

export const DealHealthDashboardDtoSchema = z.object({
  generatedAt: IsoDateTimeSchema,
  metrics: z.object({
    openPipelineValue: NonNegativeDecimalStringSchema,
    weightedPipelineValue: NonNegativeDecimalStringSchema,
    approvalQueueCount: z.number().int().nonnegative(),
    overdueInvoiceValue: NonNegativeDecimalStringSchema,
    openAlertCount: z.number().int().nonnegative(),
    stalledDealCount: z.number().int().nonnegative(),
    discountAnomalyCount: z.number().int().nonnegative(),
    approvalDelayCount: z.number().int().nonnegative(),
    deliverySlippageCount: z.number().int().nonnegative(),
    pendingNegotiationCount: z.number().int().nonnegative(),
  }),
  alertsBySeverity: z.record(
    AlertSeveritySchema,
    z.number().int().nonnegative(),
  ),
  atRiskQuotes: z.array(
    z.object({
      quoteId: IdSchema,
      quoteNumber: z.string().min(1),
      customerName: z.string().min(1),
      score: NonNegativeDecimalStringSchema,
      riskLevel: RiskLevelSchema,
      primaryReason: z.string().min(1),
    }),
  ),
  filterOptions: z.object({
    owners: z.array(z.object({ id: IdSchema, label: z.string().min(1) })),
    salesTeams: z.array(z.object({ id: IdSchema, label: z.string().min(1) })),
    warehouses: z.array(z.object({ id: IdSchema, label: z.string().min(1) })),
    products: z.array(z.object({ id: IdSchema, label: z.string().min(1) })),
    categories: z.array(z.object({ id: IdSchema, label: z.string().min(1) })),
  }),
});
export type DealHealthDashboardDto = z.infer<
  typeof DealHealthDashboardDtoSchema
>;

export const DealHealthDashboardQuerySchema = z
  .object({
    from: IsoDateSchema.optional(),
    to: IsoDateSchema.optional(),
    ownerId: IdSchema.optional(),
    salesTeamId: IdSchema.optional(),
    warehouseId: IdSchema.optional(),
    productId: IdSchema.optional(),
    categoryId: IdSchema.optional(),
    stage: QuoteStageSchema.optional(),
    approvalStatus: ApprovalRequestStatusSchema.optional(),
    riskLevel: RiskLevelSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.from === undefined ||
      value.to === undefined ||
      value.from <= value.to,
    { message: "The dashboard from date must not be after the to date" },
  );
export type DealHealthDashboardQuery = z.infer<
  typeof DealHealthDashboardQuerySchema
>;

export const DashboardFilterSchema = DealHealthDashboardQuerySchema;
export type DashboardFilter = DealHealthDashboardQuery;

export const CreateExportJobRequestSchema = z
  .object({
    reportType: ReportTypeSchema,
    format: ExportFormatSchema,
    filters: JsonObjectSchema.default({}),
  })
  .strict();
export type CreateExportJobRequest = z.infer<
  typeof CreateExportJobRequestSchema
>;

export const SavedReportFilterDtoSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  reportType: ReportTypeSchema,
  filters: JsonObjectSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type SavedReportFilterDto = z.infer<typeof SavedReportFilterDtoSchema>;

export const SavedReportFilterListQuerySchema = z
  .object({
    cursor: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    reportType: ReportTypeSchema.optional(),
  })
  .strict();
export type SavedReportFilterListQuery = z.infer<
  typeof SavedReportFilterListQuerySchema
>;

export const SavedReportFilterPageDtoSchema = createCursorPageSchema(
  SavedReportFilterDtoSchema,
);
export type SavedReportFilterPageDto = z.infer<
  typeof SavedReportFilterPageDtoSchema
>;

export const CreateSavedReportFilterRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    reportType: ReportTypeSchema,
    filters: JsonObjectSchema.default({}),
  })
  .strict();
export type CreateSavedReportFilterRequest = z.infer<
  typeof CreateSavedReportFilterRequestSchema
>;

export const UpdateSavedReportFilterRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    filters: JsonObjectSchema.optional(),
    updatedAt: IsoDateTimeSchema,
  })
  .strict()
  .refine((value) => value.name !== undefined || value.filters !== undefined, {
    message: "A saved-filter name or filter change is required",
  });
export type UpdateSavedReportFilterRequest = z.infer<
  typeof UpdateSavedReportFilterRequestSchema
>;

export const QuoteSavedFilterValueSchema = z
  .object({
    search: z.string().trim().min(1).max(200).optional(),
    stage: QuoteStageSchema.optional(),
    sort: z.enum(["updatedAt", "createdAt", "total", "expiresAt"]).optional(),
    direction: z.enum(["asc", "desc"]).optional(),
  })
  .strict();
export type QuoteSavedFilterValue = z.infer<typeof QuoteSavedFilterValueSchema>;

export const QuoteSavedFilterListQuerySchema = z
  .object({
    cursor: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
export type QuoteSavedFilterListQuery = z.infer<
  typeof QuoteSavedFilterListQuerySchema
>;

export const CreateQuoteSavedFilterRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    filters: QuoteSavedFilterValueSchema,
  })
  .strict();
export type CreateQuoteSavedFilterRequest = z.infer<
  typeof CreateQuoteSavedFilterRequestSchema
>;

export const UpdateQuoteSavedFilterRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    filters: QuoteSavedFilterValueSchema.optional(),
    updatedAt: IsoDateTimeSchema,
  })
  .strict()
  .refine((value) => value.name !== undefined || value.filters !== undefined, {
    message: "A saved-filter name or quotation filter change is required",
  });
export type UpdateQuoteSavedFilterRequest = z.infer<
  typeof UpdateQuoteSavedFilterRequestSchema
>;

const ReportDateRangeShape = {
  from: IsoDateSchema.optional(),
  to: IsoDateSchema.optional(),
};

export const ReportAggregationQuerySchema = z
  .discriminatedUnion("reportType", [
    z
      .object({
        reportType: z.literal("QUOTES"),
        ...ReportDateRangeShape,
        stage: QuoteStageSchema.optional(),
      })
      .strict(),
    z
      .object({
        reportType: z.literal("ORDERS"),
        ...ReportDateRangeShape,
        status: OrderStatusSchema.optional(),
      })
      .strict(),
    z
      .object({
        reportType: z.literal("INVOICES"),
        ...ReportDateRangeShape,
        status: InvoiceStatusSchema.optional(),
      })
      .strict(),
    z
      .object({
        reportType: z.literal("CUSTOMERS"),
        ...ReportDateRangeShape,
        status: ConfigurationStatusSchema.optional(),
      })
      .strict(),
    z
      .object({
        reportType: z.literal("INVENTORY"),
        ...ReportDateRangeShape,
      })
      .strict(),
  ])
  .refine(
    (value) =>
      value.from === undefined ||
      value.to === undefined ||
      value.from <= value.to,
    { message: "The report from date must not be after the to date" },
  );
export type ReportAggregationQuery = z.infer<
  typeof ReportAggregationQuerySchema
>;

export const ReportAggregationBucketDtoSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  recordCount: z.number().int().nonnegative(),
  value: DecimalStringSchema,
});
export type ReportAggregationBucketDto = z.infer<
  typeof ReportAggregationBucketDtoSchema
>;

export const ReportAggregationDtoSchema = z.object({
  reportType: ReportTypeSchema,
  generatedAt: IsoDateTimeSchema,
  measure: z.enum(["RECORD_COUNT", "AVAILABLE_QUANTITY"]),
  totalRecords: z.number().int().nonnegative(),
  totalValue: DecimalStringSchema,
  buckets: z.array(ReportAggregationBucketDtoSchema),
});
export type ReportAggregationDto = z.infer<typeof ReportAggregationDtoSchema>;

/**
 * Export artifacts are deliberately exposed through the credentialed API
 * origin instead of an absolute storage URL. This keeps the browser on the
 * same-origin Next.js rewrite and avoids leaking session cookies across hosts.
 */
export const ExportDownloadPathSchema = z
  .string()
  .regex(
    /^\/api\/v1\/reporting\/exports\/[^/?#]+\/file$/u,
    "Expected a same-origin DealFlow360 export file path",
  );
export type ExportDownloadPath = z.infer<typeof ExportDownloadPathSchema>;

export const ExportJobDtoSchema = z.object({
  id: IdSchema,
  reportType: ReportTypeSchema,
  format: ExportFormatSchema,
  filters: JsonObjectSchema,
  status: ExportJobStatusSchema,
  progress: z.number().int().min(0).max(100),
  downloadUrl: ExportDownloadPathSchema.nullable(),
  errorMessage: z.string().nullable(),
  startedAt: IsoDateTimeSchema.nullable(),
  completedAt: IsoDateTimeSchema.nullable(),
  expiresAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type ExportJobDto = z.infer<typeof ExportJobDtoSchema>;

export const ExportDownloadDtoSchema = z.object({
  status: ExportJobStatusSchema,
  downloadUrl: ExportDownloadPathSchema.nullable(),
  expiresAt: IsoDateTimeSchema.nullable(),
});
export type ExportDownloadDto = z.infer<typeof ExportDownloadDtoSchema>;

export const DealEventDtoSchema = z.object({
  id: IdSchema,
  quoteId: IdSchema,
  visibility: VisibilitySchema,
  eventType: z.string().min(1),
  title: z.string().min(1),
  message: z.string().nullable(),
  actorType: ActorTypeSchema,
  actorName: z.string().nullable(),
  sourceEntityType: z.string().nullable(),
  sourceEntityId: IdSchema.nullable(),
  sourceVersion: z.number().int().positive().nullable(),
  metadata: JsonObjectSchema,
  occurredAt: IsoDateTimeSchema,
});
export type DealEventDto = z.infer<typeof DealEventDtoSchema>;

export const DomainEventEnvelopeSchema = z.object({
  id: IdSchema,
  organizationId: IdSchema,
  eventType: DomainEventTypeSchema,
  aggregateType: z.string().min(1),
  aggregateId: IdSchema,
  payload: JsonObjectSchema,
  occurredAt: IsoDateTimeSchema,
});
export type DomainEventEnvelope = z.infer<typeof DomainEventEnvelopeSchema>;

export const ServerSentEventSchema = z.object({
  id: z.string().min(1),
  event: z.string().min(1),
  data: JsonObjectSchema,
  retry: z.number().int().positive().optional(),
});
export type ServerSentEvent = z.infer<typeof ServerSentEventSchema>;

export const RealtimeInvalidationTopicSchema = z.enum([
  "QUOTATIONS",
  "APPROVALS",
  "FULFILLMENT",
  "INVENTORY",
  "NEGOTIATION",
  "BILLING",
  "INSIGHTS",
  "REPORTING",
]);
export type RealtimeInvalidationTopic = z.infer<
  typeof RealtimeInvalidationTopicSchema
>;

export const RealtimeInvalidationEventDtoSchema = z
  .object({
    topics: z.array(RealtimeInvalidationTopicSchema).min(1),
    occurredAt: IsoDateTimeSchema,
  })
  .strict();
export type RealtimeInvalidationEventDto = z.infer<
  typeof RealtimeInvalidationEventDtoSchema
>;

export const NotificationDtoSchema = z.object({
  id: IdSchema,
  channel: NotificationChannelSchema,
  type: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  data: JsonObjectSchema,
  status: NotificationStatusSchema,
  readAt: IsoDateTimeSchema.nullable(),
  sentAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
});
export type NotificationDto = z.infer<typeof NotificationDtoSchema>;

export const ReportMetricDtoSchema = z.object({
  label: z.string().min(1),
  value: DecimalStringSchema,
  comparison: DecimalStringSchema.nullable(),
});
export type ReportMetricDto = z.infer<typeof ReportMetricDtoSchema>;
