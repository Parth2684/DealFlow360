"use client";

import {
  QUOTE_STAGES,
  QuoteDtoSchema,
  QuoteSubmitResponseSchema,
  UpdateQuoteStageRequestSchema,
  formatDateTime,
  formatEnumLabel,
  formatMoney,
  apiRoutes,
  planApiRoutes,
  type ApprovalRequestStatus,
  type CursorPage,
  type QuoteSavedFilterValue,
  type QuoteStage,
  type QuoteSummaryDto,
  type RiskLevel,
  type SavedReportFilterDto,
} from "@repo/common";
import {
  Badge,
  Button,
  ButtonLink,
  Dialog,
  EmptyState,
  Field,
  FieldLabel,
  InlineFeedback,
  Input,
  LiveRegion,
  PageHeader,
  Pagination,
  Select,
} from "@repo/ui";
import Link from "next/link";
import { useState, type DragEvent } from "react";

import { ApiProblemError, browserApiRequest } from "../../lib/api/browser";
import { QuoteSavedFilters } from "./quote-saved-filters";
import type { QuoteListFilters } from "./quotation-list";

function feedbackMessage(error: unknown): string {
  if (error instanceof ApiProblemError) {
    return error.problem.detail ?? error.problem.title;
  }
  if (error instanceof Error) return error.message;
  return "The stage change was not completed. Refresh the pipeline and try again.";
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

async function requestStageChange(
  quote: QuoteSummaryDto,
  target: QuoteStage,
): Promise<QuoteSummaryDto> {
  if (
    (quote.stage === "DRAFT" || quote.stage === "REVISION_REQUIRED") &&
    (target === "PENDING_APPROVAL" || target === "READY_TO_SEND")
  ) {
    const result = await browserApiRequest(apiRoutes.quotes.submit(quote.id), {
      json: { revision: quote.currentRevision },
      method: "POST",
      schema: QuoteSubmitResponseSchema,
      scope: "internal",
    });
    return result.quote;
  }

  if (quote.stage === "READY_TO_SEND" && target === "SENT") {
    return browserApiRequest(planApiRoutes.quotes.send(quote.id), {
      json: { revision: quote.currentRevision },
      method: "POST",
      schema: QuoteDtoSchema,
      scope: "internal",
    });
  }

  if (
    target === "CANCELLED" ||
    (quote.stage === "SENT" && target === "UNDER_NEGOTIATION") ||
    (quote.stage === "UNDER_NEGOTIATION" && target === "SENT")
  ) {
    return browserApiRequest(planApiRoutes.quotes.transitionStage(quote.id), {
      json: UpdateQuoteStageRequestSchema.parse({
        revision: quote.currentRevision,
        stage: target,
      }),
      method: "PATCH",
      schema: QuoteDtoSchema,
      scope: "internal",
    });
  }

  throw new Error(
    `A quotation cannot move directly from ${formatEnumLabel(quote.stage)} to ${formatEnumLabel(target)}. Open the quotation to complete the required business action.`,
  );
}

export function PipelineBoard({
  canCreate,
  canEdit,
  canSend,
  canSubmit,
  filters,
  initialQuotes,
  initialSavedFilters,
  locale,
  nextHref,
  timeZone,
}: {
  canCreate: boolean;
  canEdit: boolean;
  canSend: boolean;
  canSubmit: boolean;
  filters: QuoteListFilters;
  initialQuotes: QuoteSummaryDto[];
  initialSavedFilters?: CursorPage<SavedReportFilterDto>;
  locale: string;
  nextHref?: string;
  timeZone: string;
}) {
  const [cancelTarget, setCancelTarget] = useState<QuoteSummaryDto | null>(
    null,
  );
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"danger" | "success">(
    "success",
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [quotes, setQuotes] = useState(initialQuotes);

  async function move(
    quote: QuoteSummaryDto,
    target: QuoteStage,
    confirmed = false,
  ) {
    if (pendingId) return;
    if (target === "CANCELLED" && !confirmed) {
      setCancelTarget(quote);
      setDraggedId(null);
      return;
    }
    setPendingId(quote.id);
    setMessage(`Updating ${quote.quoteNumber}…`);
    setMessageTone("success");
    try {
      const updated = await requestStageChange(quote, target);
      setQuotes((current) =>
        current.map((candidate) =>
          candidate.id === updated.id ? updated : candidate,
        ),
      );
      setMessage(
        `${updated.quoteNumber} moved to ${formatEnumLabel(updated.stage)}.`,
      );
    } catch (error) {
      setMessageTone("danger");
      setMessage(feedbackMessage(error));
    } finally {
      setPendingId(null);
      setDraggedId(null);
    }
  }

  function dropOn(event: DragEvent<HTMLElement>, target: QuoteStage) {
    event.preventDefault();
    const quote = quotes.find((candidate) => candidate.id === draggedId);
    if (quote) void move(quote, target);
  }

  return (
    <div className="grid gap-lg">
      <PageHeader
        actions={
          canCreate ? (
            <ButtonLink href="/quotations/new" variant="primary">
              New Quotation
            </ButtonLink>
          ) : undefined
        }
        description="Review the full quote lifecycle. Drag supported transitions or use each card action for the keyboard-accessible path."
        metadata={`${quotes.length} quotations loaded`}
        title="Pipeline"
      />

      <form
        className="grid gap-sm border-b border-border pb-md sm:grid-cols-2 xl:grid-cols-5"
        method="get"
      >
        <Field className="xl:col-span-2">
          <FieldLabel htmlFor="pipeline-search">Search Pipeline</FieldLabel>
          <Input
            autoComplete="off"
            defaultValue={filters.search}
            id="pipeline-search"
            name="search"
            placeholder="Quote number or customer…"
            type="search"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="pipeline-stage">Stage</FieldLabel>
          <Select
            defaultValue={filters.stage ?? ""}
            id="pipeline-stage"
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
          <FieldLabel htmlFor="pipeline-sort">Sort By</FieldLabel>
          <Select
            defaultValue={filters.sort ?? "updatedAt"}
            id="pipeline-sort"
            name="sort"
          >
            <option value="updatedAt">Last Updated</option>
            <option value="createdAt">Created</option>
            <option value="total">Total</option>
            <option value="expiresAt">Expiration</option>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="pipeline-direction">Direction</FieldLabel>
          <Select
            defaultValue={filters.direction ?? "desc"}
            id="pipeline-direction"
            name="direction"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </Select>
        </Field>
        <div className="flex items-end gap-xs xl:col-start-5">
          <Button type="submit">Apply Filters</Button>
          <ButtonLink href="/pipeline" variant="quiet">
            Reset
          </ButtonLink>
        </div>
      </form>

      <QuoteSavedFilters
        currentFilters={filters satisfies QuoteSavedFilterValue}
        destinationPath="/pipeline"
        initialPage={initialSavedFilters}
      />

      <LiveRegion message={message} />
      {message ? (
        <InlineFeedback tone={messageTone}>{message}</InlineFeedback>
      ) : null}

      {quotes.length === 0 ? (
        <EmptyState
          action={
            filters.search ||
            filters.stage ||
            filters.sort ||
            filters.direction ? (
              <ButtonLink href="/pipeline" variant="secondary">
                Clear Filters
              </ButtonLink>
            ) : canCreate ? (
              <ButtonLink href="/quotations/new">Create Quotation</ButtonLink>
            ) : undefined
          }
          description={
            canCreate &&
            !filters.search &&
            !filters.stage &&
            !filters.sort &&
            !filters.direction
              ? "No quotations are available. Start a new quotation to populate the pipeline."
              : "No quotations match the current pipeline filters. Clear the filters to review the available pipeline."
          }
          title="No Pipeline Records"
        />
      ) : (
        <div
          aria-label="Quotation pipeline by stage"
          className="flex snap-x gap-md overflow-x-auto overscroll-x-contain pb-sm"
          role="region"
          tabIndex={0}
        >
          {QUOTE_STAGES.map((stage) => {
            const stageQuotes = quotes.filter((quote) => quote.stage === stage);
            return (
              <section
                aria-label={`${formatEnumLabel(stage)} quotations`}
                className="w-72 shrink-0 snap-start rounded-panel border border-border bg-surface-subtle"
                key={stage}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => dropOn(event, stage)}
              >
                <header className="flex items-center justify-between gap-xs border-b border-border px-sm py-xs">
                  <h2 className="m-0 text-body-sm font-semibold text-foreground-strong">
                    {formatEnumLabel(stage)}
                  </h2>
                  <Badge tone={stageTone(stage)}>{stageQuotes.length}</Badge>
                </header>
                <div className="grid gap-xs p-xs">
                  {stageQuotes.length === 0 ? (
                    <p className="m-0 rounded-control border border-dashed border-border-strong bg-surface px-sm py-md text-caption text-foreground-muted">
                      No quotations in this stage.
                    </p>
                  ) : (
                    stageQuotes.map((quote) => {
                      const canAdvance =
                        ((quote.stage === "DRAFT" ||
                          quote.stage === "REVISION_REQUIRED") &&
                          canSubmit) ||
                        (quote.stage === "READY_TO_SEND" && canSend) ||
                        (quote.stage === "SENT" && canEdit) ||
                        (quote.stage === "UNDER_NEGOTIATION" && canEdit);
                      const target =
                        quote.stage === "READY_TO_SEND"
                          ? ("SENT" as const)
                          : quote.stage === "SENT"
                            ? ("UNDER_NEGOTIATION" as const)
                            : quote.stage === "UNDER_NEGOTIATION"
                              ? ("SENT" as const)
                              : ("PENDING_APPROVAL" as const);
                      const canCancel =
                        canEdit &&
                        !["CONFIRMED", "EXPIRED", "CANCELLED"].includes(
                          quote.stage,
                        );
                      return (
                        <article
                          aria-describedby={`pipeline-${quote.id}-summary`}
                          className="grid cursor-grab gap-sm rounded-control border border-border bg-surface p-sm active:cursor-grabbing"
                          draggable={canAdvance && pendingId === null}
                          key={quote.id}
                          onDragEnd={() => setDraggedId(null)}
                          onDragStart={() => setDraggedId(quote.id)}
                        >
                          <div className="min-w-0">
                            <Link
                              className="font-mono text-caption font-semibold text-brand underline-offset-4 hover:underline"
                              href={`/quotations/${quote.id}`}
                            >
                              {quote.quoteNumber}
                            </Link>
                            <h3 className="m-0 truncate text-body-sm font-semibold text-foreground-strong">
                              {quote.customerName}
                            </h3>
                          </div>
                          <div
                            className="grid grid-cols-2 gap-xs text-caption"
                            id={`pipeline-${quote.id}-summary`}
                          >
                            <span className="text-foreground-muted">Value</span>
                            <span className="text-right font-mono tabular-nums text-foreground-strong">
                              {formatMoney(quote.total, quote.currency, locale)}
                            </span>
                            <span className="text-foreground-muted">Owner</span>
                            <span className="truncate text-right text-foreground-strong">
                              {quote.ownerName}
                            </span>
                            <span className="text-foreground-muted">
                              Approval
                            </span>
                            <Badge
                              className="justify-self-end"
                              tone={approvalTone(quote.approvalStatus)}
                            >
                              {quote.approvalStatus
                                ? formatEnumLabel(quote.approvalStatus)
                                : "Not Requested"}
                            </Badge>
                            <span className="text-foreground-muted">
                              Health
                            </span>
                            {quote.riskLevel ? (
                              <Badge
                                className="justify-self-end"
                                tone={healthTone(quote.riskLevel)}
                              >
                                {formatEnumLabel(quote.riskLevel)}
                              </Badge>
                            ) : (
                              <span className="text-right text-foreground-muted">
                                Not Calculated
                              </span>
                            )}
                            <span className="text-foreground-muted">
                              Updated
                            </span>
                            <time
                              className="text-right text-foreground-strong"
                              dateTime={quote.updatedAt}
                            >
                              {formatDateTime(
                                quote.updatedAt,
                                locale,
                                timeZone,
                              )}
                            </time>
                          </div>
                          {canAdvance || canCancel ? (
                            <div className="flex flex-wrap gap-xs">
                              {canAdvance ? (
                                <Button
                                  disabled={pendingId !== null}
                                  onClick={() => void move(quote, target)}
                                  size="compact"
                                  variant="secondary"
                                >
                                  {quote.stage === "READY_TO_SEND"
                                    ? "Share in Customer Portal"
                                    : quote.stage === "SENT"
                                      ? "Start Negotiation"
                                      : quote.stage === "UNDER_NEGOTIATION"
                                        ? "End Negotiation"
                                        : "Submit for Review"}
                                </Button>
                              ) : null}
                              {canCancel ? (
                                <Button
                                  disabled={pendingId !== null}
                                  onClick={() => void move(quote, "CANCELLED")}
                                  size="compact"
                                  variant="danger"
                                >
                                  Cancel
                                </Button>
                              ) : null}
                            </div>
                          ) : null}
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {quotes.length > 0 ? (
        <Pagination
          nextHref={nextHref}
          status={`${quotes.length} quotations in this page`}
        />
      ) : null}

      <Dialog
        description="This action closes open approvals and negotiation. It cannot be reversed from the pipeline."
        footer={
          <>
            <Button onClick={() => setCancelTarget(null)} variant="quiet">
              Keep Quotation
            </Button>
            <Button
              disabled={pendingId !== null}
              onClick={() => {
                const quote = cancelTarget;
                setCancelTarget(null);
                if (quote) void move(quote, "CANCELLED", true);
              }}
              variant="danger"
            >
              Cancel Quotation
            </Button>
          </>
        }
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
        open={cancelTarget !== null}
        size="compact"
        title={
          cancelTarget
            ? `Cancel ${cancelTarget.quoteNumber}?`
            : "Cancel Quotation?"
        }
      >
        <p className="m-0 text-body-sm text-foreground">
          The quotation will move to Cancelled and no longer be available for
          submission, sending, negotiation, or order confirmation.
        </p>
      </Dialog>
    </div>
  );
}
