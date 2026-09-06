import { z } from "zod";

import { OrganizationFormattingSchema } from "./auth.js";
import {
  ActorTypeSchema,
  BillingTypeSchema,
  ChangeRequestActionSchema,
  ChangeRequestStatusSchema,
  CounterofferStatusSchema,
  NegotiationThreadStatusSchema,
  ProductTypeSchema,
  QuoteStageSchema,
  TaxBehaviorSchema,
  VisibilitySchema,
} from "./enums.js";
import {
  CurrencyCodeSchema,
  CursorPageQuerySchema,
  createCursorPageSchema,
  IdSchema,
  IsoDateTimeSchema,
  JsonObjectSchema,
  NonNegativeDecimalStringSchema,
  PercentageStringSchema,
  PositiveDecimalStringSchema,
  RevisionSchema,
  TermsFingerprintSchema,
} from "./primitives.js";

/**
 * Deliberately independent from the internal QuoteLine DTO. Adding an internal
 * cost/risk field cannot accidentally expose it through a schema pick/spread.
 */
export const PortalQuoteLineDtoSchema = z.object({
  id: IdSchema,
  lineNumber: z.number().int().positive(),
  productCode: z.string().min(1),
  productName: z.string().min(1),
  productDescription: z.string().nullable(),
  productType: ProductTypeSchema,
  sku: z.string().nullable(),
  unit: z.string().min(1),
  quantity: PositiveDecimalStringSchema,
  listUnitPrice: NonNegativeDecimalStringSchema,
  unitPrice: NonNegativeDecimalStringSchema,
  discountPercent: PercentageStringSchema,
  lineDiscountAmount: NonNegativeDecimalStringSchema,
  preTaxSubtotal: NonNegativeDecimalStringSchema,
  taxCode: z.string().nullable(),
  taxRate: PercentageStringSchema,
  taxBehavior: TaxBehaviorSchema,
  taxAmount: NonNegativeDecimalStringSchema,
  total: NonNegativeDecimalStringSchema,
  billingType: BillingTypeSchema,
  subscription: z
    .object({
      planName: z.string().min(1),
      intervalLabel: z.string().min(1),
    })
    .nullable(),
});
export type PortalQuoteLineDto = z.infer<typeof PortalQuoteLineDtoSchema>;

export const PortalQuoteDtoSchema = z.object({
  id: IdSchema,
  quoteNumber: z.string().min(1),
  stage: QuoteStageSchema,
  revision: RevisionSchema,
  versionId: IdSchema,
  termsFingerprint: TermsFingerprintSchema,
  customer: z.object({ id: IdSchema, name: z.string().min(1) }),
  seller: z.object({
    organizationName: z.string().min(1),
    representativeName: z.string().min(1),
  }),
  formatting: OrganizationFormattingSchema,
  currency: CurrencyCodeSchema,
  paymentTermsDays: z.number().int().nonnegative(),
  expiresAt: IsoDateTimeSchema.nullable(),
  subtotal: NonNegativeDecimalStringSchema,
  discountTotal: NonNegativeDecimalStringSchema,
  taxTotal: NonNegativeDecimalStringSchema,
  total: NonNegativeDecimalStringSchema,
  notes: z.string().nullable(),
  lines: z.array(PortalQuoteLineDtoSchema),
  canNegotiate: z.boolean(),
  canConfirm: z.boolean(),
  updatedAt: IsoDateTimeSchema,
});
export type PortalQuoteDto = z.infer<typeof PortalQuoteDtoSchema>;

export const PortalQuoteSummaryDtoSchema = PortalQuoteDtoSchema.pick({
  id: true,
  quoteNumber: true,
  stage: true,
  currency: true,
  total: true,
  expiresAt: true,
  updatedAt: true,
});
export const PortalQuoteListDtoSchema = createCursorPageSchema(
  PortalQuoteSummaryDtoSchema,
);

/** Customer-safe immutable version used by portal history and comparison. */
export const PortalQuoteVersionDtoSchema = z.object({
  id: IdSchema,
  revisionNumber: RevisionSchema,
  termsFingerprint: TermsFingerprintSchema,
  currency: CurrencyCodeSchema,
  paymentTermsDays: z.number().int().nonnegative(),
  subtotal: NonNegativeDecimalStringSchema,
  discountTotal: NonNegativeDecimalStringSchema,
  taxTotal: NonNegativeDecimalStringSchema,
  total: NonNegativeDecimalStringSchema,
  notes: z.string().nullable(),
  lines: z.array(PortalQuoteLineDtoSchema),
  isCurrent: z.boolean(),
  createdAt: IsoDateTimeSchema,
});
export type PortalQuoteVersionDto = z.infer<typeof PortalQuoteVersionDtoSchema>;

export const PortalQuoteVersionHistoryDtoSchema = z.object({
  quoteId: IdSchema,
  versions: z.array(PortalQuoteVersionDtoSchema),
});
export type PortalQuoteVersionHistoryDto = z.infer<
  typeof PortalQuoteVersionHistoryDtoSchema
>;

export const PortalQuoteVersionDiffQuerySchema = z
  .object({
    fromVersionId: IdSchema,
    toVersionId: IdSchema,
  })
  .strict()
  .refine((value) => value.fromVersionId !== value.toVersionId, {
    message: "Choose two different quote versions",
    path: ["toVersionId"],
  });
export type PortalQuoteVersionDiffQuery = z.infer<
  typeof PortalQuoteVersionDiffQuerySchema
>;

const PortalVersionDifferenceValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  PortalQuoteLineDtoSchema,
]);

export const PortalVersionDifferenceDtoSchema = z.object({
  path: z.string().min(1),
  label: z.string().min(1),
  before: PortalVersionDifferenceValueSchema.nullable(),
  after: PortalVersionDifferenceValueSchema.nullable(),
  material: z.boolean(),
});
export type PortalVersionDifferenceDto = z.infer<
  typeof PortalVersionDifferenceDtoSchema
>;

export const PortalQuoteVersionDiffDtoSchema = z.object({
  quoteId: IdSchema,
  fromVersionId: IdSchema,
  toVersionId: IdSchema,
  fromRevision: RevisionSchema,
  toRevision: RevisionSchema,
  materialChange: z.boolean(),
  differences: z.array(PortalVersionDifferenceDtoSchema),
});
export type PortalQuoteVersionDiffDto = z.infer<
  typeof PortalQuoteVersionDiffDtoSchema
>;

export const NegotiationMessageDtoSchema = z.object({
  id: IdSchema,
  quoteVersionId: IdSchema,
  quoteLineId: IdSchema.nullable(),
  authorType: ActorTypeSchema,
  authorName: z.string().min(1),
  body: z.string().min(1),
  visibility: VisibilitySchema,
  createdAt: IsoDateTimeSchema,
});
export type NegotiationMessageDto = z.infer<typeof NegotiationMessageDtoSchema>;

export const PortalNegotiationMessagesQuerySchema = CursorPageQuerySchema;
export type PortalNegotiationMessagesQuery = z.infer<
  typeof PortalNegotiationMessagesQuerySchema
>;

export const PortalNegotiationMessagesDtoSchema = createCursorPageSchema(
  NegotiationMessageDtoSchema,
);
export type PortalNegotiationMessagesDto = z.infer<
  typeof PortalNegotiationMessagesDtoSchema
>;

export const CreateNegotiationMessageRequestSchema = z
  .object({
    quoteLineId: IdSchema.optional(),
    body: z.string().trim().min(1).max(4000),
    quoteRevision: RevisionSchema,
  })
  .strict();
export type CreateNegotiationMessageRequest = z.infer<
  typeof CreateNegotiationMessageRequestSchema
>;

export const ChangeRequestItemInputSchema = z
  .object({
    quoteLineId: IdSchema.optional(),
    action: ChangeRequestActionSchema,
    quantity: PositiveDecimalStringSchema.optional(),
    unitPrice: NonNegativeDecimalStringSchema.optional(),
    discountPercent: PercentageStringSchema.optional(),
    terms: JsonObjectSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.action !== "CHANGE_TERMS" && value.quoteLineId === undefined) {
      context.addIssue({
        code: "custom",
        path: ["quoteLineId"],
        message: "A line-level change requires quoteLineId",
      });
    }
    if (value.action === "CHANGE_QUANTITY" && value.quantity === undefined) {
      context.addIssue({
        code: "custom",
        path: ["quantity"],
        message: "Quantity is required",
      });
    }
    if (value.action === "CHANGE_PRICE" && value.unitPrice === undefined) {
      context.addIssue({
        code: "custom",
        path: ["unitPrice"],
        message: "Unit price is required",
      });
    }
    if (
      value.action === "CHANGE_DISCOUNT" &&
      value.discountPercent === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["discountPercent"],
        message: "Discount percent is required",
      });
    }
    if (value.action === "CHANGE_TERMS" && value.terms === undefined) {
      context.addIssue({
        code: "custom",
        path: ["terms"],
        message: "Terms are required",
      });
    }
  });
export type ChangeRequestItemInput = z.infer<
  typeof ChangeRequestItemInputSchema
>;

export const CreateChangeRequestSchema = z
  .object({
    message: z.string().trim().max(4000).optional(),
    quoteRevision: RevisionSchema.optional(),
    requestedChanges: z.array(ChangeRequestItemInputSchema).min(1),
  })
  .strict();
export type CreateChangeRequest = z.infer<typeof CreateChangeRequestSchema>;

export const ChangeRequestItemDtoSchema = ChangeRequestItemInputSchema.extend({
  id: IdSchema,
});
export type ChangeRequestItemDto = z.infer<typeof ChangeRequestItemDtoSchema>;

export const ChangeRequestDtoSchema = z.object({
  id: IdSchema,
  sourceQuoteVersionId: IdSchema,
  sourceTermsFingerprint: TermsFingerprintSchema,
  message: z.string().nullable(),
  status: ChangeRequestStatusSchema,
  requestedByName: z.string().min(1),
  resolutionReason: z.string().nullable(),
  resultingQuoteVersionId: IdSchema.nullable(),
  items: z.array(ChangeRequestItemDtoSchema),
  createdAt: IsoDateTimeSchema,
  resolvedAt: IsoDateTimeSchema.nullable(),
});
export type ChangeRequestDto = z.infer<typeof ChangeRequestDtoSchema>;

/**
 * Contract for the plan's quote-scoped customer "counteroffer" alias.
 * The customer is proposing changes rather than responding to a seller offer,
 * so the persisted and returned domain object is truthfully a ChangeRequest.
 */
export const CustomerCounterproposalDtoSchema = ChangeRequestDtoSchema;
export type CustomerCounterproposalDto = ChangeRequestDto;

export const CounterofferItemInputSchema = z
  .object({
    quoteLineId: IdSchema,
    quantity: PositiveDecimalStringSchema.optional(),
    unitPrice: NonNegativeDecimalStringSchema.optional(),
    discountPercent: PercentageStringSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.quantity !== undefined ||
      value.unitPrice !== undefined ||
      value.discountPercent !== undefined,
    {
      message: "A counteroffer line must change at least one commercial value",
    },
  );
export type CounterofferItemInput = z.infer<typeof CounterofferItemInputSchema>;

export const CreateCounterofferRequestSchema = z
  .object({
    message: z.string().trim().max(4000).optional(),
    proposedChanges: z.array(CounterofferItemInputSchema).min(1),
  })
  .strict();
export type CreateCounterofferRequest = z.infer<
  typeof CreateCounterofferRequestSchema
>;

export const CreateCustomerCounterproposalRequestSchema =
  CreateCounterofferRequestSchema.extend({
    quoteRevision: RevisionSchema,
    termsFingerprint: TermsFingerprintSchema,
  }).strict();
export type CreateCustomerCounterproposalRequest = z.infer<
  typeof CreateCustomerCounterproposalRequestSchema
>;

export const CounterofferDtoSchema = z.object({
  id: IdSchema,
  changeRequestId: IdSchema,
  sourceQuoteVersionId: IdSchema,
  sourceTermsFingerprint: TermsFingerprintSchema,
  offeredByName: z.string().min(1),
  message: z.string().nullable(),
  status: CounterofferStatusSchema,
  customerDecisionReason: z.string().nullable(),
  resultingQuoteVersionId: IdSchema.nullable(),
  proposedChanges: z.array(CounterofferItemInputSchema),
  createdAt: IsoDateTimeSchema,
  decidedAt: IsoDateTimeSchema.nullable(),
});
export type CounterofferDto = z.infer<typeof CounterofferDtoSchema>;

export const NegotiationDecisionRequestSchema = z
  .object({ reason: z.string().trim().min(1).max(1000).optional() })
  .strict();
export type NegotiationDecisionRequest = z.infer<
  typeof NegotiationDecisionRequestSchema
>;

export const PortalQuoteConfirmationRequestSchema = z
  .object({
    revision: RevisionSchema,
    termsFingerprint: TermsFingerprintSchema,
  })
  .strict();
export type PortalQuoteConfirmationRequest = z.infer<
  typeof PortalQuoteConfirmationRequestSchema
>;

export const PortalQuoteConfirmationResponseSchema = z.object({
  accepted: z.literal(true),
  acceptedAt: IsoDateTimeSchema,
  quoteId: IdSchema,
  quoteVersionId: IdSchema,
});
export type PortalQuoteConfirmationResponse = z.infer<
  typeof PortalQuoteConfirmationResponseSchema
>;

export const NegotiationThreadDtoSchema = z.object({
  id: IdSchema,
  quoteId: IdSchema,
  status: NegotiationThreadStatusSchema,
  messages: z.array(NegotiationMessageDtoSchema),
  changeRequests: z.array(ChangeRequestDtoSchema),
  openedAt: IsoDateTimeSchema,
  closedAt: IsoDateTimeSchema.nullable(),
});
export type NegotiationThreadDto = z.infer<typeof NegotiationThreadDtoSchema>;

export const InternalNegotiationDtoSchema = z.object({
  messages: z.array(NegotiationMessageDtoSchema),
  changeRequests: z.array(ChangeRequestDtoSchema),
  counteroffers: z.array(CounterofferDtoSchema),
});
