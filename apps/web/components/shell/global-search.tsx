"use client";

import {
  CustomerAccountListQuerySchema,
  CustomerAccountDtoSchema,
  OrderSummaryDtoSchema,
  QuoteSummaryDtoSchema,
  apiRoutes,
  createCursorPageSchema,
  type Capability,
} from "@repo/common";
import {
  Button,
  ButtonLink,
  Dialog,
  EmptyState,
  ErrorFeedback,
  FieldLabel,
  Input,
  LiveRegion,
  Skeleton,
} from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useMemo, useState, type FormEvent } from "react";

import { browserApiRequest } from "../../lib/api/browser";

const QuotePageSchema = createCursorPageSchema(QuoteSummaryDtoSchema);
const CustomerPageSchema = createCursorPageSchema(CustomerAccountDtoSchema);
const OrderPageSchema = createCursorPageSchema(OrderSummaryDtoSchema);

interface SearchResult {
  category: "Customer" | "Order" | "Quotation";
  description: string;
  href?: string;
  id: string;
  label: string;
}

function queryPath(path: string, search: string, limit: number): string {
  const query = new URLSearchParams({ limit: String(limit), search });
  return `${path}?${query.toString()}`;
}

function customerQueryPath(search: string, limit: number): string {
  const query = CustomerAccountListQuerySchema.parse({ limit, search });
  return queryPath(
    apiRoutes.customers.accounts,
    query.search ?? "",
    query.limit,
  );
}

export function GlobalSearch({
  cacheScope,
  capabilities,
}: {
  cacheScope: string;
  capabilities: readonly Capability[];
}) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");
  const deferredTerm = useDeferredValue(term.trim());
  const searchReady = deferredTerm.length >= 2;
  const granted = useMemo(() => new Set(capabilities), [capabilities]);

  const search = useQuery({
    enabled: open && searchReady,
    queryFn: async ({ signal }) => {
      const [quotes, customers, orders] = await Promise.all([
        granted.has("quotation.read")
          ? browserApiRequest(
              queryPath(apiRoutes.quotes.list, deferredTerm, 5),
              {
                schema: QuotePageSchema,
                signal,
              },
            )
          : Promise.resolve({
              items: [],
              pageInfo: { hasNextPage: false, nextCursor: null },
            }),
        granted.has("customer.read")
          ? browserApiRequest(customerQueryPath(deferredTerm, 5), {
              schema: CustomerPageSchema,
              signal,
            })
          : Promise.resolve({
              items: [],
              pageInfo: { hasNextPage: false, nextCursor: null },
            }),
        granted.has("fulfillment.read") || granted.has("billing.read")
          ? browserApiRequest(
              queryPath(apiRoutes.orders.list, deferredTerm, 5),
              {
                schema: OrderPageSchema,
                signal,
              },
            )
          : Promise.resolve({
              items: [],
              pageInfo: { hasNextPage: false, nextCursor: null },
            }),
      ]);

      return [
        ...quotes.items.map<SearchResult>((quote) => ({
          category: "Quotation",
          description: `${quote.customerName}, ${quote.stage.replaceAll("_", " ")}`,
          href: `/quotations/${quote.id}`,
          id: quote.id,
          label: quote.quoteNumber,
        })),
        ...customers.items.map<SearchResult>((customer) => ({
          category: "Customer",
          description: customer.accountCode,
          href: `/customers/${customer.id}`,
          id: customer.id,
          label: customer.name,
        })),
        ...orders.items.map<SearchResult>((order) => ({
          category: "Order",
          description: `${order.customerName}, ${order.status.replaceAll("_", " ")}`,
          href: `/orders/${order.id}`,
          id: order.id,
          label: order.orderNumber,
        })),
      ];
    },
    queryKey: ["global-search", cacheScope, deferredTerm],
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (term.trim().length < 2) {
      setLiveMessage("Enter at least 2 characters to search.");
      return;
    }
    setLiveMessage("");
    setOpen(true);
  }

  async function copyReference(result: SearchResult) {
    try {
      await navigator.clipboard.writeText(result.id);
      setLiveMessage(`${result.category} reference copied.`);
    } catch {
      setLiveMessage("The reference could not be copied. Select it manually.");
    }
  }

  const searchMessage = !open
    ? ""
    : !searchReady
      ? "Enter at least 2 characters to search."
      : search.isPending
        ? "Searching…"
        : search.isFetching
          ? "Updating search results…"
          : search.isError
            ? "Search results could not be loaded."
            : `${search.data?.length ?? 0} search result${search.data?.length === 1 ? "" : "s"}.`;

  return (
    <>
      <form
        className="flex min-w-0 flex-1 items-center gap-xs"
        onSubmit={submit}
        role="search"
      >
        <FieldLabel className="sr-only" htmlFor="global-search">
          Search Quotes, Customers, and Orders
        </FieldLabel>
        <Input
          autoComplete="off"
          className="min-w-0"
          id="global-search"
          maxLength={200}
          name="global-search"
          onChange={(event) => {
            setLiveMessage("");
            setTerm(event.target.value);
          }}
          placeholder="Search quotes, customers, orders…"
          spellCheck={false}
          type="search"
          value={term}
        />
        <Button size="compact" type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <Dialog
        closeLabel="Close Search"
        description="Open quotations and orders directly, or copy a customer reference for use elsewhere."
        footer={
          <Button
            onClick={() => setOpen(false)}
            size="compact"
            variant="secondary"
          >
            Close
          </Button>
        }
        onOpenChange={setOpen}
        open={open}
        title="Global Search"
        size="wide"
      >
        <div className="grid gap-md">
          <p className="m-0 text-body-sm text-foreground-muted">
            Results for{" "}
            <strong className="break-words text-foreground-strong">
              {deferredTerm}
            </strong>
          </p>

          {!searchReady ? (
            <EmptyState
              description="Use at least 2 characters from a quote, customer, or order."
              headingLevel="h2"
              title="Enter Search Terms"
            />
          ) : null}

          {searchReady && search.isPending ? (
            <div aria-busy="true" className="grid gap-sm" role="status">
              <Skeleton className="w-full" />
              <Skeleton className="w-4/5" />
              <Skeleton className="w-3/4" />
              <span className="sr-only">Searching…</span>
            </div>
          ) : null}

          {searchReady && search.isError ? (
            <ErrorFeedback title="Search Unavailable">
              DealFlow360 could not load search results. Check the API and
              retry.
            </ErrorFeedback>
          ) : null}

          {searchReady && search.data?.length === 0 ? (
            <EmptyState
              description="Try a quote number, customer name, account code, or order number."
              headingLevel="h2"
              title="No Matching Records"
            />
          ) : null}

          {searchReady && search.data && search.data.length > 0 ? (
            <ul className="m-0 grid list-none gap-xxs p-0">
              {search.data.map((result) => (
                <li
                  className="flex min-w-0 flex-col gap-sm border-b border-border py-sm last:border-b-0 sm:flex-row sm:items-center"
                  key={`${result.category}-${result.id}`}
                >
                  <div className="grid min-w-0 flex-1 gap-xxs">
                    <span className="text-caption font-semibold text-brand">
                      {result.category}
                    </span>
                    <strong className="truncate text-body-sm text-foreground-strong">
                      {result.label}
                    </strong>
                    <span className="truncate text-caption text-foreground-muted">
                      {result.description}
                    </span>
                  </div>
                  {result.href ? (
                    <ButtonLink
                      href={result.href}
                      onClick={() => setOpen(false)}
                      size="compact"
                      variant="quiet"
                    >
                      Open {result.category}
                    </ButtonLink>
                  ) : (
                    <Button
                      onClick={() => void copyReference(result)}
                      size="compact"
                      variant="quiet"
                    >
                      Copy Reference
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Dialog>
      <LiveRegion message={liveMessage || searchMessage} />
    </>
  );
}
