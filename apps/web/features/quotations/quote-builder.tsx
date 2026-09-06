"use client";

import {
  AddQuoteLineRequestSchema,
  ConfirmOrderRequestSchema,
  OrderDtoSchema,
  QuoteCalculationResponseSchema,
  QuoteDtoSchema,
  QuoteSubmitResponseSchema,
  QuoteVersionDtoSchema,
  RecommendationInteractionDtoSchema,
  UpdateQuoteLineRequestSchema,
  UpdateQuoteRequestSchema,
  apiRoutes,
  formatEnumLabel,
  formatMoney,
  formatPercentage,
  planApiRoutes,
  type AddQuoteLineRequest,
  type CursorPage,
  type DealEventDto,
  type PriceListDto,
  type ProductCategoryDto,
  type QuoteDto,
  type QuoteLineDto,
  type QuoteVersionDiffDto,
  type QuoteVersionDto,
  type QuoteProductPickerPageDto,
  type RecommendationDto,
  type SubscriptionPlanDto,
  type UpdateQuoteRequest,
  type WarehouseDto,
} from "@repo/common";
import {
  Badge,
  Button,
  ButtonLink,
  Dialog,
  ErrorFeedback,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  InlineFeedback,
  Input,
  LiveRegion,
  PageHeader,
  Panel,
  PanelBody,
  PanelDescription,
  PanelFooter,
  PanelHeader,
  PanelTitle,
  Select,
  Tabs,
  Textarea,
} from "@repo/ui";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

import { useOrganizationFormatting } from "../../components/foundation/organization-formatting";
import { ApiProblemError, browserApiRequest } from "../../lib/api/browser";
import { useIdempotencyKey } from "../shared/use-idempotency-key";
import { ProductBrowser } from "./product-browser";
import { DealTimeline } from "./deal-timeline";
import { QuoteLineEditor, type LinePatch } from "./quote-line-editor";
import { QuoteRiskPanel } from "./quote-risk-panel";
import { UpsellPanel } from "./upsell-panel";
import { VersionHistory } from "./version-history";

const QuoteVersionsSchema = z.array(QuoteVersionDtoSchema);

type SaveState = "Saved" | "Saving" | "Calculating" | "Conflict" | "Invalid";

interface LineUpdateConflict {
  kind: "line-update";
  lineId: string;
  patch: LinePatch;
  server: QuoteDto;
}

interface DetailsConflict {
  kind: "details";
  patch: Omit<UpdateQuoteRequest, "revision">;
  server: QuoteDto;
}

interface AddLineConflict {
  input: AddQuoteLineRequest;
  kind: "line-add";
  server: QuoteDto;
}

interface RemoveLineConflict {
  kind: "line-remove";
  line: QuoteLineDto;
  server: QuoteDto;
}

type QuoteConflict =
  AddLineConflict | DetailsConflict | LineUpdateConflict | RemoveLineConflict;

type PendingConflict =
  | Omit<AddLineConflict, "server">
  | Omit<DetailsConflict, "server">
  | Omit<LineUpdateConflict, "server">
  | Omit<RemoveLineConflict, "server">;

function problemMessage(error: unknown): string {
  if (error instanceof ApiProblemError) {
    return error.problem.detail ?? error.problem.title;
  }
  if (error instanceof Error) return error.message;
  return "The quotation could not be updated. Refresh and try again.";
}

function quoteTone(stage: QuoteDto["stage"]) {
  if (stage === "CONFIRMED") return "success" as const;
  if (stage === "PENDING_APPROVAL" || stage === "REVISION_REQUIRED") {
    return "warning" as const;
  }
  if (stage === "CANCELLED" || stage === "EXPIRED") return "danger" as const;
  return "neutral" as const;
}

function saveTone(state: SaveState) {
  if (state === "Conflict" || state === "Invalid") return "danger" as const;
  if (state === "Saved") return "success" as const;
  return "info" as const;
}

function mergeCalculation(
  quote: QuoteDto,
  calculation: z.infer<typeof QuoteCalculationResponseSchema>,
): QuoteDto {
  return QuoteDtoSchema.parse({
    ...quote,
    currentRevision: calculation.revision,
    marginPercent: calculation.totals.marginPercent,
    revision: calculation.revision,
    riskLevel: calculation.riskAssessment.riskLevel,
    total: calculation.totals.total,
    currentVersion: {
      ...quote.currentVersion,
      id: calculation.versionId,
      lines: calculation.lines,
      riskAssessment: calculation.riskAssessment,
      totals: calculation.totals,
    },
  });
}

function conflictValue(
  line: QuoteLineDto | undefined,
  field: keyof LinePatch,
): string {
  if (!line) return "Line removed on server";
  const value = line[field as keyof QuoteLineDto];
  return value === null || value === undefined ? "Not set" : String(value);
}

function fieldLabel(field: string): string {
  return formatEnumLabel(
    field.replaceAll(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase(),
  );
}

function QuoteDetailsEditor({
  busy,
  customers,
  onSave,
  quote,
}: {
  busy: boolean;
  customers: Array<{ id: string; name: string }>;
  onSave: (input: Omit<UpdateQuoteRequest, "revision">) => Promise<void>;
  quote: QuoteDto;
}) {
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    const parsed = UpdateQuoteRequestSchema.safeParse({
      revision: quote.revision,
      customerAccountId: formData.get("customerAccountId"),
      currency: formData.get("currency"),
      notes: String(formData.get("notes") ?? "").trim() || null,
      paymentTermsDays: Number(formData.get("paymentTermsDays")),
    });
    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ?? "Check the commercial details.",
      );
      return;
    }
    setError("");
    try {
      await onSave({
        currency: parsed.data.currency,
        customerAccountId: parsed.data.customerAccountId,
        notes: parsed.data.notes,
        paymentTermsDays: parsed.data.paymentTermsDays,
      });
    } catch (caught) {
      setError(problemMessage(caught));
    }
  }

  return (
    <Panel>
      <PanelHeader>
        <div>
          <PanelTitle>Quotation Details</PanelTitle>
          <PanelDescription>
            Customer, currency, terms, and internal context for this revision.
          </PanelDescription>
        </div>
      </PanelHeader>
      <form
        key={quote.revision}
        onSubmit={(event) => {
          event.preventDefault();
          void submit(new FormData(event.currentTarget));
        }}
      >
        <PanelBody>
          <FieldGroup className="md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="quote-customer">Customer</FieldLabel>
              <Select
                defaultValue={quote.customerAccountId}
                disabled={busy}
                id="quote-customer"
                name="customerAccountId"
              >
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="quote-currency">Currency</FieldLabel>
              <Input
                autoComplete="off"
                defaultValue={quote.currency}
                disabled={busy}
                id="quote-currency"
                maxLength={3}
                name="currency"
                spellCheck={false}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="quote-payment-terms">
                Payment Terms in Days
              </FieldLabel>
              <Input
                autoComplete="off"
                defaultValue={quote.currentVersion.paymentTermsDays}
                disabled={busy}
                id="quote-payment-terms"
                inputMode="numeric"
                max={365}
                min={0}
                name="paymentTermsDays"
                type="number"
              />
            </Field>
            <Field className="md:col-span-2">
              <FieldLabel htmlFor="quote-notes">Internal Notes</FieldLabel>
              <Textarea
                autoComplete="off"
                defaultValue={quote.currentVersion.notes ?? ""}
                disabled={busy}
                id="quote-notes"
                name="notes"
                placeholder="Add context for approvers…"
              />
              <FieldDescription>
                Customer portal responses exclude these internal notes.
              </FieldDescription>
            </Field>
          </FieldGroup>
          {error ? <FieldError className="mt-sm">{error}</FieldError> : null}
        </PanelBody>
        <PanelFooter>
          <Button
            disabled={busy}
            size="compact"
            type="submit"
            variant="secondary"
          >
            Save Details
          </Button>
        </PanelFooter>
      </form>
    </Panel>
  );
}

export interface QuoteBuilderProps {
  canConfirm: boolean;
  canEdit: boolean;
  canSend: boolean;
  canSubmit: boolean;
  categories: ProductCategoryDto[];
  customers: Array<{ id: string; name: string }>;
  initialDiff?: QuoteVersionDiffDto;
  initialQuote: QuoteDto;
  initialProductPage: QuoteProductPickerPageDto;
  initialRecommendations: RecommendationDto[];
  initialTimeline?: CursorPage<DealEventDto>;
  initialVersions: QuoteVersionDto[];
  plans: SubscriptionPlanDto[];
  priceLists: PriceListDto[];
  timeZone: string;
  warehouses: WarehouseDto[];
}

export function QuoteBuilder({
  canConfirm,
  canEdit,
  canSend,
  canSubmit,
  categories,
  customers,
  initialDiff,
  initialQuote,
  initialProductPage,
  initialRecommendations,
  initialTimeline,
  initialVersions,
  plans,
  priceLists,
  timeZone,
  warehouses,
}: QuoteBuilderProps) {
  const { locale } = useOrganizationFormatting();
  const router = useRouter();
  const confirmKey = useIdempotencyKey();
  const [activePanel, setActivePanel] = useState("lines");
  const [busy, setBusy] = useState(false);
  const [confirmOrderOpen, setConfirmOrderOpen] = useState(false);
  const [conflict, setConflict] = useState<QuoteConflict | null>(null);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [quote, setQuote] = useState(initialQuote);
  const [recommendations, setRecommendations] = useState(
    initialRecommendations,
  );
  const [removeTarget, setRemoveTarget] = useState<QuoteLineDto | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("Saved");
  const [versions, setVersions] = useState(initialVersions);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const quoteRef = useRef(initialQuote);
  const requestNumberRef = useRef(0);

  useEffect(() => {
    quoteRef.current = quote;
  }, [quote]);

  const applyQuote = useCallback((nextQuote: QuoteDto) => {
    quoteRef.current = nextQuote;
    setQuote(nextQuote);
  }, []);

  const refreshVersions = useCallback(async () => {
    const nextVersions = await browserApiRequest(
      planApiRoutes.quotes.versions(quoteRef.current.id),
      { schema: QuoteVersionsSchema, scope: "internal" },
    );
    setVersions(nextVersions);
  }, []);

  const calculate = useCallback(
    async (source: QuoteDto): Promise<QuoteDto> => {
      const requestNumber = requestNumberRef.current + 1;
      requestNumberRef.current = requestNumber;
      setSaveState("Calculating");
      const calculation = await browserApiRequest(
        apiRoutes.quotes.calculate(source.id),
        {
          json: {
            clientRequestNumber: requestNumber,
            revision: source.revision,
          },
          method: "POST",
          schema: QuoteCalculationResponseSchema,
          scope: "internal",
        },
      );
      if (calculation.clientRequestNumber !== requestNumberRef.current) {
        return quoteRef.current;
      }
      const nextQuote = mergeCalculation(source, calculation);
      applyQuote(nextQuote);
      return nextQuote;
    },
    [applyQuote],
  );

  const enqueue = useCallback((operation: () => Promise<void>) => {
    const next = queueRef.current.then(operation, operation);
    queueRef.current = next.catch(() => undefined);
    return next;
  }, []);

  const afterMaterialChange = useCallback(
    async (updated: QuoteDto, successMessage: string) => {
      applyQuote(updated);
      const calculated = await calculate(updated);
      let nextMessage = successMessage;
      try {
        await refreshVersions();
      } catch {
        nextMessage = `${successMessage} Version history will refresh when this page reloads.`;
      }
      setSaveState("Saved");
      setMessage(nextMessage);
      setProblem("");
      return calculated;
    },
    [applyQuote, calculate, refreshVersions],
  );

  const handleFailure = useCallback(
    async (error: unknown, pending?: PendingConflict): Promise<boolean> => {
      if (
        error instanceof ApiProblemError &&
        error.problem.code === "REVISION_CONFLICT"
      ) {
        const server = await browserApiRequest(
          apiRoutes.quotes.detail(quoteRef.current.id),
          { schema: QuoteDtoSchema, scope: "internal" },
        );
        setSaveState("Conflict");
        setProblem(
          "Another request changed this quotation. Compare the pending values with the current server version.",
        );
        if (pending) setConflict({ ...pending, server });
        else applyQuote(server);
        return true;
      }
      setSaveState("Invalid");
      setProblem(problemMessage(error));
      return false;
    },
    [applyQuote],
  );

  const updateLine = useCallback(
    (lineId: string, patch: LinePatch) =>
      enqueue(async () => {
        setBusy(true);
        setSaveState("Saving");
        setMessage("");
        try {
          const input = UpdateQuoteLineRequestSchema.parse({
            ...patch,
            revision: quoteRef.current.revision,
          });
          const updated = await browserApiRequest(
            planApiRoutes.quotes.line(quoteRef.current.id, lineId),
            {
              json: input,
              method: "PATCH",
              schema: QuoteDtoSchema,
              scope: "internal",
            },
          );
          await afterMaterialChange(
            updated,
            "Line saved and totals recalculated.",
          );
        } catch (error) {
          const conflicted = await handleFailure(error, {
            kind: "line-update",
            lineId,
            patch,
          });
          if (!conflicted) {
            throw new Error(problemMessage(error), { cause: error });
          }
        } finally {
          setBusy(false);
        }
      }),
    [afterMaterialChange, enqueue, handleFailure],
  );

  const saveDetails = useCallback(
    (patch: Omit<UpdateQuoteRequest, "revision">) =>
      enqueue(async () => {
        setBusy(true);
        setSaveState("Saving");
        try {
          const input = UpdateQuoteRequestSchema.parse({
            ...patch,
            revision: quoteRef.current.revision,
          });
          const updated = await browserApiRequest(
            planApiRoutes.quotes.update(quoteRef.current.id),
            {
              json: input,
              method: "PATCH",
              schema: QuoteDtoSchema,
              scope: "internal",
            },
          );
          await afterMaterialChange(updated, "Quotation details saved.");
        } catch (error) {
          const conflicted = await handleFailure(error, {
            kind: "details",
            patch,
          });
          if (!conflicted) {
            throw new Error(problemMessage(error), { cause: error });
          }
        } finally {
          setBusy(false);
        }
      }),
    [afterMaterialChange, enqueue, handleFailure],
  );

  const addLine = useCallback(
    (input: AddQuoteLineRequest) =>
      enqueue(async () => {
        setBusy(true);
        setSaveState("Saving");
        try {
          const payload = AddQuoteLineRequestSchema.parse({
            ...input,
            revision: quoteRef.current.revision,
          });
          const updated = await browserApiRequest(
            apiRoutes.quotes.lines(quoteRef.current.id),
            {
              json: payload,
              method: "POST",
              schema: QuoteDtoSchema,
              scope: "internal",
            },
          );
          await afterMaterialChange(
            updated,
            "Product added and totals recalculated.",
          );
        } catch (error) {
          const conflicted = await handleFailure(error, {
            input,
            kind: "line-add",
          });
          if (!conflicted) {
            throw new Error(problemMessage(error), { cause: error });
          }
        } finally {
          setBusy(false);
        }
      }),
    [afterMaterialChange, enqueue, handleFailure],
  );

  const removeLine = useCallback(
    (line: QuoteLineDto) =>
      enqueue(async () => {
        setBusy(true);
        setSaveState("Saving");
        try {
          const updated = await browserApiRequest(
            planApiRoutes.quotes.line(quoteRef.current.id, line.id),
            {
              json: { revision: quoteRef.current.revision },
              method: "DELETE",
              schema: QuoteDtoSchema,
              scope: "internal",
            },
          );
          setRemoveTarget(null);
          await afterMaterialChange(updated, `${line.productName} removed.`);
        } catch (error) {
          const conflicted = await handleFailure(error, {
            kind: "line-remove",
            line,
          });
          if (conflicted) setRemoveTarget(null);
        } finally {
          setBusy(false);
        }
      }),
    [afterMaterialChange, enqueue, handleFailure],
  );

  async function addRecommendation(recommendation: RecommendationDto) {
    setBusy(true);
    setSaveState("Saving");
    try {
      const updated = await browserApiRequest(
        apiRoutes.quotes.addRecommendation(quote.id, recommendation.productId),
        {
          json: {
            quantity: recommendation.suggestedQuantity,
            revision: quoteRef.current.revision,
          },
          method: "POST",
          schema: QuoteDtoSchema,
          scope: "internal",
        },
      );
      setRecommendations((current) =>
        current.filter((item) => item.productId !== recommendation.productId),
      );
      await afterMaterialChange(
        updated,
        `${recommendation.productName} added.`,
      );
    } catch (error) {
      await handleFailure(error);
    } finally {
      setBusy(false);
    }
  }

  async function dismissRecommendation(recommendation: RecommendationDto) {
    const previous = recommendations;
    setRecommendations((current) =>
      current.filter((item) => item.productId !== recommendation.productId),
    );
    setMessage(`${recommendation.productName} dismissed.`);
    try {
      await browserApiRequest(
        apiRoutes.quotes.dismissRecommendation(
          quote.id,
          recommendation.productId,
        ),
        {
          json: { interaction: "DISMISSAL", quoteRevision: quote.revision },
          method: "POST",
          schema: RecommendationInteractionDtoSchema,
          scope: "internal",
        },
      );
    } catch (error) {
      setRecommendations(previous);
      setProblem(problemMessage(error));
    }
  }

  async function runCommand(command: "send" | "submit") {
    if (busy) return;
    setBusy(true);
    setMessage("");
    setProblem("");
    try {
      if (command === "submit") {
        const result = await browserApiRequest(
          apiRoutes.quotes.submit(quote.id),
          {
            json: { revision: quoteRef.current.revision },
            method: "POST",
            schema: QuoteSubmitResponseSchema,
            scope: "internal",
          },
        );
        applyQuote(result.quote);
        setMessage(
          result.autoApproved
            ? "Quotation submitted and cleared without an approval route."
            : "Quotation submitted to the required approval route.",
        );
      } else {
        const updated = await browserApiRequest(
          planApiRoutes.quotes.send(quote.id),
          {
            json: { revision: quoteRef.current.revision },
            method: "POST",
            schema: QuoteDtoSchema,
            scope: "internal",
          },
        );
        applyQuote(updated);
        setMessage("Quotation marked as sent.");
      }
      try {
        await refreshVersions();
      } catch {
        setMessage(
          (current) =>
            `${current} Version history will refresh when this page reloads.`,
        );
      }
    } catch (error) {
      await handleFailure(error);
    } finally {
      setBusy(false);
    }
  }

  async function confirmOrder() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    setProblem("");
    const payload = ConfirmOrderRequestSchema.parse({
      revision: quoteRef.current.revision,
    });
    try {
      const order = await browserApiRequest(
        apiRoutes.orders.confirmQuote(quoteRef.current.id),
        {
          headers: confirmKey.headersFor(payload),
          json: payload,
          method: "POST",
          schema: OrderDtoSchema,
          scope: "internal",
        },
      );
      confirmKey.clear();
      setConfirmOrderOpen(false);
      router.push(`/orders/${order.id}/fulfillment`);
    } catch (error) {
      setConfirmOrderOpen(false);
      await handleFailure(error);
    } finally {
      setBusy(false);
    }
  }

  function useServerConflictVersion() {
    if (!conflict) return;
    applyQuote(conflict.server);
    setConflict(null);
    setProblem("");
    setSaveState("Saved");
  }

  function retryConflictChanges() {
    if (!conflict) return;
    const pending = conflict;
    applyQuote(pending.server);
    setConflict(null);
    setProblem("");
    if (pending.kind === "line-update") {
      void updateLine(pending.lineId, pending.patch);
    } else if (pending.kind === "details") {
      void saveDetails(pending.patch);
    } else if (pending.kind === "line-add") {
      void addLine(pending.input);
    } else {
      void removeLine(pending.line);
    }
  }

  function linePanel() {
    return (
      <div className="grid gap-md">
        <QuoteDetailsEditor
          busy={busy || !canEdit}
          customers={customers}
          onSave={saveDetails}
          quote={quote}
        />
        <Panel>
          <PanelHeader>
            <div>
              <PanelTitle>Quotation Lines</PanelTitle>
              <PanelDescription>
                Changes save after a short pause, then the API recalculates
                totals and policy facts.
              </PanelDescription>
            </div>
          </PanelHeader>
          <PanelBody>
            <QuoteLineEditor
              currency={quote.currency}
              disabled={busy || !canEdit}
              lines={quote.currentVersion.lines}
              onPatch={updateLine}
              onRemove={setRemoveTarget}
              plans={plans}
            />
          </PanelBody>
        </Panel>
      </div>
    );
  }

  function contextPanel() {
    return (
      <div className="grid gap-md">
        <QuoteRiskPanel quote={quote} />
        <UpsellPanel
          busy={busy || !canEdit}
          currency={quote.currency}
          onAdd={(recommendation) => void addRecommendation(recommendation)}
          onDismiss={(recommendation) =>
            void dismissRecommendation(recommendation)
          }
          recommendations={recommendations}
        />
      </div>
    );
  }

  const saveLabel =
    saveState === "Saving"
      ? "Saving…"
      : saveState === "Calculating"
        ? "Calculating…"
        : saveState;

  return (
    <div className="grid gap-lg">
      <PageHeader
        actions={
          <>
            <ButtonLink href="/quotations" variant="secondary">
              Back to Quotations
            </ButtonLink>
            {canSubmit &&
            (quote.stage === "DRAFT" || quote.stage === "REVISION_REQUIRED") ? (
              <Button
                disabled={busy || quote.currentVersion.lines.length === 0}
                onClick={() => void runCommand("submit")}
              >
                {busy ? "Submitting…" : "Submit for Review"}
              </Button>
            ) : null}
            {canSend && quote.stage === "READY_TO_SEND" ? (
              <Button disabled={busy} onClick={() => void runCommand("send")}>
                {busy ? "Sharing…" : "Share in Customer Portal"}
              </Button>
            ) : null}
            {canConfirm && quote.stage === "CUSTOMER_ACCEPTED" ? (
              <Button disabled={busy} onClick={() => setConfirmOrderOpen(true)}>
                Confirm Order
              </Button>
            ) : null}
          </>
        }
        description={`${quote.customerName} · Owned by ${quote.ownerName}`}
        metadata={
          <span className="flex flex-wrap items-center gap-xs">
            <Badge tone={quoteTone(quote.stage)}>
              {formatEnumLabel(quote.stage)}
            </Badge>
            <Badge tone={saveTone(saveState)}>{saveLabel}</Badge>
            <span className="font-mono">Revision {quote.currentRevision}</span>
          </span>
        }
        title={quote.quoteNumber}
      />

      <LiveRegion message={problem || message || saveLabel} />
      {problem ? (
        <ErrorFeedback title="Quotation Needs Attention">
          {problem}
        </ErrorFeedback>
      ) : null}
      {message ? (
        <InlineFeedback tone="success">{message}</InlineFeedback>
      ) : null}
      {quote.approvalStatus === "SUPERSEDED" ||
      quote.stage === "REVISION_REQUIRED" ? (
        <InlineFeedback title="Approval Invalidated" tone="warning">
          Material terms changed after an earlier decision. Submit the current
          quotation for approval before sharing or confirming.
        </InlineFeedback>
      ) : null}

      <div className="xl:hidden">
        <Tabs
          items={[
            {
              content: (
                <ProductBrowser
                  categories={categories}
                  disabled={busy || !canEdit}
                  initialPage={initialProductPage}
                  onAdd={addLine}
                  plans={plans}
                  priceLists={priceLists}
                  quoteId={quote.id}
                  warehouses={warehouses}
                />
              ),
              label: "Products",
              value: "products",
            },
            { content: linePanel(), label: "Lines", value: "lines" },
            { content: contextPanel(), label: "Review", value: "review" },
          ]}
          label="Quotation builder panels"
          onValueChange={setActivePanel}
          value={activePanel}
        />
      </div>

      <div className="hidden gap-md xl:grid xl:grid-cols-4">
        <ProductBrowser
          categories={categories}
          disabled={busy || !canEdit}
          initialPage={initialProductPage}
          onAdd={addLine}
          plans={plans}
          priceLists={priceLists}
          quoteId={quote.id}
          warehouses={warehouses}
        />
        <div className="min-w-0 xl:col-span-2">{linePanel()}</div>
        <div className="min-w-0">{contextPanel()}</div>
      </div>

      <VersionHistory
        initialDiff={initialDiff}
        quoteId={quote.id}
        timeZone={timeZone}
        versions={versions}
      />

      <DealTimeline
        initialPage={initialTimeline}
        quoteId={quote.id}
        refreshRevision={quote.revision}
        timeZone={timeZone}
      />

      <Dialog
        description="This converts the customer-accepted quotation into an order using the prices, quantities, and terms the customer accepted."
        footer={
          <>
            <Button
              disabled={busy}
              onClick={() => setConfirmOrderOpen(false)}
              variant="quiet"
            >
              Keep as Quotation
            </Button>
            <Button disabled={busy} onClick={() => void confirmOrder()}>
              {busy ? "Confirming…" : "Confirm Order"}
            </Button>
          </>
        }
        onOpenChange={(open) => {
          if (!busy) setConfirmOrderOpen(open);
        }}
        open={confirmOrderOpen}
        title="Confirm Customer-Accepted Order?"
      >
        <dl className="m-0 grid grid-cols-2 gap-sm text-body-sm">
          <div>
            <dt className="text-foreground-muted">Quotation</dt>
            <dd className="m-0 font-mono text-foreground-strong">
              {quote.quoteNumber}
            </dd>
          </div>
          <div>
            <dt className="text-foreground-muted">Current Total</dt>
            <dd className="m-0 font-mono tabular-nums text-foreground-strong">
              {formatMoney(quote.total, quote.currency, locale)}
            </dd>
          </div>
          <div>
            <dt className="text-foreground-muted">Customer</dt>
            <dd className="m-0 text-foreground-strong">{quote.customerName}</dd>
          </div>
          <div>
            <dt className="text-foreground-muted">Revision</dt>
            <dd className="m-0 font-mono tabular-nums text-foreground-strong">
              {quote.currentRevision}
            </dd>
          </div>
        </dl>
      </Dialog>

      <Dialog
        description="Removing this product creates a new commercial version and requires the updated quotation to be reviewed again."
        footer={
          <>
            <Button onClick={() => setRemoveTarget(null)} variant="quiet">
              Keep Line
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                if (removeTarget) void removeLine(removeTarget);
              }}
              variant="danger"
            >
              {busy ? "Removing Line…" : "Remove Line"}
            </Button>
          </>
        }
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        open={removeTarget !== null}
        title="Remove Quotation Line?"
      >
        <p className="m-0 text-body-sm text-foreground">
          {removeTarget
            ? `${removeTarget.productName} will be removed from the current draft.`
            : "The selected line will be removed."}
        </p>
      </Dialog>

      <Dialog
        description="Review the pending values against the latest server values before resolving the revision conflict."
        footer={
          <>
            <Button onClick={useServerConflictVersion} variant="secondary">
              Use Server Version
            </Button>
            <Button
              disabled={
                conflict?.kind === "line-remove" &&
                !conflict.server.currentVersion.lines.some(
                  (line) => line.id === conflict.line.id,
                )
              }
              onClick={retryConflictChanges}
            >
              Retry My Changes
            </Button>
          </>
        }
        onOpenChange={(open) => {
          if (!open) setConflict(null);
        }}
        open={conflict !== null}
        title="Resolve Editing Conflict"
      >
        {conflict?.kind === "line-update" ? (
          <div className="grid gap-xs">
            {Object.entries(conflict.patch).map(([field, localValue]) => {
              const serverLine = conflict.server.currentVersion.lines.find(
                (line) => line.id === conflict.lineId,
              );
              return (
                <div
                  className="grid gap-xs rounded-control border border-border p-sm sm:grid-cols-3"
                  key={field}
                >
                  <strong className="text-caption text-foreground-strong">
                    {fieldLabel(field)}
                  </strong>
                  <span className="break-words text-caption text-foreground">
                    Server:{" "}
                    {conflictValue(serverLine, field as keyof LinePatch)}
                  </span>
                  <span className="break-words text-caption text-foreground">
                    Yours:{" "}
                    {localValue === null ? "Not set" : String(localValue)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : conflict?.kind === "details" ? (
          <div className="grid gap-xs">
            {[
              {
                label: "Customer",
                server: conflict.server.customerName,
                yours:
                  customers.find(
                    (customer) =>
                      customer.id === conflict.patch.customerAccountId,
                  )?.name ?? conflict.patch.customerAccountId,
              },
              {
                label: "Currency",
                server: conflict.server.currency,
                yours: conflict.patch.currency ?? conflict.server.currency,
              },
              {
                label: "Payment Terms",
                server: `${conflict.server.currentVersion.paymentTermsDays} days`,
                yours: `${conflict.patch.paymentTermsDays ?? conflict.server.currentVersion.paymentTermsDays} days`,
              },
              {
                label: "Internal Notes",
                server: conflict.server.currentVersion.notes ?? "Not set",
                yours: conflict.patch.notes ?? "Not set",
              },
            ].map((entry) => (
              <div
                className="grid gap-xs rounded-control border border-border p-sm sm:grid-cols-3"
                key={entry.label}
              >
                <strong className="text-caption text-foreground-strong">
                  {entry.label}
                </strong>
                <span className="break-words text-caption text-foreground">
                  Server: {entry.server}
                </span>
                <span className="break-words text-caption text-foreground">
                  Yours: {entry.yours}
                </span>
              </div>
            ))}
          </div>
        ) : conflict?.kind === "line-add" ? (
          <dl className="m-0 grid grid-cols-2 gap-xs rounded-control border border-border p-sm text-caption">
            <dt className="text-foreground-muted">Server Revision</dt>
            <dd className="m-0 font-mono tabular-nums text-foreground-strong">
              {conflict.server.currentRevision}
            </dd>
            <dt className="text-foreground-muted">Product</dt>
            <dd className="m-0 break-all font-mono text-foreground-strong">
              {conflict.input.productId}
            </dd>
            <dt className="text-foreground-muted">Quantity</dt>
            <dd className="m-0 font-mono tabular-nums text-foreground-strong">
              {conflict.input.quantity}
            </dd>
            <dt className="text-foreground-muted">Requested Price</dt>
            <dd className="m-0 font-mono tabular-nums text-foreground-strong">
              {conflict.input.unitPrice
                ? formatMoney(
                    conflict.input.unitPrice,
                    conflict.server.currency,
                    locale,
                  )
                : "Use server-resolved price"}
            </dd>
            <dt className="text-foreground-muted">Discount</dt>
            <dd className="m-0 font-mono tabular-nums text-foreground-strong">
              {formatPercentage(conflict.input.discountPercent, locale)}
            </dd>
          </dl>
        ) : conflict?.kind === "line-remove" ? (
          <div className="grid gap-xs rounded-control border border-border p-sm text-body-sm">
            <strong className="text-foreground-strong">
              Remove {conflict.line.productName}
            </strong>
            <p className="m-0 text-foreground-muted">
              {conflict.server.currentVersion.lines.some(
                (line) => line.id === conflict.line.id,
              )
                ? "The line still exists on the latest server revision. Review that revision, then retry removal if it remains correct."
                : "The line was already removed on the server. Use the server version to continue."}
            </p>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
