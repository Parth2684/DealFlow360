import { z } from "zod";

import {
  ActorTypeSchema,
  ConfigurationStatusSchema,
  RecommendationInteractionTypeSchema,
} from "./enums.js";
import {
  DecimalStringSchema,
  decimalStringToScaledInteger,
  IdSchema,
  IsoDateTimeSchema,
  JsonObjectSchema,
  NonNegativeDecimalStringSchema,
  RevisionSchema,
} from "./primitives.js";

export const RecommendationInteractionDtoSchema = z.object({
  id: IdSchema,
  quoteId: IdSchema,
  quoteVersionId: IdSchema,
  productId: IdSchema,
  actorType: ActorTypeSchema,
  actorId: IdSchema.nullable(),
  interaction: RecommendationInteractionTypeSchema,
  scoreSnapshot: JsonObjectSchema,
  reasonCodes: z.array(z.string().min(1)),
  expectedMarginDelta: DecimalStringSchema.nullable(),
  resultingMarginDelta: DecimalStringSchema.nullable(),
  createdAt: IsoDateTimeSchema,
});
export type RecommendationInteractionDto = z.infer<
  typeof RecommendationInteractionDtoSchema
>;

export const RecordRecommendationInteractionRequestSchema = z
  .object({
    quoteRevision: RevisionSchema.optional(),
    interaction: RecommendationInteractionTypeSchema,
  })
  .strict();
export type RecordRecommendationInteractionRequest = z.infer<
  typeof RecordRecommendationInteractionRequestSchema
>;

export const RecommendationRuleDtoSchema = z.object({
  id: IdSchema,
  productId: IdSchema.nullable(),
  code: z.string().min(1),
  name: z.string().min(1),
  version: RevisionSchema,
  priority: z.number().int(),
  affinityWeight: NonNegativeDecimalStringSchema,
  marginWeight: NonNegativeDecimalStringSchema,
  promotionWeight: NonNegativeDecimalStringSchema,
  availabilityWeight: NonNegativeDecimalStringSchema,
  stockAgeWeight: NonNegativeDecimalStringSchema,
  minimumMargin: DecimalStringSchema,
  conditions: JsonObjectSchema,
  effectiveFrom: IsoDateTimeSchema,
  effectiveTo: IsoDateTimeSchema.nullable(),
  status: ConfigurationStatusSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type RecommendationRuleDto = z.infer<typeof RecommendationRuleDtoSchema>;

export const CreateRecommendationRuleRequestSchema = z
  .object({
    productId: IdSchema.optional(),
    code: z.string().trim().min(1).max(40),
    name: z.string().trim().min(1).max(140),
    priority: z.number().int().default(0),
    affinityWeight: NonNegativeDecimalStringSchema.default("0.35"),
    marginWeight: NonNegativeDecimalStringSchema.default("0.2"),
    promotionWeight: NonNegativeDecimalStringSchema.default("0.15"),
    availabilityWeight: NonNegativeDecimalStringSchema.default("0.15"),
    stockAgeWeight: NonNegativeDecimalStringSchema.default("0.15"),
    minimumMargin: DecimalStringSchema.default("0"),
    conditions: JsonObjectSchema.default({}),
    effectiveFrom: IsoDateTimeSchema,
    effectiveTo: IsoDateTimeSchema.optional(),
    status: ConfigurationStatusSchema.default("ACTIVE"),
  })
  .strict()
  .superRefine((value, context) => {
    const weights = [
      value.affinityWeight,
      value.marginWeight,
      value.promotionWeight,
      value.availabilityWeight,
      value.stockAgeWeight,
    ];
    if (
      weights.some(
        (weight) => !NonNegativeDecimalStringSchema.safeParse(weight).success,
      )
    )
      return;
    const total = weights.reduce(
      (sum, weight) => sum + decimalStringToScaledInteger(weight),
      0n,
    );
    if (total !== 10_000n) {
      context.addIssue({
        code: "custom",
        path: ["stockAgeWeight"],
        message: "Recommendation weights must sum to 1",
      });
    }
  });
export type CreateRecommendationRuleRequest = z.infer<
  typeof CreateRecommendationRuleRequestSchema
>;

export const UpdateRecommendationRuleRequestSchema = z
  .object({
    version: RevisionSchema,
    productId: IdSchema.nullable().optional(),
    name: z.string().trim().min(1).max(140).optional(),
    priority: z.number().int().optional(),
    affinityWeight: NonNegativeDecimalStringSchema.optional(),
    marginWeight: NonNegativeDecimalStringSchema.optional(),
    promotionWeight: NonNegativeDecimalStringSchema.optional(),
    availabilityWeight: NonNegativeDecimalStringSchema.optional(),
    stockAgeWeight: NonNegativeDecimalStringSchema.optional(),
    minimumMargin: DecimalStringSchema.optional(),
    conditions: JsonObjectSchema.optional(),
    effectiveFrom: IsoDateTimeSchema.optional(),
    effectiveTo: IsoDateTimeSchema.nullable().optional(),
    status: ConfigurationStatusSchema.optional(),
  })
  .strict();
export type UpdateRecommendationRuleRequest = z.infer<
  typeof UpdateRecommendationRuleRequestSchema
>;
