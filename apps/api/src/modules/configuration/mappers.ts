import {
  JsonObjectSchema,
  SubscriptionPlanDtoSchema,
  type ApprovalPolicyDto,
  type CustomerAccountDto,
  type CustomerContactDto,
  type CustomerTierDto,
  type DiscountLimitDto,
  type PriceListDto,
  type PriceRuleDto,
  type ProductVariantDto,
  type ProductCategoryDto,
  type ProductDto,
  type PromotionDto,
  type RecommendationRuleDto,
  type SubscriptionPlanDto,
  type TaxDto,
  type WarehouseDto,
} from "@repo/common";
import type { Prisma } from "@repo/db";

import { toJsonValue } from "../../shared/http.js";

export type CustomerAccountRecord = Prisma.CustomerAccountGetPayload<{
  include: { assignedRep: true; salesTeam: true; tier: true };
}>;

export type ProductRecord = Prisma.ProductGetPayload<{
  include: { category: true; tax: true; variants: true };
}>;

export type PromotionRecord = Prisma.PromotionGetPayload<{
  include: { products: true };
}>;

export type ApprovalPolicyRecord = Prisma.ApprovalPolicyGetPayload<{
  include: { stepTemplates: true };
}>;

function jsonObject(value: unknown) {
  return JsonObjectSchema.parse(toJsonValue(value));
}

export function mapCustomerTier(
  record: Prisma.CustomerTierGetPayload<object>,
): CustomerTierDto {
  return {
    id: record.id,
    name: record.name,
    code: record.code,
    priority: record.priority,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function mapCustomerAccount(
  record: CustomerAccountRecord,
): CustomerAccountDto {
  return {
    id: record.id,
    accountCode: record.accountCode,
    name: record.name,
    tier: {
      id: record.tier.id,
      name: record.tier.name,
      code: record.tier.code,
    },
    salesTeam:
      record.salesTeam === null
        ? null
        : { id: record.salesTeam.id, name: record.salesTeam.name },
    assignedRep:
      record.assignedRep === null
        ? null
        : {
            id: record.assignedRep.id,
            name: `${record.assignedRep.firstName} ${record.assignedRep.lastName}`,
            email: record.assignedRep.email,
          },
    preferredCurrency: record.preferredCurrency,
    paymentTermsDays: record.paymentTermsDays,
    creditLimit: record.creditLimit.toString(),
    currentExposure: record.currentExposure.toString(),
    overdueBalance: record.overdueBalance.toString(),
    status: record.status,
    revision: record.revision,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function mapCustomerContact(
  record: Prisma.CustomerContactGetPayload<object>,
): CustomerContactDto {
  return {
    id: record.id,
    customerAccountId: record.customerAccountId,
    email: record.email,
    firstName: record.firstName,
    lastName: record.lastName,
    isPrimary: record.isPrimary,
    portalEnabled: record.portalEnabled,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function mapProductCategory(
  record: Prisma.ProductCategoryGetPayload<object>,
): ProductCategoryDto {
  return {
    id: record.id,
    parentId: record.parentId,
    code: record.code,
    name: record.name,
    description: record.description,
    status: record.status,
    revision: record.revision,
  };
}

export function mapTax(record: Prisma.TaxGetPayload<object>): TaxDto {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    rate: record.rate.toString(),
    behavior: record.behavior,
    effectiveFrom: record.effectiveFrom.toISOString(),
    effectiveTo: record.effectiveTo?.toISOString() ?? null,
    status: record.status,
  };
}

export function mapProduct(record: ProductRecord): ProductDto {
  return {
    id: record.id,
    categoryId: record.categoryId,
    taxId: record.taxId,
    code: record.code,
    name: record.name,
    description: record.description,
    type: record.type,
    unit: record.unit,
    standardCost: record.standardCost.toString(),
    status: record.status,
    revision: record.revision,
    category: {
      id: record.category.id,
      code: record.category.code,
      name: record.category.name,
    },
    tax: record.tax === null ? null : mapTax(record.tax),
    variants: record.variants.map(mapProductVariant),
  };
}

export function mapProductVariant(
  record: Prisma.ProductVariantGetPayload<object>,
): ProductVariantDto {
  return {
    id: record.id,
    productId: record.productId,
    sku: record.sku,
    name: record.name,
    attributes: jsonObject(record.attributes),
    priceSurcharge: record.priceSurcharge.toString(),
    status: record.status,
    revision: record.revision,
  };
}

export function mapPromotion(record: PromotionRecord): PromotionDto {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    priority: record.priority,
    conditions: jsonObject(record.conditions),
    benefit: jsonObject(record.benefit),
    recommendationBoost: record.recommendationBoost.toString(),
    effectiveFrom: record.effectiveFrom.toISOString(),
    effectiveTo: record.effectiveTo?.toISOString() ?? null,
    status: record.status,
    revision: record.revision,
    productIds: record.products.map((product) => product.productId),
  };
}

export function mapPriceList(
  record: Prisma.PriceListGetPayload<object>,
): PriceListDto {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    currency: record.currency,
    priority: record.priority,
    effectiveFrom: record.effectiveFrom.toISOString(),
    effectiveTo: record.effectiveTo?.toISOString() ?? null,
    status: record.status,
  };
}

export function mapPriceRule(
  record: Prisma.PriceRuleGetPayload<object>,
): PriceRuleDto {
  return {
    id: record.id,
    priceListId: record.priceListId,
    productId: record.productId,
    categoryId: record.categoryId,
    tierId: record.tierId,
    minQuantity: record.minQuantity.toString(),
    unitPrice: record.unitPrice.toString(),
    priority: record.priority,
    effectiveFrom: record.effectiveFrom.toISOString(),
    effectiveTo: record.effectiveTo?.toISOString() ?? null,
    status: record.status,
  };
}

export function mapDiscountLimit(
  record: Prisma.DiscountLimitGetPayload<object>,
): DiscountLimitDto {
  return {
    id: record.id,
    name: record.name,
    tierId: record.tierId,
    categoryId: record.categoryId,
    productId: record.productId,
    maxDiscountPercent: record.maxDiscountPercent.toString(),
    priority: record.priority,
    effectiveFrom: record.effectiveFrom.toISOString(),
    effectiveTo: record.effectiveTo?.toISOString() ?? null,
    status: record.status,
  };
}

export function mapSubscriptionPlan(
  record: Prisma.SubscriptionPlanGetPayload<object>,
): SubscriptionPlanDto {
  return SubscriptionPlanDtoSchema.parse({
    id: record.id,
    code: record.code,
    name: record.name,
    interval: record.interval,
    intervalCount: record.intervalCount,
    prorationConvention: record.prorationConvention,
    cancellationRules: jsonObject(record.cancellationRules),
    refundRules: jsonObject(record.refundRules),
    status: record.status,
  });
}

export function mapWarehouse(
  record: Prisma.WarehouseGetPayload<object>,
): WarehouseDto {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    address: jsonObject(record.address),
    shippingCostWeight: record.shippingCostWeight.toString(),
    leadTimeDays: record.leadTimeDays,
    status: record.status,
    revision: record.revision,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function mapApprovalPolicy(
  record: ApprovalPolicyRecord,
): ApprovalPolicyDto {
  return {
    id: record.id,
    code: record.code,
    version: record.version,
    name: record.name,
    predicates: jsonObject(record.predicates),
    priority: record.priority,
    status: record.status,
    effectiveFrom: record.effectiveFrom.toISOString(),
    effectiveTo: record.effectiveTo?.toISOString() ?? null,
    steps: [...record.stepTemplates]
      .sort((left, right) => left.sequence - right.sequence)
      .map((step) => ({
        sequence: step.sequence,
        requiredRole: step.requiredRole,
        requiredCapability: step.requiredCapability,
        assigneeStrategy: step.assigneeStrategy,
        ...(step.dueAfterHours === null
          ? {}
          : { dueAfterHours: step.dueAfterHours }),
      })),
  };
}

export function mapRecommendationRule(
  record: Prisma.RecommendationRuleGetPayload<object>,
): RecommendationRuleDto {
  return {
    id: record.id,
    productId: record.productId,
    code: record.code,
    name: record.name,
    version: record.version,
    priority: record.priority,
    affinityWeight: record.affinityWeight.toString(),
    marginWeight: record.marginWeight.toString(),
    promotionWeight: record.promotionWeight.toString(),
    availabilityWeight: record.availabilityWeight.toString(),
    stockAgeWeight: record.stockAgeWeight.toString(),
    minimumMargin: record.minimumMargin.toString(),
    conditions: jsonObject(record.conditions),
    effectiveFrom: record.effectiveFrom.toISOString(),
    effectiveTo: record.effectiveTo?.toISOString() ?? null,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
