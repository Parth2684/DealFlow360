import { z } from "zod";

import {
  BillingIntervalSchema,
  ConfigurationStatusSchema,
  ProductTypeSchema,
  ProrationConventionSchema,
  TaxBehaviorSchema,
} from "./enums.js";
import {
  CodeSchema,
  CurrencyCodeSchema,
  CursorPageQuerySchema,
  EmailSchema,
  IdSchema,
  IsoDateTimeSchema,
  JsonObjectSchema,
  NonNegativeDecimalStringSchema,
  PercentageStringSchema,
  PositiveDecimalStringSchema,
  PositiveIntegerSchema,
  RevisionSchema,
} from "./primitives.js";

const nullableId = IdSchema.nullable();
const nullableDateTime = IsoDateTimeSchema.nullable();

export const CustomerTierDtoSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  code: z.string().min(1),
  priority: z.number().int(),
  status: ConfigurationStatusSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type CustomerTierDto = z.infer<typeof CustomerTierDtoSchema>;

export const CreateCustomerTierRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    code: CodeSchema,
    priority: z.number().int().default(0),
  })
  .strict();
export type CreateCustomerTierRequest = z.infer<
  typeof CreateCustomerTierRequestSchema
>;

export const UpdateCustomerTierRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    priority: z.number().int().optional(),
    active: z.boolean().optional(),
    status: ConfigurationStatusSchema.optional(),
  })
  .strict();
export type UpdateCustomerTierRequest = z.infer<
  typeof UpdateCustomerTierRequestSchema
>;

export const PersonSummarySchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  email: EmailSchema.optional(),
});
export type PersonSummary = z.infer<typeof PersonSummarySchema>;

export const CustomerAccountDtoSchema = z.object({
  id: IdSchema,
  accountCode: z.string().min(1),
  name: z.string().min(1),
  tier: CustomerTierDtoSchema.pick({ id: true, name: true, code: true }),
  salesTeam: z.object({ id: IdSchema, name: z.string().min(1) }).nullable(),
  assignedRep: PersonSummarySchema.nullable(),
  preferredCurrency: CurrencyCodeSchema,
  paymentTermsDays: z.number().int().nonnegative(),
  creditLimit: NonNegativeDecimalStringSchema,
  currentExposure: NonNegativeDecimalStringSchema,
  overdueBalance: NonNegativeDecimalStringSchema,
  status: ConfigurationStatusSchema,
  revision: RevisionSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type CustomerAccountDto = z.infer<typeof CustomerAccountDtoSchema>;

export const CustomerAccountListQuerySchema = CursorPageQuerySchema.extend({
  search: z.string().trim().min(1).max(200).optional(),
}).strict();
export type CustomerAccountListQuery = z.infer<
  typeof CustomerAccountListQuerySchema
>;

export const CreateCustomerAccountRequestSchema = z
  .object({
    accountCode: CodeSchema.optional(),
    name: z.string().trim().min(1).max(180),
    tierId: IdSchema,
    salesTeamId: IdSchema.optional(),
    assignedRepId: IdSchema.optional(),
    preferredCurrency: CurrencyCodeSchema.default("USD"),
    paymentTermsDays: z.number().int().min(0).max(365).default(30),
    creditLimit: NonNegativeDecimalStringSchema.default("0"),
  })
  .strict();
export type CreateCustomerAccountRequest = z.infer<
  typeof CreateCustomerAccountRequestSchema
>;

export const UpdateCustomerAccountRequestSchema = z
  .object({
    revision: RevisionSchema,
    name: z.string().trim().min(1).max(180).optional(),
    tierId: IdSchema.optional(),
    salesTeamId: IdSchema.nullable().optional(),
    assignedRepId: IdSchema.nullable().optional(),
    preferredCurrency: CurrencyCodeSchema.optional(),
    paymentTermsDays: z.number().int().min(0).max(365).optional(),
    creditLimit: NonNegativeDecimalStringSchema.optional(),
    active: z.boolean().optional(),
    status: ConfigurationStatusSchema.optional(),
  })
  .strict();
export type UpdateCustomerAccountRequest = z.infer<
  typeof UpdateCustomerAccountRequestSchema
>;

export const CustomerContactDtoSchema = z.object({
  id: IdSchema,
  customerAccountId: IdSchema,
  email: EmailSchema,
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  isPrimary: z.boolean(),
  portalEnabled: z.boolean(),
  status: ConfigurationStatusSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type CustomerContactDto = z.infer<typeof CustomerContactDtoSchema>;

export const CreateCustomerContactRequestSchema = z
  .object({
    email: EmailSchema,
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    isPrimary: z.boolean().default(false),
    portalEnabled: z.boolean().default(false),
  })
  .strict();
export type CreateCustomerContactRequest = z.infer<
  typeof CreateCustomerContactRequestSchema
>;

export const UpdateCustomerContactRequestSchema =
  CreateCustomerContactRequestSchema.partial()
    .extend({ status: ConfigurationStatusSchema.optional() })
    .strict();
export type UpdateCustomerContactRequest = z.infer<
  typeof UpdateCustomerContactRequestSchema
>;

export const ProductCategoryDtoSchema = z.object({
  id: IdSchema,
  parentId: nullableId,
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  status: ConfigurationStatusSchema,
  revision: RevisionSchema,
});
export type ProductCategoryDto = z.infer<typeof ProductCategoryDtoSchema>;

export const CreateProductCategoryRequestSchema = z
  .object({
    parentId: IdSchema.optional(),
    code: CodeSchema,
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).optional(),
  })
  .strict();
export type CreateProductCategoryRequest = z.infer<
  typeof CreateProductCategoryRequestSchema
>;

export const UpdateProductCategoryRequestSchema =
  CreateProductCategoryRequestSchema.partial()
    .extend({
      revision: RevisionSchema,
      parentId: IdSchema.nullable().optional(),
      status: ConfigurationStatusSchema.optional(),
    })
    .strict();
export type UpdateProductCategoryRequest = z.infer<
  typeof UpdateProductCategoryRequestSchema
>;

export const TaxDtoSchema = z.object({
  id: IdSchema,
  code: z.string().min(1),
  name: z.string().min(1),
  rate: PercentageStringSchema,
  behavior: TaxBehaviorSchema,
  effectiveFrom: IsoDateTimeSchema,
  effectiveTo: nullableDateTime,
  status: ConfigurationStatusSchema,
});
export type TaxDto = z.infer<typeof TaxDtoSchema>;

export const CreateTaxRequestSchema = z
  .object({
    code: CodeSchema.optional(),
    name: z.string().trim().min(1).max(100),
    rate: PercentageStringSchema,
    behavior: TaxBehaviorSchema,
    effectiveFrom: IsoDateTimeSchema,
    effectiveTo: IsoDateTimeSchema.optional(),
  })
  .strict();
export type CreateTaxRequest = z.infer<typeof CreateTaxRequestSchema>;

export const UpdateTaxRequestSchema = z
  .object({
    rate: PercentageStringSchema.optional(),
    behavior: TaxBehaviorSchema.optional(),
    active: z.boolean().optional(),
    status: ConfigurationStatusSchema.optional(),
    effectiveTo: IsoDateTimeSchema.nullable().optional(),
  })
  .strict();
export type UpdateTaxRequest = z.infer<typeof UpdateTaxRequestSchema>;

export const ProductVariantDtoSchema = z.object({
  id: IdSchema,
  productId: IdSchema,
  sku: z.string().min(1),
  name: z.string().nullable(),
  attributes: JsonObjectSchema,
  priceSurcharge: NonNegativeDecimalStringSchema,
  status: ConfigurationStatusSchema,
  revision: RevisionSchema,
});
export type ProductVariantDto = z.infer<typeof ProductVariantDtoSchema>;

export const CreateProductVariantRequestSchema = z
  .object({
    sku: CodeSchema,
    name: z.string().trim().min(1).max(120).optional(),
    attributes: JsonObjectSchema.default({}),
    priceSurcharge: NonNegativeDecimalStringSchema.default("0"),
  })
  .strict();
export type CreateProductVariantRequest = z.infer<
  typeof CreateProductVariantRequestSchema
>;

export const UpdateProductVariantRequestSchema = z
  .object({
    revision: RevisionSchema,
    sku: CodeSchema.optional(),
    name: z.string().trim().min(1).max(120).nullable().optional(),
    attributes: JsonObjectSchema.optional(),
    priceSurcharge: NonNegativeDecimalStringSchema.optional(),
    status: ConfigurationStatusSchema.optional(),
  })
  .strict();
export type UpdateProductVariantRequest = z.infer<
  typeof UpdateProductVariantRequestSchema
>;

export const ProductDtoSchema = z.object({
  id: IdSchema,
  categoryId: IdSchema,
  taxId: nullableId,
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  type: ProductTypeSchema,
  unit: z.string().min(1),
  standardCost: NonNegativeDecimalStringSchema,
  status: ConfigurationStatusSchema,
  revision: RevisionSchema,
  category: ProductCategoryDtoSchema.pick({ id: true, code: true, name: true }),
  tax: TaxDtoSchema.nullable(),
  variants: z.array(ProductVariantDtoSchema),
});
export type ProductDto = z.infer<typeof ProductDtoSchema>;

export const CreateProductRequestSchema = z
  .object({
    categoryId: IdSchema,
    taxId: IdSchema.optional(),
    code: CodeSchema,
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(4000).optional(),
    type: ProductTypeSchema,
    unit: z.string().trim().min(1).max(32).default("each"),
    standardCost: NonNegativeDecimalStringSchema,
  })
  .strict();
export type CreateProductRequest = z.infer<typeof CreateProductRequestSchema>;

export const UpdateProductRequestSchema = CreateProductRequestSchema.partial()
  .extend({
    revision: RevisionSchema,
    taxId: IdSchema.nullable().optional(),
    status: ConfigurationStatusSchema.optional(),
  })
  .strict();
export type UpdateProductRequest = z.infer<typeof UpdateProductRequestSchema>;

export const PriceListDtoSchema = z.object({
  id: IdSchema,
  code: z.string().min(1),
  name: z.string().min(1),
  currency: CurrencyCodeSchema,
  priority: z.number().int(),
  effectiveFrom: IsoDateTimeSchema,
  effectiveTo: nullableDateTime,
  status: ConfigurationStatusSchema,
});
export type PriceListDto = z.infer<typeof PriceListDtoSchema>;

export const CreatePriceListRequestSchema = z
  .object({
    code: CodeSchema.optional(),
    name: z.string().trim().min(1).max(120),
    currency: CurrencyCodeSchema,
    priority: z.number().int().default(0),
    effectiveFrom: IsoDateTimeSchema,
    effectiveTo: IsoDateTimeSchema.optional(),
  })
  .strict();
export type CreatePriceListRequest = z.infer<
  typeof CreatePriceListRequestSchema
>;

export const UpdatePriceListRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    priority: z.number().int().optional(),
    active: z.boolean().optional(),
    status: ConfigurationStatusSchema.optional(),
    effectiveTo: IsoDateTimeSchema.nullable().optional(),
  })
  .strict();
export type UpdatePriceListRequest = z.infer<
  typeof UpdatePriceListRequestSchema
>;

export const PriceRuleDtoSchema = z.object({
  id: IdSchema,
  priceListId: IdSchema,
  productId: nullableId,
  categoryId: nullableId,
  tierId: nullableId,
  minQuantity: PositiveDecimalStringSchema,
  unitPrice: NonNegativeDecimalStringSchema,
  priority: z.number().int(),
  effectiveFrom: IsoDateTimeSchema,
  effectiveTo: nullableDateTime,
  status: ConfigurationStatusSchema,
});
export type PriceRuleDto = z.infer<typeof PriceRuleDtoSchema>;

export const CreatePriceRuleRequestSchema = z
  .object({
    productId: IdSchema.optional(),
    categoryId: IdSchema.optional(),
    tierId: IdSchema.optional(),
    minQuantity: PositiveDecimalStringSchema.default("1"),
    unitPrice: NonNegativeDecimalStringSchema,
    priority: z.number().int().default(0),
    effectiveFrom: IsoDateTimeSchema,
    effectiveTo: IsoDateTimeSchema.optional(),
  })
  .strict()
  .refine(
    (value) => value.productId !== undefined || value.categoryId !== undefined,
    {
      message: "A price rule must target a product or category",
      path: ["productId"],
    },
  );
export type CreatePriceRuleRequest = z.infer<
  typeof CreatePriceRuleRequestSchema
>;

export const UpdatePriceRuleRequestSchema = z
  .object({
    minQuantity: PositiveDecimalStringSchema.optional(),
    unitPrice: NonNegativeDecimalStringSchema.optional(),
    priority: z.number().int().optional(),
    effectiveTo: IsoDateTimeSchema.nullable().optional(),
    status: ConfigurationStatusSchema.optional(),
  })
  .strict();
export type UpdatePriceRuleRequest = z.infer<
  typeof UpdatePriceRuleRequestSchema
>;

const UniqueProductIdsSchema = z
  .array(IdSchema)
  .min(1)
  .max(100)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "Promotion product IDs must be unique",
  });

export const PromotionDtoSchema = z.object({
  id: IdSchema,
  code: z.string().min(1),
  name: z.string().min(1),
  priority: z.number().int(),
  conditions: JsonObjectSchema,
  benefit: JsonObjectSchema,
  recommendationBoost: NonNegativeDecimalStringSchema,
  effectiveFrom: IsoDateTimeSchema,
  effectiveTo: nullableDateTime,
  status: ConfigurationStatusSchema,
  revision: RevisionSchema,
  productIds: z.array(IdSchema),
});
export type PromotionDto = z.infer<typeof PromotionDtoSchema>;

export const CreatePromotionRequestSchema = z
  .object({
    code: CodeSchema,
    name: z.string().trim().min(1).max(120),
    priority: z.number().int().default(0),
    conditions: JsonObjectSchema.default({}),
    benefit: JsonObjectSchema.default({}),
    recommendationBoost: NonNegativeDecimalStringSchema.default("0"),
    effectiveFrom: IsoDateTimeSchema,
    effectiveTo: IsoDateTimeSchema.optional(),
    productIds: UniqueProductIdsSchema,
  })
  .strict();
export type CreatePromotionRequest = z.infer<
  typeof CreatePromotionRequestSchema
>;

export const UpdatePromotionRequestSchema = z
  .object({
    revision: RevisionSchema,
    name: z.string().trim().min(1).max(120).optional(),
    priority: z.number().int().optional(),
    conditions: JsonObjectSchema.optional(),
    benefit: JsonObjectSchema.optional(),
    recommendationBoost: NonNegativeDecimalStringSchema.optional(),
    effectiveFrom: IsoDateTimeSchema.optional(),
    effectiveTo: IsoDateTimeSchema.nullable().optional(),
    productIds: UniqueProductIdsSchema.optional(),
    status: ConfigurationStatusSchema.optional(),
  })
  .strict();
export type UpdatePromotionRequest = z.infer<
  typeof UpdatePromotionRequestSchema
>;

export const DiscountLimitDtoSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  tierId: nullableId,
  categoryId: nullableId,
  productId: nullableId,
  maxDiscountPercent: PercentageStringSchema,
  priority: z.number().int(),
  effectiveFrom: IsoDateTimeSchema,
  effectiveTo: nullableDateTime,
  status: ConfigurationStatusSchema,
});
export type DiscountLimitDto = z.infer<typeof DiscountLimitDtoSchema>;

export const CreateDiscountLimitRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    tierId: IdSchema.optional(),
    categoryId: IdSchema.optional(),
    productId: IdSchema.optional(),
    maxDiscountPct: PercentageStringSchema,
    priority: z.number().int().default(0),
    effectiveFrom: IsoDateTimeSchema,
    effectiveTo: IsoDateTimeSchema.optional(),
  })
  .strict();
export type CreateDiscountLimitRequest = z.infer<
  typeof CreateDiscountLimitRequestSchema
>;

export const UpdateDiscountLimitRequestSchema = z
  .object({
    maxDiscountPct: PercentageStringSchema.optional(),
    priority: z.number().int().optional(),
    active: z.boolean().optional(),
    status: ConfigurationStatusSchema.optional(),
    effectiveTo: IsoDateTimeSchema.nullable().optional(),
  })
  .strict();
export type UpdateDiscountLimitRequest = z.infer<
  typeof UpdateDiscountLimitRequestSchema
>;

export const SubscriptionCancellationRulesSchema = z
  .object({
    noticeDays: z.number().int().min(0).max(3650).default(0),
  })
  .strict();
export type SubscriptionCancellationRules = z.infer<
  typeof SubscriptionCancellationRulesSchema
>;

export const SubscriptionRefundRulesSchema = z
  .object({
    unusedDays: z.enum(["credit", "no_credit"]).default("credit"),
  })
  .strict();
export type SubscriptionRefundRules = z.infer<
  typeof SubscriptionRefundRulesSchema
>;

export const SubscriptionPlanDtoSchema = z.object({
  id: IdSchema,
  code: z.string().min(1),
  name: z.string().min(1),
  interval: BillingIntervalSchema,
  intervalCount: PositiveIntegerSchema,
  prorationConvention: ProrationConventionSchema,
  cancellationRules: SubscriptionCancellationRulesSchema,
  refundRules: SubscriptionRefundRulesSchema,
  status: ConfigurationStatusSchema,
});
export type SubscriptionPlanDto = z.infer<typeof SubscriptionPlanDtoSchema>;

export const CreateSubscriptionPlanRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    code: CodeSchema,
    interval: BillingIntervalSchema,
    intervalCount: PositiveIntegerSchema.default(1),
    prorationConvention: ProrationConventionSchema.default("CALENDAR_DAYS"),
    cancellationRules: SubscriptionCancellationRulesSchema.default({
      noticeDays: 0,
    }),
    refundRules: SubscriptionRefundRulesSchema.default({
      unusedDays: "credit",
    }),
  })
  .strict();
export type CreateSubscriptionPlanRequest = z.infer<
  typeof CreateSubscriptionPlanRequestSchema
>;

export const UpdateSubscriptionPlanRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    interval: BillingIntervalSchema.optional(),
    intervalCount: PositiveIntegerSchema.optional(),
    prorationConvention: ProrationConventionSchema.optional(),
    cancellationRules: SubscriptionCancellationRulesSchema.optional(),
    refundRules: SubscriptionRefundRulesSchema.optional(),
    active: z.boolean().optional(),
    status: ConfigurationStatusSchema.optional(),
  })
  .strict();
export type UpdateSubscriptionPlanRequest = z.infer<
  typeof UpdateSubscriptionPlanRequestSchema
>;
