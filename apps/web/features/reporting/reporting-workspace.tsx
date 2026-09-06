"use client";

import {
  CONFIGURATION_STATUSES,
  CreateExportJobRequestSchema,
  CreateSavedReportFilterRequestSchema,
  ExportDownloadDtoSchema,
  ExportJobDtoSchema,
  INVOICE_STATUSES,
  ORDER_STATUSES,
  QUOTE_STAGES,
  ReportAggregationDtoSchema,
  SavedReportFilterDtoSchema,
  SavedReportFilterPageDtoSchema,
  UpdateSavedReportFilterRequestSchema,
  apiRoutes,
  createCursorPageSchema,
  formatDateTime,
  formatEnumLabel,
  formatPercentage,
  planApiRoutes,
  type CreateExportJobRequest,
  type CursorPage,
  type ExportJobDto,
  type ExportFormat,
  type ReportType,
  type ReportAggregationDto,
  type SavedReportFilterDto,
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
  FieldDescription,
  FieldError,
  FieldLabel,
  InlineFeedback,
  Input,
  LiveRegion,
  PageHeader,
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
  Select,
  Skeleton,
} from "@repo/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { useOrganizationFormatting } from "../../components/foundation/organization-formatting";
import { ApiProblemError, browserApiRequest } from "../../lib/api/browser";

const ExportPageSchema = createCursorPageSchema(ExportJobDtoSchema);
type ExportFormInput = z.input<typeof CreateExportJobRequestSchema>;

function cursorPath(path: string, limit: number, cursor?: string): string {
  const parameters = new URLSearchParams({ limit: String(limit) });
  if (cursor) parameters.set("cursor", cursor);
  return `${path}?${parameters.toString()}`;
}

function exportTone(status: ExportJobDto["status"]) {
  if (status === "COMPLETED") return "success" as const;
  if (status === "FAILED" || status === "EXPIRED") return "danger" as const;
  if (status === "CANCELLED") return "neutral" as const;
  return "info" as const;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiProblemError) {
    return error.problem.detail ?? error.problem.title;
  }
  return "The export request failed. Check the service and try again.";
}

function statusOptions(reportType: ReportType): readonly string[] {
  switch (reportType) {
    case "QUOTES":
      return QUOTE_STAGES;
    case "ORDERS":
      return ORDER_STATUSES;
    case "INVOICES":
      return INVOICE_STATUSES;
    case "CUSTOMERS":
      return CONFIGURATION_STATUSES;
    case "INVENTORY":
      return [];
  }
}

function statusFilterName(reportType: ReportType): "stage" | "status" {
  return reportType === "QUOTES" ? "stage" : "status";
}

function normalizedReportFilters(
  reportType: ReportType,
  values: Readonly<Record<string, unknown>> | undefined,
): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const name of ["from", "to"] as const) {
    const value = values?.[name];
    if (typeof value === "string" && value.length > 0) {
      normalized[name] = value;
    }
  }

  const filterName = statusFilterName(reportType);
  const currentValue = values?.[filterName];
  const legacyQuoteValue =
    reportType === "QUOTES" && currentValue === undefined
      ? values?.["status"]
      : undefined;
  const statusValue = currentValue ?? legacyQuoteValue;
  if (
    typeof statusValue === "string" &&
    statusOptions(reportType).includes(statusValue)
  ) {
    normalized[filterName] = statusValue;
  }
  return normalized;
}

function reportSummaryPath(
  reportType: ReportType,
  filters: Readonly<Record<string, string | undefined>>,
): string {
  const parameters = new URLSearchParams({ reportType });
  for (const [name, value] of Object.entries(
    normalizedReportFilters(reportType, filters),
  )) {
    parameters.set(name, value);
  }
  return `${planApiRoutes.reporting.summary}?${parameters.toString()}`;
}

function aggregationValueLabel(
  aggregation: ReportAggregationDto,
  value: string,
  locale: string,
): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: aggregation.measure === "AVAILABLE_QUANTITY" ? 4 : 0,
  }).format(Number(value));
}

export interface ReportingWorkspaceProps {
  canExport: boolean;
  initialExports?: CursorPage<ExportJobDto>;
  initialSavedFilters?: CursorPage<SavedReportFilterDto>;
  initialSummary?: ReportAggregationDto;
  selectedFilters: Readonly<Record<string, string | undefined>>;
  selectedFormat: ExportFormat;
  selectedReportType: ReportType;
  timeZone: string;
}

export function ReportingWorkspace({
  canExport,
  initialExports,
  initialSavedFilters,
  initialSummary,
  selectedFilters,
  selectedFormat,
  selectedReportType,
  timeZone,
}: ReportingWorkspaceProps) {
  const { locale } = useOrganizationFormatting();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"danger" | "info" | "success">(
    "info",
  );
  const [savedFilterId, setSavedFilterId] = useState("");
  const [savedFilterName, setSavedFilterName] = useState("");
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [savedFilterReviewRequired, setSavedFilterReviewRequired] =
    useState(false);
  const reportSummary = useQuery({
    initialData: initialSummary,
    queryFn: ({ signal }) =>
      browserApiRequest(
        reportSummaryPath(selectedReportType, selectedFilters),
        {
          schema: ReportAggregationDtoSchema,
          scope: "internal",
          signal,
        },
      ),
    queryKey: ["report-summary", selectedReportType, selectedFilters],
  });
  const exportsQuery = useInfiniteQuery({
    initialPageParam: undefined as string | undefined,
    ...(initialExports
      ? {
          initialData: {
            pageParams: [undefined],
            pages: [initialExports],
          },
        }
      : {}),
    getNextPageParam: (lastPage) =>
      lastPage.pageInfo.hasNextPage
        ? (lastPage.pageInfo.nextCursor ?? undefined)
        : undefined,
    queryFn: ({ pageParam, signal }) =>
      browserApiRequest(
        cursorPath(apiRoutes.reporting.exports, 25, pageParam),
        {
          schema: ExportPageSchema,
          scope: "internal",
          signal,
        },
      ),
    queryKey: ["report-exports"],
    refetchInterval(query) {
      return query.state.data?.pages.some((page) =>
        page.items.some((job) => ["QUEUED", "PROCESSING"].includes(job.status)),
      )
        ? 5_000
        : 30_000;
    },
  });
  const savedFiltersQuery = useInfiniteQuery({
    initialPageParam: undefined as string | undefined,
    ...(initialSavedFilters
      ? {
          initialData: {
            pageParams: [undefined],
            pages: [initialSavedFilters],
          },
        }
      : {}),
    getNextPageParam: (lastPage) =>
      lastPage.pageInfo.hasNextPage
        ? (lastPage.pageInfo.nextCursor ?? undefined)
        : undefined,
    queryFn: ({ pageParam, signal }) =>
      browserApiRequest(
        cursorPath(planApiRoutes.reporting.savedFilters, 100, pageParam),
        {
          schema: SavedReportFilterPageDtoSchema,
          scope: "internal",
          signal,
        },
      ),
    queryKey: ["report-saved-filters"],
  });
  const {
    control,
    formState: { errors },
    getValues,
    handleSubmit,
    register,
    reset,
    setValue,
  } = useForm<ExportFormInput, undefined, CreateExportJobRequest>({
    defaultValues: {
      filters: selectedFilters,
      format: selectedFormat,
      reportType: selectedReportType,
    },
    resolver: zodResolver(CreateExportJobRequestSchema),
  });
  const selectedFrom = selectedFilters["from"];
  const selectedTo = selectedFilters["to"];
  const selectedStage = selectedFilters["stage"];
  const selectedStatus = selectedFilters["status"];

  useEffect(() => {
    reset({
      filters: normalizedReportFilters(selectedReportType, {
        ...(selectedFrom === undefined ? {} : { from: selectedFrom }),
        ...(selectedTo === undefined ? {} : { to: selectedTo }),
        ...(selectedStage === undefined ? {} : { stage: selectedStage }),
        ...(selectedStatus === undefined ? {} : { status: selectedStatus }),
      }),
      format: selectedFormat,
      reportType: selectedReportType,
    });
  }, [
    reset,
    selectedFormat,
    selectedFrom,
    selectedReportType,
    selectedStage,
    selectedStatus,
    selectedTo,
  ]);
  const createExport = useMutation({
    mutationFn: (input: CreateExportJobRequest) =>
      browserApiRequest(apiRoutes.reporting.exports, {
        json: input,
        method: "POST",
        schema: ExportJobDtoSchema,
        scope: "internal",
      }),
    onError(error) {
      setMessageTone("danger");
      setMessage(errorMessage(error));
    },
    async onSuccess(job) {
      setMessageTone(job.status === "FAILED" ? "danger" : "success");
      setMessage(
        job.status === "FAILED"
          ? (job.errorMessage ?? "The export could not be generated.")
          : job.status === "COMPLETED"
            ? `${formatEnumLabel(job.reportType)} export is ready.`
            : `${formatEnumLabel(job.reportType)} export queued for processing.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["report-exports"] });
    },
  });
  const createSavedFilter = useMutation({
    mutationFn: (input: z.infer<typeof CreateSavedReportFilterRequestSchema>) =>
      browserApiRequest(planApiRoutes.reporting.savedFilters, {
        json: input,
        method: "POST",
        schema: SavedReportFilterDtoSchema,
        scope: "internal",
      }),
    onError(error) {
      setMessageTone("danger");
      setMessage(errorMessage(error));
    },
    async onSuccess(filter) {
      setSavedFilterId(filter.id);
      setSavedFilterName(filter.name);
      setSavedFilterReviewRequired(false);
      setMessageTone("success");
      setMessage(`Saved filter ${filter.name}.`);
      await queryClient.invalidateQueries({
        queryKey: ["report-saved-filters"],
      });
    },
  });
  const updateSavedFilter = useMutation({
    mutationFn: ({
      filter,
      input,
    }: {
      filter: SavedReportFilterDto;
      input: z.infer<typeof UpdateSavedReportFilterRequestSchema>;
    }) =>
      browserApiRequest(planApiRoutes.reporting.savedFilter(filter.id), {
        json: input,
        method: "PATCH",
        schema: SavedReportFilterDtoSchema,
        scope: "internal",
      }),
    async onError(error) {
      setMessageTone("danger");
      if (
        error instanceof ApiProblemError &&
        error.problem.code === "STALE_SAVED_FILTER"
      ) {
        const refreshed = await savedFiltersQuery.refetch();
        if (refreshed.isError) {
          setSavedFilterReviewRequired(true);
          setMessage(
            "This saved filter changed elsewhere, but the latest definition could not be reloaded. Refresh this page before updating.",
          );
          return;
        }
        const latest = refreshed.data?.pages
          .flatMap((page) => page.items)
          .find((filter) => filter.id === savedFilterId);
        if (latest) setSavedFilterName(latest.name);
        setSavedFilterReviewRequired(true);
        setMessage(
          "This saved filter changed elsewhere. The latest definition was reloaded; choose Load to review it before updating.",
        );
        return;
      }
      setMessage(errorMessage(error));
    },
    async onSuccess(filter) {
      setSavedFilterName(filter.name);
      setSavedFilterReviewRequired(false);
      setMessageTone("success");
      setMessage(`Updated filter ${filter.name}.`);
      await queryClient.invalidateQueries({
        queryKey: ["report-saved-filters"],
      });
    },
  });
  const deleteSavedFilter = useMutation({
    mutationFn: (filter: SavedReportFilterDto) =>
      browserApiRequest(planApiRoutes.reporting.savedFilter(filter.id), {
        method: "DELETE",
        schema: z.undefined(),
        scope: "internal",
      }),
    onError(error) {
      setMessageTone("danger");
      setMessage(errorMessage(error));
    },
    async onSuccess() {
      setDeleteConfirmationOpen(false);
      setSavedFilterId("");
      setSavedFilterName("");
      setSavedFilterReviewRequired(false);
      setMessageTone("success");
      setMessage("Deleted the saved filter.");
      await queryClient.invalidateQueries({
        queryKey: ["report-saved-filters"],
      });
    },
  });
  const reportTypeField = register("reportType");
  const formatField = register("format");
  const fromField = register("filters.from");
  const toField = register("filters.to");
  const activeReportType = useWatch({ control, name: "reportType" });
  const activeStatusFilterName = statusFilterName(activeReportType);
  const statusField = register(`filters.${activeStatusFilterName}`);
  const availableStatuses = statusOptions(activeReportType);
  const savedFilters =
    savedFiltersQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const selectedSavedFilter = savedFilters.find(
    (filter) => filter.id === savedFilterId,
  );
  const savedFilterBusy =
    createSavedFilter.isPending ||
    updateSavedFilter.isPending ||
    deleteSavedFilter.isPending;

  function currentFilterValues(): Readonly<Record<string, string>> {
    const values = getValues();
    return normalizedReportFilters(values.reportType, values.filters);
  }

  function loadSavedFilter() {
    if (!selectedSavedFilter) return;
    const nextFilters = normalizedReportFilters(
      selectedSavedFilter.reportType,
      selectedSavedFilter.filters,
    );
    const format = getValues().format;
    reset({
      filters: nextFilters,
      format,
      reportType: selectedSavedFilter.reportType,
    });
    const next = new URLSearchParams({
      format,
      reportType: selectedSavedFilter.reportType,
    });
    for (const [name, value] of Object.entries(nextFilters)) {
      if (value.length > 0) next.set(name, value);
    }
    router.replace(`/reports?${next.toString()}`, { scroll: false });
    setSavedFilterName(selectedSavedFilter.name);
    setSavedFilterReviewRequired(false);
    setMessageTone("success");
    setMessage(`Loaded filter ${selectedSavedFilter.name}.`);
  }

  function saveCurrentFilter() {
    const parsed = CreateSavedReportFilterRequestSchema.safeParse({
      filters: currentFilterValues(),
      name: savedFilterName,
      reportType: getValues().reportType,
    });
    if (!parsed.success) {
      setMessageTone("danger");
      setMessage(parsed.error.issues[0]?.message ?? "Enter a filter name.");
      return;
    }
    createSavedFilter.mutate(parsed.data);
  }

  function updateCurrentFilter() {
    if (!selectedSavedFilter) return;
    if (savedFilterReviewRequired) {
      setMessageTone("danger");
      setMessage(
        "Load the latest saved filter and review its values before updating.",
      );
      return;
    }
    if (selectedSavedFilter.reportType !== getValues().reportType) {
      setMessageTone("danger");
      setMessage(
        "A saved filter cannot change report type. Save it as a new filter instead.",
      );
      return;
    }
    const parsed = UpdateSavedReportFilterRequestSchema.safeParse({
      filters: currentFilterValues(),
      name: savedFilterName || selectedSavedFilter.name,
      updatedAt: selectedSavedFilter.updatedAt,
    });
    if (!parsed.success) {
      setMessageTone("danger");
      setMessage(
        parsed.error.issues[0]?.message ?? "The saved filter is invalid.",
      );
      return;
    }
    updateSavedFilter.mutate({
      filter: selectedSavedFilter,
      input: parsed.data,
    });
  }

  function persistSelection(name: "format", value: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set(name, value);
    router.replace(`/reports?${next.toString()}`, { scroll: false });
  }

  function persistReportType(value: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("reportType", value);
    next.delete("stage");
    next.delete("status");
    router.replace(`/reports?${next.toString()}`, { scroll: false });
  }

  function persistFilter(
    name: "from" | "stage" | "status" | "to",
    value: string,
  ) {
    const next = new URLSearchParams(searchParams.toString());
    if (name === "stage") next.delete("status");
    if (name === "status") next.delete("stage");
    if (value) next.set(name, value);
    else next.delete(name);
    router.replace(`/reports?${next.toString()}`, { scroll: false });
  }

  async function requestDownload(job: ExportJobDto) {
    setMessageTone("info");
    setMessage("Preparing download…");
    try {
      const result = await browserApiRequest(
        apiRoutes.reporting.download(job.id),
        { schema: ExportDownloadDtoSchema, scope: "internal" },
      );
      if (result.status !== "COMPLETED" || !result.downloadUrl) {
        setMessage(
          "The export is still processing. Try again after it completes.",
        );
        return;
      }
      window.location.assign(result.downloadUrl);
      setMessageTone("success");
      setMessage("Download started.");
    } catch (error) {
      setMessageTone("danger");
      setMessage(errorMessage(error));
    }
  }

  const jobs = exportsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const aggregation = reportSummary.data;
  const maximumAggregationValue = Math.max(
    0,
    ...(aggregation?.buckets.map((bucket) => Number(bucket.value)) ?? []),
  );

  return (
    <div className="grid gap-lg">
      <PageHeader
        actions={
          <Button
            disabled={exportsQuery.isFetching}
            onClick={() => exportsQuery.refetch()}
            variant="secondary"
          >
            {exportsQuery.isFetching ? "Refreshing…" : "Refresh Jobs"}
          </Button>
        }
        description="Create organization-scoped exports and follow each server-reported job through processing, completion, or failure."
        title="Reports & Exports"
      />

      <LiveRegion message={message} />
      {message ? (
        <InlineFeedback tone={messageTone}>{message}</InlineFeedback>
      ) : null}

      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Filtered Summary</PanelTitle>
            <PanelDescription>
              Server-authoritative totals for the report and date range in the
              URL.
            </PanelDescription>
          </div>
          {aggregation ? (
            <span className="font-mono text-caption tabular-nums text-foreground-muted">
              {aggregation.totalRecords.toLocaleString(locale)} records
            </span>
          ) : null}
        </PanelHeader>
        <PanelBody className="grid gap-md">
          {reportSummary.isPending ? (
            <div aria-busy="true" className="grid gap-xs" role="status">
              <Skeleton className="w-2/5" />
              <Skeleton shape="block" />
              <span className="sr-only">Loading report summary…</span>
            </div>
          ) : null}
          {reportSummary.isError ? (
            <ErrorFeedback title="Report Summary Is Unavailable">
              Check the current filters and refresh after the reporting service
              recovers.
            </ErrorFeedback>
          ) : null}
          {aggregation && aggregation.buckets.length === 0 ? (
            <EmptyState
              description="No records match the current report filters. Broaden the date range or clear the status filter."
              headingLevel="h3"
              title="No Matching Report Data"
            />
          ) : null}
          {aggregation && aggregation.buckets.length > 0 ? (
            <>
              <figure
                aria-labelledby="report-summary-chart-title"
                className="m-0 grid gap-sm"
              >
                <figcaption
                  className="text-body-sm font-semibold text-foreground-strong"
                  id="report-summary-chart-title"
                >
                  {aggregation.measure === "AVAILABLE_QUANTITY"
                    ? "Available Inventory by Warehouse"
                    : `${formatEnumLabel(aggregation.reportType)} by Status`}
                </figcaption>
                <div className="grid gap-xs">
                  {aggregation.buckets.map((bucket) => (
                    <div
                      className="grid gap-xxs sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-center"
                      key={bucket.key}
                    >
                      <span className="min-w-0 truncate text-caption text-foreground-muted">
                        {bucket.label}
                      </span>
                      <div aria-hidden="true" className="h-xs">
                        <div
                          className="h-full min-w-xxs rounded-pill bg-brand"
                          style={{
                            inlineSize: `${maximumAggregationValue === 0 ? 0 : (Number(bucket.value) / maximumAggregationValue) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="font-mono text-caption tabular-nums text-foreground-strong">
                        {aggregationValueLabel(
                          aggregation,
                          bucket.value,
                          locale,
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </figure>
              <DataTable aria-label="Filtered report summary table">
                <DataTableCaption visuallyHidden>
                  Tabular alternative for the filtered report summary chart
                </DataTableCaption>
                <DataTableHeader>
                  <DataTableRow>
                    <DataTableHead>Group</DataTableHead>
                    <DataTableHead numeric>Records</DataTableHead>
                    <DataTableHead numeric>
                      {aggregation.measure === "AVAILABLE_QUANTITY"
                        ? "Available Quantity"
                        : "Count"}
                    </DataTableHead>
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {aggregation.buckets.map((bucket) => (
                    <DataTableRow key={bucket.key}>
                      <DataTableCell>{bucket.label}</DataTableCell>
                      <DataTableCell numeric>
                        {bucket.recordCount.toLocaleString(locale)}
                      </DataTableCell>
                      <DataTableCell numeric>
                        {aggregationValueLabel(
                          aggregation,
                          bucket.value,
                          locale,
                        )}
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
              <p className="m-0 text-caption text-foreground-muted">
                Updated{" "}
                <time dateTime={aggregation.generatedAt}>
                  {formatDateTime(aggregation.generatedAt, locale, timeZone)}
                </time>
              </p>
            </>
          ) : null}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Create Export</PanelTitle>
            <PanelDescription>
              Report and format selections stay in the URL so this view can be
              shared.
            </PanelDescription>
          </div>
        </PanelHeader>
        <PanelBody>
          <form
            className="grid gap-md md:grid-cols-2 md:items-end xl:grid-cols-5"
            noValidate
            onSubmit={handleSubmit((input) => {
              const filters = normalizedReportFilters(
                input.reportType,
                input.filters,
              );
              const from = filters["from"];
              const to = filters["to"];
              if (
                typeof from === "string" &&
                typeof to === "string" &&
                from.length > 0 &&
                to.length > 0 &&
                from > to
              ) {
                setMessageTone("danger");
                setMessage("The from date must not be after the to date.");
                return;
              }
              setMessageTone("info");
              setMessage("");
              createExport.mutate({ ...input, filters });
            })}
          >
            <Field>
              <FieldLabel htmlFor="report-type">Report</FieldLabel>
              <Select
                {...reportTypeField}
                id="report-type"
                onChange={(event) => {
                  void reportTypeField.onChange(event);
                  setValue("filters.stage", "");
                  setValue("filters.status", "");
                  persistReportType(event.target.value);
                }}
              >
                {["QUOTES", "ORDERS", "INVOICES", "CUSTOMERS", "INVENTORY"].map(
                  (reportType) => (
                    <option key={reportType} value={reportType}>
                      {formatEnumLabel(reportType)}
                    </option>
                  ),
                )}
              </Select>
              {errors.reportType ? (
                <FieldError>{errors.reportType.message}</FieldError>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="export-format">Format</FieldLabel>
              <Select
                {...formatField}
                id="export-format"
                onChange={(event) => {
                  void formatField.onChange(event);
                  persistSelection("format", event.target.value);
                }}
              >
                {["CSV", "XLSX", "PDF"].map((format) => (
                  <option key={format} value={format}>
                    {format}
                  </option>
                ))}
              </Select>
              <FieldDescription>
                Availability is confirmed by the export job status.
              </FieldDescription>
              {errors.format ? (
                <FieldError>{errors.format.message}</FieldError>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="export-from">From Date</FieldLabel>
              <Input
                {...fromField}
                autoComplete="off"
                id="export-from"
                onChange={(event) => {
                  void fromField.onChange(event);
                  persistFilter("from", event.target.value);
                }}
                type="date"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="export-to">To Date</FieldLabel>
              <Input
                {...toField}
                autoComplete="off"
                id="export-to"
                onChange={(event) => {
                  void toField.onChange(event);
                  persistFilter("to", event.target.value);
                }}
                type="date"
              />
            </Field>
            {availableStatuses.length > 0 ? (
              <Field>
                <FieldLabel htmlFor="export-status">
                  {activeReportType === "QUOTES" ? "Quote Stage" : "Status"}
                </FieldLabel>
                <Select
                  {...statusField}
                  id="export-status"
                  key={activeReportType}
                  onChange={(event) => {
                    void statusField.onChange(event);
                    persistFilter(activeStatusFilterName, event.target.value);
                  }}
                >
                  <option key="all" value="">
                    {activeReportType === "QUOTES"
                      ? "All Quote Stages"
                      : "All Statuses"}
                  </option>
                  {availableStatuses.map((status) => (
                    <option key={status} value={status}>
                      {formatEnumLabel(status)}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <div className="flex flex-wrap items-center gap-xs">
              <Button
                disabled={!canExport || createExport.isPending}
                type="submit"
              >
                {createExport.isPending ? "Creating Export…" : "Create Export"}
              </Button>
              <ButtonLink href="/reports" variant="quiet">
                Reset
              </ButtonLink>
            </div>
          </form>
          {!canExport ? (
            <p className="mb-0 mt-sm text-caption text-foreground-muted">
              Your current role can view prior exports but cannot create one.
            </p>
          ) : null}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Saved Filters</PanelTitle>
            <PanelDescription>
              Store personal report selections without keeping sensitive data in
              browser storage.
            </PanelDescription>
          </div>
        </PanelHeader>
        <PanelBody>
          {savedFiltersQuery.isError ? (
            <ErrorFeedback title="Saved Filters Are Unavailable">
              The API could not load your personal report filters.
            </ErrorFeedback>
          ) : null}
          <div className="grid gap-sm lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
            <Field>
              <FieldLabel htmlFor="saved-filter">Saved Filter</FieldLabel>
              <Select
                id="saved-filter"
                name="saved-filter"
                onChange={(event) => {
                  const nextId = event.target.value;
                  const filter = savedFilters.find(
                    (item) => item.id === nextId,
                  );
                  setSavedFilterId(nextId);
                  setSavedFilterName(filter?.name ?? "");
                  setSavedFilterReviewRequired(false);
                }}
                value={savedFilterId}
              >
                <option key="all" value="">
                  Select a Saved Filter
                </option>
                {savedFilters.map((filter) => (
                  <option key={filter.id} value={filter.id}>
                    {filter.name} ({formatEnumLabel(filter.reportType)})
                  </option>
                ))}
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="saved-filter-name">Filter Name</FieldLabel>
              <Input
                autoComplete="off"
                id="saved-filter-name"
                maxLength={120}
                name="saved-filter-name"
                onChange={(event) => setSavedFilterName(event.target.value)}
                placeholder="Example: Open overdue invoices…"
                value={savedFilterName}
              />
            </Field>
            <div className="flex flex-wrap gap-xs">
              <Button
                disabled={!selectedSavedFilter || savedFilterBusy}
                onClick={loadSavedFilter}
                variant="secondary"
              >
                Load
              </Button>
              <Button
                disabled={
                  savedFilterName.trim().length === 0 || savedFilterBusy
                }
                onClick={saveCurrentFilter}
              >
                Save New
              </Button>
              <Button
                disabled={
                  !selectedSavedFilter ||
                  savedFilterBusy ||
                  savedFilterReviewRequired
                }
                onClick={updateCurrentFilter}
                variant="secondary"
              >
                Update
              </Button>
              <Button
                disabled={!selectedSavedFilter || savedFilterBusy}
                onClick={() => setDeleteConfirmationOpen(true)}
                variant="danger"
              >
                Delete
              </Button>
            </div>
          </div>
          {savedFilters.length === 0 && !savedFiltersQuery.isPending ? (
            <p className="mb-0 mt-sm text-caption text-foreground-muted">
              No personal filters are saved yet.
            </p>
          ) : null}
          {savedFilters.length > 0 ? (
            <div className="mt-sm flex flex-wrap items-center justify-between gap-xs border-t border-border pt-sm">
              <span
                aria-live="polite"
                className="text-caption text-foreground-muted"
              >
                {savedFilters.length} saved filters loaded
              </span>
              {savedFiltersQuery.hasNextPage ? (
                <Button
                  disabled={savedFiltersQuery.isFetchingNextPage}
                  onClick={() => void savedFiltersQuery.fetchNextPage()}
                  size="compact"
                  variant="secondary"
                >
                  {savedFiltersQuery.isFetchingNextPage
                    ? "Loading More…"
                    : "Load More Filters"}
                </Button>
              ) : null}
            </div>
          ) : null}
        </PanelBody>
      </Panel>

      {exportsQuery.isError ? (
        <ErrorFeedback title="Export Jobs Are Unavailable">
          The API could not load export status. Refresh after the service
          recovers.
        </ErrorFeedback>
      ) : null}

      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Export Jobs</PanelTitle>
            <PanelDescription>
              Jobs refresh automatically while server processing is active.
            </PanelDescription>
          </div>
        </PanelHeader>
        <PanelBody className="p-0">
          {jobs.length > 0 ? (
            <>
              <div className="grid gap-sm p-sm md:hidden">
                {jobs.map((job) => (
                  <article
                    className="grid gap-sm rounded-control border border-border bg-surface p-sm"
                    key={job.id}
                  >
                    <div className="flex items-start justify-between gap-xs">
                      <div>
                        <strong className="block text-body-sm text-foreground-strong">
                          {formatEnumLabel(job.reportType)}
                        </strong>
                        <span className="font-mono text-caption text-foreground-muted">
                          {job.format}
                        </span>
                      </div>
                      <Badge tone={exportTone(job.status)}>
                        {formatEnumLabel(job.status)}
                      </Badge>
                    </div>
                    <dl className="m-0 grid grid-cols-2 gap-xs text-caption">
                      <div>
                        <dt className="text-foreground-muted">Progress</dt>
                        <dd className="m-0 font-mono tabular-nums text-foreground-strong">
                          {formatPercentage(String(job.progress), locale, 0)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-foreground-muted">Created</dt>
                        <dd className="m-0 text-foreground-strong">
                          <time dateTime={job.createdAt}>
                            {formatDateTime(job.createdAt, locale, timeZone)}
                          </time>
                        </dd>
                      </div>
                    </dl>
                    {job.status === "COMPLETED" && job.downloadUrl ? (
                      <Button
                        onClick={() => requestDownload(job)}
                        size="compact"
                        variant="secondary"
                      >
                        Download
                      </Button>
                    ) : job.errorMessage ? (
                      <span className="text-caption text-danger">
                        {job.errorMessage}
                      </span>
                    ) : (
                      <span className="text-caption text-foreground-muted">
                        {job.status === "PROCESSING" || job.status === "QUEUED"
                          ? "Processing…"
                          : "No Download"}
                      </span>
                    )}
                  </article>
                ))}
              </div>
              <DataTable
                aria-label="Report export jobs and download actions"
                containerClassName="hidden md:block"
              >
                <DataTableCaption visuallyHidden>
                  Report export jobs and download actions
                </DataTableCaption>
                <DataTableHeader>
                  <DataTableRow>
                    <DataTableHead>Report</DataTableHead>
                    <DataTableHead>Format</DataTableHead>
                    <DataTableHead>Status</DataTableHead>
                    <DataTableHead numeric>Progress</DataTableHead>
                    <DataTableHead>Created</DataTableHead>
                    <DataTableHead>Result</DataTableHead>
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {jobs.map((job) => (
                    <DataTableRow key={job.id}>
                      <DataTableCell>
                        {formatEnumLabel(job.reportType)}
                      </DataTableCell>
                      <DataTableCell>{job.format}</DataTableCell>
                      <DataTableCell>
                        <Badge tone={exportTone(job.status)}>
                          {formatEnumLabel(job.status)}
                        </Badge>
                      </DataTableCell>
                      <DataTableCell numeric>
                        {formatPercentage(String(job.progress), locale, 0)}
                      </DataTableCell>
                      <DataTableCell>
                        <time dateTime={job.createdAt}>
                          {formatDateTime(job.createdAt, locale, timeZone)}
                        </time>
                      </DataTableCell>
                      <DataTableCell>
                        {job.status === "COMPLETED" && job.downloadUrl ? (
                          <Button
                            onClick={() => requestDownload(job)}
                            size="compact"
                            variant="secondary"
                          >
                            Download
                          </Button>
                        ) : job.errorMessage ? (
                          <span className="text-caption text-danger">
                            {job.errorMessage}
                          </span>
                        ) : (
                          <span className="text-caption text-foreground-muted">
                            {job.status === "PROCESSING" ||
                            job.status === "QUEUED"
                              ? "Processing…"
                              : "No Download"}
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
                  {jobs.length} export jobs loaded
                </span>
                {exportsQuery.hasNextPage ? (
                  <Button
                    disabled={exportsQuery.isFetchingNextPage}
                    onClick={() => void exportsQuery.fetchNextPage()}
                    size="compact"
                    variant="secondary"
                  >
                    {exportsQuery.isFetchingNextPage
                      ? "Loading More…"
                      : "Load More Jobs"}
                  </Button>
                ) : null}
              </div>
            </>
          ) : (
            <EmptyState
              description="Create an export to track its progress and download state here."
              headingLevel="h3"
              title="No Export Jobs"
            />
          )}
        </PanelBody>
      </Panel>

      <Dialog
        closeLabel="Close Delete Filter Confirmation"
        description="This removes only your personal saved filter. Existing export jobs are unchanged."
        footer={
          <>
            <Button
              onClick={() => setDeleteConfirmationOpen(false)}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              disabled={!selectedSavedFilter || deleteSavedFilter.isPending}
              onClick={() => {
                if (selectedSavedFilter) {
                  deleteSavedFilter.mutate(selectedSavedFilter);
                }
              }}
              variant="danger"
            >
              {deleteSavedFilter.isPending ? "Deleting…" : "Delete Filter"}
            </Button>
          </>
        }
        onOpenChange={setDeleteConfirmationOpen}
        open={deleteConfirmationOpen}
        size="compact"
        title="Delete Saved Filter?"
      >
        <p className="m-0 text-body-sm text-foreground">
          {selectedSavedFilter
            ? `Delete ${selectedSavedFilter.name}? This action cannot be undone.`
            : "Select a saved filter before deleting it."}
        </p>
      </Dialog>
    </div>
  );
}
