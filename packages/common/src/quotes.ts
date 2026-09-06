import { z } from "zod";

import {
  ApprovalRequestStatusSchema,
  BillingTypeSchema,
  ProductTypeSchema,
  QuoteStageSchema,
  QuoteVersionStatusSchema,
  RiskLevelSchema,
  RoleSchema,
  TaxBehaviorSchema,
} from "./enums.js";
import {
  createCursorPageSchema,
  CurrencyCodeSchema,
  IdSchema,
  IsoDateTimeSchema,
  JsonObjectSchema,
  NonNegativeDecimalStringSchema,
  PercentageStringSchema,
  PositiveDecimalStringSchema,
  RevisionSchema,
  TermsFingerprintSchema,
} from "./primitives.js";

export const QuoteLineDtoSchema = z.object({
  id: IdSchema,
  lineNumber: z.number().int().positive(),
  productId: IdSchema,
  variantId: IdSchema.nullable(),
  subscriptionPlanId: IdSchema.nullable(),
  productCode: z.string().min(1),
  productName: z.string().min(1),
  productDescription: z.string().nullable(),
  productType: ProductTypeSchema,
  categoryCode: z.string().min(1),
  sku: z.string().nullable(),
  unit: z.string().min(1),
  quantity: PositiveDecimalStringSchema,
  listUnitPrice: NonNegativeDecimalStringSchema,
  unitPrice: NonNegativeDecimalStringSchema,
  unitCost: NonNegativeDecimalStringSchema,
  discountPercent: PercentageStringSchema,
  lineDiscountAmount: NonNegativeDecimalStringSchema,
  allocatedOrderDiscount: NonNegativeDecimalStringSchema,
  preTaxSubtotal: NonNegativeDecimalStringSchema,
  taxCode: z.string().nullable(),
  taxRate: PercentageStringSchema,
  taxBehavior: TaxBehaviorSchema,
  taxAmount: NonNegativeDecimalStringSchema,
  total: NonNegativeDecimalStringSchema,
  costTotal: NonNegativeDecimalStringSchema,
  grossMargin: z.string(),
  billingType: BillingTypeSchema,
  pricingExplanation: z.array(z.string()),
});
export type QuoteLineDto = z.infer<typeof QuoteLineDtoSchema>;

export const CommercialTotalsSchema = z.object({
  subtotal: NonNegativeDecimalStringSchema,
  orderDiscountTotal: NonNegativeDecimalStringSchema,
  lineDiscountTotal: NonNegativeDecimalStringSchema,
  taxTotal: NonNegativeDecimalStringSchema,
  total: NonNegativeDecimalStringSchema,
  costTotal: NonNegativeDecimalStringSchema,
  grossMargin: z.string(),
  marginPercent: z.string(),
});
export type CommercialTotals = z.infer<typeof CommercialTotalsSchema>;

export const DiscountLimitMatchDtoSchema = z.object({
  discountLimitId: IdSchema,
  name: z.string().min(1),
  allowedDiscountPercent: PercentageStringSchema,
  priority: z.number().int(),
  reason: z.string().min(1),
});
export type DiscountLimitMatchDto = z.infer<typeof DiscountLimitMatchDtoSchema>;

export const QuoteLineRiskFactDtoSchema = z.object({
  quoteLineId: IdSchema,
  productName: z.string().min(1),
  appliedDiscountPercent: PercentageStringSchema,
  allowedDiscountPercent: PercentageStringSchema,
  excessDiscountPercent: NonNegativeDecimalStringSchema,
  preDiscountValue: NonNegativeDecimalStringSchema,
  weight: NonNegativeDecimalStringSchema,
  weightedExcess: NonNegativeDecimalStringSchema,
  reasonCodes: z.array(z.string().min(1)),
  matchedLimits: z.array(DiscountLimitMatchDtoSchema),
});
export type QuoteLineRiskFactDto = z.infer<typeof QuoteLineRiskFactDtoSchema>;

export const ApprovalRouteStepDtoSchema = z.object({
  sequence: z.number().int().positive(),
  role: RoleSchema,
  capability: z.string().min(1),
  reason: z.string().min(1),
});
export type ApprovalRouteStepDto = z.infer<typeof ApprovalRouteStepDtoSchema>;

export const PaymentHistoryRiskDtoSchema = z.object({
  settledInvoiceCount: z.number().int().nonnegative(),
  latePaidInvoiceCount: z.number().int().nonnegative(),
  failedPaymentCount: z.number().int().nonnegative(),
  onTimePaymentRatePercent: NonNegativeDecimalStringSchema.nullable(),
});
export type PaymentHistoryRiskDto = z.infer<typeof PaymentHistoryRiskDtoSchema>;

export const QuoteRiskAssessmentDtoSchema = z.object({
  riskLevel: RiskLevelSchema,
  blendedExcess: NonNegativeDecimalStringSchema,
  maximumLineExcess: NonNegativeDecimalStringSchema,
  postDiscountMarginPercent: z.string(),
  creditExposure: NonNegativeDecimalStringSchema,
  creditUtilizationPercent: NonNegativeDecimalStringSchema,
  overdueBalance: NonNegativeDecimalStringSchema,
  paymentHistory: PaymentHistoryRiskDtoSchema,
  representativeAnomaly: NonNegativeDecimalStringSchema,
  requiredRoute: z.array(ApprovalRouteStepDtoSchema),
  reasonCodes: z.array(z.string().min(1)),
  explanations: z.array(z.string().min(1)),
  lineFacts: z.array(QuoteLineRiskFactDtoSchema),
  thresholdSafeSuggestion: z
    .object({
      lineId: IdSchema,
      discountPercent: PercentageStringSchema,
      lineAdjustments: z
        .array(
          z.object({
            lineId: IdSchema,
            discountPercent: PercentageStringSchema,
          }),
        )
        .min(1),
      projectedMarginPercent: z.string(),
      projectedBlendedExcess: NonNegativeDecimalStringSchema,
      projectedMaximumLineExcess: NonNegativeDecimalStringSchema,
      verifiedNoApprovalRoute: z.literal(true),
      explanation: z.string().min(1),
    })
    .nullable(),
  calculatedAt: IsoDateTimeSchema,
});
export type QuoteRiskAssessmentDto = z.infer<
  typeof QuoteRiskAssessmentDtoSchema
>;

export const QuoteVersionDtoSchema = z.object({
  id: IdSchema,
  quoteId: IdSchema,
  revisionNumber: RevisionSchema,
  status: QuoteVersionStatusSchema,
  currency: CurrencyCodeSchema,
  paymentTermsDays: z.number().int().nonnegative(),
  termsFingerprint: TermsFingerprintSchema,
  notes: z.string().nullable(),
  totals: CommercialTotalsSchema,
  lines: z.array(QuoteLineDtoSchema),
  riskAssessment: QuoteRiskAssessmentDtoSchema.nullable(),
  createdById: IdSchema,
  createdAt: IsoDateTimeSchema,
});
export type QuoteVersionDto = z.infer<typeof QuoteVersionDtoSchema>;

export const QuoteSummaryDtoSchema = z.object({
  id: IdSchema,
  quoteNumber: z.string().min(1),
  customerAccountId: IdSchema,
  customerName: z.string().min(1),
  ownerId: IdSchema,
  ownerName: z.string().min(1),
  stage: QuoteStageSchema,
  currentRevision: RevisionSchema,
  currency: CurrencyCodeSchema,
  total: NonNegativeDecimalStringSchema,
  marginPercent: z.string(),
  riskLevel: RiskLevelSchema.nullable(),
  approvalStatus: ApprovalRequestStatusSchema.nullable(),
  expiresAt: IsoDateTimeSchema.nullable(),
  updatedAt: IsoDateTimeSchema,
});
export type QuoteSummaryDto = z.infer<typeof QuoteSummaryDtoSchema>;

export const QuoteDtoSchema = QuoteSummaryDtoSchema.extend({
  salesTeamId: IdSchema.nullable(),
  currentVersion: QuoteVersionDtoSchema,
  revision: RevisionSchema,
  createdAt: IsoDateTimeSchema,
});
export type QuoteDto = z.infer<typeof QuoteDtoSchema>;

export const QuoteListQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(200).optional(),
  stage: QuoteStageSchema.optional(),
  ownerId: IdSchema.optional(),
  customerAccountId: IdSchema.optional(),
  sort: z
    .enum(["updatedAt", "createdAt", "total", "expiresAt"])
    .default("updatedAt"),
  direction: z.enum(["asc", "desc"]).default("desc"),
});
export type QuoteListQuery = z.infer<typeof QuoteListQuerySchema>;

export const QuoteProductPickerQuerySchema = z
  .object({
    quoteId: IdSchema,
    cursor: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(30),
    search: z.string().trim().max(200).optional(),
    categoryId: IdSchema.optional(),
    productType: ProductTypeSchema.optional(),
    priceListId: IdSchema.optional(),
    warehouseId: IdSchema.optional(),
    quantity: PositiveDecimalStringSchema.default("1"),
    inStockOnly: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  })
  .strict();
export type QuoteProductPickerQuery = z.infer<
  typeof QuoteProductPickerQuerySchema
>;

export const QuoteProductWarehouseStockDtoSchema = z.object({
  warehouseId: IdSchema,
  warehouseCode: z.string().min(1),
  warehouseName: z.string().min(1),
  availableQuantity: NonNegativeDecimalStringSchema,
  incomingQuantity: NonNegativeDecimalStringSchema,
  incomingExpectedAt: IsoDateTimeSchema.nullable(),
  stockAgeDays: z.number().int().nonnegative().nullable(),
});
export type QuoteProductWarehouseStockDto = z.infer<
  typeof QuoteProductWarehouseStockDtoSchema
>;

export const QuoteProductOptionDtoSchema = z.object({
  variantId: IdSchema.nullable(),
  sku: z.string().nullable(),
  name: z.string().nullable(),
  attributes: JsonObjectSchema,
  priceSurcharge: NonNegativeDecimalStringSchema,
  resolvedUnitPrice: NonNegativeDecimalStringSchema,
  availableQuantity: NonNegativeDecimalStringSchema,
  warehouses: z.array(QuoteProductWarehouseStockDtoSchema),
});
export type QuoteProductOptionDto = z.infer<typeof QuoteProductOptionDtoSchema>;

export const QuoteProductPickerItemDtoSchema = z.object({
  id: IdSchema,
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  productType: ProductTypeSchema,
  unit: z.string().min(1),
  stockManaged: z.boolean(),
  category: z.object({
    id: IdSchema,
    code: z.string().min(1),
    name: z.string().min(1),
  }),
  tax: z
    .object({
      code: z.string().min(1),
      rate: PercentageStringSchema,
      behavior: TaxBehaviorSchema,
    })
    .nullable(),
  priceList: z.object({
    id: IdSchema,
    code: z.string().min(1),
    name: z.string().min(1),
    currency: CurrencyCodeSchema,
  }),
  pricingExplanation: z.string().min(1),
  options: z.array(QuoteProductOptionDtoSchema).min(1),
});
export type QuoteProductPickerItemDto = z.infer<
  typeof QuoteProductPickerItemDtoSchema
>;

export const QuoteProductPickerPageDtoSchema = createCursorPageSchema(
  QuoteProductPickerItemDtoSchema,
);
export type QuoteProductPickerPageDto = z.infer<
  typeof QuoteProductPickerPageDtoSchema
>;

export const QuoteVersionDiffQuerySchema = z
  .object({
    fromRevision: RevisionSchema.optional(),
    toRevision: RevisionSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      (value.fromRevision === undefined) !==
      (value.toRevision === undefined)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "fromRevision and toRevision must be supplied together, or both omitted for the latest comparison",
      });
    }
  });
export type QuoteVersionDiffQuery = z.infer<typeof QuoteVersionDiffQuerySchema>;

export const CreateQuoteRequestSchema = z
  .object({
    customerAccountId: IdSchema,
    currency: CurrencyCodeSchema,
    paymentTermsDays: z.number().int().min(0).max(365),
    expiresAt: IsoDateTimeSchema.optional(),
    notes: z.string().trim().max(4000).optional(),
  })
  .strict();
export type CreateQuoteRequest = z.infer<typeof CreateQuoteRequestSchema>;

export const UpdateQuoteRequestSchema = z
  .object({
    revision: RevisionSchema,
    customerAccountId: IdSchema.optional(),
    currency: CurrencyCodeSchema.optional(),
    paymentTermsDays: z.number().int().min(0).max(365).optional(),
    expiresAt: IsoDateTimeSchema.nullable().optional(),
    notes: z.string().trim().max(4000).nullable().optional(),
  })
  .strict();
export type UpdateQuoteRequest = z.infer<typeof UpdateQuoteRequestSchema>;

/**
 * Manual pipeline transitions are deliberately narrower than QuoteStage.
 * Approval, send, acceptance, confirmation, and expiry keep their dedicated
 * commands so this endpoint cannot bypass commercial invariants.
 */
export const UpdateQuoteStageRequestSchema = z
  .object({
    stage: z.enum(["SENT", "UNDER_NEGOTIATION", "CANCELLED"]),
    revision: RevisionSchema,
  })
  .strict();
export type UpdateQuoteStageRequest = z.infer<
  typeof UpdateQuoteStageRequestSchema
>;

export const AddQuoteLineRequestSchema = z
  .object({
    revision: RevisionSchema.optional(),
    productId: IdSchema,
    variantId: IdSchema.optional(),
    quantity: PositiveDecimalStringSchema,
    unitPrice: NonNegativeDecimalStringSchema.optional(),
    discountPercent: PercentageStringSchema.default("0"),
    billingType: BillingTypeSchema,
    subscriptionPlanId: IdSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.billingType === "RECURRING" &&
      value.subscriptionPlanId === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["subscriptionPlanId"],
        message: "A recurring line requires a subscription plan",
      });
    }
    if (
      value.billingType === "ONE_TIME" &&
      value.subscriptionPlanId !== undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["subscriptionPlanId"],
        message: "A one-time line cannot use a subscription plan",
      });
    }
  });
export type AddQuoteLineRequest = z.infer<typeof AddQuoteLineRequestSchema>;

export const UpdateQuoteLineRequestSchema = z
  .object({
    revision: RevisionSchema,
    variantId: IdSchema.nullable().optional(),
    quantity: PositiveDecimalStringSchema.optional(),
    unitPrice: NonNegativeDecimalStringSchema.optional(),
    discountPercent: PercentageStringSchema.optional(),
    billingType: BillingTypeSchema.optional(),
    subscriptionPlanId: IdSchema.nullable().optional(),
  })
  .strict();
export type UpdateQuoteLineRequest = z.infer<
  typeof UpdateQuoteLineRequestSchema
>;

export const QuoteCalculationRequestSchema = z
  .object({
    revision: RevisionSchema,
    clientRequestNumber: z.number().int().nonnegative().optional(),
  })
  .strict();
export type QuoteCalculationRequest = z.infer<
  typeof QuoteCalculationRequestSchema
>;

export const QuoteCalculationResponseSchema = z.object({
  quoteId: IdSchema,
  versionId: IdSchema,
  revision: RevisionSchema,
  clientRequestNumber: z.number().int().nonnegative().nullable(),
  totals: CommercialTotalsSchema,
  lines: z.array(QuoteLineDtoSchema),
  riskAssessment: QuoteRiskAssessmentDtoSchema,
});
export type QuoteCalculationResponse = z.infer<
  typeof QuoteCalculationResponseSchema
>;

export const QuoteCommandRequestSchema = z
  .object({ revision: RevisionSchema })
  .strict();
export type QuoteCommandRequest = z.infer<typeof QuoteCommandRequestSchema>;

export const DeleteQuoteLineRequestSchema = QuoteCommandRequestSchema;
export type DeleteQuoteLineRequest = z.infer<
  typeof DeleteQuoteLineRequestSchema
>;

export const SendQuoteRequestSchema = QuoteCommandRequestSchema;
export type SendQuoteRequest = z.infer<typeof SendQuoteRequestSchema>;

export const QuoteSubmitResponseSchema = z.object({
  quote: QuoteDtoSchema,
  autoApproved: z.boolean(),
  approvalRequestId: IdSchema.nullable(),
  explanation: z.array(z.string().min(1)),
});
export type QuoteSubmitResponse = z.infer<typeof QuoteSubmitResponseSchema>;

export const RecommendationScoreSchema = z.object({
  affinity: NonNegativeDecimalStringSchema,
  margin: NonNegativeDecimalStringSchema,
  promotion: NonNegativeDecimalStringSchema,
  availability: NonNegativeDecimalStringSchema,
  stockAge: NonNegativeDecimalStringSchema,
  total: NonNegativeDecimalStringSchema,
});
export type RecommendationScore = z.infer<typeof RecommendationScoreSchema>;

export const RecommendationDtoSchema = z.object({
  productId: IdSchema,
  productCode: z.string().min(1),
  productName: z.string().min(1),
  productType: ProductTypeSchema,
  suggestedQuantity: PositiveDecimalStringSchema,
  suggestedUnitPrice: NonNegativeDecimalStringSchema,
  score: RecommendationScoreSchema,
  expectedMarginDelta: z.string(),
  availableQuantity: NonNegativeDecimalStringSchema,
  stockAgeDays: z.number().int().nonnegative().nullable(),
  reasonCodes: z.array(z.string().min(1)),
  explanation: z.string().min(1),
  pricingSnapshot: JsonObjectSchema,
});
export type RecommendationDto = z.infer<typeof RecommendationDtoSchema>;

export const AddRecommendationRequestSchema = z
  .object({
    revision: RevisionSchema,
    quantity: PositiveDecimalStringSchema.default("1"),
    billingType: BillingTypeSchema.optional(),
    subscriptionPlanId: IdSchema.optional(),
  })
  .strict();
export type AddRecommendationRequest = z.infer<
  typeof AddRecommendationRequestSchema
>;

export const VersionDifferenceSchema = z.object({
  path: z.string().min(1),
  label: z.string().min(1),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  material: z.boolean(),
});
export type VersionDifference = z.infer<typeof VersionDifferenceSchema>;

export const QuoteVersionDiffDtoSchema = z.object({
  quoteId: IdSchema,
  fromRevision: RevisionSchema,
  toRevision: RevisionSchema,
  materialChange: z.boolean(),
  differences: z.array(VersionDifferenceSchema),
});
export type QuoteVersionDiffDto = z.infer<typeof QuoteVersionDiffDtoSchema>;
