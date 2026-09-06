import {
  AlertDtoSchema,
  DealHealthDashboardDtoSchema,
  DealHealthDashboardQuerySchema,
  apiRoutes,
  createCursorPageSchema,
  planApiRoutes,
  type DealHealthDashboardQuery,
} from "@repo/common";
import { redirect } from "next/navigation";

import { DealHealthWorkspace } from "../../../features/deal-health/deal-health-workspace";
import { serverApiRequest } from "../../../lib/api/server";
import {
  getInternalSessionState,
  hasInternalWorkspaceAccess,
} from "../../../lib/auth/session";

const AlertPageSchema = createCursorPageSchema(AlertDtoSchema);
const FILTER_KEYS = [
  "from",
  "to",
  "ownerId",
  "salesTeamId",
  "warehouseId",
  "productId",
  "categoryId",
  "stage",
  "approvalStatus",
  "riskLevel",
] as const satisfies readonly (keyof DealHealthDashboardQuery)[];
const FILTER_NOTICE_KEY = "filtersAdjusted";

function singleValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function dashboardQuery(
  values: Record<string, string | string[] | undefined>,
): { filters: DealHealthDashboardQuery; invalid: boolean } {
  let filters: DealHealthDashboardQuery = {};
  let invalid = false;

  for (const key of FILTER_KEYS) {
    const rawValue = values[key];
    if (Array.isArray(rawValue) && rawValue.length !== 1) invalid = true;
    const value = singleValue(rawValue)?.trim();
    if (!value) continue;
    const parsed = DealHealthDashboardQuerySchema.safeParse({
      ...filters,
      [key]: value,
    });
    if (parsed.success) filters = parsed.data;
    else invalid = true;
  }

  const allowedKeys = new Set<string>([...FILTER_KEYS, FILTER_NOTICE_KEY]);
  if (Object.keys(values).some((key) => !allowedKeys.has(key))) invalid = true;
  const noticeValue = values[FILTER_NOTICE_KEY];
  if (
    noticeValue !== undefined &&
    (Array.isArray(noticeValue) || noticeValue !== "true")
  ) {
    invalid = true;
  }
  return { filters, invalid };
}

function withQuery(
  path: string,
  query: Record<string, string | undefined>,
): string {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) parameters.set(key, value);
  }
  const suffix = parameters.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export default async function DealHealthPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sessionState = await getInternalSessionState();
  if (sessionState.status === "anonymous") redirect("/login?next=/deal-health");
  if (sessionState.status === "unavailable") {
    throw new Error(sessionState.message);
  }
  if (!hasInternalWorkspaceAccess(sessionState.session)) redirect("/forbidden");

  const parameters = await searchParams;
  const parsedQuery = dashboardQuery(parameters);
  const filters = parsedQuery.filters;
  if (parsedQuery.invalid) {
    redirect(
      withQuery("/deal-health", {
        from: filters.from,
        to: filters.to,
        ownerId: filters.ownerId,
        salesTeamId: filters.salesTeamId,
        warehouseId: filters.warehouseId,
        productId: filters.productId,
        categoryId: filters.categoryId,
        stage: filters.stage,
        approvalStatus: filters.approvalStatus,
        riskLevel: filters.riskLevel,
        [FILTER_NOTICE_KEY]: "true",
      }),
    );
  }
  const dashboardPath = withQuery(planApiRoutes.dealHealth.dashboard, {
    from: filters.from,
    to: filters.to,
    ownerId: filters.ownerId,
    salesTeamId: filters.salesTeamId,
    warehouseId: filters.warehouseId,
    productId: filters.productId,
    categoryId: filters.categoryId,
    stage: filters.stage,
    approvalStatus: filters.approvalStatus,
    riskLevel: filters.riskLevel,
  });
  const alertsPath = withQuery(apiRoutes.dealHealth.alerts, {
    limit: "25",
    status: "OPEN",
  });

  const [dashboardResult, alertsResult] = await Promise.allSettled([
    serverApiRequest(dashboardPath, DealHealthDashboardDtoSchema),
    serverApiRequest(alertsPath, AlertPageSchema),
  ]);

  return (
    <DealHealthWorkspace
      alertsPath={alertsPath}
      canManage={sessionState.session.user.capabilities.includes(
        "dealHealth.manage",
      )}
      currency={sessionState.session.organization.baseCurrency}
      dashboardPath={dashboardPath}
      filtersAdjusted={singleValue(parameters[FILTER_NOTICE_KEY]) === "true"}
      filters={filters}
      initialAlerts={
        alertsResult.status === "fulfilled" ? alertsResult.value : undefined
      }
      initialDashboard={
        dashboardResult.status === "fulfilled"
          ? dashboardResult.value
          : undefined
      }
      timeZone={sessionState.session.organization.timezone}
    />
  );
}
