import {
  QUOTE_STAGES,
  formatDateTime,
  formatEnumLabel,
  formatMoney,
  formatPercentage,
  type CursorPage,
  type ApprovalRequestStatus,
  type QuoteSavedFilterValue,
  type QuoteStage,
  type QuoteSummaryDto,
  type RiskLevel,
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
  EmptyState,
  Field,
  FieldLabel,
  Input,
  PageHeader,
  Pagination,
  Select,
} from "@repo/ui";
import Link from "next/link";

import { QuoteSavedFilters } from "./quote-saved-filters";

export interface QuoteListFilters {
  direction?: "asc" | "desc";
  search?: string;
  sort?: "updatedAt" | "createdAt" | "total" | "expiresAt";
  stage?: QuoteStage;
}

function stageTone(stage: QuoteStage) {
  if (stage === "CONFIRMED") return "success" as const;
  if (stage === "PENDING_APPROVAL" || stage === "REVISION_REQUIRED") {
    return "warning" as const;
  }
  if (stage === "CANCELLED" || stage === "EXPIRED") return "danger" as const;
  return "neutral" as const;
}

function approvalTone(status: ApprovalRequestStatus | null) {
  if (status === "APPROVED") return "success" as const;
  if (status === "REJECTED") return "danger" as const;
  if (
    status === "PENDING" ||
    status === "IN_PROGRESS" ||
    status === "REVISION_REQUIRED"
  ) {
    return "warning" as const;
  }
  return "neutral" as const;
}

function healthTone(riskLevel: RiskLevel | null) {
  if (riskLevel === "CRITICAL" || riskLevel === "HIGH") {
    return "danger" as const;
  }
  if (riskLevel === "MEDIUM") return "warning" as const;
  if (riskLevel === "LOW") return "success" as const;
  return "neutral" as const;
}

function queryHref(
  filters: QuoteListFilters,
  cursor: string | null,
): string | undefined {
  if (!cursor) return undefined;
  const parameters = new URLSearchParams();
  if (filters.search) parameters.set("search", filters.search);
  if (filters.stage) parameters.set("stage", filters.stage);
  if (filters.sort) parameters.set("sort", filters.sort);
  if (filters.direction) parameters.set("direction", filters.direction);
  parameters.set("cursor", cursor);
  return `/quotations?${parameters.toString()}`;
}

function QuoteMobileCard({
  locale,
  quote,
  timeZone,
}: {
  locale: string;
  quote: QuoteSummaryDto;
  timeZone: string;
}) {
  return (
    <article className="grid gap-sm rounded-panel border border-border bg-surface p-md md:hidden">
      <div className="flex min-w-0 items-start justify-between gap-sm">
        <div className="min-w-0">
          <Link
            className="font-mono text-body-sm font-semibold text-brand underline-offset-4 hover:underline"
            href={`/quotations/${quote.id}`}
          >
            {quote.quoteNumber}
          </Link>
          <p className="m-0 truncate text-body-sm font-semibold text-foreground-strong">
            {quote.customerName}
          </p>
        </div>
        <Badge tone={stageTone(quote.stage)}>
          {formatEnumLabel(quote.stage)}
        </Badge>
      </div>
      <dl className="m-0 grid grid-cols-2 gap-sm">
        <div>
          <dt className="text-caption text-foreground-muted">Total</dt>
          <dd className="m-0 font-mono text-body-sm tabular-nums text-foreground-strong">
            {formatMoney(quote.total, quote.currency, locale)}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-foreground-muted">Margin</dt>
          <dd className="m-0 font-mono text-body-sm tabular-nums text-foreground-strong">
            {formatPercentage(quote.marginPercent, locale)}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-foreground-muted">Approval</dt>
          <dd className="m-0 mt-xxs">
            <Badge tone={approvalTone(quote.approvalStatus)}>
              {quote.approvalStatus
                ? formatEnumLabel(quote.approvalStatus)
                : "Not Requested"}
            </Badge>
          </dd>
        </div>
        <div>
          <dt className="text-caption text-foreground-muted">Health</dt>
          <dd className="m-0 mt-xxs">
            {quote.riskLevel ? (
              <Badge tone={healthTone(quote.riskLevel)}>
                {formatEnumLabel(quote.riskLevel)}
              </Badge>
            ) : (
              <span className="text-caption text-foreground-muted">
                Not Calculated
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-foreground-muted">Owner</dt>
          <dd className="m-0 truncate text-body-sm text-foreground-strong">
            {quote.ownerName}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-foreground-muted">Updated</dt>
          <dd className="m-0 text-body-sm text-foreground-strong">
            <time dateTime={quote.updatedAt}>
              {formatDateTime(quote.updatedAt, locale, timeZone)}
            </time>
          </dd>
        </div>
      </dl>
    </article>
  );
}

export function QuotationList({
  canCreate,
  filters,
  locale,
  page,
  savedFilters,
  timeZone,
}: {
  canCreate: boolean;
  filters: QuoteListFilters;
  locale: string;
  page: CursorPage<QuoteSummaryDto>;
  savedFilters?: CursorPage<import("@repo/common").SavedReportFilterDto>;
  timeZone: string;
}) {
  return (
    <div className="grid gap-lg">
      <PageHeader
        actions={
          canCreate ? (
            <ButtonLink href="/quotations/new" variant="primary">
              New Quotation
            </ButtonLink>
          ) : null
        }
        description="Search active deals, review server-calculated value and risk, and open the current commercial version."
        title="Quotations"
      />

      <form
        className="grid gap-sm border-b border-border pb-md sm:grid-cols-2 lg:grid-cols-6"
        method="get"
      >
        <Field className="lg:col-span-2">
          <FieldLabel htmlFor="quote-search">Search Quotations</FieldLabel>
          <Input
            autoComplete="off"
            defaultValue={filters.search}
            id="quote-search"
            name="search"
            placeholder="Quote number or customer…"
            type="search"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="quote-stage">Stage</FieldLabel>
          <Select
            defaultValue={filters.stage ?? ""}
            id="quote-stage"
            name="stage"
          >
            <option value="">All Stages</option>
            {QUOTE_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {formatEnumLabel(stage)}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="quote-sort">Sort By</FieldLabel>
          <Select
            defaultValue={filters.sort ?? "updatedAt"}
            id="quote-sort"
            name="sort"
          >
            <option value="updatedAt">Last Updated</option>
            <option value="createdAt">Created</option>
            <option value="total">Total</option>
            <option value="expiresAt">Expiration</option>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="quote-direction">Direction</FieldLabel>
          <Select
            defaultValue={filters.direction ?? "desc"}
            id="quote-direction"
            name="direction"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </Select>
        </Field>
        <div className="flex items-end gap-xs">
          <ButtonLink href="/quotations" variant="quiet">
            Reset
          </ButtonLink>
          <Button type="submit">Apply Filters</Button>
        </div>
      </form>

      <QuoteSavedFilters
        currentFilters={filters satisfies QuoteSavedFilterValue}
        initialPage={savedFilters}
      />

      {page.items.length > 0 ? (
        <>
          <div className="grid gap-sm md:hidden">
            {page.items.map((quote) => (
              <QuoteMobileCard
                key={quote.id}
                locale={locale}
                quote={quote}
                timeZone={timeZone}
              />
            ))}
          </div>
          <DataTable
            aria-label="Quotations and current commercial status"
            containerClassName="hidden md:block"
          >
            <DataTableCaption visuallyHidden>
              Quotations and current commercial status
            </DataTableCaption>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>Quotation</DataTableHead>
                <DataTableHead>Customer</DataTableHead>
                <DataTableHead>Owner</DataTableHead>
                <DataTableHead>Stage</DataTableHead>
                <DataTableHead>Approval</DataTableHead>
                <DataTableHead>Health</DataTableHead>
                <DataTableHead numeric>Total</DataTableHead>
                <DataTableHead numeric>Margin</DataTableHead>
                <DataTableHead>Last Activity</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {page.items.map((quote) => (
                <DataTableRow key={quote.id}>
                  <DataTableCell>
                    <Link
                      className="font-mono font-semibold text-brand underline-offset-4 hover:underline"
                      href={`/quotations/${quote.id}`}
                    >
                      {quote.quoteNumber}
                    </Link>
                  </DataTableCell>
                  <DataTableCell>{quote.customerName}</DataTableCell>
                  <DataTableCell>{quote.ownerName}</DataTableCell>
                  <DataTableCell>
                    <Badge tone={stageTone(quote.stage)}>
                      {formatEnumLabel(quote.stage)}
                    </Badge>
                  </DataTableCell>
                  <DataTableCell>
                    <Badge tone={approvalTone(quote.approvalStatus)}>
                      {quote.approvalStatus
                        ? formatEnumLabel(quote.approvalStatus)
                        : "Not Requested"}
                    </Badge>
                  </DataTableCell>
                  <DataTableCell>
                    {quote.riskLevel ? (
                      <Badge tone={healthTone(quote.riskLevel)}>
                        {formatEnumLabel(quote.riskLevel)}
                      </Badge>
                    ) : (
                      <span className="text-caption text-foreground-muted">
                        Not Calculated
                      </span>
                    )}
                  </DataTableCell>
                  <DataTableCell numeric>
                    {formatMoney(quote.total, quote.currency, locale)}
                  </DataTableCell>
                  <DataTableCell numeric>
                    {formatPercentage(quote.marginPercent, locale)}
                  </DataTableCell>
                  <DataTableCell>
                    <time dateTime={quote.updatedAt}>
                      {formatDateTime(quote.updatedAt, locale, timeZone)}
                    </time>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
          <Pagination
            nextHref={queryHref(filters, page.pageInfo.nextCursor)}
            status={`${page.items.length} quotations in this page`}
          />
        </>
      ) : (
        <EmptyState
          action={
            filters.search || filters.stage ? (
              <ButtonLink href="/quotations" variant="secondary">
                Clear Filters
              </ButtonLink>
            ) : canCreate ? (
              <ButtonLink href="/quotations/new" variant="primary">
                Create Quotation
              </ButtonLink>
            ) : undefined
          }
          description={
            filters.search || filters.stage
              ? "No quotations match the current filters. Clear the filters and try again."
              : "No quotations are available for your current team and role."
          }
          title="No Quotations Found"
        />
      )}
    </div>
  );
}
