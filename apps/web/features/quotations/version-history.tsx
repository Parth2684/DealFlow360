"use client";

import {
  QuoteVersionDiffDtoSchema,
  formatDateTime,
  formatEnumLabel,
  formatMoney,
  planApiRoutes,
  type QuoteVersionDiffDto,
  type QuoteVersionDto,
} from "@repo/common";
import {
  Badge,
  Button,
  EmptyState,
  ErrorFeedback,
  Field,
  FieldLabel,
  InlineFeedback,
  LiveRegion,
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
  Select,
} from "@repo/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { useOrganizationFormatting } from "../../components/foundation/organization-formatting";
import { ApiProblemError, browserApiRequest } from "../../lib/api/browser";

function valueLabel(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return JSON.stringify(value);
}

function problemMessage(error: unknown): string {
  if (error instanceof ApiProblemError) {
    return error.problem.detail ?? error.problem.title;
  }
  return "The selected versions could not be compared. Refresh and try again.";
}

export function VersionHistory({
  initialDiff,
  quoteId,
  timeZone,
  versions,
}: {
  initialDiff?: QuoteVersionDiffDto;
  quoteId: string;
  timeZone: string;
  versions: QuoteVersionDto[];
}) {
  const { locale } = useOrganizationFormatting();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [diff, setDiff] = useState(initialDiff);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fromRevision, setFromRevision] = useState(
    initialDiff?.fromRevision ??
      versions[1]?.revisionNumber ??
      versions[0]?.revisionNumber,
  );
  const [toRevision, setToRevision] = useState(
    initialDiff?.toRevision ?? versions[0]?.revisionNumber,
  );

  async function compare() {
    if (fromRevision === undefined || toRevision === undefined) return;
    setLoading(true);
    setError("");
    const parameters = new URLSearchParams({
      fromRevision: String(fromRevision),
      toRevision: String(toRevision),
    });
    try {
      const result = await browserApiRequest(
        `${planApiRoutes.quotes.versionDiff(quoteId)}?${parameters.toString()}`,
        { schema: QuoteVersionDiffDtoSchema, scope: "internal" },
      );
      setDiff(result);
      const pageParameters = new URLSearchParams(searchParams.toString());
      pageParameters.set("fromRevision", String(fromRevision));
      pageParameters.set("toRevision", String(toRevision));
      router.replace(`/quotations/${quoteId}?${pageParameters.toString()}`, {
        scroll: false,
      });
    } catch (caught) {
      setError(problemMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel>
      <PanelHeader>
        <div>
          <PanelTitle>Version History</PanelTitle>
          <PanelDescription>
            Earlier quotations are preserved so you can compare changes and
            review past approvals.
          </PanelDescription>
        </div>
        <Badge>{versions.length} Versions</Badge>
      </PanelHeader>
      <PanelBody>
        <div className="grid gap-md">
          <LiveRegion
            message={error || (loading ? "Comparing versions…" : "")}
          />
          <div className="grid gap-sm sm:grid-cols-3 sm:items-end">
            <Field>
              <FieldLabel htmlFor="version-from">From Revision</FieldLabel>
              <Select
                id="version-from"
                name="version-from"
                onChange={(event) =>
                  setFromRevision(Number(event.target.value))
                }
                value={fromRevision ?? ""}
              >
                {versions.map((version) => (
                  <option key={version.id} value={version.revisionNumber}>
                    Revision {version.revisionNumber}
                  </option>
                ))}
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="version-to">To Revision</FieldLabel>
              <Select
                id="version-to"
                name="version-to"
                onChange={(event) => setToRevision(Number(event.target.value))}
                value={toRevision ?? ""}
              >
                {versions.map((version) => (
                  <option key={version.id} value={version.revisionNumber}>
                    Revision {version.revisionNumber}
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              disabled={loading || versions.length < 2}
              onClick={() => void compare()}
              variant="secondary"
            >
              {loading ? "Comparing Versions…" : "Compare Versions"}
            </Button>
          </div>
          {error ? (
            <ErrorFeedback title="Version Comparison Failed">
              {error}
            </ErrorFeedback>
          ) : null}
          {versions.length > 0 ? (
            <div className="flex snap-x gap-sm overflow-x-auto overscroll-x-contain pb-xs">
              {versions.map((version) => (
                <article
                  className="w-64 shrink-0 snap-start rounded-control border border-border bg-surface-subtle p-sm"
                  key={version.id}
                >
                  <div className="flex items-start justify-between gap-xs">
                    <strong className="text-body-sm text-foreground-strong">
                      Revision {version.revisionNumber}
                    </strong>
                    <Badge>{formatEnumLabel(version.status)}</Badge>
                  </div>
                  <p className="mb-0 mt-xs font-mono text-caption tabular-nums text-foreground-strong">
                    {formatMoney(
                      version.totals.total,
                      version.currency,
                      locale,
                    )}
                  </p>
                  <p className="mb-0 mt-xs text-caption text-foreground-muted">
                    <time dateTime={version.createdAt}>
                      {formatDateTime(version.createdAt, locale, timeZone)}
                    </time>
                  </p>
                  <p className="mb-0 mt-xs truncate font-mono text-caption text-foreground-muted">
                    Fingerprint {version.termsFingerprint.slice(0, 12)}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              description="The API has not returned a commercial version for this quotation."
              headingLevel="h3"
              title="No Version History"
            />
          )}
          {diff ? (
            <section className="grid gap-sm">
              <div className="flex flex-wrap items-center gap-xs">
                <h3 className="m-0 text-body-sm font-semibold text-foreground-strong">
                  Revision {diff.fromRevision} to {diff.toRevision}
                </h3>
                <Badge tone={diff.materialChange ? "warning" : "success"}>
                  {diff.materialChange
                    ? "Material Change"
                    : "No Material Change"}
                </Badge>
              </div>
              {diff.differences.length > 0 ? (
                <div className="grid gap-xs">
                  {diff.differences.map((difference) => (
                    <article
                      className="grid gap-xs rounded-control border border-border bg-surface px-sm py-xs sm:grid-cols-3"
                      key={difference.path}
                    >
                      <div className="min-w-0">
                        <strong className="block text-caption text-foreground-strong">
                          {difference.label}
                        </strong>
                        <span className="block truncate font-mono text-caption text-foreground-muted">
                          {difference.path}
                        </span>
                      </div>
                      <div className="min-w-0 break-words text-caption">
                        <span className="block text-foreground-muted">
                          Before
                        </span>
                        <span className="text-foreground-strong">
                          {valueLabel(difference.before)}
                        </span>
                      </div>
                      <div className="min-w-0 break-words text-caption">
                        <span className="block text-foreground-muted">
                          After
                        </span>
                        <span className="text-foreground-strong">
                          {valueLabel(difference.after)}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <InlineFeedback tone="success">
                  The selected versions have no recorded differences.
                </InlineFeedback>
              )}
            </section>
          ) : null}
        </div>
      </PanelBody>
    </Panel>
  );
}
