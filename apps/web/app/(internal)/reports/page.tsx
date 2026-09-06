import {
  CONFIGURATION_STATUSES,
  ExportJobDtoSchema,
  INVOICE_STATUSES,
  ORDER_STATUSES,
  QUOTE_STAGES,
  ReportAggregationDtoSchema,
  SavedReportFilterPageDtoSchema,
  apiRoutes,
  createCursorPageSchema,
  planApiRoutes,
} from "@repo/common";
import { redirect } from "next/navigation";

import { ReportingWorkspace } from "../../../features/reporting/reporting-workspace";
import { serverApiRequest } from "../../../lib/api/server";
import {
  getInternalSessionState,
  hasInternalWorkspaceAccess,
} from "../../../lib/auth/session";

const ExportPageSchema = createCursorPageSchema(ExportJobDtoSchema);

function selectedValue(
  value: string | string[] | undefined,
  allowed: readonly string[],
  fallback: string,
): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && allowed.includes(candidate) ? candidate : fallback;
}

function optionalValue(
  value: string | string[] | undefined,
): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate?.trim() ? candidate : undefined;
}

function allowedStatuses(reportType: string): readonly string[] {
  switch (reportType) {
    case "QUOTES":
      return QUOTE_STAGES;
    case "ORDERS":
      return ORDER_STATUSES;
    case "INVOICES":
      return INVOICE_STATUSES;
    case "CUSTOMERS":
      return CONFIGURATION_STATUSES;
    default:
      return [];
  }
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sessionState = await getInternalSessionState();
  if (sessionState.status === "anonymous") redirect("/login?next=/reports");
  if (sessionState.status === "unavailable") {
    throw new Error(sessionState.message);
  }
  if (!hasInternalWorkspaceAccess(sessionState.session)) redirect("/forbidden");

  const parameters = await searchParams;
  const selectedReportType = selectedValue(
    parameters.reportType,
    ["QUOTES", "ORDERS", "INVOICES", "CUSTOMERS", "INVENTORY"],
    "QUOTES",
  );
  const selectedFormat = selectedValue(
    parameters.format,
    ["CSV", "XLSX", "PDF"],
    "CSV",
  );
  const selectedFrom = optionalValue(parameters.from);
  const selectedTo = optionalValue(parameters.to);
  const requestedStatus = optionalValue(
    selectedReportType === "QUOTES" ? parameters.stage : parameters.status,
  );
  const selectedStatus = allowedStatuses(selectedReportType).includes(
    requestedStatus ?? "",
  )
    ? requestedStatus
    : undefined;
  const summaryParameters = new URLSearchParams({
    reportType: selectedReportType,
  });
  if (selectedFrom) summaryParameters.set("from", selectedFrom);
  if (selectedTo) summaryParameters.set("to", selectedTo);
  if (selectedStatus) {
    summaryParameters.set(
      selectedReportType === "QUOTES" ? "stage" : "status",
      selectedStatus,
    );
  }
  const [initialResult, initialSavedFilters, initialSummary] =
    await Promise.all([
      serverApiRequest(
        `${apiRoutes.reporting.exports}?limit=25`,
        ExportPageSchema,
      ).catch(() => undefined),
      serverApiRequest(
        `${planApiRoutes.reporting.savedFilters}?limit=100`,
        SavedReportFilterPageDtoSchema,
      ).catch(() => undefined),
      serverApiRequest(
        `${planApiRoutes.reporting.summary}?${summaryParameters.toString()}`,
        ReportAggregationDtoSchema,
      ).catch(() => undefined),
    ]);

  return (
    <ReportingWorkspace
      canExport={sessionState.session.user.capabilities.includes(
        "reporting.export",
      )}
      initialExports={initialResult}
      initialSavedFilters={initialSavedFilters}
      initialSummary={initialSummary}
      selectedFilters={{
        ...(selectedFrom === undefined ? {} : { from: selectedFrom }),
        ...(selectedTo === undefined ? {} : { to: selectedTo }),
        ...(selectedStatus === undefined
          ? {}
          : selectedReportType === "QUOTES"
            ? { stage: selectedStatus }
            : { status: selectedStatus }),
      }}
      selectedFormat={selectedFormat as "CSV" | "XLSX" | "PDF"}
      selectedReportType={
        selectedReportType as
          "QUOTES" | "ORDERS" | "INVOICES" | "CUSTOMERS" | "INVENTORY"
      }
      timeZone={sessionState.session.organization.timezone}
    />
  );
}
