"use client";

import {
  AssignApprovalDelegateRequestSchema,
  ApprovalDecisionRequestSchema,
  ApprovalRequestDtoSchema,
  ClearApprovalDelegateRequestSchema,
  apiRoutes,
  formatDateTime,
  formatEnumLabel,
  planApiRoutes,
  type AssignApprovalDelegateRequest,
  type ApprovalDecisionAction,
  type ApprovalRequestDto,
  type ApprovalStepDto,
  type ClearApprovalDelegateRequest,
  type QuoteDto,
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
  FieldLabel,
  InlineFeedback,
  Input,
  LiveRegion,
  PageHeader,
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
  Textarea,
  Timeline,
  TimelineItem,
} from "@repo/ui";
import { useEffect, useState } from "react";

import { useOrganizationFormatting } from "../../components/foundation/organization-formatting";
import { ApiProblemError, browserApiRequest } from "../../lib/api/browser";
import { QuoteRiskPanel } from "../quotations/quote-risk-panel";
import { ApprovalDeadline } from "./approval-deadline";

function problemMessage(error: unknown): string {
  if (error instanceof ApiProblemError) {
    return error.problem.detail ?? error.problem.title;
  }
  return "The approval action could not be completed. Refresh the approval and try again.";
}

function statusTone(status: string) {
  if (status === "APPROVED") return "success" as const;
  if (status === "REJECTED" || status === "SUPERSEDED")
    return "danger" as const;
  if (status === "ACTIVE" || status === "PENDING") return "warning" as const;
  return "neutral" as const;
}

function actionTitle(action: ApprovalDecisionAction) {
  if (action === "APPROVE") return "Approve Quotation?";
  if (action === "REJECT") return "Reject Quotation?";
  return "Return for Revision?";
}

function actionButton(action: ApprovalDecisionAction) {
  if (action === "APPROVE") return "Approve";
  if (action === "REJECT") return "Reject";
  return "Request Revision";
}

type DelegationMode = "assign" | "clear";

interface DelegationFieldErrors {
  delegateEmail?: string;
  expiresAt?: string;
  reason?: string;
}

function localDateTimeInputValue(value: Date): string {
  const localValue = new Date(
    value.getTime() - value.getTimezoneOffset() * 60_000,
  );
  return localValue.toISOString().slice(0, 16);
}

function defaultDelegationExpiry(): string {
  return localDateTimeInputValue(new Date(Date.now() + 24 * 60 * 60_000));
}

function delegationCountdown(expiresAt: string, now: number): string {
  const remainingMinutes = Math.ceil((Date.parse(expiresAt) - now) / 60_000);
  if (remainingMinutes <= 0) return "Expired";
  if (remainingMinutes === 1) return "Less than 1 minute remaining";
  if (remainingMinutes < 60) return `${remainingMinutes} minutes remaining`;

  const days = Math.floor(remainingMinutes / (24 * 60));
  const hours = Math.floor((remainingMinutes % (24 * 60)) / 60);
  const minutes = remainingMinutes % 60;
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m remaining`;
  }
  return `${hours}h ${minutes}m remaining`;
}

function delegationErrors(
  issues: readonly { message: string; path: readonly PropertyKey[] }[],
): DelegationFieldErrors {
  const errors: DelegationFieldErrors = {};
  for (const issue of issues) {
    if (issue.path[0] === "delegateEmail") {
      errors.delegateEmail ??= issue.message;
    } else if (issue.path[0] === "expiresAt") {
      errors.expiresAt ??= issue.message;
    } else if (issue.path[0] === "reason") {
      errors.reason ??= issue.message;
    }
  }
  return errors;
}

export function ApprovalWorkspace({
  canFinanceAct,
  canManagerAct,
  currentUserId,
  initialApproval,
  quote,
  timeZone,
}: {
  canFinanceAct: boolean;
  canManagerAct: boolean;
  currentUserId: string;
  initialApproval: ApprovalRequestDto;
  quote: QuoteDto;
  timeZone: string;
}) {
  const { locale } = useOrganizationFormatting();
  const [action, setAction] = useState<ApprovalDecisionAction | null>(null);
  const [approval, setApproval] = useState(initialApproval);
  const [comment, setComment] = useState("");
  const [clock, setClock] = useState(() => Date.now());
  const [delegateEmail, setDelegateEmail] = useState("");
  const [delegationProblem, setDelegationProblem] = useState("");
  const [delegationErrorsState, setDelegationErrorsState] =
    useState<DelegationFieldErrors>({});
  const [delegationExpiresAt, setDelegationExpiresAt] = useState("");
  const [delegationMode, setDelegationMode] = useState<DelegationMode | null>(
    null,
  );
  const [delegationReason, setDelegationReason] = useState("");
  const [delegationStep, setDelegationStep] = useState<ApprovalStepDto | null>(
    null,
  );
  const [fieldError, setFieldError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState("");
  const activeStep = approval.steps.find(
    (step) =>
      step.status === "ACTIVE" || step.sequence === approval.currentSequence,
  );
  const hasActiveAuthority =
    (approval.status === "PENDING" || approval.status === "IN_PROGRESS") &&
    !approval.termsChanged &&
    activeStep?.status === "ACTIVE" &&
    ((activeStep?.requiredRole === "SALES_MANAGER" && canManagerAct) ||
      (activeStep?.requiredRole === "FINANCE" && canFinanceAct));
  const activeDelegate = activeStep?.delegate;
  const currentUserIsDelegate = activeDelegate?.id === currentUserId;
  const currentUserIsActiveDelegate =
    activeDelegate !== null &&
    activeDelegate !== undefined &&
    activeDelegate.id === currentUserId &&
    Date.parse(activeDelegate.assignedAt) <= clock &&
    Date.parse(activeDelegate.expiresAt) > clock;
  const currentUserOwnsStep =
    activeStep?.assignee === null ||
    activeStep?.assignee?.id === currentUserId ||
    currentUserIsActiveDelegate;
  const canAct = hasActiveAuthority && currentUserOwnsStep;
  const canManageDelegation = hasActiveAuthority && activeStep !== undefined;

  useEffect(() => {
    if (!approval.steps.some((step) => step.delegate !== null)) return;
    const interval = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, [approval.steps]);

  function openAction(nextAction: ApprovalDecisionAction) {
    setAction(nextAction);
    setComment("");
    setFieldError("");
    setProblem("");
  }

  function openDelegation(nextMode: DelegationMode, step: ApprovalStepDto) {
    setDelegationMode(nextMode);
    setDelegationStep(step);
    setDelegateEmail(nextMode === "assign" ? (step.delegate?.email ?? "") : "");
    setDelegationExpiresAt(
      nextMode === "assign"
        ? step.delegate
          ? localDateTimeInputValue(new Date(step.delegate.expiresAt))
          : defaultDelegationExpiry()
        : "",
    );
    setDelegationReason("");
    setDelegationErrorsState({});
    setDelegationProblem("");
    setProblem("");
  }

  function closeDelegation() {
    setDelegationMode(null);
    setDelegationStep(null);
    setDelegationErrorsState({});
    setDelegationProblem("");
  }

  async function saveDelegation() {
    if (!delegationStep || !delegationMode) return;

    const mode = delegationMode;
    const step = delegationStep;
    setDelegationProblem("");
    const path = planApiRoutes.approvals.delegate(approval.id, step.id);
    let input: AssignApprovalDelegateRequest | ClearApprovalDelegateRequest;
    if (mode === "assign") {
      const expiry = new Date(delegationExpiresAt);
      if (Number.isNaN(expiry.getTime())) {
        setDelegationErrorsState({ expiresAt: "Choose a valid expiry time." });
        return;
      }
      const parsed = AssignApprovalDelegateRequestSchema.safeParse({
        delegateEmail,
        expiresAt: expiry.toISOString(),
        reason: delegationReason,
      });
      if (!parsed.success) {
        setDelegationErrorsState(delegationErrors(parsed.error.issues));
        return;
      }
      if (Date.parse(parsed.data.expiresAt) <= Date.now()) {
        setDelegationErrorsState({
          expiresAt: "Choose an expiry time in the future.",
        });
        return;
      }
      input = parsed.data;
    } else {
      const parsed = ClearApprovalDelegateRequestSchema.safeParse({
        reason: delegationReason,
      });
      if (!parsed.success) {
        setDelegationErrorsState(delegationErrors(parsed.error.issues));
        return;
      }
      input = parsed.data;
    }

    setPending(true);
    setDelegationProblem("");
    setMessage("");
    try {
      const updated = await browserApiRequest(path, {
        json: input,
        method: mode === "assign" ? "PUT" : "DELETE",
        schema: ApprovalRequestDtoSchema,
        scope: "internal",
      });
      setApproval(updated);
      setClock(Date.now());
      setMessage(
        mode === "assign"
          ? `Temporary approval authority assigned to ${updated.steps.find((candidate) => candidate.id === step.id)?.delegate?.name ?? "the delegate"}.`
          : "Temporary approval authority cleared.",
      );
      closeDelegation();
    } catch (error) {
      setDelegationProblem(problemMessage(error));
    } finally {
      setPending(false);
    }
  }

  async function decide() {
    if (!action) return;
    const parsed = ApprovalDecisionRequestSchema.safeParse({
      action,
      ...(comment.trim() ? { comment: comment.trim() } : {}),
    });
    if (!parsed.success) {
      setFieldError(
        parsed.error.issues[0]?.message ?? "Enter a reason for this decision.",
      );
      return;
    }
    setPending(true);
    setProblem("");
    setMessage("");
    try {
      const updated = await browserApiRequest(
        apiRoutes.approvals.decide(approval.id),
        {
          json: parsed.data,
          method: "POST",
          schema: ApprovalRequestDtoSchema,
          scope: "internal",
        },
      );
      setApproval(updated);
      setAction(null);
      setComment("");
      setMessage(`${actionButton(parsed.data.action)} decision recorded.`);
    } catch (error) {
      setProblem(problemMessage(error));
    } finally {
      setPending(false);
    }
  }

  const decisions = approval.steps
    .flatMap((step) => step.decisions.map((decision) => ({ decision, step })))
    .sort(
      (left, right) =>
        new Date(right.decision.createdAt).getTime() -
        new Date(left.decision.createdAt).getTime(),
    );

  return (
    <div className="grid gap-lg">
      <PageHeader
        actions={
          <>
            <ButtonLink href="/approvals" variant="secondary">
              Back to Approvals
            </ButtonLink>
            <ButtonLink href={`/quotations/${approval.quoteId}`}>
              Open Quotation
            </ButtonLink>
          </>
        }
        description={`${approval.quote.customerName} · ${formatEnumLabel(approval.quote.stage)}`}
        metadata={
          <span className="flex flex-wrap items-center gap-xs">
            <Badge tone={statusTone(approval.status)}>
              {formatEnumLabel(approval.status)}
            </Badge>
            <span className="font-mono">
              Revision {approval.quote.currentRevision}
            </span>
          </span>
        }
        title={`Approval ${approval.quote.quoteNumber}`}
      />

      <LiveRegion message={delegationProblem || problem || message} />
      {problem ? (
        <ErrorFeedback title="Approval Action Failed">{problem}</ErrorFeedback>
      ) : null}
      {message ? (
        <InlineFeedback tone="success">{message}</InlineFeedback>
      ) : null}
      {approval.termsChanged ? (
        <InlineFeedback title="Terms Changed After Submission" tone="danger">
          This request references an older fingerprint and cannot be approved.
          Open the current quotation and submit its latest commercial version.
        </InlineFeedback>
      ) : null}

      <div className="grid gap-md xl:grid-cols-2">
        <QuoteRiskPanel quote={quote} />

        <div className="grid content-start gap-md">
          <Panel>
            <PanelHeader>
              <div>
                <PanelTitle>Approval Route</PanelTitle>
                <PanelDescription>
                  Sequential steps activate only after the previous authority
                  approves.
                </PanelDescription>
              </div>
            </PanelHeader>
            <PanelBody>
              <ol className="m-0 grid list-none gap-sm p-0">
                {approval.steps.map((step) => (
                  <li
                    className="grid gap-xs rounded-control border border-border bg-surface-subtle p-sm"
                    key={step.id}
                  >
                    <div className="flex items-start justify-between gap-xs">
                      <strong className="text-body-sm text-foreground-strong">
                        {step.sequence}. {formatEnumLabel(step.requiredRole)}
                      </strong>
                      <Badge tone={statusTone(step.status)}>
                        {formatEnumLabel(step.status)}
                      </Badge>
                    </div>
                    <p className="m-0 break-words text-caption text-foreground-muted">
                      {step.assignee?.name ?? "Assigned by role"}
                      {step.delegate
                        ? `, delegated to ${step.delegate.name}`
                        : ""}
                    </p>
                    {step.delegate ? (
                      <div className="grid gap-xxs border-t border-border pt-xs text-caption text-foreground-muted">
                        <strong className="break-words text-foreground-strong">
                          {step.delegate.name} · {step.delegate.email}
                        </strong>
                        <span>
                          Expires{" "}
                          <time dateTime={step.delegate.expiresAt}>
                            {formatDateTime(
                              step.delegate.expiresAt,
                              locale,
                              timeZone,
                            )}
                          </time>{" "}
                          ·{" "}
                          {delegationCountdown(step.delegate.expiresAt, clock)}
                        </span>
                        <span>
                          Assigned by {step.delegate.assignedBy.name} on{" "}
                          <time dateTime={step.delegate.assignedAt}>
                            {formatDateTime(
                              step.delegate.assignedAt,
                              locale,
                              timeZone,
                            )}
                          </time>
                        </span>
                        <span className="break-words">
                          Reason: {step.delegate.reason}
                        </span>
                      </div>
                    ) : null}
                    {step.dueAt ? (
                      <div className="grid gap-xxs text-caption">
                        <span className="font-semibold text-foreground-strong">
                          Decision Due
                        </span>
                        {step.status === "ACTIVE" ? (
                          <ApprovalDeadline
                            dueAt={step.dueAt}
                            timeZone={timeZone}
                          />
                        ) : (
                          <time dateTime={step.dueAt}>
                            {formatDateTime(step.dueAt, locale, timeZone)}
                          </time>
                        )}
                      </div>
                    ) : null}
                    {canManageDelegation && activeStep?.id === step.id ? (
                      <div className="flex flex-wrap gap-xs border-t border-border pt-xs">
                        <Button
                          disabled={pending}
                          onClick={() => openDelegation("assign", step)}
                          size="compact"
                          variant="secondary"
                        >
                          {step.delegate
                            ? "Replace Delegate"
                            : "Assign Delegate"}
                        </Button>
                        {step.delegate ? (
                          <Button
                            disabled={pending}
                            onClick={() => openDelegation("clear", step)}
                            size="compact"
                            variant="quiet"
                          >
                            Clear Delegate
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>
              <div>
                <PanelTitle>Policy Matches</PanelTitle>
                <PanelDescription>
                  Versioned rules and stored facts that produced this route.
                </PanelDescription>
              </div>
            </PanelHeader>
            <PanelBody>
              <div className="grid gap-sm">
                {approval.policyMatches.map((match) => (
                  <details
                    className="rounded-control border border-border bg-surface-subtle px-sm py-xs"
                    key={match.policyId}
                  >
                    <summary className="cursor-pointer text-body-sm font-semibold text-foreground-strong">
                      {match.policyName}, Version {match.policyVersion}
                    </summary>
                    <p className="text-body-sm text-foreground">
                      {match.reason}
                    </p>
                    <pre className="m-0 overflow-x-auto whitespace-pre-wrap break-words font-mono text-caption text-foreground-muted">
                      {JSON.stringify(match.matchedFacts, null, 2)}
                    </pre>
                  </details>
                ))}
                {approval.policyMatches.length === 0 ? (
                  <InlineFeedback tone="neutral">
                    No stored policy match was attached to this request.
                  </InlineFeedback>
                ) : null}
              </div>
            </PanelBody>
          </Panel>
        </div>
      </div>

      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Decision</PanelTitle>
            <PanelDescription>
              Actions remain pending until the API records the immutable
              decision.
            </PanelDescription>
          </div>
        </PanelHeader>
        <PanelBody>
          {canAct ? (
            <div className="flex flex-wrap gap-xs">
              <Button disabled={pending} onClick={() => openAction("APPROVE")}>
                Approve
              </Button>
              <Button
                disabled={pending}
                onClick={() => openAction("REQUEST_REVISION")}
                variant="secondary"
              >
                Request Revision
              </Button>
              <Button
                disabled={pending}
                onClick={() => openAction("REJECT")}
                variant="danger"
              >
                Reject
              </Button>
            </div>
          ) : (
            <InlineFeedback tone="neutral">
              {approval.status !== "PENDING" &&
              approval.status !== "IN_PROGRESS"
                ? "This approval request is no longer awaiting a decision."
                : approval.termsChanged
                  ? "The changed fingerprint prevents decisions on this request."
                  : currentUserIsDelegate
                    ? "Your temporary delegation has expired. The assigned approver or another eligible authority can replace it."
                    : hasActiveAuthority && !currentUserOwnsStep
                      ? "This step is assigned to another approver. Only that user or an active temporary delegate can decide."
                      : "Your current role is not the active authority for this step."}
            </InlineFeedback>
          )}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Immutable Decision Timeline</PanelTitle>
            <PanelDescription>
              Actor, time, policy version, fingerprint, and recorded reason.
            </PanelDescription>
          </div>
        </PanelHeader>
        <PanelBody>
          {decisions.length > 0 ? (
            <Timeline aria-label="Approval decision history">
              {decisions.map(({ decision, step }) => (
                <TimelineItem
                  description={
                    decision.reason ?? "No optional comment recorded."
                  }
                  key={decision.id}
                  metadata={
                    <span className="grid gap-xxs break-all font-mono">
                      <span>
                        Policy step {step.sequence}, fingerprint{" "}
                        {approval.termsFingerprint}
                      </span>
                      <span>
                        Policy versions:{" "}
                        {approval.policyMatches.length > 0
                          ? approval.policyMatches
                              .map(
                                (match) =>
                                  `${match.policyName} v${match.policyVersion}`,
                              )
                              .join(", ")
                          : "No matched policy version"}
                      </span>
                    </span>
                  }
                  time={formatDateTime(decision.createdAt, locale, timeZone)}
                  timeProps={{ dateTime: decision.createdAt }}
                  title={`${formatEnumLabel(decision.action)} by ${decision.actorName}`}
                />
              ))}
            </Timeline>
          ) : (
            <InlineFeedback tone="neutral">
              No decision has been recorded for this request.
            </InlineFeedback>
          )}
        </PanelBody>
      </Panel>

      <Dialog
        description={
          action === "APPROVE"
            ? "The comment is optional. Approval applies only to this exact terms fingerprint."
            : "A clear reason is required and will be stored in the audit timeline."
        }
        footer={
          <>
            <Button onClick={() => setAction(null)} variant="quiet">
              Cancel
            </Button>
            <Button
              disabled={pending}
              onClick={() => void decide()}
              variant={action === "REJECT" ? "danger" : "primary"}
            >
              {pending
                ? "Recording Decision…"
                : action
                  ? actionButton(action)
                  : "Record Decision"}
            </Button>
          </>
        }
        onOpenChange={(open) => {
          if (!open) setAction(null);
        }}
        open={action !== null}
        title={action ? actionTitle(action) : "Record Decision"}
      >
        <Field>
          <FieldLabel htmlFor="approval-comment">
            {action === "APPROVE" ? "Comment" : "Reason"}
          </FieldLabel>
          <Textarea
            aria-describedby={
              fieldError ? "approval-comment-error" : "approval-comment-help"
            }
            aria-invalid={Boolean(fieldError)}
            autoComplete="off"
            id="approval-comment"
            name="approval-comment"
            onChange={(event) => setComment(event.target.value)}
            placeholder="Explain the decision…"
            value={comment}
          />
          <FieldDescription id="approval-comment-help">
            Keep the note factual so later reviewers can understand the
            decision.
          </FieldDescription>
          {fieldError ? (
            <FieldError id="approval-comment-error">{fieldError}</FieldError>
          ) : null}
        </Field>
      </Dialog>

      <Dialog
        description={
          delegationMode === "assign"
            ? "Authority applies only to this active step and automatically expires at the selected time."
            : "The delegate loses authority for this step immediately. A reason is recorded in the audit trail."
        }
        footer={
          <>
            <Button
              disabled={pending}
              onClick={closeDelegation}
              variant="quiet"
            >
              Cancel
            </Button>
            <Button
              disabled={pending || delegationStep === null}
              onClick={() => void saveDelegation()}
              variant={delegationMode === "clear" ? "danger" : "primary"}
            >
              {pending
                ? "Saving Delegation…"
                : delegationMode === "clear"
                  ? "Clear Delegate"
                  : "Assign Delegate"}
            </Button>
          </>
        }
        onOpenChange={(open) => {
          if (!open && !pending) closeDelegation();
        }}
        open={delegationMode !== null}
        title={
          delegationMode === "clear"
            ? "Clear Temporary Delegate?"
            : delegationStep?.delegate
              ? "Replace Temporary Delegate"
              : "Assign Temporary Delegate"
        }
      >
        <div className="grid gap-sm">
          {delegationProblem ? (
            <ErrorFeedback title="Delegation Was Not Saved">
              {delegationProblem}
            </ErrorFeedback>
          ) : null}
          {delegationMode === "clear" && delegationStep?.delegate ? (
            <InlineFeedback tone="warning">
              Clearing {delegationStep.delegate.name} removes their authority
              immediately, before the scheduled expiry.
            </InlineFeedback>
          ) : null}
          {delegationMode === "assign" ? (
            <>
              <Field>
                <FieldLabel htmlFor="delegate-email">Delegate Email</FieldLabel>
                <Input
                  aria-describedby={
                    delegationErrorsState.delegateEmail
                      ? "delegate-email-error"
                      : "delegate-email-help"
                  }
                  aria-invalid={Boolean(delegationErrorsState.delegateEmail)}
                  autoComplete="email"
                  id="delegate-email"
                  inputMode="email"
                  maxLength={254}
                  name="delegate-email"
                  onChange={(event) => {
                    setDelegateEmail(event.target.value);
                    setDelegationErrorsState((current) => ({
                      ...current,
                      delegateEmail: undefined,
                    }));
                  }}
                  placeholder="approver@example.com…"
                  type="email"
                  value={delegateEmail}
                />
                <FieldDescription id="delegate-email-help">
                  The user must be active and hold this step&apos;s role and
                  capability.
                </FieldDescription>
                {delegationErrorsState.delegateEmail ? (
                  <FieldError id="delegate-email-error">
                    {delegationErrorsState.delegateEmail}
                  </FieldError>
                ) : null}
              </Field>
              <Field>
                <FieldLabel htmlFor="delegate-expiry">Expires At</FieldLabel>
                <Input
                  aria-describedby={
                    delegationErrorsState.expiresAt
                      ? "delegate-expiry-error"
                      : "delegate-expiry-help"
                  }
                  aria-invalid={Boolean(delegationErrorsState.expiresAt)}
                  autoComplete="off"
                  id="delegate-expiry"
                  name="delegate-expiry"
                  onChange={(event) => {
                    setDelegationExpiresAt(event.target.value);
                    setDelegationErrorsState((current) => ({
                      ...current,
                      expiresAt: undefined,
                    }));
                  }}
                  type="datetime-local"
                  value={delegationExpiresAt}
                />
                <FieldDescription id="delegate-expiry-help">
                  Times use your device timezone and are stored as an exact UTC
                  instant.
                </FieldDescription>
                {delegationErrorsState.expiresAt ? (
                  <FieldError id="delegate-expiry-error">
                    {delegationErrorsState.expiresAt}
                  </FieldError>
                ) : null}
              </Field>
            </>
          ) : null}
          <Field>
            <FieldLabel htmlFor="delegation-reason">Reason</FieldLabel>
            <Textarea
              aria-describedby={
                delegationErrorsState.reason
                  ? "delegation-reason-error"
                  : "delegation-reason-help"
              }
              aria-invalid={Boolean(delegationErrorsState.reason)}
              autoComplete="off"
              id="delegation-reason"
              maxLength={500}
              name="delegation-reason"
              onChange={(event) => {
                setDelegationReason(event.target.value);
                setDelegationErrorsState((current) => ({
                  ...current,
                  reason: undefined,
                }));
              }}
              placeholder="Explain why temporary coverage is needed…"
              value={delegationReason}
            />
            <FieldDescription id="delegation-reason-help">
              This explanation is retained in the approval audit trail.
            </FieldDescription>
            {delegationErrorsState.reason ? (
              <FieldError id="delegation-reason-error">
                {delegationErrorsState.reason}
              </FieldError>
            ) : null}
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
