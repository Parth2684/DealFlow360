"use client";

import {
  ApplyCreditNoteRequestSchema,
  BillingScheduleDtoSchema,
  CreditNoteDtoSchema,
  InvoiceDtoSchema,
  InvoiceSummaryDtoSchema,
  IssueInvoiceRequestSchema,
  OrderBillingDtoSchema,
  OrderDtoSchema,
  PAYMENT_METHODS,
  PaymentDtoSchema,
  PositiveDecimalStringSchema,
  ProrationPreviewDtoSchema,
  RecordPaymentRequestSchema,
  SubscriptionCancelRequestSchema,
  SubscriptionCancellationPreviewRequestSchema,
  SubscriptionChangeDtoSchema,
  SubscriptionChangeRequestSchema,
  SubscriptionDtoSchema,
  SubscriptionPlanDtoSchema,
  addDecimalStrings,
  apiRoutes,
  compareDecimalStrings,
  createCursorPageSchema,
  formatDateTime,
  formatEnumLabel,
  formatMoney,
  planApiRoutes,
  type BillingScheduleDto,
  type Capability,
  type CreditNoteDto,
  type InvoiceDto,
  type OrderBillingDto,
  type PaymentDto,
  type ProrationPreviewDto,
  type SubscriptionCancellationPreviewRequest,
  type SubscriptionChangeRequest,
  type SubscriptionDto,
  type SubscriptionPlanDto,
} from "@repo/common";
import {
  Badge,
  Button,
  ButtonLink,
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
import { useMemo, useState } from "react";
import { z } from "zod";

import { useOrganizationFormatting } from "../../components/foundation/organization-formatting";
import { ApiProblemError, browserApiRequest } from "../../lib/api/browser";
import { useIdempotencyKey } from "../shared/use-idempotency-key";

const ScheduleListSchema = z.array(BillingScheduleDtoSchema);
const PaymentListSchema = z.array(PaymentDtoSchema);
const CreditNotePageSchema = createCursorPageSchema(CreditNoteDtoSchema);
const InvoicePageSchema = createCursorPageSchema(InvoiceSummaryDtoSchema);
const PlanPageSchema = createCursorPageSchema(SubscriptionPlanDtoSchema);

interface SubscriptionLedgerEntry {
  detail: SubscriptionDto;
  schedules: BillingScheduleDto[];
}

interface InvoiceLedgerEntry {
  detail: InvoiceDto;
  payments: PaymentDto[];
}

interface BillingLedger {
  creditNotes: CreditNoteDto[];
  invoices: InvoiceLedgerEntry[];
  plans: SubscriptionPlanDto[];
  subscriptions: SubscriptionLedgerEntry[];
}

const billingKey = (orderId: string) => ["order-billing", orderId] as const;
const orderKey = (orderId: string) => ["order", orderId] as const;
const ledgerKey = (orderId: string) => ["billing-ledger", orderId] as const;

function problemMessage(error: unknown, fallback: string): string {
  return error instanceof ApiProblemError
    ? (error.problem.detail ?? fallback)
    : fallback;
}

function statusTone(
  status: string,
): "neutral" | "success" | "warning" | "danger" | "info" {
  if (["PAID", "ACTIVE", "APPLIED", "GENERATED", "RECORDED"].includes(status)) {
    return "success";
  }
  if (["VOID", "CANCELLED", "EXPIRED", "FAILED", "REVERSED"].includes(status)) {
    return "danger";
  }
  if (
    [
      "OVERDUE",
      "PARTIALLY_PAID",
      "CHANGE_SCHEDULED",
      "CANCELLATION_SCHEDULED",
    ].includes(status)
  ) {
    return "warning";
  }
  if (["ISSUED", "PENDING"].includes(status)) return "info";
  return "neutral";
}

function quantityLabel(value: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 4,
  }).format(Number(value));
}

function dateLabel(value: string, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone,
  }).format(new Date(`${value}T12:00:00.000Z`));
}

function dateKeyInTimeZone(
  value: Date,
  locale: string,
  timeZone: string,
): string {
  const parts = new Intl.DateTimeFormat(locale, {
    calendar: "iso8601",
    day: "2-digit",
    month: "2-digit",
    numberingSystem: "latn",
    timeZone,
    year: "numeric",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");
  if (!year || !month || !day) {
    throw new RangeError(`Unable to resolve a calendar date in ${timeZone}`);
  }
  return `${year}-${month}-${day}`;
}

function localDateStartToIso(
  value: string,
  locale: string,
  timeZone: string,
): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const canonical = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(canonical.valueOf())) return undefined;
  const searchWindow = 48 * 60 * 60_000;
  let low = canonical.getTime() - searchWindow;
  let high = canonical.getTime() + searchWindow;
  try {
    if (
      dateKeyInTimeZone(new Date(low), locale, timeZone) >= value ||
      dateKeyInTimeZone(new Date(high), locale, timeZone) < value
    ) {
      return undefined;
    }
    while (high - low > 1) {
      const middle = low + Math.floor((high - low) / 2);
      if (dateKeyInTimeZone(new Date(middle), locale, timeZone) >= value)
        high = middle;
      else low = middle;
    }
    const result = new Date(high);
    return dateKeyInTimeZone(result, locale, timeZone) === value
      ? result.toISOString()
      : undefined;
  } catch {
    return undefined;
  }
}

function defaultEffectiveDate(
  subscription: SubscriptionDto,
  locale: string,
): string {
  const today = dateKeyInTimeZone(new Date(), locale, subscription.timezone);
  const latest = new Date(`${subscription.currentPeriodEnd}T00:00:00.000Z`);
  latest.setUTCDate(latest.getUTCDate() - 1);
  const latestValue = latest.toISOString().slice(0, 10);
  if (today < subscription.currentPeriodStart)
    return subscription.currentPeriodStart;
  return today > latestValue ? latestValue : today;
}

function localDateTimeValue(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function localDateTimeToIso(value: string): string | undefined {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

async function loadCreditNotes(): Promise<CreditNoteDto[]> {
  const notes: CreditNoteDto[] = [];
  let cursor: string | undefined;
  do {
    const query = new URLSearchParams({ limit: "100" });
    if (cursor) query.set("cursor", cursor);
    const page = await browserApiRequest(
      `${apiRoutes.billing.creditNotes}?${query.toString()}`,
      { schema: CreditNotePageSchema },
    );
    notes.push(...page.items);
    cursor = page.pageInfo.nextCursor ?? undefined;
  } while (cursor);
  return notes;
}

async function loadInvoiceIds(orderId: string): Promise<string[]> {
  const invoiceIds: string[] = [];
  let cursor: string | undefined;
  do {
    const query = new URLSearchParams({ limit: "100" });
    if (cursor) query.set("cursor", cursor);
    const page = await browserApiRequest(
      `${apiRoutes.billing.invoices}?${query.toString()}`,
      { schema: InvoicePageSchema },
    );
    invoiceIds.push(
      ...page.items
        .filter((invoice) => invoice.orderId === orderId)
        .map((invoice) => invoice.id),
    );
    cursor = page.pageInfo.nextCursor ?? undefined;
  } while (cursor);
  return invoiceIds;
}

async function loadPlans(): Promise<SubscriptionPlanDto[]> {
  const plans: SubscriptionPlanDto[] = [];
  let cursor: string | undefined;
  do {
    const query = new URLSearchParams({ limit: "100" });
    if (cursor) query.set("cursor", cursor);
    const page = await browserApiRequest(
      `${apiRoutes.catalog.subscriptionPlans}?${query.toString()}`,
      { schema: PlanPageSchema },
    );
    plans.push(...page.items);
    cursor = page.pageInfo.nextCursor ?? undefined;
  } while (cursor);
  return plans.filter((plan) => plan.status === "ACTIVE");
}

async function loadLedger(snapshot: OrderBillingDto): Promise<BillingLedger> {
  const [subscriptions, creditNotes, plans, listedInvoiceIds] =
    await Promise.all([
      Promise.all(
        snapshot.subscriptions.map(async (subscription) => {
          const [detail, schedules] = await Promise.all([
            browserApiRequest(apiRoutes.subscriptions.detail(subscription.id), {
              schema: SubscriptionDtoSchema,
            }),
            browserApiRequest(
              apiRoutes.subscriptions.schedules(subscription.id),
              {
                schema: ScheduleListSchema,
              },
            ),
          ]);
          return { detail, schedules };
        }),
      ),
      loadCreditNotes(),
      loadPlans(),
      loadInvoiceIds(snapshot.orderId),
    ]);

  const invoiceIds = new Set(listedInvoiceIds);
  for (const invoice of snapshot.oneTimeInvoices) invoiceIds.add(invoice.id);
  for (const entry of subscriptions) {
    for (const schedule of entry.schedules) {
      if (schedule.invoiceId) invoiceIds.add(schedule.invoiceId);
    }
  }
  const invoices = await Promise.all(
    [...invoiceIds].map(async (invoiceId) => {
      const [detail, payments] = await Promise.all([
        browserApiRequest(apiRoutes.billing.invoice(invoiceId), {
          schema: InvoiceDtoSchema,
        }),
        browserApiRequest(apiRoutes.billing.payments(invoiceId), {
          schema: PaymentListSchema,
        }),
      ]);
      return { detail, payments };
    }),
  );

  const relevantInvoiceIds = new Set(invoices.map((entry) => entry.detail.id));
  return {
    creditNotes: creditNotes.filter((note) =>
      relevantInvoiceIds.has(note.sourceInvoiceId),
    ),
    invoices,
    plans,
    subscriptions,
  };
}

function ProrationPreview({ preview }: { preview: ProrationPreviewDto }) {
  const { locale } = useOrganizationFormatting();
  return (
    <InlineFeedback
      title={`${formatEnumLabel(preview.changeType)} Preview`}
      tone={preview.direction === "CREDIT" ? "success" : "info"}
    >
      <div className="grid gap-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-xs">
          <span>{formatEnumLabel(preview.direction)} adjustment</span>
          <strong className="font-mono tabular-nums">
            {formatMoney(preview.roundedAmount, preview.currency, locale)}
          </strong>
        </div>
        <p className="m-0 text-caption">
          {preview.remainingBillableDays} of {preview.totalDays} billable days,
          using {formatEnumLabel(preview.convention)}.
        </p>
        <ul className="m-0 grid gap-xxs pl-md text-caption">
          {preview.explanation.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </InlineFeedback>
  );
}

function SubscriptionActions({
  entry,
  onChanged,
  plans,
}: {
  entry: SubscriptionLedgerEntry;
  onChanged: (message: string) => Promise<void>;
  plans: readonly SubscriptionPlanDto[];
}) {
  const { locale } = useOrganizationFormatting();
  const { detail } = entry;
  const [changeKind, setChangeKind] = useState<"quantity" | "plan">(
    detail.items.length === 1 ? "quantity" : "plan",
  );
  const [quantity, setQuantity] = useState(detail.items[0]?.quantity ?? "1");
  const [planId, setPlanId] = useState(detail.subscriptionPlanId);
  const [changeDate, setChangeDate] = useState(() =>
    defaultEffectiveDate(detail, locale),
  );
  const [changeReason, setChangeReason] = useState("");
  const [changePreview, setChangePreview] = useState<ProrationPreviewDto>();
  const [changePreviewSignature, setChangePreviewSignature] = useState("");
  const [cancelDate, setCancelDate] = useState(() =>
    defaultEffectiveDate(detail, locale),
  );
  const [cancelReason, setCancelReason] = useState("");
  const [cancelPreview, setCancelPreview] = useState<ProrationPreviewDto>();
  const [cancelPreviewSignature, setCancelPreviewSignature] = useState("");
  const [error, setError] = useState("");
  const changeKey = useIdempotencyKey();
  const cancelKey = useIdempotencyKey();

  function changeBody() {
    const effectiveDate = localDateStartToIso(
      changeDate,
      locale,
      detail.timezone,
    );
    return SubscriptionChangeRequestSchema.parse({
      revision: detail.revision,
      effectiveDate,
      reason: changeReason.trim() || undefined,
      ...(changeKind === "quantity" ? { quantity } : { planId }),
    });
  }

  function cancellationPreviewBody() {
    return SubscriptionCancellationPreviewRequestSchema.parse({
      revision: detail.revision,
      effectiveDate: localDateStartToIso(cancelDate, locale, detail.timezone),
    });
  }

  const previewChange = useMutation({
    mutationFn: (body: SubscriptionChangeRequest) =>
      browserApiRequest(apiRoutes.subscriptions.previewChange(detail.id), {
        json: body,
        method: "POST",
        schema: ProrationPreviewDtoSchema,
      }),
    onError: (requestError) => {
      setError(
        problemMessage(
          requestError,
          "The change preview could not be calculated.",
        ),
      );
      setChangePreview(undefined);
      setChangePreviewSignature("");
    },
    onMutate: () => setError(""),
    onSuccess: (result, body) => {
      setChangePreview(result);
      setChangePreviewSignature(JSON.stringify(body));
    },
  });
  const applyChange = useMutation({
    mutationFn: () => {
      const body = changeBody();
      if (changePreviewSignature !== JSON.stringify(body)) {
        throw new Error(
          "Preview the current subscription change before applying it.",
        );
      }
      return browserApiRequest(apiRoutes.subscriptions.change(detail.id), {
        headers: changeKey.headersFor({ subscriptionId: detail.id, ...body }),
        json: body,
        method: "POST",
        schema: SubscriptionChangeDtoSchema,
      });
    },
    onError: (requestError) =>
      setError(
        problemMessage(
          requestError,
          "The subscription change was not applied.",
        ),
      ),
    onMutate: () => setError(""),
    onSuccess: async () => {
      changeKey.clear();
      setChangePreview(undefined);
      setChangePreviewSignature("");
      await onChanged(
        `${detail.subscriptionNumber} updated after server confirmation.`,
      );
    },
  });
  const previewCancellation = useMutation({
    mutationFn: (body: SubscriptionCancellationPreviewRequest) =>
      browserApiRequest(
        planApiRoutes.subscriptions.previewCancellation(detail.id),
        {
          json: body,
          method: "POST",
          schema: ProrationPreviewDtoSchema,
        },
      ),
    onError: (requestError) => {
      setError(
        problemMessage(
          requestError,
          "The cancellation preview could not be calculated.",
        ),
      );
      setCancelPreview(undefined);
      setCancelPreviewSignature("");
    },
    onMutate: () => setError(""),
    onSuccess: (result, body) => {
      setCancelPreview(result);
      setCancelPreviewSignature(JSON.stringify(body));
    },
  });
  const cancel = useMutation({
    mutationFn: () => {
      const previewBody = cancellationPreviewBody();
      if (cancelPreviewSignature !== JSON.stringify(previewBody)) {
        throw new Error("Preview the current cancellation before applying it.");
      }
      const body = SubscriptionCancelRequestSchema.parse({
        revision: detail.revision,
        effectiveDate: localDateStartToIso(cancelDate, locale, detail.timezone),
        reason: cancelReason,
      });
      return browserApiRequest(apiRoutes.subscriptions.cancel(detail.id), {
        headers: cancelKey.headersFor({ subscriptionId: detail.id, ...body }),
        json: body,
        method: "POST",
        schema: SubscriptionChangeDtoSchema,
      });
    },
    onError: (requestError) =>
      setError(
        problemMessage(requestError, "The cancellation was not scheduled."),
      ),
    onMutate: () => setError(""),
    onSuccess: async () => {
      cancelKey.clear();
      setCancelPreview(undefined);
      setCancelPreviewSignature("");
      await onChanged(
        `${detail.subscriptionNumber} cancellation confirmed by the server.`,
      );
    },
  });

  const isTerminal = ["CANCELLED", "EXPIRED"].includes(detail.status);
  const effectiveChangeDateValid =
    changeDate >= detail.currentPeriodStart &&
    changeDate < detail.currentPeriodEnd;
  const effectiveCancelDateValid =
    cancelDate >= detail.currentPeriodStart &&
    cancelDate < detail.currentPeriodEnd;
  const quantityChangeValid =
    detail.items.length === 1 &&
    PositiveDecimalStringSchema.safeParse(quantity).success &&
    compareDecimalStrings(quantity, detail.items[0]?.quantity ?? "0") !== 0;
  const planChangeValid =
    planId.length > 0 && planId !== detail.subscriptionPlanId;
  const changeInputValid =
    effectiveChangeDateValid &&
    (changeKind === "quantity" ? quantityChangeValid : planChangeValid);
  const changePreviewCurrent =
    changePreview !== undefined &&
    changePreviewSignature === JSON.stringify(changeBody());
  const cancelPreviewCurrent =
    cancelPreview !== undefined &&
    cancelPreviewSignature === JSON.stringify(cancellationPreviewBody());
  const isBusy =
    previewChange.isPending ||
    applyChange.isPending ||
    previewCancellation.isPending ||
    cancel.isPending;

  function resetChangePreview() {
    setChangePreview(undefined);
    setChangePreviewSignature("");
    setError("");
  }

  return (
    <details className="rounded-control border border-border bg-surface-subtle p-sm">
      <summary className="cursor-pointer font-semibold text-foreground-strong">
        Manage Plan or Quantity
      </summary>
      <div className="mt-md grid gap-lg">
        {error ? (
          <ErrorFeedback title="Subscription Action Failed">
            {error}
          </ErrorFeedback>
        ) : null}
        <section
          aria-labelledby={`change-${detail.id}`}
          className="grid gap-md"
        >
          <div>
            <h4
              className="m-0 text-body-sm font-semibold text-foreground-strong"
              id={`change-${detail.id}`}
            >
              Preview a Change
            </h4>
            <p className="m-0 text-caption text-foreground-muted">
              Previewing is read-only. Applying waits for the server before
              refreshing the ledger.
            </p>
          </div>
          <div className="grid gap-sm sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={`change-kind-${detail.id}`}>
                Change Type
              </FieldLabel>
              <Select
                id={`change-kind-${detail.id}`}
                name={`change-kind-${detail.id}`}
                onChange={(event) => {
                  setChangeKind(event.target.value as "quantity" | "plan");
                  resetChangePreview();
                }}
                value={changeKind}
              >
                {detail.items.length === 1 ? (
                  <option value="quantity">Quantity</option>
                ) : null}
                <option value="plan">Subscription Plan</option>
              </Select>
            </Field>
            {changeKind === "quantity" ? (
              <Field>
                <FieldLabel htmlFor={`quantity-${detail.id}`}>
                  New Quantity
                </FieldLabel>
                <Input
                  autoComplete="off"
                  id={`quantity-${detail.id}`}
                  inputMode="decimal"
                  min="0.0001"
                  name={`quantity-${detail.id}`}
                  onChange={(event) => {
                    setQuantity(event.target.value);
                    resetChangePreview();
                  }}
                  step="0.0001"
                  type="number"
                  value={quantity}
                />
              </Field>
            ) : (
              <Field>
                <FieldLabel htmlFor={`plan-${detail.id}`}>New Plan</FieldLabel>
                <Select
                  id={`plan-${detail.id}`}
                  name={`plan-${detail.id}`}
                  onChange={(event) => {
                    setPlanId(event.target.value);
                    resetChangePreview();
                  }}
                  value={planId}
                >
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} · every {plan.intervalCount}{" "}
                      {formatEnumLabel(plan.interval)}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor={`change-date-${detail.id}`}>
                Effective Date
              </FieldLabel>
              <Input
                autoComplete="off"
                id={`change-date-${detail.id}`}
                name={`change-date-${detail.id}`}
                onChange={(event) => {
                  setChangeDate(event.target.value);
                  resetChangePreview();
                }}
                type="date"
                value={changeDate}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`change-reason-${detail.id}`}>
                Reason (Optional)
              </FieldLabel>
              <Input
                autoComplete="off"
                id={`change-reason-${detail.id}`}
                maxLength={1000}
                name={`change-reason-${detail.id}`}
                onChange={(event) => {
                  setChangeReason(event.target.value);
                  resetChangePreview();
                }}
                value={changeReason}
              />
            </Field>
          </div>
          {changePreview ? <ProrationPreview preview={changePreview} /> : null}
          <div className="flex flex-wrap gap-xs">
            <Button
              disabled={isBusy || !changeInputValid}
              onClick={() => previewChange.mutate(changeBody())}
              size="compact"
              variant="secondary"
            >
              {previewChange.isPending ? "Calculating…" : "Preview Proration"}
            </Button>
            <Button
              disabled={isBusy || !changePreviewCurrent}
              onClick={() => applyChange.mutate()}
              size="compact"
            >
              {applyChange.isPending
                ? "Applying Change…"
                : "Apply Previewed Change"}
            </Button>
          </div>
        </section>

        <section
          aria-labelledby={`cancel-${detail.id}`}
          className="grid gap-md border-t border-border pt-md"
        >
          <div>
            <h4
              className="m-0 text-body-sm font-semibold text-foreground-strong"
              id={`cancel-${detail.id}`}
            >
              Schedule Cancellation
            </h4>
            <p className="m-0 text-caption text-foreground-muted">
              A cancellation requires a fresh server-side proration preview and
              a recorded reason.
            </p>
          </div>
          <div className="grid gap-sm sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={`cancel-date-${detail.id}`}>
                Effective Date
              </FieldLabel>
              <Input
                autoComplete="off"
                id={`cancel-date-${detail.id}`}
                name={`cancel-date-${detail.id}`}
                onChange={(event) => {
                  setCancelDate(event.target.value);
                  setCancelPreview(undefined);
                  setCancelPreviewSignature("");
                }}
                type="date"
                value={cancelDate}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`cancel-reason-${detail.id}`}>
                Cancellation Reason
              </FieldLabel>
              <Textarea
                aria-describedby={
                  cancelReason.trim()
                    ? undefined
                    : `cancel-reason-error-${detail.id}`
                }
                aria-invalid={!cancelReason.trim()}
                autoComplete="off"
                id={`cancel-reason-${detail.id}`}
                maxLength={1000}
                name={`cancel-reason-${detail.id}`}
                onChange={(event) => {
                  setCancelReason(event.target.value);
                }}
                rows={2}
                value={cancelReason}
              />
              {!cancelReason.trim() ? (
                <FieldError id={`cancel-reason-error-${detail.id}`}>
                  A reason is required to apply cancellation.
                </FieldError>
              ) : null}
            </Field>
          </div>
          {cancelPreview ? <ProrationPreview preview={cancelPreview} /> : null}
          <div className="flex flex-wrap gap-xs">
            <Button
              disabled={isBusy || !effectiveCancelDateValid}
              onClick={() =>
                previewCancellation.mutate(cancellationPreviewBody())
              }
              size="compact"
              variant="secondary"
            >
              {previewCancellation.isPending
                ? "Calculating…"
                : "Preview Cancellation"}
            </Button>
            <Button
              disabled={
                isBusy ||
                !cancelPreviewCurrent ||
                !cancelReason.trim() ||
                isTerminal
              }
              onClick={() => cancel.mutate()}
              size="compact"
              variant="danger"
            >
              {cancel.isPending
                ? "Scheduling Cancellation…"
                : "Confirm Cancellation"}
            </Button>
          </div>
        </section>
      </div>
    </details>
  );
}

function SubscriptionCard({
  canManage,
  entry,
  onChanged,
  plans,
  timeZone,
}: {
  canManage: boolean;
  entry: SubscriptionLedgerEntry;
  onChanged: (message: string) => Promise<void>;
  plans: readonly SubscriptionPlanDto[];
  timeZone: string;
}) {
  const { locale } = useOrganizationFormatting();
  const { detail, schedules } = entry;
  return (
    <article className="grid gap-md border-b border-border pb-lg last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-sm">
        <div className="min-w-0">
          <h3 className="m-0 break-words text-title font-semibold text-foreground-strong">
            {detail.subscriptionNumber}
          </h3>
          <p className="m-0 text-body-sm text-foreground-muted">
            {detail.planName} · {detail.items.length} item
            {detail.items.length === 1 ? "" : "s"}
          </p>
        </div>
        <Badge tone={statusTone(detail.status)}>
          {formatEnumLabel(detail.status)}
        </Badge>
      </div>
      <MetricGroup aria-label={`${detail.subscriptionNumber} billing facts`}>
        <Metric
          label="Current Period"
          value={`${dateLabel(detail.currentPeriodStart, locale, timeZone)} to ${dateLabel(detail.currentPeriodEnd, locale, timeZone)}`}
        />
        <Metric
          label="Next Billing"
          value={
            detail.nextBillingAt
              ? formatDateTime(detail.nextBillingAt, locale, timeZone)
              : "Not scheduled"
          }
        />
        <Metric
          label="Upcoming Cycles"
          value={
            schedules.filter((item) => item.generationStatus === "PENDING")
              .length
          }
        />
      </MetricGroup>
      <div className="grid gap-xs">
        {detail.items.map((item) => (
          <div
            className="flex flex-wrap justify-between gap-xs text-body-sm"
            key={item.id}
          >
            <span>
              {item.productName} · {item.quantity} {item.unit}
            </span>
            <strong className="font-mono tabular-nums text-foreground-strong">
              {formatMoney(item.unitPrice, detail.currency, locale)} / unit
            </strong>
          </div>
        ))}
      </div>
      {canManage && ["ACTIVE", "CHANGE_SCHEDULED"].includes(detail.status) ? (
        <SubscriptionActions
          entry={entry}
          onChanged={onChanged}
          plans={plans}
        />
      ) : null}
    </article>
  );
}

function PaymentForm({
  invoice,
  onRecorded,
}: {
  invoice: InvoiceDto;
  onRecorded: (message: string) => Promise<void>;
}) {
  const { locale } = useOrganizationFormatting();
  const [amount, setAmount] = useState(invoice.balanceDue);
  const [method, setMethod] =
    useState<(typeof PAYMENT_METHODS)[number]>("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(localDateTimeValue());
  const [error, setError] = useState("");
  const paymentKey = useIdempotencyKey();
  const payment = useMutation({
    mutationFn: () => {
      const body = RecordPaymentRequestSchema.parse({
        amount,
        method,
        paymentDate: localDateTimeToIso(paymentDate),
        reference: reference.trim() || undefined,
      });
      return browserApiRequest(apiRoutes.billing.payments(invoice.id), {
        headers: paymentKey.headersFor({ invoiceId: invoice.id, ...body }),
        json: body,
        method: "POST",
        schema: PaymentDtoSchema,
      });
    },
    onError: (requestError) =>
      setError(problemMessage(requestError, "The payment was not recorded.")),
    onMutate: () => setError(""),
    onSuccess: async (result) => {
      paymentKey.clear();
      setReference("");
      await onRecorded(
        `${formatMoney(result.amount, result.currency, locale)} payment recorded by the server.`,
      );
    },
  });

  return (
    <details className="rounded-control border border-border bg-surface-subtle p-sm">
      <summary className="cursor-pointer font-semibold text-foreground-strong">
        Record Payment
      </summary>
      <div className="mt-md grid gap-sm">
        {error ? (
          <ErrorFeedback title="Payment Failed">{error}</ErrorFeedback>
        ) : null}
        <div className="grid gap-sm sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`payment-amount-${invoice.id}`}>
              Amount
            </FieldLabel>
            <Input
              autoComplete="off"
              id={`payment-amount-${invoice.id}`}
              inputMode="decimal"
              max={invoice.balanceDue}
              min="0.0001"
              name={`payment-amount-${invoice.id}`}
              onChange={(event) => setAmount(event.target.value)}
              step="0.0001"
              type="number"
              value={amount}
            />
            <FieldDescription>
              Balance due:{" "}
              {formatMoney(invoice.balanceDue, invoice.currency, locale)}
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor={`payment-method-${invoice.id}`}>
              Method
            </FieldLabel>
            <Select
              id={`payment-method-${invoice.id}`}
              name={`payment-method-${invoice.id}`}
              onChange={(event) =>
                setMethod(
                  event.target.value as (typeof PAYMENT_METHODS)[number],
                )
              }
              value={method}
            >
              {PAYMENT_METHODS.map((value) => (
                <option key={value} value={value}>
                  {formatEnumLabel(value)}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor={`payment-date-${invoice.id}`}>
              Payment Date
            </FieldLabel>
            <Input
              autoComplete="off"
              id={`payment-date-${invoice.id}`}
              name={`payment-date-${invoice.id}`}
              onChange={(event) => setPaymentDate(event.target.value)}
              type="datetime-local"
              value={paymentDate}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`payment-reference-${invoice.id}`}>
              Reference (Optional)
            </FieldLabel>
            <Input
              autoComplete="off"
              id={`payment-reference-${invoice.id}`}
              maxLength={160}
              name={`payment-reference-${invoice.id}`}
              onChange={(event) => setReference(event.target.value)}
              value={reference}
            />
          </Field>
        </div>
        <Button
          disabled={
            payment.isPending ||
            !localDateTimeToIso(paymentDate) ||
            !PositiveDecimalStringSchema.safeParse(amount).success
          }
          onClick={() => payment.mutate()}
          size="compact"
        >
          {payment.isPending
            ? "Recording Payment…"
            : "Record Confirmed Payment"}
        </Button>
      </div>
    </details>
  );
}

export function InvoiceCard({
  canIssue,
  canRecordPayment,
  entry,
  onChanged,
  timeZone,
}: {
  canIssue: boolean;
  canRecordPayment: boolean;
  entry: InvoiceLedgerEntry;
  onChanged: (message: string) => Promise<void>;
  timeZone: string;
}) {
  const { locale } = useOrganizationFormatting();
  const { detail, payments } = entry;
  const [error, setError] = useState("");
  const issueKey = useIdempotencyKey();
  const issue = useMutation({
    mutationFn: () => {
      const body = IssueInvoiceRequestSchema.parse({
        revision: detail.revision,
      });
      return browserApiRequest(apiRoutes.billing.issueInvoice(detail.id), {
        headers: issueKey.headersFor({ invoiceId: detail.id, ...body }),
        json: body,
        method: "POST",
        schema: InvoiceDtoSchema,
      });
    },
    onError: (requestError) =>
      setError(
        problemMessage(requestError, "The invoice could not be issued."),
      ),
    onMutate: () => setError(""),
    onSuccess: async () => {
      issueKey.clear();
      await onChanged(
        `${detail.invoiceNumber} issued after server confirmation.`,
      );
    },
  });
  const canPay = ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(
    detail.status,
  );

  return (
    <article className="grid gap-md border-b border-border pb-lg last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-sm">
        <div>
          <h3 className="m-0 text-title font-semibold text-foreground-strong">
            {detail.invoiceNumber}
          </h3>
          <p className="m-0 text-caption text-foreground-muted">
            {formatEnumLabel(detail.type)} · due{" "}
            {dateLabel(detail.dueDate, locale, timeZone)}
          </p>
        </div>
        <Badge tone={statusTone(detail.status)}>
          {formatEnumLabel(detail.status)}
        </Badge>
      </div>
      {error ? (
        <ErrorFeedback title="Invoice Action Failed">{error}</ErrorFeedback>
      ) : null}
      <MetricGroup aria-label={`${detail.invoiceNumber} balance`}>
        <Metric
          label="Total"
          value={formatMoney(detail.total, detail.currency, locale)}
        />
        <Metric
          label="Paid"
          value={formatMoney(detail.amountPaid, detail.currency, locale)}
        />
        <Metric
          label="Balance Due"
          tone={
            compareDecimalStrings(detail.balanceDue, "0") > 0
              ? "warning"
              : "success"
          }
          value={formatMoney(detail.balanceDue, detail.currency, locale)}
        />
      </MetricGroup>
      <div className="grid gap-sm md:hidden">
        {detail.lines.map((line) => (
          <article
            className="grid gap-xs rounded-control border border-border bg-surface-subtle p-sm"
            key={line.id}
          >
            <strong className="break-words text-body-sm text-foreground-strong">
              {line.description}
            </strong>
            <dl className="m-0 grid grid-cols-2 gap-xs text-caption">
              <div>
                <dt className="text-foreground-muted">Billing</dt>
                <dd className="m-0 text-foreground-strong">
                  {formatEnumLabel(line.billingType)}
                </dd>
              </div>
              <div>
                <dt className="text-foreground-muted">Quantity</dt>
                <dd className="m-0 font-mono tabular-nums text-foreground-strong">
                  {quantityLabel(line.quantity, locale)}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-foreground-muted">Total</dt>
                <dd className="m-0 font-mono tabular-nums text-foreground-strong">
                  {formatMoney(line.total, detail.currency, locale)}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <DataTable
        aria-label={`${detail.invoiceNumber} line items`}
        containerClassName="hidden md:block"
      >
        <DataTableHeader>
          <DataTableRow>
            <DataTableHead>Description</DataTableHead>
            <DataTableHead>Billing</DataTableHead>
            <DataTableHead numeric>Quantity</DataTableHead>
            <DataTableHead numeric>Total</DataTableHead>
          </DataTableRow>
        </DataTableHeader>
        <DataTableBody>
          {detail.lines.map((line) => (
            <DataTableRow key={line.id}>
              <DataTableCell>{line.description}</DataTableCell>
              <DataTableCell>{formatEnumLabel(line.billingType)}</DataTableCell>
              <DataTableCell numeric>
                {quantityLabel(line.quantity, locale)}
              </DataTableCell>
              <DataTableCell numeric>
                {formatMoney(line.total, detail.currency, locale)}
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>
      {canIssue && detail.status === "DRAFT" ? (
        <Button
          disabled={issue.isPending}
          onClick={() => issue.mutate()}
          size="compact"
        >
          {issue.isPending ? "Issuing Invoice…" : "Issue Invoice"}
        </Button>
      ) : null}
      {canRecordPayment && canPay ? (
        <PaymentForm invoice={detail} onRecorded={onChanged} />
      ) : null}
      <div className="grid gap-xs">
        <h4 className="m-0 text-body-sm font-semibold text-foreground-strong">
          Payment History
        </h4>
        {payments.length === 0 ? (
          <p className="m-0 text-caption text-foreground-muted">
            No payments recorded.
          </p>
        ) : (
          payments.map((payment) => (
            <div
              className="flex flex-wrap items-center justify-between gap-xs text-caption"
              key={payment.id}
            >
              <span>
                {formatDateTime(payment.paymentDate, locale, timeZone)} ·{" "}
                {formatEnumLabel(payment.method)} · {payment.recordedByName}
              </span>
              <span className="flex items-center gap-xs">
                <strong className="font-mono tabular-nums">
                  {formatMoney(payment.amount, payment.currency, locale)}
                </strong>
                <Badge tone={statusTone(payment.status)}>
                  {formatEnumLabel(payment.status)}
                </Badge>
              </span>
            </div>
          ))
        )}
      </div>
    </article>
  );
}

function CreditNoteCard({
  canApply,
  invoice,
  note,
  onChanged,
  timeZone,
}: {
  canApply: boolean;
  invoice?: InvoiceDto;
  note: CreditNoteDto;
  onChanged: (message: string) => Promise<void>;
  timeZone: string;
}) {
  const { locale } = useOrganizationFormatting();
  const [error, setError] = useState("");
  const applyKey = useIdempotencyKey();
  const apply = useMutation({
    mutationFn: () => {
      if (!invoice)
        throw new Error("The source invoice is not in this order ledger.");
      const body = ApplyCreditNoteRequestSchema.parse({
        invoiceId: invoice.id,
      });
      return browserApiRequest(apiRoutes.billing.applyCreditNote(note.id), {
        headers: applyKey.headersFor({ creditNoteId: note.id, ...body }),
        json: body,
        method: "POST",
        schema: CreditNoteDtoSchema,
      });
    },
    onError: (requestError) =>
      setError(
        problemMessage(requestError, "The credit note could not be applied."),
      ),
    onMutate: () => setError(""),
    onSuccess: async () => {
      applyKey.clear();
      await onChanged(
        `${note.creditNoteNumber} applied after server confirmation.`,
      );
    },
  });
  const sourceHasBalance =
    invoice && compareDecimalStrings(invoice.balanceDue, "0") > 0;

  return (
    <article className="grid gap-xs border-b border-border pb-md last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-sm">
        <div>
          <h3 className="m-0 text-body-sm font-semibold text-foreground-strong">
            {note.creditNoteNumber}
          </h3>
          <p className="m-0 text-caption text-foreground-muted">
            Created {formatDateTime(note.createdAt, locale, timeZone)} ·{" "}
            {note.reason ?? "No reason recorded"}
          </p>
        </div>
        <div className="flex items-center gap-xs">
          <strong className="font-mono text-body-sm tabular-nums text-foreground-strong">
            {formatMoney(note.total, note.currency, locale)}
          </strong>
          <Badge tone={statusTone(note.status)}>
            {formatEnumLabel(note.status)}
          </Badge>
        </div>
      </div>
      {error ? (
        <ErrorFeedback title="Credit Application Failed">{error}</ErrorFeedback>
      ) : null}
      {canApply && note.status === "ISSUED" && sourceHasBalance ? (
        <Button
          disabled={apply.isPending}
          onClick={() => apply.mutate()}
          size="compact"
          variant="secondary"
        >
          {apply.isPending
            ? "Applying Credit…"
            : `Apply to ${invoice.invoiceNumber}`}
        </Button>
      ) : null}
    </article>
  );
}

export function BillingWorkspace({
  capabilities,
  orderId,
  timeZone,
}: {
  capabilities: readonly Capability[];
  orderId: string;
  timeZone: string;
}) {
  const { locale } = useOrganizationFormatting();
  const queryClient = useQueryClient();
  const granted = useMemo(() => new Set(capabilities), [capabilities]);
  const [actionMessage, setActionMessage] = useState("");

  const order = useQuery({
    queryFn: ({ signal }) =>
      browserApiRequest(apiRoutes.orders.detail(orderId), {
        schema: OrderDtoSchema,
        signal,
      }),
    queryKey: orderKey(orderId),
  });
  const billing = useQuery({
    queryFn: ({ signal }) =>
      browserApiRequest(apiRoutes.orders.billing(orderId), {
        schema: OrderBillingDtoSchema,
        signal,
      }),
    queryKey: billingKey(orderId),
    refetchInterval: 30_000,
  });
  const ledger = useQuery({
    enabled: billing.isSuccess,
    queryFn: () => {
      if (!billing.data)
        throw new Error("Order billing summary is unavailable.");
      return loadLedger(billing.data);
    },
    queryKey: ledgerKey(orderId),
    refetchInterval: 30_000,
  });

  async function refreshLedger(
    message = "Billing ledger refreshed from the API.",
  ) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: billingKey(orderId) }),
      queryClient.invalidateQueries({ queryKey: ledgerKey(orderId) }),
      queryClient.invalidateQueries({ queryKey: orderKey(orderId) }),
    ]);
    setActionMessage(message);
  }

  if (billing.isPending || order.isPending) {
    return (
      <div aria-busy="true" className="grid gap-md" role="status">
        <Skeleton className="w-2/5" />
        <Skeleton shape="block" />
        <span className="sr-only">Loading order billing…</span>
      </div>
    );
  }
  if (billing.isError || !billing.data || order.isError || !order.data) {
    return (
      <ErrorFeedback title="Billing Not Available">
        {problemMessage(
          billing.error ?? order.error,
          "This order billing ledger could not be loaded.",
        )}
      </ErrorFeedback>
    );
  }

  const recurringInvoices =
    ledger.data?.invoices.filter((entry) => entry.detail.type !== "ONE_TIME") ??
    [];
  const oneTimeInvoices =
    ledger.data?.invoices.filter((entry) => entry.detail.type === "ONE_TIME") ??
    [];
  const outstanding = addDecimalStrings(
    ...(ledger.data?.invoices.map((entry) => entry.detail.balanceDue) ?? ["0"]),
  );
  const nextSchedule = [...billing.data.upcomingSchedules].sort((left, right) =>
    left.dueDate.localeCompare(right.dueDate),
  )[0];
  const invoiceById = new Map(
    ledger.data?.invoices.map((entry) => [entry.detail.id, entry.detail]) ?? [],
  );
  const timeline = [
    ...(ledger.data?.subscriptions.flatMap((entry) =>
      entry.schedules.map((schedule) => ({
        id: `schedule-${schedule.id}`,
        date: schedule.dueDate,
        title: `${formatEnumLabel(schedule.generationStatus)} billing cycle`,
        description: `${entry.detail.subscriptionNumber} · ${formatMoney(schedule.amount, schedule.currency, locale)}`,
        metadata: `${dateLabel(schedule.periodStart, locale, timeZone)} to ${dateLabel(schedule.periodEnd, locale, timeZone)}`,
      })),
    ) ?? []),
    ...(ledger.data?.invoices.flatMap((entry) =>
      entry.payments.map((payment) => ({
        id: `payment-${payment.id}`,
        date: payment.paymentDate,
        title: `${formatMoney(payment.amount, payment.currency, locale)} payment ${formatEnumLabel(payment.status).toLowerCase()}`,
        description: `${entry.detail.invoiceNumber} · ${formatEnumLabel(payment.method)}`,
        metadata: payment.reference
          ? `Reference ${payment.reference}`
          : `Recorded by ${payment.recordedByName}`,
      })),
    ) ?? []),
  ].sort((left, right) => left.date.localeCompare(right.date));

  return (
    <div className="grid gap-lg">
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-xs">
            {granted.has("fulfillment.read") ? (
              <ButtonLink
                href={`/orders/${encodeURIComponent(orderId)}/fulfillment`}
                variant="secondary"
              >
                Open Fulfillment
              </ButtonLink>
            ) : null}
            <Button
              disabled={ledger.isFetching}
              onClick={() => void refreshLedger()}
              variant="secondary"
            >
              {ledger.isFetching ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        }
        description={`${order.data.customerName}. One-time charges, recurring schedules, invoices, payments, credits, and subscription changes.`}
        metadata={`Order ${order.data.orderNumber}`}
        title="Billing"
      />
      <LiveRegion message={actionMessage} />
      {actionMessage ? (
        <InlineFeedback tone="success">{actionMessage}</InlineFeedback>
      ) : null}
      <MetricGroup aria-label="Order billing summary">
        <Metric
          label="One-Time Total"
          value={formatMoney(
            billing.data.totalOneTime,
            billing.data.currency,
            locale,
          )}
        />
        <Metric
          label="Recurring Amount"
          value={formatMoney(
            billing.data.recurringAmount,
            billing.data.currency,
            locale,
          )}
        />
        <Metric
          label="Outstanding"
          tone={
            compareDecimalStrings(outstanding, "0") > 0 ? "warning" : "success"
          }
          value={formatMoney(outstanding, billing.data.currency, locale)}
        />
        <Metric
          label="Next Due"
          value={
            nextSchedule
              ? dateLabel(nextSchedule.dueDate, locale, timeZone)
              : "Not scheduled"
          }
        />
      </MetricGroup>

      {ledger.isPending ? (
        <div aria-busy="true" className="grid gap-sm" role="status">
          <Skeleton shape="block" />
          <span className="sr-only">
            Loading subscription and invoice history…
          </span>
        </div>
      ) : null}
      {ledger.isError ? (
        <ErrorFeedback title="Detailed Ledger Unavailable">
          {problemMessage(
            ledger.error,
            "Invoice, payment, and schedule details could not be loaded.",
          )}
        </ErrorFeedback>
      ) : null}

      {ledger.data ? (
        <div className="grid gap-lg">
          <Panel>
            <PanelHeader>
              <div>
                <PanelTitle>One-Time Billing</PanelTitle>
                <PanelDescription>
                  Draft and issued invoices generated from one-time order lines.
                </PanelDescription>
              </div>
              <Badge>{oneTimeInvoices.length} invoices</Badge>
            </PanelHeader>
            <PanelBody className="grid gap-lg">
              {oneTimeInvoices.length === 0 ? (
                <EmptyState
                  description="This order has no one-time invoices."
                  headingLevel="h3"
                  title="No One-Time Charges"
                />
              ) : null}
              {oneTimeInvoices.map((entry) => (
                <InvoiceCard
                  canIssue={granted.has("billing.issueInvoice")}
                  canRecordPayment={granted.has("billing.recordPayment")}
                  entry={entry}
                  key={`${entry.detail.id}:${entry.detail.revision}`}
                  onChanged={refreshLedger}
                  timeZone={timeZone}
                />
              ))}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>
              <div>
                <PanelTitle>Recurring Billing</PanelTitle>
                <PanelDescription>
                  Active subscriptions, proration controls, generated invoices,
                  and future schedules.
                </PanelDescription>
              </div>
              <Badge tone="info">
                {ledger.data.subscriptions.length} subscriptions
              </Badge>
            </PanelHeader>
            <PanelBody className="grid gap-xl">
              {ledger.data.subscriptions.length === 0 ? (
                <EmptyState
                  description="This order has no recurring subscription lines."
                  headingLevel="h3"
                  title="No Recurring Billing"
                />
              ) : null}
              {ledger.data.subscriptions.map((entry) => (
                <SubscriptionCard
                  canManage={granted.has("subscription.manage")}
                  entry={entry}
                  key={`${entry.detail.id}:${entry.detail.revision}`}
                  onChanged={refreshLedger}
                  plans={ledger.data.plans}
                  timeZone={timeZone}
                />
              ))}
              {recurringInvoices.length > 0 ? (
                <section
                  aria-labelledby="recurring-invoices"
                  className="grid gap-lg border-t border-border pt-lg"
                >
                  <h3
                    className="m-0 text-title font-semibold text-foreground-strong"
                    id="recurring-invoices"
                  >
                    Recurring & Proration Invoices
                  </h3>
                  {recurringInvoices.map((entry) => (
                    <InvoiceCard
                      canIssue={granted.has("billing.issueInvoice")}
                      canRecordPayment={granted.has("billing.recordPayment")}
                      entry={entry}
                      key={`${entry.detail.id}:${entry.detail.revision}`}
                      onChanged={refreshLedger}
                      timeZone={timeZone}
                    />
                  ))}
                </section>
              ) : null}
            </PanelBody>
          </Panel>

          <div className="grid gap-lg xl:grid-cols-2">
            <Panel>
              <PanelHeader>
                <div>
                  <PanelTitle>Billing Timeline</PanelTitle>
                  <PanelDescription>
                    Scheduled cycles and recorded payments in chronological
                    order.
                  </PanelDescription>
                </div>
              </PanelHeader>
              <PanelBody>
                {timeline.length === 0 ? (
                  <EmptyState
                    description="No billing events are recorded yet."
                    headingLevel="h3"
                    title="Timeline Empty"
                  />
                ) : (
                  <Timeline aria-label="Billing schedule and payment timeline">
                    {timeline.map((item) => (
                      <TimelineItem
                        description={item.description}
                        key={item.id}
                        metadata={item.metadata}
                        time={
                          item.date.includes("T")
                            ? formatDateTime(item.date, locale, timeZone)
                            : dateLabel(item.date, locale, timeZone)
                        }
                        title={item.title}
                      />
                    ))}
                  </Timeline>
                )}
              </PanelBody>
            </Panel>
            <Panel>
              <PanelHeader>
                <div>
                  <PanelTitle>Credit Notes</PanelTitle>
                  <PanelDescription>
                    Credits linked to invoices in this order. Eligible issued
                    credits can be applied to their source invoice.
                  </PanelDescription>
                </div>
              </PanelHeader>
              <PanelBody className="grid gap-md">
                {ledger.data.creditNotes.length === 0 ? (
                  <EmptyState
                    description="No credit notes are linked to this order."
                    headingLevel="h3"
                    title="No Credits"
                  />
                ) : null}
                {ledger.data.creditNotes.map((note) => (
                  <CreditNoteCard
                    canApply={granted.has("billing.manageCredit")}
                    invoice={invoiceById.get(note.sourceInvoiceId)}
                    key={note.id}
                    note={note}
                    onChanged={refreshLedger}
                    timeZone={timeZone}
                  />
                ))}
              </PanelBody>
            </Panel>
          </div>
        </div>
      ) : null}
    </div>
  );
}
