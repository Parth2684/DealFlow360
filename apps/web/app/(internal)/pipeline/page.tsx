import {
  QUOTE_STAGES,
  QuoteSummaryDtoSchema,
  SavedReportFilterPageDtoSchema,
  apiRoutes,
  createCursorPageSchema,
  planApiRoutes,
  type QuoteStage,
} from "@repo/common";
import type { Metadata } from "next";

import { PipelineBoard } from "../../../features/quotations/pipeline-board";
import type { QuoteListFilters } from "../../../features/quotations/quotation-list";
import { serverApiRequest } from "../../../lib/api/server";
import { getInternalSessionState } from "../../../lib/auth/session";

export const metadata: Metadata = { title: "Pipeline" };

const QuotePageSchema = createCursorPageSchema(QuoteSummaryDtoSchema);

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function filtersFrom(
  values: Record<string, string | string[] | undefined>,
): QuoteListFilters {
  const stage = first(values.stage);
  const sort = first(values.sort);
  const direction = first(values.direction);
  const search = first(values.search)?.trim();
  return {
    ...(search ? { search } : {}),
    ...(QUOTE_STAGES.includes(stage as QuoteStage)
      ? { stage: stage as QuoteStage }
      : {}),
    ...(sort === "createdAt" ||
    sort === "total" ||
    sort === "expiresAt" ||
    sort === "updatedAt"
      ? { sort }
      : {}),
    ...(direction === "asc" || direction === "desc" ? { direction } : {}),
  };
}

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sessionState = await getInternalSessionState();
  if (sessionState.status !== "authenticated") return null;
  const parameters = await searchParams;
  const filters = filtersFrom(parameters);
  const cursor = first(parameters.cursor);
  const query = new URLSearchParams({ limit: "50" });
  for (const [name, value] of Object.entries(filters)) {
    if (value) query.set(name, value);
  }
  if (cursor) query.set("cursor", cursor);
  const [quotes, savedFilters] = await Promise.all([
    serverApiRequest(
      `${apiRoutes.quotes.list}?${query.toString()}`,
      QuotePageSchema,
    ),
    serverApiRequest(
      `${planApiRoutes.quotes.savedFilters}?limit=25`,
      SavedReportFilterPageDtoSchema,
    ).catch(() => undefined),
  ]);
  const capabilities = sessionState.session.user.capabilities;
  const nextHref = quotes.pageInfo.nextCursor
    ? `/pipeline?${new URLSearchParams(
        Object.entries({
          ...filters,
          cursor: quotes.pageInfo.nextCursor,
        }).filter((entry): entry is [string, string] => Boolean(entry[1])),
      ).toString()}`
    : undefined;

  return (
    <PipelineBoard
      canCreate={capabilities.includes("quotation.create")}
      canEdit={
        capabilities.includes("quotation.editOwn") ||
        capabilities.includes("quotation.editAny")
      }
      canSend={capabilities.includes("quotation.send")}
      canSubmit={capabilities.includes("quotation.submit")}
      filters={filters}
      initialQuotes={quotes.items}
      initialSavedFilters={savedFilters}
      key={query.toString()}
      locale={sessionState.session.organization.locale}
      nextHref={nextHref}
      timeZone={sessionState.session.organization.timezone}
    />
  );
}
