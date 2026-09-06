import {
  ApprovalRouteStepDtoSchema,
  PaymentHistoryRiskDtoSchema,
  QuoteDtoSchema,
  QuoteLineDtoSchema,
  QuoteRiskAssessmentDtoSchema,
  QuoteSummaryDtoSchema,
  QuoteVersionDtoSchema,
  type RiskLevel,
} from "@repo/common";
import type { Prisma } from "@repo/db";

import { toJsonValue } from "../../shared/http.js";

export const versionInclude = {
  lines: { orderBy: { lineNumber: "asc" } },
  riskAssessment: {
    include: {
      lineFacts: {
        include: {
          quoteLine: true,
          limitMatches: { include: { discountLimit: true } },
        },
      },
    },
  },
} satisfies Prisma.QuoteVersionInclude;

export const quoteInclude = {
  customerAccount: true,
  owner: true,
  salesTeam: true,
  approvalRequests: { orderBy: { requestedAt: "desc" }, take: 1 },
  currentVersion: { include: versionInclude },
} satisfies Prisma.QuoteInclude;

export type QuoteRecord = Prisma.QuoteGetPayload<{
  include: typeof quoteInclude;
}>;

export type VersionRecord = NonNullable<QuoteRecord["currentVersion"]>;

function decimal(value: { toString(): string }): string {
  return value.toString();
}

function jsonObject(value: unknown): Record<string, unknown> {
  const converted = toJsonValue(value);
  return converted !== null &&
    typeof converted === "object" &&
    !Array.isArray(converted)
    ? (converted as Record<string, unknown>)
    : {};
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function riskLevelFor(input: {
  blendedExcess: { toString(): string };
  maximumLineExcess: { toString(): string };
  postDiscountMarginPercent: { toString(): string };
  overdueBalance: { toString(): string };
}): RiskLevel {
  const blended = Number(input.blendedExcess.toString());
  const maximum = Number(input.maximumLineExcess.toString());
  const margin = Number(input.postDiscountMarginPercent.toString());
  const overdue = Number(input.overdueBalance.toString());
  if (maximum >= 8 || blended >= 4 || margin < 10 || overdue > 0)
    return "CRITICAL";
  if (maximum >= 4 || blended >= 2 || margin < 15) return "HIGH";
  if (maximum > 0 || blended >= 1.5 || margin < 20) return "MEDIUM";
  return "LOW";
}

export function mapQuoteLine(line: VersionRecord["lines"][number]) {
  const snapshot = jsonObject(line.pricingSnapshot);
  return QuoteLineDtoSchema.parse({
    id: line.id,
    lineNumber: line.lineNumber,
    productId: line.productId,
    variantId: line.variantId,
    subscriptionPlanId: line.subscriptionPlanId,
    productCode: line.productCode,
    productName: line.productName,
    productDescription: line.productDescription,
    productType: line.productType,
    categoryCode: line.categoryCode,
    sku: line.sku,
    unit: line.unit,
    quantity: decimal(line.quantity),
    listUnitPrice: decimal(line.listUnitPrice),
    unitPrice: decimal(line.unitPrice),
    unitCost: decimal(line.unitCost),
    discountPercent: decimal(line.discountPercent),
    lineDiscountAmount: decimal(line.lineDiscountAmount),
    allocatedOrderDiscount: decimal(line.allocatedOrderDiscount),
    preTaxSubtotal: decimal(line.preTaxSubtotal),
    taxCode: line.taxCode,
    taxRate: decimal(line.taxRate),
    taxBehavior: line.taxBehavior,
    taxAmount: decimal(line.taxAmount),
    total: decimal(line.total),
    costTotal: decimal(line.costTotal),
    grossMargin: decimal(line.grossMargin),
    billingType: line.billingType,
    pricingExplanation: stringList(snapshot.explanation),
  });
}

function mapRisk(version: VersionRecord) {
  const risk = version.riskAssessment;
  if (risk === null) return null;
  const requiredRouteResult = ApprovalRouteStepDtoSchema.array().safeParse(
    toJsonValue(risk.requiredRoute),
  );
  const suggestionResult =
    QuoteRiskAssessmentDtoSchema.shape.thresholdSafeSuggestion.safeParse(
      toJsonValue(risk.thresholdSafeSuggestion),
    );
  const versionRiskFacts = jsonObject(version.riskFacts);
  const paymentHistoryResult = PaymentHistoryRiskDtoSchema.safeParse(
    versionRiskFacts["paymentHistory"],
  );
  return QuoteRiskAssessmentDtoSchema.parse({
    riskLevel: riskLevelFor(risk),
    blendedExcess: decimal(risk.blendedExcess),
    maximumLineExcess: decimal(risk.maximumLineExcess),
    postDiscountMarginPercent: decimal(risk.postDiscountMarginPercent),
    creditExposure: decimal(risk.creditExposure),
    creditUtilizationPercent: decimal(risk.creditUtilizationPercent),
    overdueBalance: decimal(risk.overdueBalance),
    paymentHistory: paymentHistoryResult.success
      ? paymentHistoryResult.data
      : {
          settledInvoiceCount: 0,
          latePaidInvoiceCount: 0,
          failedPaymentCount: 0,
          onTimePaymentRatePercent: null,
        },
    representativeAnomaly: decimal(risk.representativeAnomaly),
    requiredRoute: requiredRouteResult.success ? requiredRouteResult.data : [],
    reasonCodes: risk.reasonCodes,
    explanations: risk.reasonCodes.map((code) =>
      code.toLowerCase().replaceAll("_", " "),
    ),
    lineFacts: risk.lineFacts.map((fact) => ({
      quoteLineId: fact.quoteLineId,
      productName: fact.quoteLine.productName,
      appliedDiscountPercent: decimal(fact.appliedDiscountPercent),
      allowedDiscountPercent: decimal(fact.allowedDiscountPercent),
      excessDiscountPercent: decimal(fact.excessDiscountPercent),
      preDiscountValue: decimal(fact.preDiscountValue),
      weight: decimal(fact.weight),
      weightedExcess: decimal(fact.weightedExcess),
      reasonCodes: fact.reasonCodes,
      matchedLimits: fact.limitMatches.map((match) => ({
        discountLimitId: match.discountLimitId,
        name: match.discountLimit.name,
        allowedDiscountPercent: decimal(match.discountLimit.maxDiscountPercent),
        priority: match.discountLimit.priority,
        reason: match.reason ?? `Matched ${match.discountLimit.name}`,
      })),
    })),
    thresholdSafeSuggestion: suggestionResult.success
      ? suggestionResult.data
      : null,
    calculatedAt: risk.calculatedAt.toISOString(),
  });
}

export function mapQuoteVersion(version: VersionRecord) {
  return QuoteVersionDtoSchema.parse({
    id: version.id,
    quoteId: version.quoteId,
    revisionNumber: version.revisionNumber,
    status: version.status,
    currency: version.currency,
    paymentTermsDays: version.paymentTermsDays,
    termsFingerprint: version.termsFingerprint,
    notes: version.notes,
    totals: {
      subtotal: decimal(version.subtotal),
      orderDiscountTotal: decimal(version.orderDiscountTotal),
      lineDiscountTotal: decimal(version.lineDiscountTotal),
      taxTotal: decimal(version.taxTotal),
      total: decimal(version.total),
      costTotal: decimal(version.costTotal),
      grossMargin: decimal(version.grossMargin),
      marginPercent: decimal(version.marginPercent),
    },
    lines: version.lines.map(mapQuoteLine),
    riskAssessment: mapRisk(version),
    createdById: version.createdById,
    createdAt: version.createdAt.toISOString(),
  });
}

export function mapQuoteSummary(quote: QuoteRecord) {
  const version = quote.currentVersion;
  if (version === null) throw new Error("Quote has no current version");
  return QuoteSummaryDtoSchema.parse({
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    customerAccountId: quote.customerAccountId,
    customerName: quote.customerAccount.name,
    ownerId: quote.ownerId,
    ownerName: `${quote.owner.firstName} ${quote.owner.lastName}`,
    stage: quote.stage,
    currentRevision: quote.currentRevision,
    currency: version.currency,
    total: decimal(version.total),
    marginPercent: decimal(version.marginPercent),
    riskLevel:
      version.riskAssessment === null
        ? null
        : riskLevelFor(version.riskAssessment),
    approvalStatus: quote.approvalRequests[0]?.status ?? null,
    expiresAt: quote.expiresAt?.toISOString() ?? null,
    updatedAt: quote.updatedAt.toISOString(),
  });
}

export function mapQuote(quote: QuoteRecord) {
  if (quote.currentVersion === null)
    throw new Error("Quote has no current version");
  return QuoteDtoSchema.parse({
    ...mapQuoteSummary(quote),
    salesTeamId: quote.salesTeamId,
    currentVersion: mapQuoteVersion(quote.currentVersion),
    revision: quote.revision,
    createdAt: quote.createdAt.toISOString(),
  });
}
