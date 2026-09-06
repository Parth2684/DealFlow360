"use client";

import {
  formatDateTime,
  formatEnumLabel,
  formatMoney,
  type ApprovalRequestDto,
  type CursorPage,
} from "@repo/common";
import {
  Badge,
  ButtonLink,
  DataTable,
  DataTableBody,
  DataTableCaption,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  EmptyState,
  PageHeader,
  Pagination,
} from "@repo/ui";
import Link from "next/link";

import { useOrganizationFormatting } from "../../components/foundation/organization-formatting";
import { ApprovalDeadline } from "./approval-deadline";

export type ApprovalQueueKey = "manager" | "finance" | "completed" | "overdue";

function statusTone(status: ApprovalRequestDto["status"]) {
  if (status === "APPROVED") return "success" as const;
  if (status === "REJECTED" || status === "SUPERSEDED")
    return "danger" as const;
  if (status === "PENDING") return "warning" as const;
  return "neutral" as const;
}

function nextHref(queue: ApprovalQueueKey, cursor: string | null) {
  return cursor
    ? `/approvals?queue=${queue}&cursor=${encodeURIComponent(cursor)}`
    : undefined;
}

function currentStep(approval: ApprovalRequestDto) {
  return approval.steps.find(
    (step) =>
      step.status === "ACTIVE" || step.sequence === approval.currentSequence,
  );
}

export function ApprovalQueue({
  page,
  queue,
  timeZone,
}: {
  page: CursorPage<ApprovalRequestDto>;
  queue: ApprovalQueueKey;
  timeZone: string;
}) {
  const { locale } = useOrganizationFormatting();
  const tabs: Array<{ href: string; key: ApprovalQueueKey; label: string }> = [
    { href: "/approvals?queue=manager", key: "manager", label: "Manager" },
    { href: "/approvals?queue=finance", key: "finance", label: "Finance" },
    {
      href: "/approvals?queue=completed",
      key: "completed",
      label: "Completed",
    },
    { href: "/approvals?queue=overdue", key: "overdue", label: "Overdue" },
  ];

  return (
    <div className="grid gap-lg">
      <PageHeader
        actions={
          <ButtonLink href={`/approvals?queue=${queue}`} variant="secondary">
            Refresh Queue
          </ButtonLink>
        }
        description="Review immutable commercial terms, policy matches, and the active decision step before taking action."
        title="Approvals"
      />

      <nav
        aria-label="Approval queue"
        className="flex overflow-x-auto border-b border-border"
      >
        {tabs.map((tab) => (
          <Link
            aria-current={tab.key === queue ? "page" : undefined}
            className={
              tab.key === queue
                ? "min-h-touch shrink-0 border-b-2 border-brand bg-brand-subtle px-sm py-xs text-body-sm font-semibold text-brand"
                : "min-h-touch shrink-0 border-b-2 border-transparent px-sm py-xs text-body-sm font-semibold text-foreground-muted transition-colors hover:bg-surface-subtle hover:text-foreground-strong"
            }
            href={tab.href}
            key={tab.key}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {page.items.length > 0 ? (
        <>
          <div className="grid gap-sm md:hidden">
            {page.items.map((approval) => {
              const step = currentStep(approval);
              return (
                <article
                  className="grid gap-sm rounded-panel border border-border bg-surface p-md"
                  key={approval.id}
                >
                  <div className="flex min-w-0 items-start justify-between gap-xs">
                    <div className="min-w-0">
                      <Link
                        className="font-mono text-body-sm font-semibold text-brand underline-offset-4 hover:underline"
                        href={`/approvals/${approval.id}`}
                      >
                        {approval.quote.quoteNumber}
                      </Link>
                      <p className="m-0 truncate text-body-sm font-semibold text-foreground-strong">
                        {approval.quote.customerName}
                      </p>
                    </div>
                    <Badge tone={statusTone(approval.status)}>
                      {formatEnumLabel(approval.status)}
                    </Badge>
                  </div>
                  <dl className="m-0 grid grid-cols-2 gap-sm text-caption">
                    <div>
                      <dt className="text-foreground-muted">Quote Value</dt>
                      <dd className="m-0 font-mono tabular-nums text-foreground-strong">
                        {formatMoney(
                          approval.quote.total,
                          approval.quote.currency,
                          locale,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-foreground-muted">Active Step</dt>
                      <dd className="m-0 text-foreground-strong">
                        {step ? formatEnumLabel(step.requiredRole) : "Complete"}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-foreground-muted">Decision Due</dt>
                      <dd className="m-0 text-foreground-strong">
                        {step?.status === "ACTIVE" && step.dueAt ? (
                          <ApprovalDeadline
                            dueAt={step.dueAt}
                            timeZone={timeZone}
                          />
                        ) : (
                          "No active deadline"
                        )}
                      </dd>
                    </div>
                  </dl>
                  <ButtonLink href={`/approvals/${approval.id}`} size="compact">
                    Review Approval
                  </ButtonLink>
                </article>
              );
            })}
          </div>
          <DataTable
            aria-label="Approval requests"
            containerClassName="hidden md:block"
          >
            <DataTableCaption visuallyHidden>
              Approval requests
            </DataTableCaption>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>Quotation</DataTableHead>
                <DataTableHead>Customer</DataTableHead>
                <DataTableHead>Active Step</DataTableHead>
                <DataTableHead>Status</DataTableHead>
                <DataTableHead numeric>Value</DataTableHead>
                <DataTableHead>Decision Due</DataTableHead>
                <DataTableHead>Requested</DataTableHead>
                <DataTableHead>Changed Terms</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {page.items.map((approval) => {
                const step = currentStep(approval);
                return (
                  <DataTableRow key={approval.id}>
                    <DataTableCell>
                      <Link
                        className="font-mono font-semibold text-brand underline-offset-4 hover:underline"
                        href={`/approvals/${approval.id}`}
                      >
                        {approval.quote.quoteNumber}
                      </Link>
                    </DataTableCell>
                    <DataTableCell>{approval.quote.customerName}</DataTableCell>
                    <DataTableCell>
                      {step ? formatEnumLabel(step.requiredRole) : "Complete"}
                    </DataTableCell>
                    <DataTableCell>
                      <Badge tone={statusTone(approval.status)}>
                        {formatEnumLabel(approval.status)}
                      </Badge>
                    </DataTableCell>
                    <DataTableCell numeric>
                      {formatMoney(
                        approval.quote.total,
                        approval.quote.currency,
                        locale,
                      )}
                    </DataTableCell>
                    <DataTableCell>
                      {step?.status === "ACTIVE" && step.dueAt ? (
                        <ApprovalDeadline
                          dueAt={step.dueAt}
                          timeZone={timeZone}
                        />
                      ) : (
                        "No active deadline"
                      )}
                    </DataTableCell>
                    <DataTableCell>
                      <time dateTime={approval.requestedAt}>
                        {formatDateTime(approval.requestedAt, locale, timeZone)}
                      </time>
                    </DataTableCell>
                    <DataTableCell>
                      {approval.termsChanged ? (
                        <Badge tone="danger">Invalidated</Badge>
                      ) : (
                        <Badge tone="success">Current</Badge>
                      )}
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTableBody>
          </DataTable>
          <Pagination
            nextHref={nextHref(queue, page.pageInfo.nextCursor)}
            status={`${page.items.length} approvals in this page`}
          />
        </>
      ) : (
        <EmptyState
          description="No approval requests match this queue. Select another queue or refresh after a quotation is submitted."
          title="Approval Queue Is Clear"
        />
      )}
    </div>
  );
}
