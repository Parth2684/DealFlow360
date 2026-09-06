import {
  Router,
  type ErrorRequestHandler,
  type Request,
  type RequestHandler,
} from "express";

import {
  CreateApprovalPolicyRequestSchema,
  CreateCustomerAccountRequestSchema,
  CreateCustomerContactRequestSchema,
  CreateCustomerTierRequestSchema,
  CreateDiscountLimitRequestSchema,
  CreatePriceListRequestSchema,
  CreatePriceRuleRequestSchema,
  CreateProductCategoryRequestSchema,
  CreateProductRequestSchema,
  CreateProductVariantRequestSchema,
  CreatePromotionRequestSchema,
  CreateRecommendationRuleRequestSchema,
  CreateSubscriptionPlanRequestSchema,
  CreateTaxRequestSchema,
  CreateWarehouseRequestSchema,
  CursorPageQuerySchema,
  CustomerAccountListQuerySchema,
  UpdateApprovalPolicyRequestSchema,
  UpdateCustomerAccountRequestSchema,
  UpdateCustomerContactRequestSchema,
  UpdateCustomerTierRequestSchema,
  UpdateDiscountLimitRequestSchema,
  UpdatePriceListRequestSchema,
  UpdatePriceRuleRequestSchema,
  UpdateProductCategoryRequestSchema,
  UpdateProductRequestSchema,
  UpdateProductVariantRequestSchema,
  UpdatePromotionRequestSchema,
  UpdateRecommendationRuleRequestSchema,
  UpdateSubscriptionPlanRequestSchema,
  UpdateTaxRequestSchema,
  UpdateWarehouseRequestSchema,
  type ConfigurationStatus,
} from "@repo/common";
import { Prisma, prisma } from "@repo/db";

import {
  authenticateInternal,
  internalPrincipal,
  requireCapability,
  requireCsrf,
} from "../../middleware/auth.js";
import { jsonInput, recordActivity } from "../../shared/activity.js";
import { approvalAuthority } from "../../shared/approval-authority.js";
import { conflict, HttpError, notFound } from "../../shared/errors.js";
import {
  cursorArgs,
  pageFromRows,
  parseBody,
  parseId,
  parseQuery,
} from "../../shared/http.js";
import type { InternalPrincipal } from "../../shared/types.js";
import {
  mapApprovalPolicy,
  mapCustomerAccount,
  mapCustomerContact,
  mapCustomerTier,
  mapDiscountLimit,
  mapPriceList,
  mapPriceRule,
  mapProduct,
  mapProductCategory,
  mapProductVariant,
  mapPromotion,
  mapRecommendationRule,
  mapSubscriptionPlan,
  mapTax,
  mapWarehouse,
} from "./mappers.js";

const customerAccountInclude = {
  assignedRep: true,
  salesTeam: true,
  tier: true,
} satisfies Prisma.CustomerAccountInclude;

const productInclude = {
  category: true,
  tax: true,
  variants: { orderBy: { id: "asc" } },
} satisfies Prisma.ProductInclude;

const promotionInclude = {
  products: { orderBy: { productId: "asc" } },
} satisfies Prisma.PromotionInclude;

const approvalPolicyInclude = {
  stepTemplates: { orderBy: { sequence: "asc" } },
} as const satisfies Prisma.ApprovalPolicyInclude;

type TransactionClient = Prisma.TransactionClient;
type StatusPatch = {
  active?: boolean;
  status?: ConfigurationStatus;
};

function serializableWrite<T>(
  operation: (transaction: TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(operation, { isolationLevel: "Serializable" });
}

function pageQuery(request: Request): {
  cursor?: string;
  limit: number;
} {
  const query = parseQuery(CursorPageQuerySchema, request);
  return {
    limit: query.limit,
    ...(query.cursor === undefined
      ? {}
      : { cursor: parseId(query.cursor, "cursor") }),
  };
}

function pathId(value: string | string[] | undefined, label: string): string {
  return parseId(Array.isArray(value) ? undefined : value, label);
}

function mappedPage<T extends { id: string }, U>(
  rows: T[],
  limit: number,
  mapper: (row: T) => U,
) {
  const page = pageFromRows(rows, limit);
  return { ...page, items: page.items.map(mapper) };
}

function generatedCode(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function effectiveDate(value: string): Date {
  return new Date(value);
}

function nullableEffectiveDate(
  value: string | null | undefined,
): Date | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : effectiveDate(value);
}

function nextEffectiveDate(
  value: string | null | undefined,
  current: Date | null,
): Date | null {
  const parsed = nullableEffectiveDate(value);
  return parsed === undefined ? current : parsed;
}

function assertEffectiveRange(
  effectiveFrom: Date,
  effectiveTo: Date | null,
): void {
  if (effectiveTo !== null && effectiveTo <= effectiveFrom) {
    throw new HttpError(
      422,
      "Validation failed",
      "effectiveTo must be later than effectiveFrom",
      { code: "INVALID_EFFECTIVE_PERIOD" },
    );
  }
}

function overlapWindow(effectiveFrom: Date, effectiveTo: Date | null) {
  return {
    ...(effectiveTo === null ? {} : { effectiveFrom: { lt: effectiveTo } }),
    OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
  };
}

function statusUpdate(
  patch: StatusPatch,
): { status: ConfigurationStatus; archivedAt: Date | null } | object {
  const activeStatus =
    patch.active === undefined
      ? undefined
      : patch.active
        ? ("ACTIVE" as const)
        : ("ARCHIVED" as const);

  if (
    activeStatus !== undefined &&
    patch.status !== undefined &&
    activeStatus !== patch.status
  ) {
    throw new HttpError(
      422,
      "Validation failed",
      "active and status describe conflicting states",
      { code: "CONFLICTING_STATUS_FIELDS" },
    );
  }

  const status = activeStatus ?? patch.status;
  if (status === undefined) return {};
  return {
    status,
    archivedAt: status === "ARCHIVED" ? new Date() : null,
  };
}

function addressInput(value: Record<string, unknown> | string) {
  return jsonInput(typeof value === "string" ? { formatted: value } : value);
}

async function recordWrite(
  transaction: TransactionClient,
  actor: InternalPrincipal,
  input: {
    action: "created" | "updated" | "archived" | "versioned";
    entityType: string;
    entityId: string;
    entityVersion?: number;
    before?: unknown;
    after?: unknown;
  },
): Promise<void> {
  await recordActivity(transaction, {
    organizationId: actor.organizationId,
    actor,
    eventType: "deal.activityRecorded",
    entityType: input.entityType,
    entityId: input.entityId,
    entityVersion: input.entityVersion,
    before: input.before,
    after: input.after,
    metadata: { action: input.action, source: "configuration-api" },
  });
}

async function requireTier(
  transaction: TransactionClient,
  organizationId: string,
  tierId: string,
): Promise<void> {
  const record = await transaction.customerTier.findFirst({
    where: { id: tierId, organizationId },
    select: { id: true },
  });
  if (record === null) notFound("Customer tier");
}

async function requireSalesTeam(
  transaction: TransactionClient,
  organizationId: string,
  salesTeamId: string,
): Promise<void> {
  const record = await transaction.salesTeam.findFirst({
    where: { id: salesTeamId, organizationId },
    select: { id: true },
  });
  if (record === null) notFound("Sales team");
}

async function requireUser(
  transaction: TransactionClient,
  organizationId: string,
  userId: string,
): Promise<void> {
  const record = await transaction.user.findFirst({
    where: { id: userId, organizationId },
    select: { id: true },
  });
  if (record === null) notFound("Assigned representative");
}

async function requireCategory(
  transaction: TransactionClient,
  organizationId: string,
  categoryId: string,
): Promise<void> {
  const record = await transaction.productCategory.findFirst({
    where: { id: categoryId, organizationId },
    select: { id: true },
  });
  if (record === null) notFound("Product category");
}

async function requireTax(
  transaction: TransactionClient,
  organizationId: string,
  taxId: string,
): Promise<void> {
  const record = await transaction.tax.findFirst({
    where: { id: taxId, organizationId },
    select: { id: true },
  });
  if (record === null) notFound("Tax");
}

async function requireProduct(
  transaction: TransactionClient,
  organizationId: string,
  productId: string,
): Promise<{ categoryId: string }> {
  const record = await transaction.product.findFirst({
    where: { id: productId, organizationId },
    select: { categoryId: true },
  });
  if (record === null) notFound("Product");
  return record;
}

async function requirePriceList(
  transaction: TransactionClient,
  organizationId: string,
  priceListId: string,
): Promise<void> {
  const record = await transaction.priceList.findFirst({
    where: { id: priceListId, organizationId },
    select: { id: true },
  });
  if (record === null) notFound("Price list");
}

async function validateProductCategoryTarget(
  transaction: TransactionClient,
  organizationId: string,
  productId: string | undefined,
  categoryId: string | undefined,
): Promise<void> {
  const product =
    productId === undefined
      ? undefined
      : await requireProduct(transaction, organizationId, productId);
  if (categoryId !== undefined) {
    await requireCategory(transaction, organizationId, categoryId);
  }
  if (
    product !== undefined &&
    categoryId !== undefined &&
    product.categoryId !== categoryId
  ) {
    throw new HttpError(
      422,
      "Validation failed",
      "productId does not belong to categoryId",
      { code: "PRODUCT_CATEGORY_MISMATCH" },
    );
  }
}

async function validateCategoryParent(
  transaction: TransactionClient,
  organizationId: string,
  categoryId: string | undefined,
  parentId: string,
): Promise<void> {
  let candidateId: string | null = parentId;
  const visited = new Set<string>();
  while (candidateId !== null) {
    if (candidateId === categoryId || visited.has(candidateId)) {
      conflict(
        "A product category cannot be its own ancestor",
        "CATEGORY_CYCLE",
      );
    }
    visited.add(candidateId);
    const candidate: { parentId: string | null } | null =
      await transaction.productCategory.findFirst({
        where: { id: candidateId, organizationId },
        select: { parentId: true },
      });
    if (candidate === null) notFound("Parent product category");
    candidateId = candidate.parentId;
  }
}

async function assertPriceListDoesNotOverlap(
  transaction: TransactionClient,
  input: {
    organizationId: string;
    currency: string;
    priority: number;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    excludeId?: string;
  },
): Promise<void> {
  const overlap = await transaction.priceList.findFirst({
    where: {
      organizationId: input.organizationId,
      currency: input.currency,
      priority: input.priority,
      status: { not: "ARCHIVED" },
      ...(input.excludeId === undefined
        ? {}
        : { id: { not: input.excludeId } }),
      ...overlapWindow(input.effectiveFrom, input.effectiveTo),
    },
    select: { id: true },
  });
  if (overlap !== null) {
    conflict(
      "An active price list with the same currency and priority overlaps this period",
      "EFFECTIVE_PERIOD_OVERLAP",
    );
  }
}

async function assertPriceRuleDoesNotOverlap(
  transaction: TransactionClient,
  input: {
    organizationId: string;
    priceListId: string;
    productId: string | null;
    categoryId: string | null;
    tierId: string | null;
    minQuantity: string;
    priority: number;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    excludeId?: string;
  },
): Promise<void> {
  const overlap = await transaction.priceRule.findFirst({
    where: {
      organizationId: input.organizationId,
      priceListId: input.priceListId,
      productId: input.productId,
      categoryId: input.categoryId,
      tierId: input.tierId,
      minQuantity: input.minQuantity,
      priority: input.priority,
      status: { not: "ARCHIVED" },
      ...(input.excludeId === undefined
        ? {}
        : { id: { not: input.excludeId } }),
      ...overlapWindow(input.effectiveFrom, input.effectiveTo),
    },
    select: { id: true },
  });
  if (overlap !== null) {
    conflict(
      "A price rule with the same selector overlaps this period",
      "EFFECTIVE_PERIOD_OVERLAP",
    );
  }
}

async function assertDiscountLimitDoesNotOverlap(
  transaction: TransactionClient,
  input: {
    organizationId: string;
    tierId: string | null;
    categoryId: string | null;
    productId: string | null;
    priority: number;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    excludeId?: string;
  },
): Promise<void> {
  const overlap = await transaction.discountLimit.findFirst({
    where: {
      organizationId: input.organizationId,
      tierId: input.tierId,
      categoryId: input.categoryId,
      productId: input.productId,
      priority: input.priority,
      status: { not: "ARCHIVED" },
      ...(input.excludeId === undefined
        ? {}
        : { id: { not: input.excludeId } }),
      ...overlapWindow(input.effectiveFrom, input.effectiveTo),
    },
    select: { id: true },
  });
  if (overlap !== null) {
    conflict(
      "A discount limit with the same selector overlaps this period",
      "EFFECTIVE_PERIOD_OVERLAP",
    );
  }
}

async function assertApprovalPolicyDoesNotOverlap(
  transaction: TransactionClient,
  input: {
    organizationId: string;
    code: string;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    excludeId?: string;
  },
): Promise<void> {
  const overlap = await transaction.approvalPolicy.findFirst({
    where: {
      organizationId: input.organizationId,
      code: input.code,
      status: "ACTIVE",
      ...(input.excludeId === undefined
        ? {}
        : { id: { not: input.excludeId } }),
      ...overlapWindow(input.effectiveFrom, input.effectiveTo),
    },
    select: { id: true },
  });
  if (overlap !== null) {
    conflict(
      "An active approval-policy version overlaps this period",
      "EFFECTIVE_PERIOD_OVERLAP",
    );
  }
}

async function assertRecommendationRuleDoesNotOverlap(
  transaction: TransactionClient,
  input: {
    organizationId: string;
    code: string;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    excludeId?: string;
  },
): Promise<void> {
  const overlap = await transaction.recommendationRule.findFirst({
    where: {
      organizationId: input.organizationId,
      code: input.code,
      status: "ACTIVE",
      ...(input.excludeId === undefined
        ? {}
        : { id: { not: input.excludeId } }),
      ...overlapWindow(input.effectiveFrom, input.effectiveTo),
    },
    select: { id: true },
  });
  if (overlap !== null) {
    conflict(
      "An active recommendation-rule version overlaps this period",
      "EFFECTIVE_PERIOD_OVERLAP",
    );
  }
}

function assertRecommendationWeights(input: {
  affinityWeight: Prisma.Decimal | string;
  marginWeight: Prisma.Decimal | string;
  promotionWeight: Prisma.Decimal | string;
  availabilityWeight: Prisma.Decimal | string;
  stockAgeWeight: Prisma.Decimal | string;
}): void {
  const total = new Prisma.Decimal(input.affinityWeight)
    .plus(input.marginWeight)
    .plus(input.promotionWeight)
    .plus(input.availabilityWeight)
    .plus(input.stockAgeWeight);
  if (!total.equals(1)) {
    throw new HttpError(
      422,
      "Validation failed",
      "Recommendation weights must sum to 1",
      { code: "INVALID_RECOMMENDATION_WEIGHTS" },
    );
  }
}

function assertRecommendationBoost(value: string | Prisma.Decimal): void {
  if (new Prisma.Decimal(value).greaterThan(1)) {
    throw new HttpError(
      422,
      "Validation failed",
      "recommendationBoost must be between 0 and 1",
      { code: "INVALID_RECOMMENDATION_BOOST" },
    );
  }
}

async function requirePromotionProducts(
  transaction: TransactionClient,
  organizationId: string,
  productIds: readonly string[],
): Promise<void> {
  const products = await transaction.product.findMany({
    where: { organizationId, id: { in: [...productIds] } },
    select: { id: true },
  });
  if (products.length !== productIds.length) {
    throw new HttpError(
      422,
      "Validation failed",
      "Every promotion product must belong to this organization",
      { code: "INVALID_PROMOTION_PRODUCT" },
    );
  }
}

async function assertPromotionDoesNotOverlap(
  transaction: TransactionClient,
  input: {
    organizationId: string;
    productIds: readonly string[];
    priority: number;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    excludeId?: string;
  },
): Promise<void> {
  const overlap = await transaction.promotion.findFirst({
    where: {
      organizationId: input.organizationId,
      status: "ACTIVE",
      priority: input.priority,
      products: { some: { productId: { in: [...input.productIds] } } },
      ...(input.excludeId === undefined
        ? {}
        : { id: { not: input.excludeId } }),
      ...overlapWindow(input.effectiveFrom, input.effectiveTo),
    },
    select: { id: true },
  });
  if (overlap !== null) {
    conflict(
      "An active promotion with the same priority targets one of these products during the effective period",
      "EFFECTIVE_PERIOD_OVERLAP",
    );
  }
}

const listProducts: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const query = pageQuery(request);
  const rows = await prisma.product.findMany({
    where: { organizationId: principal.organizationId },
    include: productInclude,
    orderBy: { id: "asc" },
    ...cursorArgs(query.cursor, query.limit),
  });
  response.json(mappedPage(rows, query.limit, mapProduct));
};

const createProduct: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const body = parseBody(CreateProductRequestSchema, request);
  const result = await prisma.$transaction(async (transaction) => {
    await requireCategory(
      transaction,
      principal.organizationId,
      body.categoryId,
    );
    if (body.taxId !== undefined) {
      await requireTax(transaction, principal.organizationId, body.taxId);
    }
    const record = await transaction.product.create({
      data: {
        organizationId: principal.organizationId,
        categoryId: body.categoryId,
        taxId: body.taxId,
        code: body.code,
        name: body.name,
        description: body.description,
        type: body.type,
        unit: body.unit,
        standardCost: body.standardCost,
      },
      include: productInclude,
    });
    const dto = mapProduct(record);
    await recordWrite(transaction, principal, {
      action: "created",
      entityType: "Product",
      entityId: record.id,
      entityVersion: record.revision,
      after: dto,
    });
    return dto;
  });
  response.status(201).json(result);
};

const updateProduct: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const productId = pathId(request.params.productId, "productId");
  const body = parseBody(UpdateProductRequestSchema, request);
  const result = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.product.findFirst({
      where: { id: productId, organizationId: principal.organizationId },
      include: productInclude,
    });
    if (existing === null) notFound("Product");
    if (body.categoryId !== undefined) {
      await requireCategory(
        transaction,
        principal.organizationId,
        body.categoryId,
      );
    }
    if (body.taxId !== undefined && body.taxId !== null) {
      await requireTax(transaction, principal.organizationId, body.taxId);
    }
    const updated = await transaction.product.updateMany({
      where: {
        id: productId,
        organizationId: principal.organizationId,
        revision: body.revision,
      },
      data: {
        ...(body.categoryId === undefined
          ? {}
          : { categoryId: body.categoryId }),
        ...(body.taxId === undefined ? {} : { taxId: body.taxId }),
        ...(body.code === undefined ? {} : { code: body.code }),
        ...(body.name === undefined ? {} : { name: body.name }),
        ...(body.description === undefined
          ? {}
          : { description: body.description }),
        ...(body.type === undefined ? {} : { type: body.type }),
        ...(body.unit === undefined ? {} : { unit: body.unit }),
        ...(body.standardCost === undefined
          ? {}
          : { standardCost: body.standardCost }),
        ...statusUpdate(body),
        revision: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      conflict(
        "The product was changed by another request",
        "REVISION_CONFLICT",
      );
    }
    const record = await transaction.product.findUniqueOrThrow({
      where: { id: productId },
      include: productInclude,
    });
    const before = mapProduct(existing);
    const after = mapProduct(record);
    await recordWrite(transaction, principal, {
      action: "updated",
      entityType: "Product",
      entityId: record.id,
      entityVersion: record.revision,
      before,
      after,
    });
    return after;
  });
  response.json(result);
};

const listProductVariants: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const productId = pathId(request.params.productId, "productId");
  const query = pageQuery(request);
  await requireProduct(prisma, principal.organizationId, productId);
  const rows = await prisma.productVariant.findMany({
    where: { organizationId: principal.organizationId, productId },
    orderBy: { id: "asc" },
    ...cursorArgs(query.cursor, query.limit),
  });
  response.json(mappedPage(rows, query.limit, mapProductVariant));
};

const createProductVariant: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const productId = pathId(request.params.productId, "productId");
  const body = parseBody(CreateProductVariantRequestSchema, request);
  const result = await prisma.$transaction(async (transaction) => {
    await requireProduct(transaction, principal.organizationId, productId);
    const record = await transaction.productVariant.create({
      data: {
        organizationId: principal.organizationId,
        productId,
        sku: body.sku,
        name: body.name,
        attributes: jsonInput(body.attributes),
        priceSurcharge: body.priceSurcharge,
      },
    });
    const dto = mapProductVariant(record);
    await recordWrite(transaction, principal, {
      action: "created",
      entityType: "ProductVariant",
      entityId: record.id,
      entityVersion: record.revision,
      after: dto,
    });
    return dto;
  });
  response.status(201).json(result);
};

const updateProductVariant: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const productId = pathId(request.params.productId, "productId");
  const variantId = pathId(request.params.variantId, "variantId");
  const body = parseBody(UpdateProductVariantRequestSchema, request);
  const result = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.productVariant.findFirst({
      where: {
        id: variantId,
        organizationId: principal.organizationId,
        productId,
      },
    });
    if (existing === null) notFound("Product variant");
    const updated = await transaction.productVariant.updateMany({
      where: {
        id: variantId,
        organizationId: principal.organizationId,
        productId,
        revision: body.revision,
      },
      data: {
        ...(body.sku === undefined ? {} : { sku: body.sku }),
        ...(body.name === undefined ? {} : { name: body.name }),
        ...(body.attributes === undefined
          ? {}
          : { attributes: jsonInput(body.attributes) }),
        ...(body.priceSurcharge === undefined
          ? {}
          : { priceSurcharge: body.priceSurcharge }),
        ...statusUpdate(body),
        revision: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      conflict(
        "The product variant was changed by another request",
        "REVISION_CONFLICT",
      );
    }
    const record = await transaction.productVariant.findUniqueOrThrow({
      where: { id: variantId },
    });
    const before = mapProductVariant(existing);
    const after = mapProductVariant(record);
    await recordWrite(transaction, principal, {
      action: "updated",
      entityType: "ProductVariant",
      entityId: record.id,
      entityVersion: record.revision,
      before,
      after,
    });
    return after;
  });
  response.json(result);
};

const listProductCategories: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const query = pageQuery(request);
  const rows = await prisma.productCategory.findMany({
    where: { organizationId: principal.organizationId },
    orderBy: { id: "asc" },
    ...cursorArgs(query.cursor, query.limit),
  });
  response.json(mappedPage(rows, query.limit, mapProductCategory));
};

const createProductCategory: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const body = parseBody(CreateProductCategoryRequestSchema, request);
  const result = await prisma.$transaction(async (transaction) => {
    if (body.parentId !== undefined) {
      await validateCategoryParent(
        transaction,
        principal.organizationId,
        undefined,
        body.parentId,
      );
    }
    const record = await transaction.productCategory.create({
      data: {
        organizationId: principal.organizationId,
        parentId: body.parentId,
        code: body.code,
        name: body.name,
        description: body.description,
      },
    });
    const dto = mapProductCategory(record);
    await recordWrite(transaction, principal, {
      action: "created",
      entityType: "ProductCategory",
      entityId: record.id,
      entityVersion: record.revision,
      after: dto,
    });
    return dto;
  });
  response.status(201).json(result);
};

const updateProductCategory: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const categoryId = pathId(request.params.categoryId, "categoryId");
  const body = parseBody(UpdateProductCategoryRequestSchema, request);
  const result = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.productCategory.findFirst({
      where: { id: categoryId, organizationId: principal.organizationId },
    });
    if (existing === null) notFound("Product category");
    if (body.parentId !== undefined && body.parentId !== null) {
      await validateCategoryParent(
        transaction,
        principal.organizationId,
        categoryId,
        body.parentId,
      );
    }
    const updated = await transaction.productCategory.updateMany({
      where: {
        id: categoryId,
        organizationId: principal.organizationId,
        revision: body.revision,
      },
      data: {
        ...(body.parentId === undefined ? {} : { parentId: body.parentId }),
        ...(body.code === undefined ? {} : { code: body.code }),
        ...(body.name === undefined ? {} : { name: body.name }),
        ...(body.description === undefined
          ? {}
          : { description: body.description }),
        ...statusUpdate(body),
        revision: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      conflict(
        "The product category was changed by another request",
        "REVISION_CONFLICT",
      );
    }
    const record = await transaction.productCategory.findUniqueOrThrow({
      where: { id: categoryId },
    });
    const before = mapProductCategory(existing);
    const after = mapProductCategory(record);
    await recordWrite(transaction, principal, {
      action: "updated",
      entityType: "ProductCategory",
      entityId: record.id,
      entityVersion: record.revision,
      before,
      after,
    });
    return after;
  });
  response.json(result);
};

const listCustomerTiers: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const query = pageQuery(request);
  const rows = await prisma.customerTier.findMany({
    where: { organizationId: principal.organizationId },
    orderBy: { id: "asc" },
    ...cursorArgs(query.cursor, query.limit),
  });
  response.json(mappedPage(rows, query.limit, mapCustomerTier));
};

const createCustomerTier: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const body = parseBody(CreateCustomerTierRequestSchema, request);
  const result = await prisma.$transaction(async (transaction) => {
    const record = await transaction.customerTier.create({
      data: {
        organizationId: principal.organizationId,
        name: body.name,
        code: body.code,
        priority: body.priority,
      },
    });
    const dto = mapCustomerTier(record);
    await recordWrite(transaction, principal, {
      action: "created",
      entityType: "CustomerTier",
      entityId: record.id,
      after: dto,
    });
    return dto;
  });
  response.status(201).json(result);
};

const updateCustomerTier: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const tierId = pathId(request.params.tierId, "tierId");
  const body = parseBody(UpdateCustomerTierRequestSchema, request);
  const result = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.customerTier.findFirst({
      where: { id: tierId, organizationId: principal.organizationId },
    });
    if (existing === null) notFound("Customer tier");
    const record = await transaction.customerTier.update({
      where: { id: tierId },
      data: {
        ...(body.name === undefined ? {} : { name: body.name }),
        ...(body.priority === undefined ? {} : { priority: body.priority }),
        ...statusUpdate(body),
      },
    });
    const before = mapCustomerTier(existing);
    const after = mapCustomerTier(record);
    await recordWrite(transaction, principal, {
      action: "updated",
      entityType: "CustomerTier",
      entityId: record.id,
      before,
      after,
    });
    return after;
  });
  response.json(result);
};

const listCustomerAccounts: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const query = parseQuery(CustomerAccountListQuerySchema, request);
  const cursor =
    query.cursor === undefined ? undefined : parseId(query.cursor, "cursor");
  const rows = await prisma.customerAccount.findMany({
    where: {
      organizationId: principal.organizationId,
      ...(query.search === undefined
        ? {}
        : {
            OR: [
              {
                accountCode: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              },
              {
                name: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }),
    },
    include: customerAccountInclude,
    orderBy: { id: "asc" },
    ...cursorArgs(cursor, query.limit),
  });
  response.json(mappedPage(rows, query.limit, mapCustomerAccount));
};

const createCustomerAccount: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const body = parseBody(CreateCustomerAccountRequestSchema, request);
  const result = await prisma.$transaction(async (transaction) => {
    await requireTier(transaction, principal.organizationId, body.tierId);
    if (body.salesTeamId !== undefined) {
      await requireSalesTeam(
        transaction,
        principal.organizationId,
        body.salesTeamId,
      );
    }
    if (body.assignedRepId !== undefined) {
      await requireUser(
        transaction,
        principal.organizationId,
        body.assignedRepId,
      );
    }
    const record = await transaction.customerAccount.create({
      data: {
        organizationId: principal.organizationId,
        tierId: body.tierId,
        salesTeamId: body.salesTeamId,
        assignedRepId: body.assignedRepId,
        accountCode: body.accountCode ?? generatedCode("CUS"),
        name: body.name,
        preferredCurrency: body.preferredCurrency,
        paymentTermsDays: body.paymentTermsDays,
        creditLimit: body.creditLimit,
      },
      include: customerAccountInclude,
    });
    const dto = mapCustomerAccount(record);
    await recordWrite(transaction, principal, {
      action: "created",
      entityType: "CustomerAccount",
      entityId: record.id,
      entityVersion: record.revision,
      after: dto,
    });
    return dto;
  });
  response.status(201).json(result);
};

const getCustomerAccount: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const customerId = pathId(request.params.customerId, "customerId");
  const record = await prisma.customerAccount.findFirst({
    where: { id: customerId, organizationId: principal.organizationId },
    include: customerAccountInclude,
  });
  if (record === null) notFound("Customer account");
  response.json(mapCustomerAccount(record));
};

const updateCustomerAccount: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const customerId = pathId(request.params.customerId, "customerId");
  const body = parseBody(UpdateCustomerAccountRequestSchema, request);
  const result = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.customerAccount.findFirst({
      where: { id: customerId, organizationId: principal.organizationId },
      include: customerAccountInclude,
    });
    if (existing === null) notFound("Customer account");
    if (body.tierId !== undefined) {
      await requireTier(transaction, principal.organizationId, body.tierId);
    }
    if (body.salesTeamId !== undefined && body.salesTeamId !== null) {
      await requireSalesTeam(
        transaction,
        principal.organizationId,
        body.salesTeamId,
      );
    }
    if (body.assignedRepId !== undefined && body.assignedRepId !== null) {
      await requireUser(
        transaction,
        principal.organizationId,
        body.assignedRepId,
      );
    }
    const updated = await transaction.customerAccount.updateMany({
      where: {
        id: customerId,
        organizationId: principal.organizationId,
        revision: body.revision,
      },
      data: {
        ...(body.name === undefined ? {} : { name: body.name }),
        ...(body.tierId === undefined ? {} : { tierId: body.tierId }),
        ...(body.salesTeamId === undefined
          ? {}
          : { salesTeamId: body.salesTeamId }),
        ...(body.assignedRepId === undefined
          ? {}
          : { assignedRepId: body.assignedRepId }),
        ...(body.preferredCurrency === undefined
          ? {}
          : { preferredCurrency: body.preferredCurrency }),
        ...(body.paymentTermsDays === undefined
          ? {}
          : { paymentTermsDays: body.paymentTermsDays }),
        ...(body.creditLimit === undefined
          ? {}
          : { creditLimit: body.creditLimit }),
        ...statusUpdate(body),
        revision: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      conflict(
        "The customer account was changed by another request",
        "REVISION_CONFLICT",
      );
    }
    const record = await transaction.customerAccount.findUniqueOrThrow({
      where: { id: customerId },
      include: customerAccountInclude,
    });
    const before = mapCustomerAccount(existing);
    const after = mapCustomerAccount(record);
    await recordWrite(transaction, principal, {
      action: "updated",
      entityType: "CustomerAccount",
      entityId: record.id,
      entityVersion: record.revision,
      before,
      after,
    });
    return after;
  });
  response.json(result);
};

const listCustomerContacts: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const customerId = pathId(request.params.customerId, "customerId");
  const query = pageQuery(request);
  const account = await prisma.customerAccount.findFirst({
    where: { id: customerId, organizationId: principal.organizationId },
    select: { id: true },
  });
  if (account === null) notFound("Customer account");
  const rows = await prisma.customerContact.findMany({
    where: {
      organizationId: principal.organizationId,
      customerAccountId: customerId,
    },
    orderBy: { id: "asc" },
    ...cursorArgs(query.cursor, query.limit),
  });
  response.json(mappedPage(rows, query.limit, mapCustomerContact));
};

const createCustomerContact: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const customerId = pathId(request.params.customerId, "customerId");
  const body = parseBody(CreateCustomerContactRequestSchema, request);
  const result = await prisma.$transaction(async (transaction) => {
    const account = await transaction.customerAccount.findFirst({
      where: { id: customerId, organizationId: principal.organizationId },
      select: { id: true },
    });
    if (account === null) notFound("Customer account");
    if (body.isPrimary) {
      await transaction.customerContact.updateMany({
        where: {
          organizationId: principal.organizationId,
          customerAccountId: customerId,
          isPrimary: true,
        },
        data: { isPrimary: false },
      });
    }
    const record = await transaction.customerContact.create({
      data: {
        organizationId: principal.organizationId,
        customerAccountId: customerId,
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
        isPrimary: body.isPrimary,
        portalEnabled: body.portalEnabled,
      },
    });
    if (body.portalEnabled) {
      await transaction.portalIdentity.create({
        data: {
          organizationId: principal.organizationId,
          customerContactId: record.id,
          email: record.email,
          status: "ACTIVE",
        },
      });
    }
    const dto = mapCustomerContact(record);
    await recordWrite(transaction, principal, {
      action: "created",
      entityType: "CustomerContact",
      entityId: record.id,
      after: dto,
    });
    return dto;
  });
  response.status(201).json(result);
};

const updateCustomerContact: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const customerId = pathId(request.params.customerId, "customerId");
  const contactId = pathId(request.params.contactId, "contactId");
  const body = parseBody(UpdateCustomerContactRequestSchema, request);
  const result = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.customerContact.findFirst({
      where: {
        id: contactId,
        organizationId: principal.organizationId,
        customerAccountId: customerId,
      },
    });
    if (existing === null) notFound("Customer contact");
    const nextStatus = body.status ?? existing.status;
    const nextPortalEnabled =
      nextStatus === "ACTIVE" && (body.portalEnabled ?? existing.portalEnabled);
    if (body.isPrimary) {
      await transaction.customerContact.updateMany({
        where: {
          organizationId: principal.organizationId,
          customerAccountId: customerId,
          isPrimary: true,
          id: { not: contactId },
        },
        data: { isPrimary: false },
      });
    }
    const record = await transaction.customerContact.update({
      where: { id: contactId },
      data: {
        ...(body.email === undefined ? {} : { email: body.email }),
        ...(body.firstName === undefined ? {} : { firstName: body.firstName }),
        ...(body.lastName === undefined ? {} : { lastName: body.lastName }),
        ...(body.isPrimary === undefined ? {} : { isPrimary: body.isPrimary }),
        portalEnabled: nextPortalEnabled,
        ...(body.status === undefined ? {} : { status: body.status }),
      },
    });
    const portalIdentity = await transaction.portalIdentity.findUnique({
      where: { customerContactId: contactId },
      select: { id: true },
    });
    if (nextPortalEnabled) {
      if (portalIdentity === null) {
        await transaction.portalIdentity.create({
          data: {
            organizationId: principal.organizationId,
            customerContactId: contactId,
            email: record.email,
            status: "ACTIVE",
          },
        });
      } else {
        await transaction.portalIdentity.update({
          where: { id: portalIdentity.id },
          data: { email: record.email, status: "ACTIVE" },
        });
      }
    } else if (portalIdentity !== null) {
      await transaction.portalIdentity.update({
        where: { id: portalIdentity.id },
        data: { email: record.email, status: "DISABLED" },
      });
    }
    const before = mapCustomerContact(existing);
    const after = mapCustomerContact(record);
    await recordWrite(transaction, principal, {
      action: "updated",
      entityType: "CustomerContact",
      entityId: record.id,
      before,
      after,
    });
    return after;
  });
  response.json(result);
};

const listPriceLists: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const query = pageQuery(request);
  const rows = await prisma.priceList.findMany({
    where: { organizationId: principal.organizationId },
    orderBy: { id: "asc" },
    ...cursorArgs(query.cursor, query.limit),
  });
  response.json(mappedPage(rows, query.limit, mapPriceList));
};

const createPriceList: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const body = parseBody(CreatePriceListRequestSchema, request);
  const effectiveFrom = effectiveDate(body.effectiveFrom);
  const effectiveTo =
    body.effectiveTo === undefined ? null : effectiveDate(body.effectiveTo);
  assertEffectiveRange(effectiveFrom, effectiveTo);
  const result = await serializableWrite(async (transaction) => {
    await assertPriceListDoesNotOverlap(transaction, {
      organizationId: principal.organizationId,
      currency: body.currency,
      priority: body.priority,
      effectiveFrom,
      effectiveTo,
    });
    const record = await transaction.priceList.create({
      data: {
        organizationId: principal.organizationId,
        code: body.code ?? generatedCode("PL"),
        name: body.name,
        currency: body.currency,
        priority: body.priority,
        effectiveFrom,
        effectiveTo,
      },
    });
    const dto = mapPriceList(record);
    await recordWrite(transaction, principal, {
      action: "created",
      entityType: "PriceList",
      entityId: record.id,
      after: dto,
    });
    return dto;
  });
  response.status(201).json(result);
};

const updatePriceList: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const priceListId = pathId(request.params.priceListId, "priceListId");
  const body = parseBody(UpdatePriceListRequestSchema, request);
  const result = await serializableWrite(async (transaction) => {
    const existing = await transaction.priceList.findFirst({
      where: { id: priceListId, organizationId: principal.organizationId },
    });
    if (existing === null) notFound("Price list");
    const effectiveTo = nextEffectiveDate(
      body.effectiveTo,
      existing.effectiveTo,
    );
    const priority = body.priority ?? existing.priority;
    const status =
      body.active === undefined && body.status === undefined
        ? existing.status
        : body.active === undefined
          ? body.status
          : body.active
            ? "ACTIVE"
            : "ARCHIVED";
    assertEffectiveRange(existing.effectiveFrom, effectiveTo);
    if (status !== "ARCHIVED") {
      await assertPriceListDoesNotOverlap(transaction, {
        organizationId: principal.organizationId,
        currency: existing.currency,
        priority,
        effectiveFrom: existing.effectiveFrom,
        effectiveTo,
        excludeId: existing.id,
      });
    }
    const record = await transaction.priceList.update({
      where: { id: priceListId },
      data: {
        ...(body.name === undefined ? {} : { name: body.name }),
        ...(body.priority === undefined ? {} : { priority: body.priority }),
        ...(body.effectiveTo === undefined ? {} : { effectiveTo }),
        ...statusUpdate(body),
      },
    });
    const before = mapPriceList(existing);
    const after = mapPriceList(record);
    await recordWrite(transaction, principal, {
      action: "updated",
      entityType: "PriceList",
      entityId: record.id,
      before,
      after,
    });
    return after;
  });
  response.json(result);
};

const listPriceRules: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const priceListId = pathId(request.params.priceListId, "priceListId");
  const query = pageQuery(request);
  const priceList = await prisma.priceList.findFirst({
    where: { id: priceListId, organizationId: principal.organizationId },
    select: { id: true },
  });
  if (priceList === null) notFound("Price list");
  const rows = await prisma.priceRule.findMany({
    where: {
      organizationId: principal.organizationId,
      priceListId,
    },
    orderBy: { id: "asc" },
    ...cursorArgs(query.cursor, query.limit),
  });
  response.json(mappedPage(rows, query.limit, mapPriceRule));
};

const createPriceRule: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const priceListId = pathId(request.params.priceListId, "priceListId");
  const body = parseBody(CreatePriceRuleRequestSchema, request);
  const effectiveFrom = effectiveDate(body.effectiveFrom);
  const effectiveTo =
    body.effectiveTo === undefined ? null : effectiveDate(body.effectiveTo);
  assertEffectiveRange(effectiveFrom, effectiveTo);
  const result = await serializableWrite(async (transaction) => {
    await requirePriceList(transaction, principal.organizationId, priceListId);
    await validateProductCategoryTarget(
      transaction,
      principal.organizationId,
      body.productId,
      body.categoryId,
    );
    if (body.tierId !== undefined) {
      await requireTier(transaction, principal.organizationId, body.tierId);
    }
    await assertPriceRuleDoesNotOverlap(transaction, {
      organizationId: principal.organizationId,
      priceListId,
      productId: body.productId ?? null,
      categoryId: body.categoryId ?? null,
      tierId: body.tierId ?? null,
      minQuantity: body.minQuantity,
      priority: body.priority,
      effectiveFrom,
      effectiveTo,
    });
    const record = await transaction.priceRule.create({
      data: {
        organizationId: principal.organizationId,
        priceListId,
        productId: body.productId,
        categoryId: body.categoryId,
        tierId: body.tierId,
        minQuantity: body.minQuantity,
        unitPrice: body.unitPrice,
        priority: body.priority,
        effectiveFrom,
        effectiveTo,
      },
    });
    const dto = mapPriceRule(record);
    await recordWrite(transaction, principal, {
      action: "created",
      entityType: "PriceRule",
      entityId: record.id,
      after: dto,
    });
    return dto;
  });
  response.status(201).json(result);
};

const updatePriceRule: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const ruleId = pathId(request.params.ruleId, "ruleId");
  const body = parseBody(UpdatePriceRuleRequestSchema, request);
  const result = await serializableWrite(async (transaction) => {
    const existing = await transaction.priceRule.findFirst({
      where: { id: ruleId, organizationId: principal.organizationId },
    });
    if (existing === null) notFound("Price rule");
    const effectiveTo = nextEffectiveDate(
      body.effectiveTo,
      existing.effectiveTo,
    );
    const priority = body.priority ?? existing.priority;
    const minQuantity = body.minQuantity ?? existing.minQuantity.toString();
    const status = body.status ?? existing.status;
    assertEffectiveRange(existing.effectiveFrom, effectiveTo);
    if (status !== "ARCHIVED") {
      await assertPriceRuleDoesNotOverlap(transaction, {
        organizationId: principal.organizationId,
        priceListId: existing.priceListId,
        productId: existing.productId,
        categoryId: existing.categoryId,
        tierId: existing.tierId,
        minQuantity,
        priority,
        effectiveFrom: existing.effectiveFrom,
        effectiveTo,
        excludeId: existing.id,
      });
    }
    const record = await transaction.priceRule.update({
      where: { id: ruleId },
      data: {
        ...(body.minQuantity === undefined
          ? {}
          : { minQuantity: body.minQuantity }),
        ...(body.unitPrice === undefined ? {} : { unitPrice: body.unitPrice }),
        ...(body.priority === undefined ? {} : { priority: body.priority }),
        ...(body.effectiveTo === undefined ? {} : { effectiveTo }),
        ...statusUpdate(body),
      },
    });
    const before = mapPriceRule(existing);
    const after = mapPriceRule(record);
    await recordWrite(transaction, principal, {
      action: "updated",
      entityType: "PriceRule",
      entityId: record.id,
      before,
      after,
    });
    return after;
  });
  response.json(result);
};

const archivePriceRule: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const ruleId = pathId(request.params.ruleId, "ruleId");
  await prisma.$transaction(async (transaction) => {
    const existing = await transaction.priceRule.findFirst({
      where: { id: ruleId, organizationId: principal.organizationId },
    });
    if (existing === null) notFound("Price rule");
    const record = await transaction.priceRule.update({
      where: { id: ruleId },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });
    await recordWrite(transaction, principal, {
      action: "archived",
      entityType: "PriceRule",
      entityId: record.id,
      before: mapPriceRule(existing),
      after: mapPriceRule(record),
    });
  });
  response.status(204).end();
};

const listDiscountLimits: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const query = pageQuery(request);
  const rows = await prisma.discountLimit.findMany({
    where: { organizationId: principal.organizationId },
    orderBy: { id: "asc" },
    ...cursorArgs(query.cursor, query.limit),
  });
  response.json(mappedPage(rows, query.limit, mapDiscountLimit));
};

const createDiscountLimit: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const body = parseBody(CreateDiscountLimitRequestSchema, request);
  const effectiveFrom = effectiveDate(body.effectiveFrom);
  const effectiveTo =
    body.effectiveTo === undefined ? null : effectiveDate(body.effectiveTo);
  assertEffectiveRange(effectiveFrom, effectiveTo);
  const result = await serializableWrite(async (transaction) => {
    await validateProductCategoryTarget(
      transaction,
      principal.organizationId,
      body.productId,
      body.categoryId,
    );
    if (body.tierId !== undefined) {
      await requireTier(transaction, principal.organizationId, body.tierId);
    }
    await assertDiscountLimitDoesNotOverlap(transaction, {
      organizationId: principal.organizationId,
      tierId: body.tierId ?? null,
      categoryId: body.categoryId ?? null,
      productId: body.productId ?? null,
      priority: body.priority,
      effectiveFrom,
      effectiveTo,
    });
    const record = await transaction.discountLimit.create({
      data: {
        organizationId: principal.organizationId,
        name: body.name,
        tierId: body.tierId,
        categoryId: body.categoryId,
        productId: body.productId,
        maxDiscountPercent: body.maxDiscountPct,
        priority: body.priority,
        effectiveFrom,
        effectiveTo,
      },
    });
    const dto = mapDiscountLimit(record);
    await recordWrite(transaction, principal, {
      action: "created",
      entityType: "DiscountLimit",
      entityId: record.id,
      after: dto,
    });
    return dto;
  });
  response.status(201).json(result);
};

const updateDiscountLimit: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const limitId = pathId(request.params.limitId, "limitId");
  const body = parseBody(UpdateDiscountLimitRequestSchema, request);
  const result = await serializableWrite(async (transaction) => {
    const existing = await transaction.discountLimit.findFirst({
      where: { id: limitId, organizationId: principal.organizationId },
    });
    if (existing === null) notFound("Discount limit");
    const effectiveTo = nextEffectiveDate(
      body.effectiveTo,
      existing.effectiveTo,
    );
    const priority = body.priority ?? existing.priority;
    const status =
      body.active === undefined && body.status === undefined
        ? existing.status
        : body.active === undefined
          ? body.status
          : body.active
            ? "ACTIVE"
            : "ARCHIVED";
    assertEffectiveRange(existing.effectiveFrom, effectiveTo);
    if (status !== "ARCHIVED") {
      await assertDiscountLimitDoesNotOverlap(transaction, {
        organizationId: principal.organizationId,
        tierId: existing.tierId,
        categoryId: existing.categoryId,
        productId: existing.productId,
        priority,
        effectiveFrom: existing.effectiveFrom,
        effectiveTo,
        excludeId: existing.id,
      });
    }
    const record = await transaction.discountLimit.update({
      where: { id: limitId },
      data: {
        ...(body.maxDiscountPct === undefined
          ? {}
          : { maxDiscountPercent: body.maxDiscountPct }),
        ...(body.priority === undefined ? {} : { priority: body.priority }),
        ...(body.effectiveTo === undefined ? {} : { effectiveTo }),
        ...statusUpdate(body),
      },
    });
    const before = mapDiscountLimit(existing);
    const after = mapDiscountLimit(record);
    await recordWrite(transaction, principal, {
      action: "updated",
      entityType: "DiscountLimit",
      entityId: record.id,
      before,
      after,
    });
    return after;
  });
  response.json(result);
};

const listTaxes: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const query = pageQuery(request);
  const rows = await prisma.tax.findMany({
    where: { organizationId: principal.organizationId },
    orderBy: { id: "asc" },
    ...cursorArgs(query.cursor, query.limit),
  });
  response.json(mappedPage(rows, query.limit, mapTax));
};

const createTax: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const body = parseBody(CreateTaxRequestSchema, request);
  const effectiveFrom = effectiveDate(body.effectiveFrom);
  const effectiveTo =
    body.effectiveTo === undefined ? null : effectiveDate(body.effectiveTo);
  assertEffectiveRange(effectiveFrom, effectiveTo);
  const result = await prisma.$transaction(async (transaction) => {
    const record = await transaction.tax.create({
      data: {
        organizationId: principal.organizationId,
        code: body.code ?? generatedCode("TAX"),
        name: body.name,
        rate: body.rate,
        behavior: body.behavior,
        effectiveFrom,
        effectiveTo,
      },
    });
    const dto = mapTax(record);
    await recordWrite(transaction, principal, {
      action: "created",
      entityType: "Tax",
      entityId: record.id,
      after: dto,
    });
    return dto;
  });
  response.status(201).json(result);
};

const updateTax: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const taxId = pathId(request.params.taxId, "taxId");
  const body = parseBody(UpdateTaxRequestSchema, request);
  const result = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.tax.findFirst({
      where: { id: taxId, organizationId: principal.organizationId },
    });
    if (existing === null) notFound("Tax");
    const effectiveTo = nextEffectiveDate(
      body.effectiveTo,
      existing.effectiveTo,
    );
    assertEffectiveRange(existing.effectiveFrom, effectiveTo);
    const record = await transaction.tax.update({
      where: { id: taxId },
      data: {
        ...(body.rate === undefined ? {} : { rate: body.rate }),
        ...(body.behavior === undefined ? {} : { behavior: body.behavior }),
        ...(body.effectiveTo === undefined ? {} : { effectiveTo }),
        ...statusUpdate(body),
      },
    });
    const before = mapTax(existing);
    const after = mapTax(record);
    await recordWrite(transaction, principal, {
      action: "updated",
      entityType: "Tax",
      entityId: record.id,
      before,
      after,
    });
    return after;
  });
  response.json(result);
};

const listSubscriptionPlans: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const query = pageQuery(request);
  const rows = await prisma.subscriptionPlan.findMany({
    where: { organizationId: principal.organizationId },
    orderBy: { id: "asc" },
    ...cursorArgs(query.cursor, query.limit),
  });
  response.json(mappedPage(rows, query.limit, mapSubscriptionPlan));
};

const createSubscriptionPlan: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const body = parseBody(CreateSubscriptionPlanRequestSchema, request);
  const result = await prisma.$transaction(async (transaction) => {
    const record = await transaction.subscriptionPlan.create({
      data: {
        organizationId: principal.organizationId,
        code: body.code,
        name: body.name,
        interval: body.interval,
        intervalCount: body.intervalCount,
        prorationConvention: body.prorationConvention,
        cancellationRules: jsonInput(body.cancellationRules),
        refundRules: jsonInput(body.refundRules),
      },
    });
    const dto = mapSubscriptionPlan(record);
    await recordWrite(transaction, principal, {
      action: "created",
      entityType: "SubscriptionPlan",
      entityId: record.id,
      after: dto,
    });
    return dto;
  });
  response.status(201).json(result);
};

const updateSubscriptionPlan: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const planId = pathId(request.params.planId, "planId");
  const body = parseBody(UpdateSubscriptionPlanRequestSchema, request);
  const result = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.subscriptionPlan.findFirst({
      where: { id: planId, organizationId: principal.organizationId },
    });
    if (existing === null) notFound("Subscription plan");
    const record = await transaction.subscriptionPlan.update({
      where: { id: planId },
      data: {
        ...(body.name === undefined ? {} : { name: body.name }),
        ...(body.interval === undefined ? {} : { interval: body.interval }),
        ...(body.intervalCount === undefined
          ? {}
          : { intervalCount: body.intervalCount }),
        ...(body.prorationConvention === undefined
          ? {}
          : { prorationConvention: body.prorationConvention }),
        ...(body.cancellationRules === undefined
          ? {}
          : { cancellationRules: jsonInput(body.cancellationRules) }),
        ...(body.refundRules === undefined
          ? {}
          : { refundRules: jsonInput(body.refundRules) }),
        ...statusUpdate(body),
      },
    });
    const before = mapSubscriptionPlan(existing);
    const after = mapSubscriptionPlan(record);
    await recordWrite(transaction, principal, {
      action: "updated",
      entityType: "SubscriptionPlan",
      entityId: record.id,
      before,
      after,
    });
    return after;
  });
  response.json(result);
};

const listWarehouses: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const query = pageQuery(request);
  const rows = await prisma.warehouse.findMany({
    where: { organizationId: principal.organizationId },
    orderBy: { id: "asc" },
    ...cursorArgs(query.cursor, query.limit),
  });
  response.json(mappedPage(rows, query.limit, mapWarehouse));
};

const createWarehouse: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const body = parseBody(CreateWarehouseRequestSchema, request);
  const result = await prisma.$transaction(async (transaction) => {
    const record = await transaction.warehouse.create({
      data: {
        organizationId: principal.organizationId,
        code: body.code ?? generatedCode("WH"),
        name: body.name,
        address: addressInput(body.address),
        leadTimeDays: body.leadTimeDays,
        shippingCostWeight: body.shippingCostWeight,
      },
    });
    const dto = mapWarehouse(record);
    await recordWrite(transaction, principal, {
      action: "created",
      entityType: "Warehouse",
      entityId: record.id,
      entityVersion: record.revision,
      after: dto,
    });
    return dto;
  });
  response.status(201).json(result);
};

const updateWarehouse: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const warehouseId = pathId(request.params.warehouseId, "warehouseId");
  const body = parseBody(UpdateWarehouseRequestSchema, request);
  const result = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.warehouse.findFirst({
      where: { id: warehouseId, organizationId: principal.organizationId },
    });
    if (existing === null) notFound("Warehouse");
    const updated = await transaction.warehouse.updateMany({
      where: {
        id: warehouseId,
        organizationId: principal.organizationId,
        revision: body.revision,
      },
      data: {
        ...(body.name === undefined ? {} : { name: body.name }),
        ...(body.address === undefined
          ? {}
          : { address: addressInput(body.address) }),
        ...(body.leadTimeDays === undefined
          ? {}
          : { leadTimeDays: body.leadTimeDays }),
        ...(body.shippingCostWeight === undefined
          ? {}
          : { shippingCostWeight: body.shippingCostWeight }),
        ...statusUpdate(body),
        revision: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      conflict(
        "The warehouse was changed by another request",
        "REVISION_CONFLICT",
      );
    }
    const record = await transaction.warehouse.findUniqueOrThrow({
      where: { id: warehouseId },
    });
    const before = mapWarehouse(existing);
    const after = mapWarehouse(record);
    await recordWrite(transaction, principal, {
      action: "updated",
      entityType: "Warehouse",
      entityId: record.id,
      entityVersion: record.revision,
      before,
      after,
    });
    return after;
  });
  response.json(result);
};

const listApprovalPolicies: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const query = pageQuery(request);
  const rows = await prisma.approvalPolicy.findMany({
    where: { organizationId: principal.organizationId },
    include: approvalPolicyInclude,
    orderBy: { id: "asc" },
    ...cursorArgs(query.cursor, query.limit),
  });
  response.json(mappedPage(rows, query.limit, mapApprovalPolicy));
};

const getApprovalPolicy: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const record = await prisma.approvalPolicy.findFirst({
    where: {
      id: pathId(request.params.policyId, "policyId"),
      organizationId: principal.organizationId,
    },
    include: approvalPolicyInclude,
  });
  if (record === null) notFound("Approval policy");
  response.json(mapApprovalPolicy(record));
};

const createApprovalPolicy: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const body = parseBody(CreateApprovalPolicyRequestSchema, request);
  if (
    body.steps.some(
      (step) =>
        approvalAuthority(step.requiredRole, step.requiredCapability) === null,
    )
  ) {
    throw new HttpError(
      422,
      "Invalid approval authority",
      "Every approval step must pair its role with approval.managerAct or approval.financeAct as granted by the central role contract",
      { code: "VALIDATION_FAILED" },
    );
  }
  const effectiveFrom = effectiveDate(body.effectiveFrom);
  const effectiveTo =
    body.effectiveTo === undefined ? null : effectiveDate(body.effectiveTo);
  assertEffectiveRange(effectiveFrom, effectiveTo);
  const result = await serializableWrite(async (transaction) => {
    if (body.status === "ACTIVE") {
      await assertApprovalPolicyDoesNotOverlap(transaction, {
        organizationId: principal.organizationId,
        code: body.code,
        effectiveFrom,
        effectiveTo,
      });
    }
    const record = await transaction.approvalPolicy.create({
      data: {
        organizationId: principal.organizationId,
        code: body.code,
        name: body.name,
        predicates: jsonInput(body.predicates),
        priority: body.priority,
        status: body.status,
        effectiveFrom,
        effectiveTo,
        stepTemplates: {
          create: body.steps.map((step) => ({
            organizationId: principal.organizationId,
            sequence: step.sequence,
            requiredRole: step.requiredRole,
            requiredCapability: step.requiredCapability,
            assigneeStrategy: step.assigneeStrategy,
            dueAfterHours: step.dueAfterHours,
          })),
        },
      },
      include: approvalPolicyInclude,
    });
    const dto = mapApprovalPolicy(record);
    await recordWrite(transaction, principal, {
      action: "created",
      entityType: "ApprovalPolicy",
      entityId: record.id,
      entityVersion: record.version,
      after: dto,
    });
    return dto;
  });
  response.status(201).json(result);
};

const updateApprovalPolicy: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const policyId = pathId(request.params.policyId, "policyId");
  const body = parseBody(UpdateApprovalPolicyRequestSchema, request);
  const result = await serializableWrite(async (transaction) => {
    const existing = await transaction.approvalPolicy.findFirst({
      where: { id: policyId, organizationId: principal.organizationId },
      include: approvalPolicyInclude,
    });
    if (existing === null) notFound("Approval policy");
    if (existing.version !== body.revision) {
      conflict(
        "The approval policy was changed by another request",
        "REVISION_CONFLICT",
      );
    }
    const effectiveTo = nextEffectiveDate(
      body.effectiveTo,
      existing.effectiveTo,
    );
    const status = body.status ?? existing.status;
    assertEffectiveRange(existing.effectiveFrom, effectiveTo);
    if (status === "ACTIVE") {
      await assertApprovalPolicyDoesNotOverlap(transaction, {
        organizationId: principal.organizationId,
        code: existing.code,
        effectiveFrom: existing.effectiveFrom,
        effectiveTo,
        excludeId: existing.id,
      });
    }
    const archived = await transaction.approvalPolicy.updateMany({
      where: {
        id: policyId,
        organizationId: principal.organizationId,
        version: body.revision,
        status: { not: "ARCHIVED" },
      },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });
    if (archived.count !== 1) {
      conflict(
        "The approval policy was changed by another request",
        "REVISION_CONFLICT",
      );
    }
    const steps =
      body.steps ??
      existing.stepTemplates.map((step) => ({
        sequence: step.sequence,
        requiredRole: step.requiredRole,
        requiredCapability: step.requiredCapability,
        assigneeStrategy: step.assigneeStrategy,
        ...(step.dueAfterHours === null
          ? {}
          : { dueAfterHours: step.dueAfterHours }),
      }));
    if (
      steps.some(
        (step) =>
          approvalAuthority(step.requiredRole, step.requiredCapability) ===
          null,
      )
    ) {
      throw new HttpError(
        422,
        "Invalid approval authority",
        "Every approval step must pair its role with approval.managerAct or approval.financeAct as granted by the central role contract",
        { code: "VALIDATION_FAILED" },
      );
    }
    const record = await transaction.approvalPolicy.create({
      data: {
        organizationId: principal.organizationId,
        code: existing.code,
        version: existing.version + 1,
        name: body.name ?? existing.name,
        predicates: jsonInput(body.predicates ?? existing.predicates),
        priority: body.priority ?? existing.priority,
        status,
        effectiveFrom: existing.effectiveFrom,
        effectiveTo,
        archivedAt: status === "ARCHIVED" ? new Date() : null,
        stepTemplates: {
          create: steps.map((step) => ({
            organizationId: principal.organizationId,
            sequence: step.sequence,
            requiredRole: step.requiredRole,
            requiredCapability: step.requiredCapability,
            assigneeStrategy: step.assigneeStrategy,
            dueAfterHours: step.dueAfterHours,
          })),
        },
      },
      include: approvalPolicyInclude,
    });
    const before = mapApprovalPolicy(existing);
    const after = mapApprovalPolicy(record);
    await recordWrite(transaction, principal, {
      action: "versioned",
      entityType: "ApprovalPolicy",
      entityId: record.id,
      entityVersion: record.version,
      before,
      after,
    });
    return after;
  });
  response.json(result);
};

const listPromotions: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const query = pageQuery(request);
  const rows = await prisma.promotion.findMany({
    where: { organizationId: principal.organizationId },
    include: promotionInclude,
    orderBy: { id: "asc" },
    ...cursorArgs(query.cursor, query.limit),
  });
  response.json(mappedPage(rows, query.limit, mapPromotion));
};

const getPromotion: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const promotionId = pathId(request.params.promotionId, "promotionId");
  const record = await prisma.promotion.findFirst({
    where: { id: promotionId, organizationId: principal.organizationId },
    include: promotionInclude,
  });
  if (record === null) notFound("Promotion");
  response.json(mapPromotion(record));
};

const createPromotion: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const body = parseBody(CreatePromotionRequestSchema, request);
  const effectiveFrom = effectiveDate(body.effectiveFrom);
  const effectiveTo =
    body.effectiveTo === undefined ? null : effectiveDate(body.effectiveTo);
  assertEffectiveRange(effectiveFrom, effectiveTo);
  assertRecommendationBoost(body.recommendationBoost);
  const result = await serializableWrite(async (transaction) => {
    await requirePromotionProducts(
      transaction,
      principal.organizationId,
      body.productIds,
    );
    await assertPromotionDoesNotOverlap(transaction, {
      organizationId: principal.organizationId,
      productIds: body.productIds,
      priority: body.priority,
      effectiveFrom,
      effectiveTo,
    });
    const record = await transaction.promotion.create({
      data: {
        organizationId: principal.organizationId,
        code: body.code,
        name: body.name,
        priority: body.priority,
        conditions: jsonInput(body.conditions),
        benefit: jsonInput(body.benefit),
        recommendationBoost: body.recommendationBoost,
        effectiveFrom,
        effectiveTo,
        products: {
          create: body.productIds.map((productId) => ({
            organizationId: principal.organizationId,
            productId,
          })),
        },
      },
      include: promotionInclude,
    });
    const dto = mapPromotion(record);
    await recordWrite(transaction, principal, {
      action: "created",
      entityType: "Promotion",
      entityId: record.id,
      entityVersion: record.revision,
      after: dto,
    });
    return dto;
  });
  response.status(201).json(result);
};

const updatePromotion: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const promotionId = pathId(request.params.promotionId, "promotionId");
  const body = parseBody(UpdatePromotionRequestSchema, request);
  const result = await serializableWrite(async (transaction) => {
    const existing = await transaction.promotion.findFirst({
      where: { id: promotionId, organizationId: principal.organizationId },
      include: promotionInclude,
    });
    if (existing === null) notFound("Promotion");
    if (existing.revision !== body.revision) {
      conflict(
        "The promotion was changed by another request",
        "REVISION_CONFLICT",
      );
    }
    const productIds =
      body.productIds ?? existing.products.map((product) => product.productId);
    const effectiveFrom =
      body.effectiveFrom === undefined
        ? existing.effectiveFrom
        : effectiveDate(body.effectiveFrom);
    const effectiveTo = nextEffectiveDate(
      body.effectiveTo,
      existing.effectiveTo,
    );
    const priority = body.priority ?? existing.priority;
    const status = body.status ?? existing.status;
    const recommendationBoost =
      body.recommendationBoost ?? existing.recommendationBoost;
    assertEffectiveRange(effectiveFrom, effectiveTo);
    assertRecommendationBoost(recommendationBoost);
    await requirePromotionProducts(
      transaction,
      principal.organizationId,
      productIds,
    );
    if (status === "ACTIVE") {
      await assertPromotionDoesNotOverlap(transaction, {
        organizationId: principal.organizationId,
        productIds,
        priority,
        effectiveFrom,
        effectiveTo,
        excludeId: existing.id,
      });
    }
    const updated = await transaction.promotion.updateMany({
      where: {
        id: promotionId,
        organizationId: principal.organizationId,
        revision: body.revision,
      },
      data: {
        ...(body.name === undefined ? {} : { name: body.name }),
        ...(body.priority === undefined ? {} : { priority: body.priority }),
        ...(body.conditions === undefined
          ? {}
          : { conditions: jsonInput(body.conditions) }),
        ...(body.benefit === undefined
          ? {}
          : { benefit: jsonInput(body.benefit) }),
        ...(body.recommendationBoost === undefined
          ? {}
          : { recommendationBoost: body.recommendationBoost }),
        ...(body.effectiveFrom === undefined ? {} : { effectiveFrom }),
        ...(body.effectiveTo === undefined ? {} : { effectiveTo }),
        ...statusUpdate(body),
        revision: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      conflict(
        "The promotion was changed by another request",
        "REVISION_CONFLICT",
      );
    }
    if (body.productIds !== undefined) {
      await transaction.promotionProduct.deleteMany({
        where: { organizationId: principal.organizationId, promotionId },
      });
      await transaction.promotionProduct.createMany({
        data: body.productIds.map((productId) => ({
          organizationId: principal.organizationId,
          promotionId,
          productId,
        })),
      });
    }
    const record = await transaction.promotion.findUniqueOrThrow({
      where: { id: promotionId },
      include: promotionInclude,
    });
    const before = mapPromotion(existing);
    const after = mapPromotion(record);
    await recordWrite(transaction, principal, {
      action: "updated",
      entityType: "Promotion",
      entityId: record.id,
      entityVersion: record.revision,
      before,
      after,
    });
    return after;
  });
  response.json(result);
};

const listRecommendationRules: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const query = pageQuery(request);
  const rows = await prisma.recommendationRule.findMany({
    where: { organizationId: principal.organizationId },
    orderBy: { id: "asc" },
    ...cursorArgs(query.cursor, query.limit),
  });
  response.json(mappedPage(rows, query.limit, mapRecommendationRule));
};

const getRecommendationRule: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const record = await prisma.recommendationRule.findFirst({
    where: {
      id: pathId(request.params.ruleId, "ruleId"),
      organizationId: principal.organizationId,
    },
  });
  if (record === null) notFound("Recommendation rule");
  response.json(mapRecommendationRule(record));
};

const createRecommendationRule: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const body = parseBody(CreateRecommendationRuleRequestSchema, request);
  const effectiveFrom = effectiveDate(body.effectiveFrom);
  const effectiveTo =
    body.effectiveTo === undefined ? null : effectiveDate(body.effectiveTo);
  assertEffectiveRange(effectiveFrom, effectiveTo);
  assertRecommendationWeights(body);
  const result = await serializableWrite(async (transaction) => {
    if (body.productId !== undefined) {
      await requireProduct(
        transaction,
        principal.organizationId,
        body.productId,
      );
    }
    if (body.status === "ACTIVE") {
      await assertRecommendationRuleDoesNotOverlap(transaction, {
        organizationId: principal.organizationId,
        code: body.code,
        effectiveFrom,
        effectiveTo,
      });
    }
    const record = await transaction.recommendationRule.create({
      data: {
        organizationId: principal.organizationId,
        productId: body.productId,
        code: body.code,
        name: body.name,
        priority: body.priority,
        affinityWeight: body.affinityWeight,
        marginWeight: body.marginWeight,
        promotionWeight: body.promotionWeight,
        availabilityWeight: body.availabilityWeight,
        stockAgeWeight: body.stockAgeWeight,
        minimumMargin: body.minimumMargin,
        conditions: jsonInput(body.conditions),
        effectiveFrom,
        effectiveTo,
        status: body.status,
      },
    });
    const dto = mapRecommendationRule(record);
    await recordWrite(transaction, principal, {
      action: "created",
      entityType: "RecommendationRule",
      entityId: record.id,
      entityVersion: record.version,
      after: dto,
    });
    return dto;
  });
  response.status(201).json(result);
};

const updateRecommendationRule: RequestHandler = async (request, response) => {
  const principal = internalPrincipal(response);
  const ruleId = pathId(request.params.ruleId, "ruleId");
  const body = parseBody(UpdateRecommendationRuleRequestSchema, request);
  const result = await serializableWrite(async (transaction) => {
    const existing = await transaction.recommendationRule.findFirst({
      where: { id: ruleId, organizationId: principal.organizationId },
    });
    if (existing === null) notFound("Recommendation rule");
    if (existing.version !== body.version) {
      conflict(
        "The recommendation rule was changed by another request",
        "REVISION_CONFLICT",
      );
    }
    const productId =
      body.productId === undefined ? existing.productId : body.productId;
    if (productId !== null) {
      await requireProduct(transaction, principal.organizationId, productId);
    }
    const effectiveFrom =
      body.effectiveFrom === undefined
        ? existing.effectiveFrom
        : effectiveDate(body.effectiveFrom);
    const effectiveTo = nextEffectiveDate(
      body.effectiveTo,
      existing.effectiveTo,
    );
    const status = body.status ?? existing.status;
    const weights = {
      affinityWeight: body.affinityWeight ?? existing.affinityWeight,
      marginWeight: body.marginWeight ?? existing.marginWeight,
      promotionWeight: body.promotionWeight ?? existing.promotionWeight,
      availabilityWeight:
        body.availabilityWeight ?? existing.availabilityWeight,
      stockAgeWeight: body.stockAgeWeight ?? existing.stockAgeWeight,
    };
    assertEffectiveRange(effectiveFrom, effectiveTo);
    assertRecommendationWeights(weights);
    if (status === "ACTIVE") {
      await assertRecommendationRuleDoesNotOverlap(transaction, {
        organizationId: principal.organizationId,
        code: existing.code,
        effectiveFrom,
        effectiveTo,
        excludeId: existing.id,
      });
    }
    const archived = await transaction.recommendationRule.updateMany({
      where: {
        id: ruleId,
        organizationId: principal.organizationId,
        version: body.version,
        status: { not: "ARCHIVED" },
      },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });
    if (archived.count !== 1) {
      conflict(
        "The recommendation rule was changed by another request",
        "REVISION_CONFLICT",
      );
    }
    const record = await transaction.recommendationRule.create({
      data: {
        organizationId: principal.organizationId,
        productId,
        code: existing.code,
        name: body.name ?? existing.name,
        version: existing.version + 1,
        priority: body.priority ?? existing.priority,
        affinityWeight: weights.affinityWeight,
        marginWeight: weights.marginWeight,
        promotionWeight: weights.promotionWeight,
        availabilityWeight: weights.availabilityWeight,
        stockAgeWeight: weights.stockAgeWeight,
        minimumMargin: body.minimumMargin ?? existing.minimumMargin,
        conditions: jsonInput(body.conditions ?? existing.conditions),
        effectiveFrom,
        effectiveTo,
        status,
        archivedAt: status === "ARCHIVED" ? new Date() : null,
      },
    });
    const before = mapRecommendationRule(existing);
    const after = mapRecommendationRule(record);
    await recordWrite(transaction, principal, {
      action: "versioned",
      entityType: "RecommendationRule",
      entityId: record.id,
      entityVersion: record.version,
      before,
      after,
    });
    return after;
  });
  response.json(result);
};

const prismaErrorMapper: ErrorRequestHandler = (
  error,
  _request,
  _response,
  next,
) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      next(
        new HttpError(
          409,
          "Conflict",
          "A configuration record with the same unique value already exists",
          { code: "UNIQUE_CONSTRAINT_CONFLICT" },
        ),
      );
      return;
    }
    if (error.code === "P2003") {
      next(
        new HttpError(
          422,
          "Validation failed",
          "A referenced configuration record is invalid",
          { code: "INVALID_REFERENCE" },
        ),
      );
      return;
    }
    if (error.code === "P2034") {
      next(
        new HttpError(
          409,
          "Conflict",
          "A concurrent configuration write won; retry with fresh data",
          { code: "CONCURRENT_WRITE_CONFLICT" },
        ),
      );
      return;
    }
  }
  next(error);
};

function readable(
  handler: RequestHandler,
  capability:
    | "catalog.read"
    | "customer.read"
    | "inventory.read"
    | "approval.read"
    | "recommendation.read",
) {
  return [requireCapability(capability), handler] as const;
}

function configurable(handler: RequestHandler) {
  return [
    requireCapability("configuration.manage"),
    requireCsrf,
    handler,
  ] as const;
}

function customerMutation(handler: RequestHandler) {
  return [requireCapability("customer.manage"), requireCsrf, handler] as const;
}

export function createConfigurationRouter(): Router {
  const router = Router();

  router.get(
    "/products",
    authenticateInternal,
    ...readable(listProducts, "catalog.read"),
  );
  router.post(
    "/products",
    authenticateInternal,
    ...configurable(createProduct),
  );
  router.patch(
    "/products/:productId",
    authenticateInternal,
    ...configurable(updateProduct),
  );
  router.get(
    "/products/:productId/variants",
    authenticateInternal,
    ...readable(listProductVariants, "catalog.read"),
  );
  router.post(
    "/products/:productId/variants",
    authenticateInternal,
    ...configurable(createProductVariant),
  );
  router.patch(
    "/products/:productId/variants/:variantId",
    authenticateInternal,
    ...configurable(updateProductVariant),
  );

  router.get(
    "/product-categories",
    authenticateInternal,
    ...readable(listProductCategories, "catalog.read"),
  );
  router.post(
    "/product-categories",
    authenticateInternal,
    ...configurable(createProductCategory),
  );
  router.patch(
    "/product-categories/:categoryId",
    authenticateInternal,
    ...configurable(updateProductCategory),
  );

  router.get(
    "/customers",
    authenticateInternal,
    ...readable(listCustomerAccounts, "customer.read"),
  );
  router.get(
    "/warehouses",
    authenticateInternal,
    ...readable(listWarehouses, "catalog.read"),
  );
  router.post(
    "/warehouses",
    authenticateInternal,
    ...configurable(createWarehouse),
  );
  router.patch(
    "/warehouses/:warehouseId",
    authenticateInternal,
    ...configurable(updateWarehouse),
  );
  router.get(
    "/subscription-plans",
    authenticateInternal,
    ...readable(listSubscriptionPlans, "catalog.read"),
  );
  router.post(
    "/subscription-plans",
    authenticateInternal,
    ...configurable(createSubscriptionPlan),
  );
  router.patch(
    "/subscription-plans/:planId",
    authenticateInternal,
    ...configurable(updateSubscriptionPlan),
  );

  router.get(
    "/customer-accounts/tiers",
    authenticateInternal,
    ...readable(listCustomerTiers, "customer.read"),
  );
  router.post(
    "/customer-accounts/tiers",
    authenticateInternal,
    ...customerMutation(createCustomerTier),
  );
  router.patch(
    "/customer-accounts/tiers/:tierId",
    authenticateInternal,
    ...customerMutation(updateCustomerTier),
  );
  router.get(
    "/customer-accounts/accounts",
    authenticateInternal,
    ...readable(listCustomerAccounts, "customer.read"),
  );
  router.post(
    "/customer-accounts/accounts",
    authenticateInternal,
    ...customerMutation(createCustomerAccount),
  );
  router.get(
    "/customer-accounts/accounts/:customerId",
    authenticateInternal,
    ...readable(getCustomerAccount, "customer.read"),
  );
  router.patch(
    "/customer-accounts/accounts/:customerId",
    authenticateInternal,
    ...customerMutation(updateCustomerAccount),
  );
  router.get(
    "/customer-accounts/accounts/:customerId/contacts",
    authenticateInternal,
    ...readable(listCustomerContacts, "customer.read"),
  );
  router.post(
    "/customer-accounts/accounts/:customerId/contacts",
    authenticateInternal,
    ...customerMutation(createCustomerContact),
  );
  router.patch(
    "/customer-accounts/accounts/:customerId/contacts/:contactId",
    authenticateInternal,
    ...customerMutation(updateCustomerContact),
  );

  router.get(
    "/pricing/price-lists",
    authenticateInternal,
    ...readable(listPriceLists, "catalog.read"),
  );
  router.post(
    "/pricing/price-lists",
    authenticateInternal,
    ...configurable(createPriceList),
  );
  router.patch(
    "/pricing/price-lists/:priceListId",
    authenticateInternal,
    ...configurable(updatePriceList),
  );
  router.get(
    "/pricing/price-lists/:priceListId/rules",
    authenticateInternal,
    ...readable(listPriceRules, "catalog.read"),
  );
  router.post(
    "/pricing/price-lists/:priceListId/rules",
    authenticateInternal,
    ...configurable(createPriceRule),
  );
  router.patch(
    "/pricing/price-rules/:ruleId",
    authenticateInternal,
    ...configurable(updatePriceRule),
  );
  router.delete(
    "/pricing/price-rules/:ruleId",
    authenticateInternal,
    ...configurable(archivePriceRule),
  );
  router.get(
    "/pricing/discount-limits",
    authenticateInternal,
    ...readable(listDiscountLimits, "catalog.read"),
  );
  router.post(
    "/pricing/discount-limits",
    authenticateInternal,
    ...configurable(createDiscountLimit),
  );
  router.patch(
    "/pricing/discount-limits/:limitId",
    authenticateInternal,
    ...configurable(updateDiscountLimit),
  );
  router.get(
    "/pricing/taxes",
    authenticateInternal,
    ...readable(listTaxes, "catalog.read"),
  );
  router.post(
    "/pricing/taxes",
    authenticateInternal,
    ...configurable(createTax),
  );
  router.patch(
    "/pricing/taxes/:taxId",
    authenticateInternal,
    ...configurable(updateTax),
  );
  router.get(
    "/pricing/subscription-plans",
    authenticateInternal,
    ...readable(listSubscriptionPlans, "catalog.read"),
  );
  router.post(
    "/pricing/subscription-plans",
    authenticateInternal,
    ...configurable(createSubscriptionPlan),
  );
  router.patch(
    "/pricing/subscription-plans/:planId",
    authenticateInternal,
    ...configurable(updateSubscriptionPlan),
  );

  router.get(
    "/price-lists",
    authenticateInternal,
    ...readable(listPriceLists, "catalog.read"),
  );
  router.post(
    "/price-lists",
    authenticateInternal,
    ...configurable(createPriceList),
  );
  router.patch(
    "/price-lists/:priceListId",
    authenticateInternal,
    ...configurable(updatePriceList),
  );
  router.get(
    "/discount-limits",
    authenticateInternal,
    ...readable(listDiscountLimits, "catalog.read"),
  );
  router.post(
    "/discount-limits",
    authenticateInternal,
    ...configurable(createDiscountLimit),
  );
  router.patch(
    "/discount-limits/:limitId",
    authenticateInternal,
    ...configurable(updateDiscountLimit),
  );

  router.get(
    "/approval-policies",
    authenticateInternal,
    ...readable(listApprovalPolicies, "approval.read"),
  );
  router.get(
    "/approval-policies/:policyId",
    authenticateInternal,
    ...readable(getApprovalPolicy, "approval.read"),
  );
  router.post(
    "/approval-policies",
    authenticateInternal,
    ...configurable(createApprovalPolicy),
  );
  router.patch(
    "/approval-policies/:policyId",
    authenticateInternal,
    ...configurable(updateApprovalPolicy),
  );

  router.get(
    "/promotions",
    authenticateInternal,
    ...readable(listPromotions, "recommendation.read"),
  );
  router.get(
    "/promotions/:promotionId",
    authenticateInternal,
    ...readable(getPromotion, "recommendation.read"),
  );
  router.post(
    "/promotions",
    authenticateInternal,
    ...configurable(createPromotion),
  );
  router.patch(
    "/promotions/:promotionId",
    authenticateInternal,
    ...configurable(updatePromotion),
  );

  router.get(
    "/recommendation-rules",
    authenticateInternal,
    ...readable(listRecommendationRules, "recommendation.read"),
  );
  router.get(
    "/recommendation-rules/:ruleId",
    authenticateInternal,
    ...readable(getRecommendationRule, "recommendation.read"),
  );
  router.post(
    "/recommendation-rules",
    authenticateInternal,
    ...configurable(createRecommendationRule),
  );
  router.patch(
    "/recommendation-rules/:ruleId",
    authenticateInternal,
    ...configurable(updateRecommendationRule),
  );

  router.get(
    "/inventory/warehouses",
    authenticateInternal,
    ...readable(listWarehouses, "inventory.read"),
  );
  router.post(
    "/inventory/warehouses",
    authenticateInternal,
    ...configurable(createWarehouse),
  );
  router.patch(
    "/inventory/warehouses/:warehouseId",
    authenticateInternal,
    ...configurable(updateWarehouse),
  );

  router.use(prismaErrorMapper);
  return router;
}
