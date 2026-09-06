"use client";

import {
  ChangeRequestActionSchema,
  ChangeRequestDtoSchema,
  CreateChangeRequestSchema,
  CreateCustomerCounterproposalRequestSchema,
  CreateNegotiationMessageRequestSchema,
  CustomerCounterproposalDtoSchema,
  NegotiationMessageDtoSchema,
  NonNegativeDecimalStringSchema,
  PercentageStringSchema,
  PortalNegotiationMessagesDtoSchema,
  PortalQuoteConfirmationRequestSchema,
  PortalQuoteConfirmationResponseSchema,
  PortalQuoteDtoSchema,
  PortalQuoteVersionDiffDtoSchema,
  PortalQuoteVersionDiffQuerySchema,
  PortalQuoteVersionHistoryDtoSchema,
  PositiveDecimalStringSchema,
  apiRoutes,
  divideDecimalStrings,
  formatDateTime,
  formatEnumLabel,
  formatMoney,
  formatPercentage,
  multiplyDecimalStrings,
  planApiRoutes,
  subtractDecimalStrings,
  type ChangeRequestAction,
  type ChangeRequestDto,
  type PortalQuoteDto,
  type PortalVersionDifferenceDto,
} from "@repo/common";
import {
  Badge,
  Button,
  Checkbox,
  CheckboxField,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  EmptyState,
  ErrorFeedback,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  InlineFeedback,
  Input,
  LiveRegion,
  Metric,
  MetricGroup,
  PageHeader,
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
  Select,
  Skeleton,
  Textarea,
  Timeline,
  TimelineItem,
} from "@repo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { z } from "zod";

import { ApiProblemError, browserApiRequest } from "../../lib/api/browser";
import { useIdempotencyKey } from "../shared/use-idempotency-key";

const ChangeRequestListSchema = z.array(ChangeRequestDtoSchema);

const quoteKey = (quoteId: string) => ["portal-quote", quoteId] as const;
const messagesKey = (quoteId: string) =>
  ["portal-quote-messages", quoteId] as const;
const requestsKey = (quoteId: string) =>
  ["portal-quote-change-requests", quoteId] as const;
const versionsKey = (quoteId: string) =>
  ["portal-quote-versions", quoteId] as const;

function problemMessage(error: unknown, fallback: string): string {
  return error instanceof ApiProblemError
    ? (error.problem.detail ?? fallback)
    : fallback;
}

function statusTone(
  status: string,
): "neutral" | "success" | "warning" | "danger" | "info" {
  if (
    ["CUSTOMER_ACCEPTED", "CONFIRMED", "ACCEPTED", "APPROVED"].includes(status)
  ) {
    return "success";
  }
  if (["CANCELLED", "EXPIRED", "REJECTED"].includes(status)) return "danger";
  if (["PENDING_APPROVAL", "REVISION_REQUIRED", "PENDING"].includes(status)) {
    return "warning";
  }
  if (["SENT", "UNDER_NEGOTIATION", "OPEN"].includes(status)) return "info";
  return "neutral";
}

async function loadPortalMessages(quoteId: string) {
  const messages: z.infer<typeof NegotiationMessageDtoSchema>[] = [];
  let cursor: string | undefined;
  do {
    const query = new URLSearchParams({ limit: "100" });
    if (cursor) query.set("cursor", cursor);
    const page = await browserApiRequest(
      `${planApiRoutes.portal.comments(quoteId)}?${query.toString()}`,
      { schema: PortalNegotiationMessagesDtoSchema, scope: "portal" },
    );
    messages.push(...page.items);
    cursor = page.pageInfo.nextCursor ?? undefined;
  } while (cursor);
  return messages.sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
}

function LineCards({ quote }: { quote: PortalQuoteDto }) {
  return (
    <div className="grid gap-sm md:hidden">
      {quote.lines.map((line) => (
        <article
          className="grid gap-sm rounded-panel border border-border bg-surface p-sm"
          key={line.id}
        >
          <div className="flex items-start justify-between gap-sm">
            <div className="min-w-0">
              <p className="m-0 break-words text-body-sm font-semibold text-foreground-strong">
                {line.productName}
              </p>
              <p className="m-0 font-mono text-caption text-foreground-muted">
                {line.productCode}
                {line.sku ? ` · ${line.sku}` : ""}
              </p>
            </div>
            <Badge>{formatEnumLabel(line.billingType)}</Badge>
          </div>
          {line.productDescription ? (
            <p className="m-0 text-caption text-foreground-muted">
              {line.productDescription}
            </p>
          ) : null}
          <dl className="m-0 grid grid-cols-2 gap-xs text-caption">
            <div>
              <dt className="text-foreground-muted">Quantity</dt>
              <dd className="m-0 font-mono tabular-nums text-foreground-strong">
                {line.quantity} {line.unit}
              </dd>
            </div>
            <div>
              <dt className="text-foreground-muted">Unit Price</dt>
              <dd className="m-0 font-mono tabular-nums text-foreground-strong">
                {formatMoney(
                  line.unitPrice,
                  quote.currency,
                  quote.formatting.locale,
                )}
              </dd>
            </div>
            <div>
              <dt className="text-foreground-muted">Discount</dt>
              <dd className="m-0 font-mono tabular-nums text-foreground-strong">
                {formatPercentage(
                  line.discountPercent,
                  quote.formatting.locale,
                )}
              </dd>
            </div>
            <div>
              <dt className="text-foreground-muted">Line Total</dt>
              <dd className="m-0 font-mono tabular-nums text-foreground-strong">
                {formatMoney(
                  line.total,
                  quote.currency,
                  quote.formatting.locale,
                )}
              </dd>
            </div>
          </dl>
          {line.subscription ? (
            <p className="m-0 text-caption text-foreground-muted">
              {line.subscription.planName} · {line.subscription.intervalLabel}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function QuoteDocument({
  quote,
  versionNumber,
}: {
  quote: PortalQuoteDto;
  versionNumber?: number;
}) {
  const { locale, timezone } = quote.formatting;
  return (
    <Panel className="print:border-0 print:shadow-none">
      <PanelHeader>
        <div>
          <PanelTitle>Quotation {quote.quoteNumber}</PanelTitle>
          <PanelDescription>
            Shared by {quote.seller.organizationName}. Your representative is{" "}
            {quote.seller.representativeName}.
          </PanelDescription>
        </div>
        <Button
          className="print:hidden"
          onClick={() => window.print()}
          size="compact"
          variant="secondary"
        >
          Print / Save PDF
        </Button>
      </PanelHeader>
      <PanelBody className="grid gap-lg">
        <dl className="m-0 grid gap-sm text-body-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-foreground-muted">Customer</dt>
            <dd className="m-0 font-semibold text-foreground-strong">
              {quote.customer.name}
            </dd>
          </div>
          <div>
            <dt className="text-foreground-muted">Current Version</dt>
            <dd className="m-0 font-mono tabular-nums text-foreground-strong">
              {versionNumber === undefined
                ? "Current shared version"
                : `Revision ${versionNumber}`}
            </dd>
          </div>
          <div>
            <dt className="text-foreground-muted">Payment Terms</dt>
            <dd className="m-0 text-foreground-strong">
              Net {quote.paymentTermsDays} days
            </dd>
          </div>
          <div>
            <dt className="text-foreground-muted">Expires</dt>
            <dd className="m-0 text-foreground-strong">
              {quote.expiresAt
                ? formatDateTime(quote.expiresAt, locale, timezone)
                : "No expiry set"}
            </dd>
          </div>
        </dl>
        <LineCards quote={quote} />
        <DataTable
          aria-label="Quotation line items"
          containerClassName="hidden md:block"
        >
          <DataTableHeader>
            <DataTableRow>
              <DataTableHead>Product</DataTableHead>
              <DataTableHead>Billing</DataTableHead>
              <DataTableHead numeric>Quantity</DataTableHead>
              <DataTableHead numeric>Unit Price</DataTableHead>
              <DataTableHead numeric>Discount</DataTableHead>
              <DataTableHead numeric>Total</DataTableHead>
            </DataTableRow>
          </DataTableHeader>
          <DataTableBody>
            {quote.lines.map((line) => (
              <DataTableRow key={line.id}>
                <DataTableCell>
                  <span className="grid gap-xxs">
                    <strong>{line.productName}</strong>
                    <span className="font-mono text-caption text-foreground-muted">
                      {line.productCode}
                      {line.sku ? ` · ${line.sku}` : ""}
                    </span>
                    {line.subscription ? (
                      <span className="text-caption text-foreground-muted">
                        {line.subscription.planName} ·{" "}
                        {line.subscription.intervalLabel}
                      </span>
                    ) : null}
                  </span>
                </DataTableCell>
                <DataTableCell>
                  {formatEnumLabel(line.billingType)}
                </DataTableCell>
                <DataTableCell numeric>
                  {line.quantity} {line.unit}
                </DataTableCell>
                <DataTableCell numeric>
                  {formatMoney(line.unitPrice, quote.currency, locale)}
                </DataTableCell>
                <DataTableCell numeric>
                  {formatPercentage(line.discountPercent, locale)}
                </DataTableCell>
                <DataTableCell numeric>
                  {formatMoney(line.total, quote.currency, locale)}
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
        <div className="grid gap-md border-t border-border pt-md sm:grid-cols-2">
          <div>
            <h3 className="m-0 text-body-sm font-semibold text-foreground-strong">
              Notes
            </h3>
            <p className="m-0 whitespace-pre-wrap text-body-sm text-foreground-muted">
              {quote.notes ?? "No additional notes."}
            </p>
          </div>
          <dl className="m-0 grid gap-xs text-body-sm">
            <div className="flex justify-between gap-sm">
              <dt className="text-foreground-muted">Subtotal</dt>
              <dd className="m-0 font-mono tabular-nums">
                {formatMoney(quote.subtotal, quote.currency, locale)}
              </dd>
            </div>
            <div className="flex justify-between gap-sm">
              <dt className="text-foreground-muted">Discount</dt>
              <dd className="m-0 font-mono tabular-nums">
                −{formatMoney(quote.discountTotal, quote.currency, locale)}
              </dd>
            </div>
            <div className="flex justify-between gap-sm">
              <dt className="text-foreground-muted">Tax</dt>
              <dd className="m-0 font-mono tabular-nums">
                {formatMoney(quote.taxTotal, quote.currency, locale)}
              </dd>
            </div>
            <div className="flex justify-between gap-sm border-t border-border pt-xs text-title font-semibold text-foreground-strong">
              <dt>Total</dt>
              <dd className="m-0 font-mono tabular-nums">
                {formatMoney(quote.total, quote.currency, locale)}
              </dd>
            </div>
          </dl>
        </div>
      </PanelBody>
    </Panel>
  );
}

function CommentComposer({
  onPosted,
  quote,
}: {
  onPosted: (message: string) => Promise<void>;
  quote: PortalQuoteDto;
}) {
  const [lineId, setLineId] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const post = useMutation({
    mutationFn: () => {
      const input = CreateNegotiationMessageRequestSchema.parse({
        body,
        quoteLineId: lineId || undefined,
        quoteRevision: quote.revision,
      });
      return browserApiRequest(planApiRoutes.portal.comments(quote.id), {
        json: input,
        method: "POST",
        schema: NegotiationMessageDtoSchema,
        scope: "portal",
      });
    },
    onError: (requestError) =>
      setError(
        problemMessage(requestError, "Your comment could not be posted."),
      ),
    onMutate: () => setError(""),
    onSuccess: async () => {
      setBody("");
      await onPosted("Comment posted to the shared quotation.");
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    post.mutate();
  }

  return (
    <form className="grid gap-sm" onSubmit={submit}>
      {error ? (
        <ErrorFeedback title="Comment Not Posted">{error}</ErrorFeedback>
      ) : null}
      <Field>
        <FieldLabel htmlFor="portal-comment-line">Comment About</FieldLabel>
        <Select
          id="portal-comment-line"
          name="portal-comment-line"
          onChange={(event) => setLineId(event.target.value)}
          value={lineId}
        >
          <option value="">Entire quotation</option>
          {quote.lines.map((line) => (
            <option key={line.id} value={line.id}>
              Line {line.lineNumber}: {line.productName}
            </option>
          ))}
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="portal-comment-body">Comment</FieldLabel>
        <Textarea
          autoComplete="off"
          id="portal-comment-body"
          maxLength={4000}
          name="portal-comment-body"
          onChange={(event) => setBody(event.target.value)}
          value={body}
        />
        <FieldDescription>
          Comments do not change price, quantity, discount, or terms.
        </FieldDescription>
      </Field>
      <Button disabled={post.isPending || !body.trim()} fullWidth type="submit">
        {post.isPending ? "Posting Comment…" : "Post Comment"}
      </Button>
    </form>
  );
}

function ChangeRequestComposer({
  onCreated,
  quote,
}: {
  onCreated: (message: string) => Promise<void>;
  quote: PortalQuoteDto;
}) {
  const [action, setAction] = useState<ChangeRequestAction>("CHANGE_QUANTITY");
  const [lineId, setLineId] = useState(quote.lines[0]?.id ?? "");
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const create = useMutation({
    mutationFn: () => {
      const requestedChange =
        action === "REMOVE"
          ? { action, quoteLineId: lineId }
          : action === "CHANGE_QUANTITY"
            ? {
                action,
                quoteLineId: lineId,
                quantity: PositiveDecimalStringSchema.parse(value),
              }
            : action === "CHANGE_PRICE"
              ? {
                  action,
                  quoteLineId: lineId,
                  unitPrice: NonNegativeDecimalStringSchema.parse(value),
                }
              : action === "CHANGE_DISCOUNT"
                ? {
                    action,
                    quoteLineId: lineId,
                    discountPercent: PercentageStringSchema.parse(value),
                  }
                : {
                    action,
                    terms: {
                      paymentTermsDays: z.coerce
                        .number()
                        .int()
                        .nonnegative()
                        .parse(value),
                    },
                  };
      const input = CreateChangeRequestSchema.parse({
        message: message.trim() || undefined,
        quoteRevision: quote.revision,
        requestedChanges: [requestedChange],
      });
      return browserApiRequest(planApiRoutes.portal.changeRequests(quote.id), {
        json: input,
        method: "POST",
        schema: ChangeRequestDtoSchema,
        scope: "portal",
      });
    },
    onError: (requestError) =>
      setError(
        problemMessage(
          requestError,
          "Your change request could not be submitted.",
        ),
      ),
    onMutate: () => setError(""),
    onSuccess: async () => {
      setValue("");
      setMessage("");
      await onCreated("Change request submitted for seller review.");
    },
  });
  const selectedLine = quote.lines.find((line) => line.id === lineId);
  const label =
    action === "CHANGE_QUANTITY"
      ? "Requested Quantity"
      : action === "CHANGE_PRICE"
        ? "Requested Unit Price"
        : action === "CHANGE_DISCOUNT"
          ? "Requested Discount Percent"
          : "Requested Payment Terms (Days)";

  return (
    <div className="grid gap-sm">
      {error ? (
        <ErrorFeedback title="Request Not Submitted">{error}</ErrorFeedback>
      ) : null}
      <div className="grid gap-sm sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="change-action">Requested Change</FieldLabel>
          <Select
            id="change-action"
            name="change-action"
            onChange={(event) => {
              setAction(ChangeRequestActionSchema.parse(event.target.value));
              setValue("");
            }}
            value={action}
          >
            <option value="REMOVE">Remove Line</option>
            <option value="CHANGE_QUANTITY">Quantity</option>
            <option value="CHANGE_PRICE">Unit Price</option>
            <option value="CHANGE_DISCOUNT">Discount</option>
            <option value="CHANGE_TERMS">Payment Terms</option>
          </Select>
        </Field>
        {action !== "CHANGE_TERMS" ? (
          <Field>
            <FieldLabel htmlFor="change-line">Quotation Line</FieldLabel>
            <Select
              id="change-line"
              name="change-line"
              onChange={(event) => setLineId(event.target.value)}
              value={lineId}
            >
              {quote.lines.map((line) => (
                <option key={line.id} value={line.id}>
                  Line {line.lineNumber}: {line.productName}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        {action === "REMOVE" ? (
          <InlineFeedback tone="warning">
            {selectedLine
              ? `${selectedLine.productName} will be requested for removal.`
              : "Choose a line to remove."}
          </InlineFeedback>
        ) : (
          <Field>
            <FieldLabel htmlFor="change-value">{label}</FieldLabel>
            <Input
              autoComplete="off"
              id="change-value"
              inputMode="decimal"
              min="0"
              name="change-value"
              onChange={(event) => setValue(event.target.value)}
              step="0.0001"
              type="number"
              value={value}
            />
            {selectedLine && action === "CHANGE_QUANTITY" ? (
              <FieldDescription>
                Current quantity: {selectedLine.quantity}
              </FieldDescription>
            ) : null}
            {selectedLine && action === "CHANGE_PRICE" ? (
              <FieldDescription>
                Current unit price:{" "}
                {formatMoney(
                  selectedLine.unitPrice,
                  quote.currency,
                  quote.formatting.locale,
                )}
              </FieldDescription>
            ) : null}
            {selectedLine && action === "CHANGE_DISCOUNT" ? (
              <FieldDescription>
                Current discount:{" "}
                {formatPercentage(
                  selectedLine.discountPercent,
                  quote.formatting.locale,
                )}
              </FieldDescription>
            ) : null}
            {action === "CHANGE_TERMS" ? (
              <FieldDescription>
                Current payment terms: Net {quote.paymentTermsDays} days
              </FieldDescription>
            ) : null}
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="change-message">Context (Optional)</FieldLabel>
          <Textarea
            autoComplete="off"
            id="change-message"
            maxLength={4000}
            name="change-message"
            onChange={(event) => setMessage(event.target.value)}
            rows={2}
            value={message}
          />
        </Field>
      </div>
      <Button
        disabled={
          create.isPending ||
          (action !== "REMOVE" && !value) ||
          (action !== "CHANGE_TERMS" && !lineId)
        }
        fullWidth
        onClick={() => create.mutate()}
      >
        {create.isPending
          ? "Submitting Request…"
          : "Submit Commercial Change Request"}
      </Button>
    </div>
  );
}

function CounterproposalComposer({
  onCreated,
  quote,
}: {
  onCreated: (message: string) => Promise<void>;
  quote: PortalQuoteDto;
}) {
  const queryClient = useQueryClient();
  const [lineId, setLineId] = useState(quote.lines[0]?.id ?? "");
  const [discount, setDiscount] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const selectedLine = quote.lines.find((line) => line.id === lineId);
  const create = useMutation({
    mutationFn: () => {
      const input = CreateCustomerCounterproposalRequestSchema.parse({
        message: message.trim() || undefined,
        quoteRevision: quote.revision,
        proposedChanges: [
          {
            quoteLineId: lineId,
            discountPercent: PercentageStringSchema.parse(discount),
          },
        ],
        termsFingerprint: quote.termsFingerprint,
      });
      return browserApiRequest(
        planApiRoutes.portal.customerCounterproposals(quote.id),
        {
          json: input,
          method: "POST",
          schema: CustomerCounterproposalDtoSchema,
          scope: "portal",
        },
      );
    },
    onError: (requestError) => {
      setError(
        problemMessage(
          requestError,
          "Your counterproposal could not be submitted.",
        ),
      );
      if (
        requestError instanceof ApiProblemError &&
        ["REVISION_CONFLICT", "TERMS_CHANGED"].includes(
          requestError.problem.code ?? "",
        )
      ) {
        void queryClient.invalidateQueries({ queryKey: quoteKey(quote.id) });
      }
    },
    onMutate: () => setError(""),
    onSuccess: async () => {
      setDiscount("");
      setMessage("");
      await onCreated("Counter-discount proposal submitted for seller review.");
    },
  });
  const validDiscount = PercentageStringSchema.safeParse(discount).success;
  const provisionalAmounts =
    selectedLine && validDiscount
      ? (() => {
          const grossAmount = multiplyDecimalStrings(
            selectedLine.quantity,
            selectedLine.unitPrice,
          );
          const proposedDiscountAmount = multiplyDecimalStrings(
            grossAmount,
            divideDecimalStrings(discount, "100"),
          );
          const proposedDiscountedAmount = subtractDecimalStrings(
            grossAmount,
            proposedDiscountAmount,
          );
          const currentDiscountedAmount = subtractDecimalStrings(
            grossAmount,
            selectedLine.lineDiscountAmount,
          );
          return {
            delta: subtractDecimalStrings(
              proposedDiscountedAmount,
              currentDiscountedAmount,
            ),
            currentDiscountedAmount,
            proposedDiscountedAmount,
          };
        })()
      : undefined;

  return (
    <div className="grid gap-sm">
      {error ? (
        <ErrorFeedback title="Proposal Not Submitted">{error}</ErrorFeedback>
      ) : null}
      <Field>
        <FieldLabel htmlFor="counter-line">Quotation Line</FieldLabel>
        <Select
          id="counter-line"
          name="counter-line"
          onChange={(event) => setLineId(event.target.value)}
          value={lineId}
        >
          {quote.lines.map((line) => (
            <option key={line.id} value={line.id}>
              Line {line.lineNumber}: {line.productName}
            </option>
          ))}
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="counter-discount">
          Proposed Discount Percent
        </FieldLabel>
        <Input
          autoComplete="off"
          id="counter-discount"
          inputMode="decimal"
          max="100"
          min="0"
          name="counter-discount"
          onChange={(event) => setDiscount(event.target.value)}
          step="0.0001"
          type="number"
          value={discount}
        />
      </Field>
      {selectedLine && provisionalAmounts ? (
        <InlineFeedback title="Proposal Preview" tone="info">
          <div className="grid gap-xs">
            <p className="m-0">
              {selectedLine.productName}: current discount{" "}
              {formatPercentage(
                selectedLine.discountPercent,
                quote.formatting.locale,
              )}{" "}
              to proposed discount{" "}
              {formatPercentage(discount, quote.formatting.locale)}.
            </p>
            <dl className="m-0 grid grid-cols-2 gap-xs text-caption">
              <div>
                <dt>Current discounted line amount</dt>
                <dd className="m-0 font-mono tabular-nums">
                  {formatMoney(
                    provisionalAmounts.currentDiscountedAmount,
                    quote.currency,
                    quote.formatting.locale,
                  )}
                </dd>
              </div>
              <div>
                <dt>Proposed discounted line amount</dt>
                <dd className="m-0 font-mono tabular-nums">
                  {formatMoney(
                    provisionalAmounts.proposedDiscountedAmount,
                    quote.currency,
                    quote.formatting.locale,
                  )}
                </dd>
              </div>
              <div>
                <dt>Provisional delta</dt>
                <dd className="m-0 font-mono tabular-nums">
                  {formatMoney(
                    provisionalAmounts.delta,
                    quote.currency,
                    quote.formatting.locale,
                  )}
                </dd>
              </div>
            </dl>
            <p className="m-0 text-caption">
              These amounts are before inclusive or exclusive tax treatment. The
              API remains authoritative, and totals change only after seller
              acceptance creates a new version.
            </p>
          </div>
        </InlineFeedback>
      ) : null}
      <Field>
        <FieldLabel htmlFor="counter-message">
          Proposal Context (Optional)
        </FieldLabel>
        <Textarea
          autoComplete="off"
          id="counter-message"
          maxLength={4000}
          name="counter-message"
          onChange={(event) => setMessage(event.target.value)}
          rows={2}
          value={message}
        />
      </Field>
      <Button
        disabled={create.isPending || !lineId || !validDiscount}
        fullWidth
        onClick={() => create.mutate()}
      >
        {create.isPending
          ? "Submitting Proposal…"
          : "Submit Counter-Discount Proposal"}
      </Button>
    </div>
  );
}

function requestDescription(
  request: ChangeRequestDto,
  quote: PortalQuoteDto,
): string {
  return request.items
    .map((item) => {
      const line = quote.lines.find(
        (candidate) => candidate.id === item.quoteLineId,
      );
      if (item.action === "REMOVE")
        return `${line?.productName ?? "Line"}: remove line`;
      if (item.action === "CHANGE_QUANTITY")
        return `${line?.productName ?? "Line"}: quantity ${item.quantity}`;
      if (item.action === "CHANGE_PRICE")
        return `${line?.productName ?? "Line"}: unit price ${item.unitPrice ? formatMoney(item.unitPrice, quote.currency, quote.formatting.locale) : "requested"}`;
      if (item.action === "CHANGE_DISCOUNT")
        return `${line?.productName ?? "Line"}: discount ${formatPercentage(item.discountPercent ?? "0", quote.formatting.locale)}`;
      return "Payment terms change";
    })
    .join("; ");
}

function differenceValue(
  value: PortalVersionDifferenceDto["before"],
  currency: string,
  locale: string,
): string {
  if (value === null) return "Not present";
  if (typeof value === "object") {
    return `${value.productName}, ${value.quantity} ${value.unit}, ${formatMoney(value.total, currency, locale)}`;
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export function PortalQuotationWorkspace({ quoteId }: { quoteId: string }) {
  const queryClient = useQueryClient();
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [acknowledgedFingerprint, setAcknowledgedFingerprint] = useState("");
  const [fromVersionId, setFromVersionId] = useState("");
  const [toVersionId, setToVersionId] = useState("");
  const confirmationKey = useIdempotencyKey();

  const quote = useQuery({
    queryFn: ({ signal }) =>
      browserApiRequest(planApiRoutes.portal.quote(quoteId), {
        schema: PortalQuoteDtoSchema,
        scope: "portal",
        signal,
      }),
    queryKey: quoteKey(quoteId),
    refetchInterval: 30_000,
    retry: false,
  });
  const messages = useQuery({
    enabled: quote.isSuccess,
    queryFn: () => loadPortalMessages(quoteId),
    queryKey: messagesKey(quoteId),
    refetchInterval: 30_000,
  });
  const requests = useQuery({
    enabled: quote.isSuccess,
    queryFn: ({ signal }) =>
      browserApiRequest(apiRoutes.negotiation.changeRequests(quoteId), {
        schema: ChangeRequestListSchema,
        scope: "portal",
        signal,
      }),
    queryKey: requestsKey(quoteId),
    refetchInterval: 30_000,
  });
  const versions = useQuery({
    enabled: quote.isSuccess,
    queryFn: ({ signal }) =>
      browserApiRequest(planApiRoutes.portal.versions(quoteId), {
        schema: PortalQuoteVersionHistoryDtoSchema,
        scope: "portal",
        signal,
      }),
    queryKey: versionsKey(quoteId),
  });
  const orderedVersions = useMemo(
    () =>
      [...(versions.data?.versions ?? [])].sort(
        (left, right) => left.revisionNumber - right.revisionNumber,
      ),
    [versions.data],
  );
  const effectiveFrom = fromVersionId || orderedVersions.at(-2)?.id || "";
  const effectiveTo = toVersionId || orderedVersions.at(-1)?.id || "";
  const currentVersion = orderedVersions.find((version) => version.isCurrent);
  const diffQuery = PortalQuoteVersionDiffQuerySchema.safeParse({
    fromVersionId: effectiveFrom,
    toVersionId: effectiveTo,
  });
  const versionDiff = useQuery({
    enabled: diffQuery.success,
    queryFn: ({ signal }) => {
      if (!diffQuery.success) throw new Error("Select two different versions.");
      const queryParameters = new URLSearchParams(diffQuery.data);
      return browserApiRequest(
        `${planApiRoutes.portal.versionDiff(quoteId)}?${queryParameters.toString()}`,
        { schema: PortalQuoteVersionDiffDtoSchema, scope: "portal", signal },
      );
    },
    queryKey: [
      "portal-quote-version-diff",
      quoteId,
      effectiveFrom,
      effectiveTo,
    ],
  });

  async function refreshPortal(message: string) {
    setActionError("");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: quoteKey(quoteId) }),
      queryClient.invalidateQueries({ queryKey: messagesKey(quoteId) }),
      queryClient.invalidateQueries({ queryKey: requestsKey(quoteId) }),
      queryClient.invalidateQueries({ queryKey: versionsKey(quoteId) }),
    ]);
    setActionMessage(message);
  }

  const confirm = useMutation({
    mutationFn: (currentQuote: PortalQuoteDto) => {
      const body = PortalQuoteConfirmationRequestSchema.parse({
        revision: currentQuote.revision,
        termsFingerprint: currentQuote.termsFingerprint,
      });
      return browserApiRequest(planApiRoutes.portal.confirm(currentQuote.id), {
        headers: confirmationKey.headersFor({
          quoteId: currentQuote.id,
          ...body,
        }),
        json: body,
        method: "POST",
        schema: PortalQuoteConfirmationResponseSchema,
        scope: "portal",
      });
    },
    onError: async (requestError) => {
      setActionError(
        problemMessage(requestError, "This quotation could not be confirmed."),
      );
      if (
        requestError instanceof ApiProblemError &&
        ["TERMS_CHANGED", "REVISION_CONFLICT"].includes(
          requestError.problem.code ?? "",
        )
      ) {
        setAcknowledgedFingerprint("");
        await queryClient.invalidateQueries({ queryKey: quoteKey(quoteId) });
      }
    },
    onMutate: () => {
      setActionError("");
      setActionMessage("");
    },
    onSuccess: async (result, currentQuote) => {
      confirmationKey.clear();
      await refreshPortal(
        `Quotation confirmed at ${formatDateTime(result.acceptedAt, currentQuote.formatting.locale, currentQuote.formatting.timezone)}.`,
      );
    },
  });

  if (quote.isPending) {
    return (
      <div aria-busy="true" className="grid gap-md" role="status">
        <Skeleton className="w-2/5" />
        <Skeleton shape="block" />
        <span className="sr-only">Loading shared quotation…</span>
      </div>
    );
  }
  if (quote.isError || !quote.data) {
    return (
      <ErrorFeedback title="Quotation Not Available">
        {problemMessage(
          quote.error,
          "This link is expired, revoked, or outside your customer access scope.",
        )}
      </ErrorFeedback>
    );
  }

  const awaitingApproval = quote.data.stage === "PENDING_APPROVAL";
  const acknowledged = acknowledgedFingerprint === quote.data.termsFingerprint;
  const { locale, timezone } = quote.data.formatting;

  return (
    <div className="grid gap-lg">
      <div className="print:hidden">
        <PageHeader
          actions={
            <Button
              disabled={quote.isFetching}
              onClick={() =>
                void refreshPortal(
                  "Quotation refreshed from the secure portal API.",
                )
              }
              variant="secondary"
            >
              {quote.isFetching ? "Refreshing…" : "Refresh"}
            </Button>
          }
          description={`${quote.data.customer.name}, review the exact shared terms, discuss individual lines, or submit a commercial request.`}
          metadata={`Updated ${formatDateTime(quote.data.updatedAt, locale, timezone)}`}
          title={`Quotation ${quote.data.quoteNumber}`}
        />
        <LiveRegion message={actionMessage || actionError} />
        {actionError ? (
          <ErrorFeedback title="Portal Action Failed">
            {actionError}
          </ErrorFeedback>
        ) : null}
        {actionMessage ? (
          <InlineFeedback tone="success">{actionMessage}</InlineFeedback>
        ) : null}
        {awaitingApproval ? (
          <InlineFeedback title="Awaiting Internal Approval" tone="warning">
            Revised commercial terms are being reviewed. Internal thresholds and
            approval details remain private. You can review this version, but
            confirmation will become available only after approval.
          </InlineFeedback>
        ) : null}
        <MetricGroup aria-label="Quotation status and total">
          <Metric label="Status" value={formatEnumLabel(quote.data.stage)} />
          <Metric
            label="Version"
            value={currentVersion?.revisionNumber ?? "Current"}
          />
          <Metric label="Lines" value={quote.data.lines.length} />
          <Metric
            label="Total"
            value={formatMoney(quote.data.total, quote.data.currency, locale)}
          />
        </MetricGroup>
      </div>

      <QuoteDocument
        quote={quote.data}
        versionNumber={currentVersion?.revisionNumber}
      />

      {quote.data.canNegotiate ? (
        <div className="grid gap-lg print:hidden lg:grid-cols-3">
          <Panel>
            <PanelHeader>
              <div>
                <PanelTitle>Comment</PanelTitle>
                <PanelDescription>
                  Ask a question without changing commercial terms.
                </PanelDescription>
              </div>
            </PanelHeader>
            <PanelBody>
              <CommentComposer onPosted={refreshPortal} quote={quote.data} />
            </PanelBody>
          </Panel>
          <Panel>
            <PanelHeader>
              <div>
                <PanelTitle>Request a Change</PanelTitle>
                <PanelDescription>
                  Record one explicit quantity, price, discount, or
                  payment-terms request.
                </PanelDescription>
              </div>
            </PanelHeader>
            <PanelBody>
              <ChangeRequestComposer
                onCreated={refreshPortal}
                quote={quote.data}
              />
            </PanelBody>
          </Panel>
          <Panel>
            <PanelHeader>
              <div>
                <PanelTitle>Counterproposal</PanelTitle>
                <PanelDescription>
                  Propose a line discount and preview it against the current
                  shared value.
                </PanelDescription>
              </div>
            </PanelHeader>
            <PanelBody>
              <CounterproposalComposer
                onCreated={refreshPortal}
                quote={quote.data}
              />
            </PanelBody>
          </Panel>
        </div>
      ) : null}

      <div className="grid gap-lg print:hidden xl:grid-cols-2">
        <Panel>
          <PanelHeader>
            <div>
              <PanelTitle>Shared Discussion</PanelTitle>
              <PanelDescription>
                Only messages marked for customer visibility appear here.
              </PanelDescription>
            </div>
          </PanelHeader>
          <PanelBody>
            {messages.isPending ? <Skeleton shape="block" /> : null}
            {messages.isError ? (
              <ErrorFeedback title="Discussion Unavailable">
                {problemMessage(
                  messages.error,
                  "Customer-visible comments could not be loaded.",
                )}
              </ErrorFeedback>
            ) : null}
            {messages.data?.length === 0 ? (
              <EmptyState
                description="Use the comment form to start a line-level or quote-level discussion."
                headingLevel="h3"
                title="No Shared Comments"
              />
            ) : null}
            {messages.data && messages.data.length > 0 ? (
              <Timeline aria-label="Customer-visible quotation comments">
                {messages.data.map((message) => {
                  const line = quote.data.lines.find(
                    (candidate) => candidate.id === message.quoteLineId,
                  );
                  return (
                    <TimelineItem
                      description={message.body}
                      key={message.id}
                      metadata={`${message.authorName}${line ? ` · Line ${line.lineNumber}: ${line.productName}` : " · Entire quotation"}`}
                      time={formatDateTime(message.createdAt, locale, timezone)}
                      title={
                        message.authorType === "PORTAL"
                          ? "Customer Comment"
                          : message.authorType === "USER"
                            ? "Seller Comment"
                            : "System Update"
                      }
                    />
                  );
                })}
              </Timeline>
            ) : null}
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader>
            <div>
              <PanelTitle>Commercial Requests</PanelTitle>
              <PanelDescription>
                Requested changes stay separate from comments and show their
                resolution state.
              </PanelDescription>
            </div>
          </PanelHeader>
          <PanelBody>
            {requests.isPending ? <Skeleton shape="block" /> : null}
            {requests.isError ? (
              <ErrorFeedback title="Requests Unavailable">
                {problemMessage(
                  requests.error,
                  "Commercial requests could not be loaded.",
                )}
              </ErrorFeedback>
            ) : null}
            {requests.data?.length === 0 ? (
              <EmptyState
                description="No commercial changes have been requested."
                headingLevel="h3"
                title="No Change Requests"
              />
            ) : null}
            {requests.data && requests.data.length > 0 ? (
              <Timeline aria-label="Quotation change requests">
                {requests.data.map((request) => (
                  <TimelineItem
                    description={requestDescription(request, quote.data)}
                    key={request.id}
                    metadata={
                      request.message ??
                      request.resolutionReason ??
                      "No context provided"
                    }
                    time={formatDateTime(request.createdAt, locale, timezone)}
                    title={
                      <span className="flex flex-wrap items-center gap-xs">
                        Change Request{" "}
                        <Badge tone={statusTone(request.status)}>
                          {formatEnumLabel(request.status)}
                        </Badge>
                      </span>
                    }
                  />
                ))}
              </Timeline>
            ) : null}
          </PanelBody>
        </Panel>
      </div>

      <Panel className="print:hidden">
        <PanelHeader>
          <div>
            <PanelTitle>Version History & Comparison</PanelTitle>
            <PanelDescription>
              Compare earlier quotations and review the changes before
              accepting.
            </PanelDescription>
          </div>
          <Badge>{orderedVersions.length} versions</Badge>
        </PanelHeader>
        <PanelBody className="grid gap-md">
          {versions.isPending ? <Skeleton shape="block" /> : null}
          {versions.isError ? (
            <ErrorFeedback title="Version History Unavailable">
              {problemMessage(
                versions.error,
                "Shared version history could not be loaded.",
              )}
            </ErrorFeedback>
          ) : null}
          {orderedVersions.length === 1 ? (
            <InlineFeedback>
              This is the first shared version, so there is no earlier version
              to compare.
            </InlineFeedback>
          ) : null}
          {orderedVersions.length > 1 ? (
            <>
              <div className="grid gap-sm sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="version-from">Compare From</FieldLabel>
                  <Select
                    aria-describedby={
                      !diffQuery.success
                        ? "version-comparison-error"
                        : undefined
                    }
                    aria-invalid={!diffQuery.success}
                    id="version-from"
                    name="version-from"
                    onChange={(event) => setFromVersionId(event.target.value)}
                    value={effectiveFrom}
                  >
                    {orderedVersions.map((version) => (
                      <option key={version.id} value={version.id}>
                        Revision {version.revisionNumber}
                        {version.isCurrent ? " (current)" : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="version-to">Compare To</FieldLabel>
                  <Select
                    aria-describedby={
                      !diffQuery.success
                        ? "version-comparison-error"
                        : undefined
                    }
                    aria-invalid={!diffQuery.success}
                    id="version-to"
                    name="version-to"
                    onChange={(event) => setToVersionId(event.target.value)}
                    value={effectiveTo}
                  >
                    {orderedVersions.map((version) => (
                      <option key={version.id} value={version.id}>
                        Revision {version.revisionNumber}
                        {version.isCurrent ? " (current)" : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              {!diffQuery.success ? (
                <FieldError id="version-comparison-error">
                  Choose two different versions to compare.
                </FieldError>
              ) : null}
              {versionDiff.isPending ? <Skeleton shape="block" /> : null}
              {versionDiff.isError ? (
                <ErrorFeedback title="Comparison Unavailable">
                  {problemMessage(
                    versionDiff.error,
                    "These versions could not be compared.",
                  )}
                </ErrorFeedback>
              ) : null}
              {versionDiff.data ? (
                <div className="grid gap-sm">
                  <InlineFeedback
                    title={
                      versionDiff.data.materialChange
                        ? "Material Terms Changed"
                        : "No Material Terms Changed"
                    }
                    tone={
                      versionDiff.data.materialChange ? "warning" : "success"
                    }
                  >
                    Comparing revision {versionDiff.data.fromRevision} with
                    revision {versionDiff.data.toRevision}.
                  </InlineFeedback>
                  {versionDiff.data.differences.length === 0 ? (
                    <EmptyState
                      description="The customer-visible terms are identical."
                      headingLevel="h3"
                      title="No Differences"
                    />
                  ) : (
                    <div className="grid gap-xs">
                      {versionDiff.data.differences.map((difference) => (
                        <article
                          className="grid gap-xs rounded-control border border-border p-sm"
                          key={difference.path}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-xs">
                            <strong className="text-body-sm text-foreground-strong">
                              {difference.label}
                            </strong>
                            {difference.material ? (
                              <Badge tone="warning">Material</Badge>
                            ) : null}
                          </div>
                          <dl className="m-0 grid gap-xs text-caption sm:grid-cols-2">
                            <div>
                              <dt className="text-foreground-muted">Before</dt>
                              <dd className="m-0 break-words text-foreground-strong">
                                {differenceValue(
                                  difference.before,
                                  quote.data.currency,
                                  locale,
                                )}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-foreground-muted">After</dt>
                              <dd className="m-0 break-words text-foreground-strong">
                                {differenceValue(
                                  difference.after,
                                  quote.data.currency,
                                  locale,
                                )}
                              </dd>
                            </div>
                          </dl>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </>
          ) : null}
        </PanelBody>
      </Panel>

      <Panel className="print:hidden">
        <PanelHeader>
          <div>
            <PanelTitle>Final Confirmation</PanelTitle>
            <PanelDescription>
              Accept the prices, quantities, and payment terms in this
              quotation.
            </PanelDescription>
          </div>
          <Badge tone={statusTone(quote.data.stage)}>
            {formatEnumLabel(quote.data.stage)}
          </Badge>
        </PanelHeader>
        <PanelBody className="grid gap-md">
          {quote.data.canConfirm ? (
            <>
              <CheckboxField
                checkbox={
                  <Checkbox
                    checked={acknowledged}
                    name="acknowledge-terms"
                    onChange={(event) =>
                      setAcknowledgedFingerprint(
                        event.target.checked ? quote.data.termsFingerprint : "",
                      )
                    }
                  />
                }
                description="If the visible terms change, this acknowledgement is cleared automatically."
              >
                I reviewed{" "}
                {currentVersion
                  ? `revision ${currentVersion.revisionNumber}`
                  : "the current shared version"}{" "}
                and accept its prices, quantities, and payment terms.
              </CheckboxField>
              <Button
                disabled={confirm.isPending || !acknowledged}
                fullWidth
                onClick={() => confirm.mutate(quote.data)}
              >
                {confirm.isPending ? "Confirming…" : "Confirm This Quotation"}
              </Button>
            </>
          ) : awaitingApproval ? (
            <InlineFeedback tone="warning">
              Confirmation is locked while this version awaits internal
              approval.
            </InlineFeedback>
          ) : (
            <InlineFeedback>
              This quotation is not currently eligible for confirmation.
            </InlineFeedback>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
