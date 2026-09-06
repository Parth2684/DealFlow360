"use client";

import {
  formatEnumLabel,
  formatMoney,
  formatPercentage,
  type QuoteDto,
} from "@repo/common";
import {
  Badge,
  InlineFeedback,
  Metric,
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from "@repo/ui";

import { useOrganizationFormatting } from "../../components/foundation/organization-formatting";

function riskTone(risk: string) {
  if (risk === "CRITICAL" || risk === "HIGH") return "danger" as const;
  if (risk === "MEDIUM") return "warning" as const;
  return "success" as const;
}

export function QuoteRiskPanel({ quote }: { quote: QuoteDto }) {
  const { locale } = useOrganizationFormatting();
  const version = quote.currentVersion;
  const risk = version.riskAssessment;
  const lineNameById = new Map(
    version.lines.map((line) => [line.id, line.productName]),
  );

  return (
    <div className="grid gap-md">
      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Commercial Summary</PanelTitle>
            <PanelDescription>
              Server-confirmed revision {quote.currentRevision}
            </PanelDescription>
          </div>
          {risk ? (
            <Badge tone={riskTone(risk.riskLevel)}>
              {formatEnumLabel(risk.riskLevel)} Risk
            </Badge>
          ) : null}
        </PanelHeader>
        <PanelBody>
          <div className="grid grid-cols-2 gap-md">
            <Metric
              label="Total"
              value={formatMoney(version.totals.total, quote.currency, locale)}
            />
            <Metric
              label="Margin"
              value={formatMoney(
                version.totals.grossMargin,
                quote.currency,
                locale,
              )}
            />
            <Metric
              label="Margin Rate"
              value={formatPercentage(version.totals.marginPercent, locale)}
            />
            <Metric
              label="Tax"
              value={formatMoney(
                version.totals.taxTotal,
                quote.currency,
                locale,
              )}
            />
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Decision Explainer</PanelTitle>
            <PanelDescription>
              Approval facts from the authoritative policy evaluation.
            </PanelDescription>
          </div>
        </PanelHeader>
        <PanelBody>
          {risk ? (
            <div className="grid gap-md">
              {risk.explanations.length > 0 ? (
                <InlineFeedback tone={riskTone(risk.riskLevel)}>
                  <ul className="m-0 grid gap-xxs pl-md">
                    {risk.explanations.map((explanation) => (
                      <li key={explanation}>{explanation}</li>
                    ))}
                  </ul>
                </InlineFeedback>
              ) : null}
              <dl className="m-0 grid grid-cols-2 gap-sm">
                <div>
                  <dt className="text-caption text-foreground-muted">
                    Blended Excess
                  </dt>
                  <dd className="m-0 font-mono text-body-sm tabular-nums text-foreground-strong">
                    {formatPercentage(risk.blendedExcess, locale)}
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-foreground-muted">
                    Maximum Excess
                  </dt>
                  <dd className="m-0 font-mono text-body-sm tabular-nums text-foreground-strong">
                    {formatPercentage(risk.maximumLineExcess, locale)}
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-foreground-muted">
                    Credit Utilization
                  </dt>
                  <dd className="m-0 font-mono text-body-sm tabular-nums text-foreground-strong">
                    {formatPercentage(risk.creditUtilizationPercent, locale)}
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-foreground-muted">
                    Overdue Balance
                  </dt>
                  <dd className="m-0 font-mono text-body-sm tabular-nums text-foreground-strong">
                    {formatMoney(risk.overdueBalance, quote.currency, locale)}
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-foreground-muted">
                    Representative Anomaly
                  </dt>
                  <dd className="m-0 font-mono text-body-sm tabular-nums text-foreground-strong">
                    {formatPercentage(risk.representativeAnomaly, locale)}
                  </dd>
                </div>
              </dl>

              <section className="grid gap-xs">
                <h3 className="m-0 text-body-sm font-semibold text-foreground-strong">
                  Payment History Evidence
                </h3>
                <dl className="m-0 grid grid-cols-2 gap-sm rounded-control border border-border bg-surface-subtle p-sm">
                  <div>
                    <dt className="text-caption text-foreground-muted">
                      Settled Invoices
                    </dt>
                    <dd className="m-0 font-mono text-body-sm tabular-nums text-foreground-strong">
                      {risk.paymentHistory.settledInvoiceCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption text-foreground-muted">
                      On-Time Payment Rate
                    </dt>
                    <dd className="m-0 font-mono text-body-sm tabular-nums text-foreground-strong">
                      {risk.paymentHistory.onTimePaymentRatePercent === null
                        ? "Not Available"
                        : formatPercentage(
                            risk.paymentHistory.onTimePaymentRatePercent,
                            locale,
                          )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption text-foreground-muted">
                      Late Payments
                    </dt>
                    <dd className="m-0 font-mono text-body-sm tabular-nums text-foreground-strong">
                      {risk.paymentHistory.latePaidInvoiceCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption text-foreground-muted">
                      Failed Payments
                    </dt>
                    <dd className="m-0 font-mono text-body-sm tabular-nums text-foreground-strong">
                      {risk.paymentHistory.failedPaymentCount}
                    </dd>
                  </div>
                </dl>
              </section>

              {risk.requiredRoute.length > 0 ? (
                <section className="grid gap-xs">
                  <h3 className="m-0 text-body-sm font-semibold text-foreground-strong">
                    Required Route
                  </h3>
                  <ol className="m-0 grid gap-xs p-0">
                    {risk.requiredRoute.map((step) => (
                      <li
                        className="flex gap-xs text-body-sm"
                        key={`${step.sequence}-${step.role}`}
                      >
                        <span className="font-mono tabular-nums text-foreground-muted">
                          {step.sequence}.
                        </span>
                        <span className="min-w-0">
                          <strong>{formatEnumLabel(step.role)}</strong>
                          <span className="block text-caption text-foreground-muted">
                            {step.reason}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : (
                <InlineFeedback tone="success">
                  Current terms do not require an approval route.
                </InlineFeedback>
              )}

              {risk.lineFacts.length > 0 ? (
                <details className="rounded-control border border-border bg-surface-subtle px-sm py-xs">
                  <summary className="cursor-pointer text-body-sm font-semibold text-foreground-strong">
                    Review Line Contributions
                  </summary>
                  <div className="grid gap-sm pt-sm">
                    {risk.lineFacts.map((fact) => (
                      <article
                        className="grid gap-xs border-b border-border pb-sm last:border-b-0 last:pb-0"
                        key={fact.quoteLineId}
                      >
                        <strong className="text-body-sm text-foreground-strong">
                          {fact.productName}
                        </strong>
                        <dl className="m-0 grid grid-cols-2 gap-xs text-caption">
                          <dt className="text-foreground-muted">Ceiling</dt>
                          <dd className="m-0 text-right font-mono tabular-nums">
                            {formatPercentage(
                              fact.allowedDiscountPercent,
                              locale,
                            )}
                          </dd>
                          <dt className="text-foreground-muted">Actual</dt>
                          <dd className="m-0 text-right font-mono tabular-nums">
                            {formatPercentage(
                              fact.appliedDiscountPercent,
                              locale,
                            )}
                          </dd>
                          <dt className="text-foreground-muted">Excess</dt>
                          <dd className="m-0 text-right font-mono tabular-nums">
                            {formatPercentage(
                              fact.excessDiscountPercent,
                              locale,
                            )}
                          </dd>
                          <dt className="text-foreground-muted">
                            Weighted Contribution
                          </dt>
                          <dd className="m-0 text-right font-mono tabular-nums">
                            {formatPercentage(fact.weightedExcess, locale)}
                          </dd>
                        </dl>
                      </article>
                    ))}
                  </div>
                </details>
              ) : null}

              {risk.thresholdSafeSuggestion ? (
                <section className="grid gap-sm rounded-control border border-border bg-surface-subtle p-sm">
                  <div>
                    <h3 className="m-0 text-body-sm font-semibold text-foreground-strong">
                      Threshold-Safe Suggestion
                    </h3>
                    <p className="m-0 text-caption text-foreground-muted">
                      {risk.thresholdSafeSuggestion.explanation}
                    </p>
                  </div>
                  <dl className="m-0 grid grid-cols-2 gap-sm">
                    <div>
                      <dt className="text-caption text-foreground-muted">
                        Projected Margin
                      </dt>
                      <dd className="m-0 font-mono text-body-sm tabular-nums text-foreground-strong">
                        {formatPercentage(
                          risk.thresholdSafeSuggestion.projectedMarginPercent,
                          locale,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-caption text-foreground-muted">
                        Projected Blended Excess
                      </dt>
                      <dd className="m-0 font-mono text-body-sm tabular-nums text-foreground-strong">
                        {formatPercentage(
                          risk.thresholdSafeSuggestion.projectedBlendedExcess,
                          locale,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-caption text-foreground-muted">
                        Projected Maximum Excess
                      </dt>
                      <dd className="m-0 font-mono text-body-sm tabular-nums text-foreground-strong">
                        {formatPercentage(
                          risk.thresholdSafeSuggestion
                            .projectedMaximumLineExcess,
                          locale,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-caption text-foreground-muted">
                        Approval Route
                      </dt>
                      <dd className="m-0 text-body-sm font-semibold text-success">
                        No Route Required
                      </dd>
                    </div>
                  </dl>
                  <div className="grid gap-xs">
                    <h4 className="m-0 text-caption font-semibold text-foreground-strong">
                      Suggested Line Adjustments
                    </h4>
                    <ul className="m-0 grid gap-xs p-0">
                      {risk.thresholdSafeSuggestion.lineAdjustments.map(
                        (adjustment) => (
                          <li
                            className="flex items-center justify-between gap-sm text-caption"
                            key={adjustment.lineId}
                          >
                            <span className="min-w-0 truncate text-foreground-muted">
                              {lineNameById.get(adjustment.lineId) ??
                                `Line ${adjustment.lineId}`}
                            </span>
                            <span className="font-mono tabular-nums text-foreground-strong">
                              {formatPercentage(
                                adjustment.discountPercent,
                                locale,
                              )}
                            </span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                </section>
              ) : null}
            </div>
          ) : (
            <InlineFeedback tone="neutral">
              Calculate the quotation to generate risk and approval facts.
            </InlineFeedback>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
