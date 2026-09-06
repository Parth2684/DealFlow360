"use client";

import {
  AlertDtoSchema,
  CreateNudgeRequestSchema,
  DealHealthDashboardDtoSchema,
  NudgeDtoSchema,
  QUOTE_STAGES,
  QuoteDtoSchema,
  SnoozeAlertRequestSchema,
  apiRoutes,
  createCursorPageSchema,
  formatDateTime,
  formatEnumLabel,
  formatMoney,
  planApiRoutes,
  type AlertDto,
  type CursorPage,
  type DealHealthDashboardDto,
  type DealHealthDashboardQuery,
} from "@repo/common";
import {
  Badge,
  Button,
  ButtonLink,
  DataTable,
  DataTableBody,
  DataTableCaption,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  Dialog,
  EmptyState,
  ErrorFeedback,
  Field,
  FieldLabel,
  InlineFeedback,
  Input,
  LiveRegion,
  LoadingState,
  Metric,
  MetricGroup,
  PageHeader,
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
  Select,
} from "@repo/ui";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { useOrganizationFormatting } from "../../components/foundation/organization-formatting";
import { ApiProblemError, browserApiRequest } from "../../lib/api/browser";

const AlertPageSchema = createCursorPageSchema(AlertDtoSchema);
const OPEN_QUOTE_STAGES = QUOTE_STAGES.filter(
  (stage) => !["CONFIRMED", "EXPIRED", "CANCELLED"].includes(stage),
);

function withCursor(path: string, cursor?: string): string {
  if (!cursor) return path;
  const [pathname, rawQuery = ""] = path.split("?", 2);
  const parameters = new URLSearchParams(rawQuery);
  parameters.set("cursor", cursor);
  return `${pathname}?${parameters.toString()}`;
}

type AlertAction =
  | { alert: AlertDto; kind: "acknowledge" }
  | { alert: AlertDto; kind: "nudge" }
  | { alert: AlertDto; kind: "snooze" };

function statusTone(status: AlertDto["status"]) {
  switch (status) {
    case "OPEN":
      return "warning" as const;
    case "ACKNOWLEDGED":
      return "info" as const;
    case "SNOOZED":
      return "neutral" as const;
    case "RESOLVED":
      return "success" as const;
  }
}

function severityTone(severity: AlertDto["severity"]) {
  switch (severity) {
    case "CRITICAL":
      return "danger" as const;
    case "WARNING":
      return "warning" as const;
    case "INFO":
      return "info" as const;
  }
}

function riskTone(risk: string) {
  if (risk === "CRITICAL") return "danger" as const;
  if (risk === "HIGH" || risk === "MEDIUM") return "warning" as const;
  return "success" as const;
}

function actionError(error: unknown): string {
  if (error instanceof ApiProblemError) {
    return error.problem.detail ?? error.problem.title;
  }
  return "The action could not be completed. Refresh the alert and try again.";
}

async function runAlertAction(action: AlertAction): Promise<AlertDto> {
  if (action.kind === "acknowledge") {
    return browserApiRequest(
      apiRoutes.dealHealth.acknowledge(action.alert.id),
      {
        method: "POST",
        schema: AlertDtoSchema,
        scope: "internal",
      },
    );
  }

  if (action.kind === "snooze") {
    const until = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
    return browserApiRequest(apiRoutes.dealHealth.snooze(action.alert.id), {
      json: SnoozeAlertRequestSchema.parse({
        revision: action.alert.revision,
        until,
      }),
      method: "POST",
      schema: AlertDtoSchema,
      scope: "internal",
    });
  }

  if (!action.alert.quoteId) {
    throw new Error("This alert is not connected to a quotation owner.");
  }
  const quote = await browserApiRequest(
    apiRoutes.quotes.detail(action.alert.quoteId),
    { schema: QuoteDtoSchema, scope: "internal" },
  );
  await browserApiRequest(planApiRoutes.dealHealth.nudge(action.alert.id), {
    json: CreateNudgeRequestSchema.parse({
      channel: "IN_APP",
      message: `Please review ${action.alert.title.toLowerCase()} for ${quote.quoteNumber}.`,
      recipientUserId: quote.ownerId,
    }),
    method: "POST",
    schema: NudgeDtoSchema,
    scope: "internal",
  });
  return action.alert;
}

export interface DealHealthWorkspaceProps {
  alertsPath: string;
  canManage: boolean;
  currency: string;
  dashboardPath: string;
  filtersAdjusted: boolean;
  filters: DealHealthDashboardQuery;
  initialAlerts?: CursorPage<AlertDto>;
  initialDashboard?: DealHealthDashboardDto;
  timeZone: string;
}

export function DealHealthWorkspace({
  alertsPath,
  canManage,
  currency,
  dashboardPath,
  filtersAdjusted,
  filters,
  initialAlerts,
  initialDashboard,
  timeZone,
}: DealHealthWorkspaceProps) {
  const { locale } = useOrganizationFormatting();
  const queryClient = useQueryClient();
  const [confirmingAlert, setConfirmingAlert] = useState<AlertDto | null>(null);
  const [resultMessage, setResultMessage] = useState("");
  const [resultTone, setResultTone] = useState<"danger" | "info" | "success">(
    "info",
  );
  const dashboard = useQuery({
    initialData: initialDashboard,
    queryFn: () =>
      browserApiRequest(dashboardPath, {
        schema: DealHealthDashboardDtoSchema,
        scope: "internal",
      }),
    queryKey: ["deal-health", filters],
    refetchInterval: 30_000,
  });
  const alerts = useInfiniteQuery({
    initialPageParam: undefined as string | undefined,
    ...(initialAlerts
      ? {
          initialData: {
            pageParams: [undefined],
            pages: [initialAlerts],
          },
        }
      : {}),
    getNextPageParam: (lastPage) =>
      lastPage.pageInfo.hasNextPage
        ? (lastPage.pageInfo.nextCursor ?? undefined)
        : undefined,
    queryFn: ({ pageParam, signal }) =>
      browserApiRequest(withCursor(alertsPath, pageParam), {
        schema: AlertPageSchema,
        scope: "internal",
        signal,
      }),
    queryKey: ["deal-health-alerts", alertsPath],
    refetchInterval: 30_000,
  });
  const action = useMutation({
    mutationFn: runAlertAction,
    onError(error) {
      setResultTone("danger");
      setResultMessage(actionError(error));
    },
    async onSuccess(_, variables) {
      setResultTone("success");
      setResultMessage(
        variables.kind === "acknowledge"
          ? "Alert acknowledged."
          : variables.kind === "snooze"
            ? "Alert snoozed for 24 hours."
            : "The quotation owner was nudged.",
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["deal-health"] }),
        queryClient.invalidateQueries({ queryKey: ["deal-health-alerts"] }),
      ]);
    },
  });

  const reload = async () => {
    setResultTone("info");
    setResultMessage("Refreshing deal health…");
    const [dashboardResult, alertsResult] = await Promise.all([
      dashboard.refetch(),
      alerts.refetch(),
    ]);
    const failed = dashboardResult.isError || alertsResult.isError;
    setResultTone(failed ? "danger" : "success");
    setResultMessage(
      failed
        ? "Deal health could not be refreshed. Check the service and try again."
        : "Deal health refreshed.",
    );
  };
  const snapshot = dashboard.data;
  const alertRows = alerts.data?.pages.flatMap((page) => page.items) ?? [];
  const loading = dashboard.isPending || alerts.isPending;

  return (
    <div className="grid gap-lg">
      <PageHeader
        actions={
          <Button
            disabled={dashboard.isFetching || alerts.isFetching}
            onClick={reload}
            variant="secondary"
          >
            {dashboard.isFetching || alerts.isFetching
              ? "Refreshing…"
              : "Refresh Health"}
          </Button>
        }
        description="Prioritize stalled deals, approval delays, discount anomalies, credit exposure, and delivery risk from current server facts."
        metadata={
          snapshot
            ? `Last calculated ${formatDateTime(snapshot.generatedAt, locale, timeZone)}`
            : "Waiting for the latest server calculation"
        }
        title="Deal Health"
      />

      <form
        className="grid gap-sm border-b border-border pb-md sm:grid-cols-2 xl:grid-cols-4"
        key={JSON.stringify(filters)}
        method="get"
      >
        <Field>
          <FieldLabel htmlFor="health-from">From Date</FieldLabel>
          <Input
            autoComplete="off"
            defaultValue={filters.from}
            id="health-from"
            name="from"
            type="date"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="health-to">To date</FieldLabel>
          <Input
            autoComplete="off"
            defaultValue={filters.to}
            id="health-to"
            name="to"
            type="date"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="health-team">Sales team</FieldLabel>
          <Select
            defaultValue={filters.salesTeamId ?? ""}
            id="health-team"
            name="salesTeamId"
          >
            <option value="">All sales teams</option>
            {snapshot?.filterOptions.salesTeams.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="health-owner">Representative</FieldLabel>
          <Select
            defaultValue={filters.ownerId ?? ""}
            id="health-owner"
            name="ownerId"
          >
            <option value="">All representatives</option>
            {snapshot?.filterOptions.owners.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="health-category">Product category</FieldLabel>
          <Select
            defaultValue={filters.categoryId ?? ""}
            id="health-category"
            name="categoryId"
          >
            <option value="">All categories</option>
            {snapshot?.filterOptions.categories.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="health-product">Product</FieldLabel>
          <Select
            defaultValue={filters.productId ?? ""}
            id="health-product"
            name="productId"
          >
            <option value="">All products</option>
            {snapshot?.filterOptions.products.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="health-warehouse">Warehouse</FieldLabel>
          <Select
            defaultValue={filters.warehouseId ?? ""}
            id="health-warehouse"
            name="warehouseId"
          >
            <option value="">All warehouses</option>
            {snapshot?.filterOptions.warehouses.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="health-stage">Quote stage</FieldLabel>
          <Select
            defaultValue={filters.stage ?? ""}
            id="health-stage"
            name="stage"
          >
            <option value="">All quote stages</option>
            {OPEN_QUOTE_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {formatEnumLabel(stage)}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="health-approval">Approval state</FieldLabel>
          <Select
            defaultValue={filters.approvalStatus ?? ""}
            id="health-approval"
            name="approvalStatus"
          >
            <option value="">All approval states</option>
            {[
              "PENDING",
              "IN_PROGRESS",
              "APPROVED",
              "REJECTED",
              "REVISION_REQUIRED",
              "SUPERSEDED",
            ].map((status) => (
              <option key={status} value={status}>
                {formatEnumLabel(status)}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="health-risk">Risk Level</FieldLabel>
          <Select
            defaultValue={filters.riskLevel ?? ""}
            id="health-risk"
            name="riskLevel"
          >
            <option value="">All Risk Levels</option>
            {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((risk) => (
              <option key={risk} value={risk}>
                {formatEnumLabel(risk)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex items-end gap-xs">
          <Button type="submit">Apply Filters</Button>
          <ButtonLink href="/deal-health" variant="quiet">
            Reset
          </ButtonLink>
        </div>
      </form>

      {filtersAdjusted ? (
        <InlineFeedback title="Filters Adjusted" tone="warning">
          One or more invalid URL filters were removed. Valid filters were
          preserved in this view.
        </InlineFeedback>
      ) : null}

      <LiveRegion message={resultMessage} />
      {resultMessage ? (
        <InlineFeedback tone={resultTone}>{resultMessage}</InlineFeedback>
      ) : null}

      {loading ? <LoadingState label="Loading deal health…" rows={5} /> : null}
      {dashboard.isError || alerts.isError ? (
        <ErrorFeedback title="Health Data Is Unavailable">
          The API could not return all deal-health data. Refresh this page after
          the service recovers.
        </ErrorFeedback>
      ) : null}

      {snapshot ? (
        <MetricGroup
          aria-label="Deal-health risk indicators"
          className="lg:grid-cols-5"
        >
          <Metric
            detail="Needs owner follow-up"
            label="Stalled deals"
            tone={snapshot.metrics.stalledDealCount > 0 ? "warning" : "success"}
            value={snapshot.metrics.stalledDealCount}
          />
          <Metric
            detail="Outside the expected pattern"
            label="Discount anomalies"
            tone={
              snapshot.metrics.discountAnomalyCount > 0 ? "warning" : "success"
            }
            value={snapshot.metrics.discountAnomalyCount}
          />
          <Metric
            detail="Past the approval SLA"
            label="Approval delays"
            tone={
              snapshot.metrics.approvalDelayCount > 0 ? "danger" : "success"
            }
            value={snapshot.metrics.approvalDelayCount}
          />
          <Metric
            detail="Promise date at risk"
            label="Delivery slippage"
            tone={
              snapshot.metrics.deliverySlippageCount > 0 ? "danger" : "success"
            }
            value={snapshot.metrics.deliverySlippageCount}
          />
          <Metric
            detail="Customer response in progress"
            label="Pending negotiations"
            tone={
              snapshot.metrics.pendingNegotiationCount > 0 ? "info" : "success"
            }
            value={snapshot.metrics.pendingNegotiationCount}
          />
        </MetricGroup>
      ) : null}

      {snapshot ? (
        <MetricGroup
          aria-label="Commercial overview"
          className="lg:grid-cols-5"
        >
          <Metric
            label="Open pipeline"
            value={formatMoney(
              snapshot.metrics.openPipelineValue,
              currency,
              locale,
            )}
          />
          <Metric
            label="Weighted pipeline"
            value={formatMoney(
              snapshot.metrics.weightedPipelineValue,
              currency,
              locale,
            )}
          />
          <Metric
            detail="Waiting for a decision"
            label="Approval queue"
            tone={
              snapshot.metrics.approvalQueueCount > 0 ? "warning" : "success"
            }
            value={snapshot.metrics.approvalQueueCount}
          />
          <Metric
            detail="Past due"
            label="Overdue invoices"
            tone={
              Number(snapshot.metrics.overdueInvoiceValue) > 0
                ? "danger"
                : "success"
            }
            value={formatMoney(
              snapshot.metrics.overdueInvoiceValue,
              currency,
              locale,
            )}
          />
          <Metric
            detail="Needs review"
            label="Open alerts"
            tone={snapshot.metrics.openAlertCount > 0 ? "warning" : "success"}
            value={snapshot.metrics.openAlertCount}
          />
        </MetricGroup>
      ) : null}

      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>At-Risk Quotations</PanelTitle>
            <PanelDescription>
              A tabular alternative ordered from the current health snapshot.
            </PanelDescription>
          </div>
        </PanelHeader>
        <PanelBody className="p-0">
          {snapshot && snapshot.atRiskQuotes.length > 0 ? (
            <DataTable aria-label="At-risk quotation health scores">
              <DataTableCaption visuallyHidden>
                At-risk quotation health scores
              </DataTableCaption>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>Quotation</DataTableHead>
                  <DataTableHead>Customer</DataTableHead>
                  <DataTableHead>Primary Reason</DataTableHead>
                  <DataTableHead>Risk</DataTableHead>
                  <DataTableHead numeric>Score</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {snapshot.atRiskQuotes.map((quote) => (
                  <DataTableRow key={quote.quoteId}>
                    <DataTableCell>
                      <Link
                        className="font-semibold text-brand underline-offset-4 hover:underline"
                        href={`/quotations/${quote.quoteId}`}
                      >
                        {quote.quoteNumber}
                      </Link>
                    </DataTableCell>
                    <DataTableCell>{quote.customerName}</DataTableCell>
                    <DataTableCell>{quote.primaryReason}</DataTableCell>
                    <DataTableCell>
                      <Badge tone={riskTone(quote.riskLevel)}>
                        {formatEnumLabel(quote.riskLevel)}
                      </Badge>
                    </DataTableCell>
                    <DataTableCell numeric>{quote.score}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          ) : (
            <EmptyState
              description="No quotations match the current risk filters. Broaden the period or clear the risk level."
              headingLevel="h3"
              title="No At-Risk Quotations"
            />
          )}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Open Alerts</PanelTitle>
            <PanelDescription>
              Act on each alert only after the API confirms the change.
            </PanelDescription>
          </div>
        </PanelHeader>
        <PanelBody className="p-0">
          {alertRows.length > 0 ? (
            <>
              <div className="grid gap-sm p-sm md:hidden">
                {alertRows.map((alert) => (
                  <article
                    className="grid gap-sm rounded-control border border-border bg-surface p-sm"
                    key={alert.id}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-xs">
                      <div className="min-w-0">
                        <strong className="block break-words text-body-sm text-foreground-strong">
                          {alert.title}
                        </strong>
                        <p className="m-0 break-words text-caption text-foreground-muted">
                          {alert.message}
                        </p>
                      </div>
                      <Badge tone={severityTone(alert.severity)}>
                        {formatEnumLabel(alert.severity)}
                      </Badge>
                    </div>
                    <dl className="m-0 grid grid-cols-2 gap-xs text-caption">
                      <div>
                        <dt className="text-foreground-muted">Quotation</dt>
                        <dd className="m-0 text-foreground-strong">
                          {alert.quoteId ? (
                            <Link
                              className="font-semibold text-brand underline-offset-4 hover:underline"
                              href={`/quotations/${alert.quoteId}`}
                            >
                              {alert.quoteNumber ?? "Open Quotation"}
                            </Link>
                          ) : (
                            "Organization"
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-foreground-muted">Status</dt>
                        <dd className="m-0">
                          <Badge tone={statusTone(alert.status)}>
                            {formatEnumLabel(alert.status)}
                          </Badge>
                        </dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-foreground-muted">Detected</dt>
                        <dd className="m-0 text-foreground-strong">
                          <time dateTime={alert.detectedAt}>
                            {formatDateTime(alert.detectedAt, locale, timeZone)}
                          </time>
                        </dd>
                      </div>
                    </dl>
                    {canManage ? (
                      <div className="flex flex-wrap gap-xs">
                        <Button
                          disabled={action.isPending}
                          onClick={() =>
                            action.mutate({ alert, kind: "acknowledge" })
                          }
                          size="compact"
                          variant="secondary"
                        >
                          Acknowledge
                        </Button>
                        <Button
                          disabled={action.isPending}
                          onClick={() =>
                            action.mutate({ alert, kind: "snooze" })
                          }
                          size="compact"
                          variant="quiet"
                        >
                          Snooze 24 Hours
                        </Button>
                        {alert.quoteId ? (
                          <Button
                            disabled={action.isPending}
                            onClick={() => setConfirmingAlert(alert)}
                            size="compact"
                          >
                            Nudge Owner
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-caption text-foreground-muted">
                        View only
                      </span>
                    )}
                  </article>
                ))}
              </div>
              <DataTable
                aria-label="Open deal-health alerts and actions"
                containerClassName="hidden md:block"
              >
                <DataTableCaption visuallyHidden>
                  Open deal-health alerts and actions
                </DataTableCaption>
                <DataTableHeader>
                  <DataTableRow>
                    <DataTableHead>Alert</DataTableHead>
                    <DataTableHead>Quotation</DataTableHead>
                    <DataTableHead>Severity</DataTableHead>
                    <DataTableHead>Status</DataTableHead>
                    <DataTableHead>Detected</DataTableHead>
                    <DataTableHead>Actions</DataTableHead>
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {alertRows.map((alert) => (
                    <DataTableRow key={alert.id}>
                      <DataTableCell>
                        <div className="grid min-w-0 gap-xxs">
                          <strong className="text-foreground-strong">
                            {alert.title}
                          </strong>
                          <span className="max-w-reading text-caption text-foreground-muted">
                            {alert.message}
                          </span>
                        </div>
                      </DataTableCell>
                      <DataTableCell>
                        {alert.quoteId ? (
                          <Link
                            className="font-semibold text-brand underline-offset-4 hover:underline"
                            href={`/quotations/${alert.quoteId}`}
                          >
                            {alert.quoteNumber ?? "Open Quotation"}
                          </Link>
                        ) : (
                          "Organization"
                        )}
                      </DataTableCell>
                      <DataTableCell>
                        <Badge tone={severityTone(alert.severity)}>
                          {formatEnumLabel(alert.severity)}
                        </Badge>
                      </DataTableCell>
                      <DataTableCell>
                        <Badge tone={statusTone(alert.status)}>
                          {formatEnumLabel(alert.status)}
                        </Badge>
                      </DataTableCell>
                      <DataTableCell>
                        <time dateTime={alert.detectedAt}>
                          {formatDateTime(alert.detectedAt, locale, timeZone)}
                        </time>
                      </DataTableCell>
                      <DataTableCell>
                        {canManage ? (
                          <div className="flex flex-wrap gap-xs">
                            <Button
                              disabled={action.isPending}
                              onClick={() =>
                                action.mutate({ alert, kind: "acknowledge" })
                              }
                              size="compact"
                              variant="secondary"
                            >
                              Acknowledge
                            </Button>
                            <Button
                              disabled={action.isPending}
                              onClick={() =>
                                action.mutate({ alert, kind: "snooze" })
                              }
                              size="compact"
                              variant="quiet"
                            >
                              Snooze 24 Hours
                            </Button>
                            {alert.quoteId ? (
                              <Button
                                disabled={action.isPending}
                                onClick={() => setConfirmingAlert(alert)}
                                size="compact"
                              >
                                Nudge Owner
                              </Button>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-caption text-foreground-muted">
                            View only
                          </span>
                        )}
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
              <div className="flex flex-wrap items-center justify-between gap-xs border-t border-border px-sm py-xs">
                <span
                  aria-live="polite"
                  className="text-caption text-foreground-muted"
                >
                  {alertRows.length} open alerts loaded
                </span>
                {alerts.hasNextPage ? (
                  <Button
                    disabled={alerts.isFetchingNextPage}
                    onClick={() => void alerts.fetchNextPage()}
                    size="compact"
                    variant="secondary"
                  >
                    {alerts.isFetchingNextPage
                      ? "Loading More…"
                      : "Load More Alerts"}
                  </Button>
                ) : null}
              </div>
            </>
          ) : (
            <EmptyState
              description="No open alerts match this view. Scheduled health checks will add new findings here."
              headingLevel="h3"
              title="No Open Alerts"
            />
          )}
        </PanelBody>
      </Panel>

      <Dialog
        closeLabel="Close Nudge Confirmation"
        description="The owner will receive an in-app notification linked to this deal-health alert."
        footer={
          <>
            <Button
              onClick={() => setConfirmingAlert(null)}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              disabled={action.isPending || confirmingAlert === null}
              onClick={() => {
                if (!confirmingAlert) return;
                const alert = confirmingAlert;
                setConfirmingAlert(null);
                action.mutate({ alert, kind: "nudge" });
              }}
            >
              Send Nudge
            </Button>
          </>
        }
        onOpenChange={(open) => {
          if (!open) setConfirmingAlert(null);
        }}
        open={confirmingAlert !== null}
        size="compact"
        title="Nudge the Quotation Owner?"
      >
        <p className="m-0 text-body-sm text-foreground">
          {confirmingAlert
            ? `${confirmingAlert.title} will be sent now.`
            : "Choose send to continue."}
        </p>
      </Dialog>
    </div>
  );
}
