"use client";

import {
  CustomerAccountDtoSchema,
  InvoiceSummaryDtoSchema,
  OrderSummaryDtoSchema,
  PortalQuoteListDtoSchema,
  SubscriptionSummaryDtoSchema,
  apiRoutes,
  createCursorPageSchema,
  formatEnumLabel,
  formatMoney,
  planApiRoutes,
} from "@repo/common";
import {
  Badge,
  Button,
  ButtonLink,
  EmptyState,
  ErrorFeedback,
  Field,
  FieldLabel,
  Input,
  PageHeader,
  Panel,
  PanelBody,
  Skeleton,
} from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { browserApiRequest } from "../../lib/api/browser";

type DirectoryKind =
  "orders" | "invoices" | "subscriptions" | "customers" | "portal";
const titles = {
  orders: "Orders",
  invoices: "Invoices",
  subscriptions: "Subscriptions",
  customers: "Customers",
  portal: "My Quotations",
};
const descriptions = {
  orders:
    "Find a confirmed order to review delivery, fulfillment, and billing.",
  invoices: "Review balances, issue invoices, and record received payments.",
  subscriptions: "Review services, billing schedules, and plan changes.",
  customers: "Find customer accounts and their contact details.",
  portal: "Review shared quotations, request changes, and accept an offer.",
};

export function RecordDirectory({
  kind,
  locale = "en-US",
}: {
  kind: DirectoryKind;
  locale?: string;
}) {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [cursors, setCursors] = useState<string[]>([]);
  const cursor = cursors.at(-1);
  const result = useQuery({
    queryKey: ["directory", kind, search, cursor],
    queryFn: async ({ signal }) => {
      const query = new URLSearchParams({ limit: "25" });
      if (search) query.set("search", search);
      if (cursor) query.set("cursor", cursor);
      const path = (base: string) => `${base}?${query}`;
      if (kind === "portal") {
        const page = await browserApiRequest(
          path(planApiRoutes.portal.quotes),
          { schema: PortalQuoteListDtoSchema, signal, scope: "portal" },
        );
        return {
          ...page,
          items: page.items.map((row) => ({
            id: row.id,
            title: row.quoteNumber,
            description: row.expiresAt
              ? `Valid until ${new Date(row.expiresAt).toLocaleDateString(locale)}`
              : "No expiry date",
            status: row.stage,
            amount: formatMoney(row.total, row.currency, locale),
            href: `/portal/quotations/${row.id}`,
          })),
        };
      }
      if (kind === "orders") {
        const page = await browserApiRequest(path(apiRoutes.orders.list), {
          schema: createCursorPageSchema(OrderSummaryDtoSchema),
          signal,
        });
        return {
          ...page,
          items: page.items.map((row) => ({
            id: row.id,
            title: row.orderNumber,
            description: row.customerName,
            status: row.status,
            amount: formatMoney(row.total, row.currency, locale),
            href: `/orders/${row.id}`,
          })),
        };
      }
      if (kind === "invoices") {
        const page = await browserApiRequest(path(apiRoutes.billing.invoices), {
          schema: createCursorPageSchema(InvoiceSummaryDtoSchema),
          signal,
        });
        return {
          ...page,
          items: page.items.map((row) => ({
            id: row.id,
            title: row.invoiceNumber,
            description: `${row.customerName} · Due ${row.dueDate}`,
            status: row.status,
            amount: `${formatMoney(row.balanceDue, row.currency, locale)} due`,
            href: `/invoices/${row.id}`,
          })),
        };
      }
      if (kind === "subscriptions") {
        const page = await browserApiRequest(
          path(apiRoutes.subscriptions.list),
          {
            schema: createCursorPageSchema(SubscriptionSummaryDtoSchema),
            signal,
          },
        );
        return {
          ...page,
          items: page.items.map((row) => ({
            id: row.id,
            title: row.subscriptionNumber,
            description: `${row.customerName} · ${row.planName}`,
            status: row.status,
            amount: "",
            href: `/orders/${row.orderId}/billing`,
          })),
        };
      }
      const page = await browserApiRequest(path(apiRoutes.customers.accounts), {
        schema: createCursorPageSchema(CustomerAccountDtoSchema),
        signal,
      });
      return {
        ...page,
        items: page.items.map((row) => ({
          id: row.id,
          title: row.name,
          description: row.accountCode,
          status: row.status,
          amount: "",
          href: `/customers/${row.id}`,
        })),
      };
    },
  });
  return (
    <div className="grid gap-lg">
      <PageHeader title={titles[kind]} description={descriptions[kind]} />
      <form
        className="flex items-end gap-sm"
        onSubmit={(event) => {
          event.preventDefault();
          setCursors([]);
          setSearch(input.trim());
        }}
      >
        <Field>
          <FieldLabel htmlFor="directory-search">
            Search {titles[kind].toLowerCase()}
          </FieldLabel>
          <Input
            id="directory-search"
            value={input}
            maxLength={200}
            onChange={(event) => setInput(event.target.value)}
          />
        </Field>
        <Button type="submit">Search</Button>
      </form>
      {result.isPending ? (
        <Skeleton />
      ) : result.isError ? (
        <ErrorFeedback title="Unable to load records">
          {result.error.message}
          <Button variant="quiet" onClick={() => void result.refetch()}>
            Retry
          </Button>
        </ErrorFeedback>
      ) : (
        <>
          <Panel>
            <PanelBody>
              <div className="grid gap-md">
                {result.data.items.length === 0 ? (
                  <EmptyState
                    title="No records found"
                    description={
                      search
                        ? "Try a different search."
                        : kind === "portal"
                          ? "Your sales team will share quotations here when they are ready."
                          : "Records will appear here as your team completes the sales workflow."
                    }
                  />
                ) : (
                  result.data.items.map((row) => (
                    <article
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-sm border-b border-border pb-md"
                    >
                      <div>
                        <ButtonLink href={row.href} variant="quiet">
                          {row.title}
                        </ButtonLink>
                        <p className="m-0 text-body-sm text-foreground-muted">
                          {row.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-sm">
                        <span className="font-mono text-body-sm">
                          {row.amount}
                        </span>
                        <Badge>{formatEnumLabel(row.status)}</Badge>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </PanelBody>
          </Panel>
          <div className="flex items-center justify-between">
            <Button
              variant="secondary"
              disabled={cursors.length === 0}
              onClick={() => setCursors((items) => items.slice(0, -1))}
            >
              Previous
            </Button>
            <span>Page {cursors.length + 1}</span>
            <Button
              variant="secondary"
              disabled={!result.data.pageInfo.hasNextPage}
              onClick={() => {
                const next = result.data.pageInfo.nextCursor;
                if (next) setCursors((items) => [...items, next]);
              }}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
