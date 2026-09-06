"use client";

import {
  formatEnumLabel,
  formatMoney,
  type RecommendationDto,
} from "@repo/common";
import {
  Badge,
  Button,
  EmptyState,
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from "@repo/ui";

import { useOrganizationFormatting } from "../../components/foundation/organization-formatting";

function scoreLabel(value: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 4,
  }).format(Number(value));
}

function quantityLabel(value: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 4,
  }).format(Number(value));
}

function stockAgeLabel(
  recommendation: RecommendationDto,
  locale: string,
): string {
  if (recommendation.productType !== "HARDWARE") return "Not stock-managed";
  if (recommendation.stockAgeDays === null) return "Age unavailable";
  return `${new Intl.NumberFormat(locale).format(recommendation.stockAgeDays)} day${recommendation.stockAgeDays === 1 ? "" : "s"}`;
}

function reasonTone(
  reasonCode: string,
): "neutral" | "success" | "warning" | "info" {
  if (reasonCode === "AVAILABLE_NOW" || reasonCode === "POSITIVE_MARGIN") {
    return "success";
  }
  if (reasonCode === "AGING_STOCK") return "warning";
  if (reasonCode === "ACTIVE_PROMOTION") return "info";
  return "neutral";
}

export function UpsellPanel({
  busy,
  currency,
  onAdd,
  onDismiss,
  recommendations,
}: {
  busy: boolean;
  currency: string;
  onAdd: (recommendation: RecommendationDto) => void;
  onDismiss: (recommendation: RecommendationDto) => void;
  recommendations: RecommendationDto[];
}) {
  const { locale } = useOrganizationFormatting();
  return (
    <Panel>
      <PanelHeader>
        <div>
          <PanelTitle>Relevant Add-Ons</PanelTitle>
          <PanelDescription>
            Ranked by configured affinity, margin, promotion, availability, and
            continuous stock age.
          </PanelDescription>
        </div>
      </PanelHeader>
      <PanelBody>
        {recommendations.length > 0 ? (
          <div className="grid gap-md">
            {recommendations.map((recommendation) => (
              <article
                className="grid gap-sm border-b border-border pb-md last:border-b-0 last:pb-0"
                key={recommendation.productId}
              >
                <div className="flex min-w-0 items-start justify-between gap-xs">
                  <div className="min-w-0">
                    <strong className="block truncate text-body-sm text-foreground-strong">
                      {recommendation.productName}
                    </strong>
                    <span className="font-mono text-caption text-foreground-muted">
                      {recommendation.productCode}
                    </span>
                  </div>
                  <Badge>{formatEnumLabel(recommendation.productType)}</Badge>
                </div>
                <p className="m-0 text-pretty text-caption text-foreground-muted">
                  {recommendation.explanation}
                </p>
                <div
                  aria-label="Recommendation signals"
                  className="flex flex-wrap gap-xs"
                  role="group"
                >
                  {recommendation.reasonCodes.map((reasonCode) => (
                    <Badge key={reasonCode} tone={reasonTone(reasonCode)}>
                      {formatEnumLabel(reasonCode)}
                    </Badge>
                  ))}
                </div>
                <dl className="m-0 grid grid-cols-2 gap-xs text-caption">
                  <div>
                    <dt className="text-foreground-muted">Suggested Price</dt>
                    <dd className="m-0 font-mono tabular-nums text-foreground-strong">
                      {formatMoney(
                        recommendation.suggestedUnitPrice,
                        currency,
                        locale,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-foreground-muted">Margin Change</dt>
                    <dd className="m-0 font-mono tabular-nums text-foreground-strong">
                      {formatMoney(
                        recommendation.expectedMarginDelta,
                        currency,
                        locale,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-foreground-muted">Available</dt>
                    <dd className="m-0 font-mono tabular-nums text-foreground-strong">
                      {recommendation.productType === "HARDWARE"
                        ? quantityLabel(
                            recommendation.availableQuantity,
                            locale,
                          )
                        : "Not stock-managed"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-foreground-muted">Stock Age</dt>
                    <dd className="m-0 font-mono tabular-nums text-foreground-strong">
                      {stockAgeLabel(recommendation, locale)}
                    </dd>
                  </div>
                </dl>
                <details className="rounded-control border border-border bg-surface-subtle px-sm py-xs">
                  <summary className="cursor-pointer text-body-sm font-semibold text-foreground-strong">
                    Review Ranking Inputs
                  </summary>
                  <div className="grid gap-sm pt-sm">
                    <dl className="m-0 grid grid-cols-2 gap-xs text-caption sm:grid-cols-3">
                      {(
                        [
                          ["Affinity", recommendation.score.affinity],
                          ["Margin", recommendation.score.margin],
                          ["Promotion", recommendation.score.promotion],
                          ["Availability", recommendation.score.availability],
                          ["Stock Age", recommendation.score.stockAge],
                          ["Weighted Total", recommendation.score.total],
                        ] as const
                      ).map(([label, value]) => (
                        <div key={label}>
                          <dt className="text-foreground-muted">{label}</dt>
                          <dd className="m-0 font-mono tabular-nums text-foreground-strong">
                            {scoreLabel(value, locale)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <p className="m-0 text-caption text-foreground-muted">
                      The API normalizes each input and applies the active
                      recommendation rule weights to produce the weighted total.
                    </p>
                  </div>
                </details>
                <div className="flex flex-wrap gap-xs">
                  <Button
                    disabled={busy}
                    onClick={() => onAdd(recommendation)}
                    size="compact"
                  >
                    Add to Quotation
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() => onDismiss(recommendation)}
                    size="compact"
                    variant="quiet"
                  >
                    Dismiss
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            description="No eligible add-ons remain for this quotation and catalog state."
            headingLevel="h3"
            title="No Recommendations"
          />
        )}
      </PanelBody>
    </Panel>
  );
}
