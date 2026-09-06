import {
  QUOTE_STAGES,
  QuoteSummaryDtoSchema,
  SavedReportFilterPageDtoSchema,
  apiRoutes,
  createCursorPageSchema,
  type QuoteListQuery,
  type QuoteStage,
  planApiRoutes,
} from "@repo/common";
import type { Metadata } from "next";

import {
  QuotationList,
  type QuoteListFilters,
} from "../../../features/quotations/quotation-list";
import { serverApiRequest } from "../../../lib/api/server";
import { getInternalSessionState } from "../../../lib/auth/session";

export const metadata: Metadata = { title: "Quotations" };

const QuotePageSchema = createCursorPageSchema(QuoteSummaryDtoSchema);

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function filtersFrom(
  values: Record<string, string | string[] | undefined>,
): QuoteListFilters {
  const stageValue = first(values.stage);
  const sortValue = first(values.sort);
  const directionValue = first(values.direction);
  return {
    ...(first(values.search) ? { search: first(values.search) } : {}),
    ...(QUOTE_STAGES.includes(stageValue as QuoteStage)
      ? { stage: stageValue as QuoteStage }
      : {}),
    ...(sortValue === "createdAt" ||
    sortValue === "total" ||
    sortValue === "expiresAt" ||
    sortValue === "updatedAt"
      ? { sort: sortValue }
      : {}),
    ...(directionValue === "asc" || directionValue === "desc"
      ? { direction: directionValue }
      : {}),
  };
}

function listPath(
  filters: QuoteListFilters,
  cursor: string | undefined,
): string {
  const parameters = new URLSearchParams({ limit: "25" });
  for (const [name, value] of Object.entries(filters)) {
    if (value) parameters.set(name, value);
  }
  if (cursor) parameters.set("cursor", cursor);
  return `${apiRoutes.quotes.list}?${parameters.toString()}`;
}

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sessionState = await getInternalSessionState();
  if (sessionState.status !== "authenticated") return null;
  const parameters = await searchParams;
  const filters = filtersFrom(parameters);
  const cursor = first(parameters.cursor);
  const [page, savedFilters] = await Promise.all([
    serverApiRequest(listPath(filters, cursor), QuotePageSchema),
    serverApiRequest(
      `${planApiRoutes.quotes.savedFilters}?limit=25`,
      SavedReportFilterPageDtoSchema,
    ).catch(() => undefined),
  ]);

  return (
    <QuotationList
      canCreate={sessionState.session.user.capabilities.includes(
        "quotation.create",
      )}
      filters={filters satisfies Partial<QuoteListQuery>}
      locale={sessionState.session.organization.locale}
      page={page}
      savedFilters={savedFilters}
      timeZone={sessionState.session.organization.timezone}
    />
  );
}
