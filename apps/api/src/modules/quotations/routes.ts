import { Router } from "express";

import {
  AddQuoteLineRequestSchema,
  AddRecommendationRequestSchema,
  CreateQuoteSavedFilterRequestSchema,
  CreateQuoteRequestSchema,
  DealEventDtoSchema,
  DeleteQuoteLineRequestSchema,
  ListQuerySchema,
  QuoteCalculationRequestSchema,
  QuoteCalculationResponseSchema,
  QuoteCommandRequestSchema,
  QuoteListQuerySchema,
  QuoteProductPickerPageDtoSchema,
  QuoteProductPickerQuerySchema,
  QuoteSavedFilterListQuerySchema,
  QuoteSavedFilterValueSchema,
  QuoteSubmitResponseSchema,
  QuoteVersionDiffDtoSchema,
  QuoteVersionDiffQuerySchema,
  RecommendationInteractionDtoSchema,
  RecordRecommendationInteractionRequestSchema,
  SavedReportFilterDtoSchema,
  SavedReportFilterPageDtoSchema,
  SendQuoteRequestSchema,
  UpdateQuoteLineRequestSchema,
  UpdateQuoteRequestSchema,
  UpdateQuoteSavedFilterRequestSchema,
  UpdateQuoteStageRequestSchema,
} from "@repo/common";
import { prisma, Prisma } from "@repo/db";

import {
  authenticateInternal,
  internalPrincipal,
  requireCapability,
  requireCsrf,
} from "../../middleware/auth.js";
import { jsonInput } from "../../shared/activity.js";
import { conflict, notFound } from "../../shared/errors.js";
import {
  cursorArgs,
  pageFromRows,
  parseBody,
  parsePathId,
  parseQuery,
  toJsonValue,
} from "../../shared/http.js";
import { recalculateQuote } from "./calculation.js";
import {
  mapQuote,
  mapQuoteLine,
  mapQuoteSummary,
  mapQuoteVersion,
  quoteInclude,
  versionInclude,
} from "./mappers.js";
import { recommendationsForQuote } from "./recommendations.js";
import {
  addQuoteLine,
  createQuote,
  deleteQuoteLine,
  hasOrganizationWideQuoteAccess,
  loadOwnedQuote,
  mayReadQuote,
  transitionQuoteStage,
  updateQuote,
  updateQuoteLine,
} from "./service.js";
import { sendQuote, submitQuote } from "./workflow.js";

function lineIdentity(line: {
  lineNumber: number;
  productId: string;
  variantId: string | null;
  subscriptionPlanId: string | null;
}): string {
  return `${line.lineNumber}:${line.productId}:${line.variantId ?? "base"}:${line.subscriptionPlanId ?? "none"}`;
}

function mapQuoteSavedFilter(filter: {
  id: string;
  name: string;
  filters: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}) {
  return SavedReportFilterDtoSchema.parse({
    id: filter.id,
    name: filter.name,
    reportType: "QUOTES",
    filters: QuoteSavedFilterValueSchema.parse(filter.filters),
    createdAt: filter.createdAt.toISOString(),
    updatedAt: filter.updatedAt.toISOString(),
  });
}

function quoteSavedFilterNameConflict(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    conflict(
      "A saved quotation filter already uses this name",
      "SAVED_FILTER_NAME_CONFLICT",
    );
  }
  throw error;
}

function versionDifferences(
  before: Prisma.QuoteVersionGetPayload<{ include: typeof versionInclude }>,
  after: Prisma.QuoteVersionGetPayload<{ include: typeof versionInclude }>,
) {
  const differences: Array<{
    path: string;
    label: string;
    before: unknown;
    after: unknown;
    material: boolean;
  }> = [];
  const compare = (
    path: string,
    label: string,
    left: unknown,
    right: unknown,
  ) => {
    if (String(left ?? "") !== String(right ?? "")) {
      differences.push({
        path,
        label,
        before: left ?? null,
        after: right ?? null,
        material: true,
      });
    }
  };
  compare("currency", "Currency", before.currency, after.currency);
  compare(
    "paymentTermsDays",
    "Payment terms",
    before.paymentTermsDays,
    after.paymentTermsDays,
  );
  const beforeLines = new Map(
    before.lines.map((line) => [lineIdentity(line), line]),
  );
  const afterLines = new Map(
    after.lines.map((line) => [lineIdentity(line), line]),
  );
  for (const key of new Set([...beforeLines.keys(), ...afterLines.keys()])) {
    const left = beforeLines.get(key);
    const right = afterLines.get(key);
    const label = right?.productName ?? left?.productName ?? "Quote line";
    if (left === undefined || right === undefined) {
      differences.push({
        path: `lines.${key}`,
        label,
        before: left === undefined ? null : mapQuoteLine(left),
        after: right === undefined ? null : mapQuoteLine(right),
        material: true,
      });
      continue;
    }
    compare(
      `lines.${key}.quantity`,
      `${label} quantity`,
      left.quantity.toString(),
      right.quantity.toString(),
    );
    compare(
      `lines.${key}.unitPrice`,
      `${label} unit price`,
      left.unitPrice.toString(),
      right.unitPrice.toString(),
    );
    compare(
      `lines.${key}.discountPercent`,
      `${label} discount`,
      left.discountPercent.toString(),
      right.discountPercent.toString(),
    );
    compare(
      `lines.${key}.billingType`,
      `${label} billing`,
      left.billingType,
      right.billingType,
    );
    compare(
      `lines.${key}.taxCode`,
      `${label} tax`,
      left.taxCode,
      right.taxCode,
    );
    compare(
      `lines.${key}.taxRate`,
      `${label} tax rate`,
      left.taxRate.toString(),
      right.taxRate.toString(),
    );
    compare(
      `lines.${key}.taxBehavior`,
      `${label} tax behavior`,
      left.taxBehavior,
      right.taxBehavior,
    );
  }
  return differences;
}

export function createQuotationRouter(): Router {
  const router = Router();

  router.get(
    "/catalog/product-picker",
    authenticateInternal,
    requireCapability("quotation.read"),
    requireCapability("catalog.read"),
    async (request, response) => {
      const principal = internalPrincipal(response);
      const query = parseQuery(QuoteProductPickerQuerySchema, request);
      const quote = await prisma.quote.findFirst({
        where: { id: query.quoteId, organizationId: principal.organizationId },
        select: {
          ownerId: true,
          salesTeamId: true,
          customerAccount: { select: { tierId: true } },
          currentVersion: { select: { currency: true } },
        },
      });
      if (
        quote === null ||
        quote.currentVersion === null ||
        !mayReadQuote(principal, quote)
      ) {
        notFound("Quote");
      }
      const now = new Date();
      const quantity = new Prisma.Decimal(query.quantity);
      const rules = await prisma.priceRule.findMany({
        where: {
          organizationId: principal.organizationId,
          status: "ACTIVE",
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
          minQuantity: { lte: quantity },
          priceList: {
            organizationId: principal.organizationId,
            ...(query.priceListId === undefined
              ? {}
              : { id: query.priceListId }),
            currency: quote.currentVersion.currency,
            status: "ACTIVE",
            effectiveFrom: { lte: now },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
          },
          AND: [
            {
              OR: [{ tierId: quote.customerAccount.tierId }, { tierId: null }],
            },
          ],
        },
        include: { priceList: true },
      });
      if (rules.length === 0) {
        response.json(
          QuoteProductPickerPageDtoSchema.parse({
            items: [],
            pageInfo: { nextCursor: null, hasNextPage: false },
          }),
        );
        return;
      }
      const hasGlobalRule = rules.some(
        (rule) => rule.productId === null && rule.categoryId === null,
      );
      const pricedProductIds = rules.flatMap((rule) =>
        rule.productId === null ? [] : [rule.productId],
      );
      const pricedCategoryIds = rules.flatMap((rule) =>
        rule.productId === null && rule.categoryId !== null
          ? [rule.categoryId]
          : [],
      );
      const productFilters: Prisma.ProductWhereInput[] = [];
      if (!hasGlobalRule) {
        productFilters.push({
          OR: [
            ...(pricedProductIds.length === 0
              ? []
              : [{ id: { in: pricedProductIds } }]),
            ...(pricedCategoryIds.length === 0
              ? []
              : [{ categoryId: { in: pricedCategoryIds } }]),
          ],
        });
      }
      if (query.search !== undefined) {
        productFilters.push({
          OR: [
            { code: { contains: query.search, mode: "insensitive" } },
            { name: { contains: query.search, mode: "insensitive" } },
            {
              description: {
                contains: query.search,
                mode: "insensitive",
              },
            },
            {
              variants: {
                some: {
                  OR: [
                    {
                      sku: {
                        contains: query.search,
                        mode: "insensitive",
                      },
                    },
                    {
                      name: {
                        contains: query.search,
                        mode: "insensitive",
                      },
                    },
                  ],
                },
              },
            },
          ],
        });
      }
      if (query.warehouseId !== undefined || query.inStockOnly) {
        productFilters.push({
          inventoryBalances: {
            some: {
              ...(query.warehouseId === undefined
                ? {}
                : { warehouseId: query.warehouseId }),
              ...(query.inStockOnly ? { available: { gt: 0 } } : {}),
              warehouse: {
                organizationId: principal.organizationId,
                status: "ACTIVE",
              },
            },
          },
        });
      }
      const rows = await prisma.product.findMany({
        where: {
          organizationId: principal.organizationId,
          status: "ACTIVE",
          category: {
            organizationId: principal.organizationId,
            status: "ACTIVE",
          },
          ...(query.categoryId === undefined
            ? {}
            : { categoryId: query.categoryId }),
          ...(query.productType === undefined
            ? {}
            : { type: query.productType }),
          AND: productFilters,
        },
        include: {
          category: true,
          tax: true,
          variants: {
            where: { status: "ACTIVE" },
            orderBy: { id: "asc" },
          },
          inventoryBalances: {
            where: {
              warehouse: {
                organizationId: principal.organizationId,
                status: "ACTIVE",
              },
              ...(query.warehouseId === undefined
                ? {}
                : { warehouseId: query.warehouseId }),
            },
            include: { warehouse: true },
            orderBy: { id: "asc" },
          },
        },
        orderBy: { id: "asc" },
        ...cursorArgs(query.cursor, query.limit),
      });
      const items = rows.map((product) => {
        const selected = rules
          .filter(
            (rule) =>
              (rule.productId === product.id ||
                (rule.productId === null &&
                  rule.categoryId === product.categoryId) ||
                (rule.productId === null && rule.categoryId === null)) &&
              (rule.tierId === quote.customerAccount.tierId ||
                rule.tierId === null),
          )
          .sort((left, right) => {
            const specificity = (rule: (typeof rules)[number]) =>
              (rule.productId === product.id
                ? 4
                : rule.categoryId === product.categoryId
                  ? 2
                  : 0) + (rule.tierId === quote.customerAccount.tierId ? 1 : 0);
            return (
              specificity(right) - specificity(left) ||
              right.priority - left.priority ||
              right.priceList.priority - left.priceList.priority ||
              right.minQuantity.comparedTo(left.minQuantity) ||
              left.id.localeCompare(right.id)
            );
          })[0];
        if (selected === undefined) {
          throw new Error("A product-picker row has no matching price rule");
        }
        const activeTax =
          product.tax !== null &&
          product.tax.organizationId === principal.organizationId &&
          product.tax.status === "ACTIVE" &&
          product.tax.effectiveFrom <= now &&
          (product.tax.effectiveTo === null || product.tax.effectiveTo >= now)
            ? product.tax
            : null;
        const variants = [
          {
            id: null,
            sku: null,
            name: null,
            attributes: {},
            priceSurcharge: new Prisma.Decimal(0),
          },
          ...product.variants,
        ];
        return {
          id: product.id,
          code: product.code,
          name: product.name,
          description: product.description,
          productType: product.type,
          unit: product.unit,
          stockManaged: product.type === "HARDWARE",
          category: {
            id: product.category.id,
            code: product.category.code,
            name: product.category.name,
          },
          tax:
            activeTax === null
              ? null
              : {
                  code: activeTax.code,
                  rate: activeTax.rate.toString(),
                  behavior: activeTax.behavior,
                },
          priceList: {
            id: selected.priceList.id,
            code: selected.priceList.code,
            name: selected.priceList.name,
            currency: selected.priceList.currency,
          },
          pricingExplanation: `Matched ${selected.priceList.name} for quantity ${query.quantity}`,
          options: variants.map((variant) => {
            const balances = product.inventoryBalances.filter(
              (balance) => balance.variantId === variant.id,
            );
            const available = balances.reduce(
              (total, balance) => total.plus(balance.available),
              new Prisma.Decimal(0),
            );
            return {
              variantId: variant.id,
              sku: variant.sku,
              name: variant.name,
              attributes: toJsonValue(variant.attributes),
              priceSurcharge: variant.priceSurcharge.toString(),
              resolvedUnitPrice: selected.unitPrice
                .plus(variant.priceSurcharge)
                .toString(),
              availableQuantity: available.toString(),
              warehouses: balances.map((balance) => ({
                warehouseId: balance.warehouseId,
                warehouseCode: balance.warehouse.code,
                warehouseName: balance.warehouse.name,
                availableQuantity: balance.available.toString(),
                incomingQuantity: balance.incoming.toString(),
                incomingExpectedAt:
                  balance.incomingExpectedAt?.toISOString() ?? null,
                stockAgeDays:
                  balance.stockedSince === null
                    ? null
                    : Math.max(
                        0,
                        Math.floor(
                          (now.getTime() - balance.stockedSince.getTime()) /
                            (24 * 60 * 60 * 1000),
                        ),
                      ),
              })),
            };
          }),
        };
      });
      response.json(
        QuoteProductPickerPageDtoSchema.parse(pageFromRows(items, query.limit)),
      );
    },
  );

  router.get(
    "/quotes",
    authenticateInternal,
    requireCapability("quotation.read"),
    async (request, response) => {
      const principal = internalPrincipal(response);
      const query = parseQuery(QuoteListQuerySchema, request);
      const visibility: Prisma.QuoteWhereInput =
        !hasOrganizationWideQuoteAccess(principal)
          ? {
              OR: [
                { ownerId: principal.userId },
                ...(principal.salesTeamIds.length === 0
                  ? []
                  : [{ salesTeamId: { in: principal.salesTeamIds } }]),
              ],
            }
          : {};
      const primaryOrder: Prisma.QuoteOrderByWithRelationInput =
        query.sort === "total"
          ? { currentVersion: { total: query.direction } }
          : { [query.sort]: query.direction };
      const rows = await prisma.quote.findMany({
        where: {
          organizationId: principal.organizationId,
          AND: [visibility],
          ...(query.stage === undefined ? {} : { stage: query.stage }),
          ...(query.ownerId === undefined ? {} : { ownerId: query.ownerId }),
          ...(query.customerAccountId === undefined
            ? {}
            : { customerAccountId: query.customerAccountId }),
          ...(query.search === undefined
            ? {}
            : {
                OR: [
                  {
                    quoteNumber: {
                      contains: query.search,
                      mode: "insensitive",
                    },
                  },
                  {
                    customerAccount: {
                      name: { contains: query.search, mode: "insensitive" },
                    },
                  },
                ],
              }),
        },
        include: quoteInclude,
        orderBy: [primaryOrder, { id: query.direction }],
        ...cursorArgs(query.cursor, query.limit),
      });
      response.json(pageFromRows(rows.map(mapQuoteSummary), query.limit));
    },
  );

  router.get(
    "/quotes/saved-filters",
    authenticateInternal,
    requireCapability("quotation.read"),
    async (request, response) => {
      const principal = internalPrincipal(response);
      const query = parseQuery(QuoteSavedFilterListQuerySchema, request);
      const rows = await prisma.savedReportFilter.findMany({
        where: {
          organizationId: principal.organizationId,
          userId: principal.userId,
          reportType: "QUOTES",
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        ...cursorArgs(query.cursor, query.limit),
      });
      response.json(
        SavedReportFilterPageDtoSchema.parse(
          pageFromRows(rows.map(mapQuoteSavedFilter), query.limit),
        ),
      );
    },
  );

  router.post(
    "/quotes/saved-filters",
    authenticateInternal,
    requireCapability("quotation.read"),
    requireCsrf,
    async (request, response) => {
      const principal = internalPrincipal(response);
      const input = parseBody(CreateQuoteSavedFilterRequestSchema, request);
      try {
        const created = await prisma.savedReportFilter.create({
          data: {
            organizationId: principal.organizationId,
            userId: principal.userId,
            name: input.name,
            reportType: "QUOTES",
            filters: jsonInput(input.filters),
          },
        });
        response.status(201).json(mapQuoteSavedFilter(created));
      } catch (error) {
        quoteSavedFilterNameConflict(error);
      }
    },
  );

  router.patch(
    "/quotes/saved-filters/:filterId",
    authenticateInternal,
    requireCapability("quotation.read"),
    requireCsrf,
    async (request, response) => {
      const principal = internalPrincipal(response);
      const filterId = parsePathId(request, "filterId");
      const input = parseBody(UpdateQuoteSavedFilterRequestSchema, request);
      const existing = await prisma.savedReportFilter.findFirst({
        where: {
          id: filterId,
          organizationId: principal.organizationId,
          userId: principal.userId,
          reportType: "QUOTES",
        },
      });
      if (existing === null) notFound("Saved quotation filter");
      try {
        const updated = await prisma.savedReportFilter.updateMany({
          where: {
            id: existing.id,
            organizationId: principal.organizationId,
            userId: principal.userId,
            reportType: "QUOTES",
            updatedAt: new Date(input.updatedAt),
          },
          data: {
            ...(input.name === undefined ? {} : { name: input.name }),
            ...(input.filters === undefined
              ? {}
              : { filters: jsonInput(input.filters) }),
          },
        });
        if (updated.count !== 1) {
          conflict(
            "The saved quotation filter changed after this request was prepared",
            "STALE_SAVED_FILTER",
          );
        }
        const record = await prisma.savedReportFilter.findUniqueOrThrow({
          where: { id: existing.id },
        });
        response.json(mapQuoteSavedFilter(record));
      } catch (error) {
        quoteSavedFilterNameConflict(error);
      }
    },
  );

  router.delete(
    "/quotes/saved-filters/:filterId",
    authenticateInternal,
    requireCapability("quotation.read"),
    requireCsrf,
    async (request, response) => {
      const principal = internalPrincipal(response);
      const deleted = await prisma.savedReportFilter.deleteMany({
        where: {
          id: parsePathId(request, "filterId"),
          organizationId: principal.organizationId,
          userId: principal.userId,
          reportType: "QUOTES",
        },
      });
      if (deleted.count !== 1) notFound("Saved quotation filter");
      response.status(204).end();
    },
  );

  router.post(
    "/quotes",
    authenticateInternal,
    requireCapability("quotation.create"),
    requireCsrf,
    async (request, response) => {
      const principal = internalPrincipal(response);
      const input = parseBody(CreateQuoteRequestSchema, request);
      const quote = await prisma.$transaction((transaction) =>
        createQuote(transaction, principal, input),
      );
      response.status(201).json(mapQuote(quote));
    },
  );

  router.get(
    "/quotes/:quoteId",
    authenticateInternal,
    requireCapability("quotation.read"),
    async (request, response) => {
      const principal = internalPrincipal(response);
      const quoteId = parsePathId(request, "quoteId");
      const quote = await prisma.$transaction((transaction) =>
        loadOwnedQuote(transaction, principal, quoteId),
      );
      response.json(mapQuote(quote));
    },
  );

  router.patch(
    "/quotes/:quoteId",
    authenticateInternal,
    requireCapability("quotation.editOwn"),
    requireCsrf,
    async (request, response) => {
      const principal = internalPrincipal(response);
      const input = parseBody(UpdateQuoteRequestSchema, request);
      const quote = await prisma.$transaction((transaction) =>
        updateQuote(
          transaction,
          principal,
          parsePathId(request, "quoteId"),
          input,
        ),
      );
      response.json(mapQuote(quote));
    },
  );

  router.patch(
    "/quotes/:quoteId/stage",
    authenticateInternal,
    requireCapability("quotation.editOwn"),
    requireCsrf,
    async (request, response) => {
      const principal = internalPrincipal(response);
      const input = parseBody(UpdateQuoteStageRequestSchema, request);
      const quote = await prisma.$transaction((transaction) =>
        transitionQuoteStage(
          transaction,
          principal,
          parsePathId(request, "quoteId"),
          input,
        ),
      );
      response.json(mapQuote(quote));
    },
  );

  router.post(
    "/quotes/:quoteId/lines",
    authenticateInternal,
    requireCapability("quotation.editOwn"),
    requireCsrf,
    async (request, response) => {
      const principal = internalPrincipal(response);
      const input = parseBody(AddQuoteLineRequestSchema, request);
      const quote = await prisma.$transaction((transaction) =>
        addQuoteLine(
          transaction,
          principal,
          parsePathId(request, "quoteId"),
          input,
        ),
      );
      response.status(201).json(mapQuote(quote));
    },
  );

  router.patch(
    "/quotes/:quoteId/lines/:lineId",
    authenticateInternal,
    requireCapability("quotation.editOwn"),
    requireCsrf,
    async (request, response) => {
      const principal = internalPrincipal(response);
      const input = parseBody(UpdateQuoteLineRequestSchema, request);
      const quote = await prisma.$transaction((transaction) =>
        updateQuoteLine(
          transaction,
          principal,
          parsePathId(request, "quoteId"),
          parsePathId(request, "lineId"),
          input,
        ),
      );
      response.json(mapQuote(quote));
    },
  );

  router.delete(
    "/quotes/:quoteId/lines/:lineId",
    authenticateInternal,
    requireCapability("quotation.editOwn"),
    requireCsrf,
    async (request, response) => {
      const principal = internalPrincipal(response);
      const input = parseBody(DeleteQuoteLineRequestSchema, request);
      const quote = await prisma.$transaction((transaction) =>
        deleteQuoteLine(
          transaction,
          principal,
          parsePathId(request, "quoteId"),
          parsePathId(request, "lineId"),
          input.revision,
        ),
      );
      response.json(mapQuote(quote));
    },
  );

  router.post(
    "/quotes/:quoteId/calculate",
    authenticateInternal,
    requireCapability("quotation.editOwn"),
    requireCsrf,
    async (request, response) => {
      const principal = internalPrincipal(response);
      const input = parseBody(QuoteCalculationRequestSchema, request);
      const quote = await prisma.$transaction(async (transaction) => {
        const current = await loadOwnedQuote(
          transaction,
          principal,
          parsePathId(request, "quoteId"),
        );
        if (current.revision !== input.revision) {
          const { conflict } = await import("../../shared/errors.js");
          conflict("The quote revision is stale", "REVISION_CONFLICT");
        }
        return recalculateQuote(
          transaction,
          principal.organizationId,
          current.id,
        );
      });
      const version = mapQuoteVersion(quote.currentVersion);
      if (version.riskAssessment === null)
        throw new Error("Risk calculation did not produce a result");
      response.json(
        QuoteCalculationResponseSchema.parse({
          quoteId: quote.id,
          versionId: version.id,
          revision: quote.revision,
          clientRequestNumber: input.clientRequestNumber ?? null,
          totals: version.totals,
          lines: version.lines,
          riskAssessment: version.riskAssessment,
        }),
      );
    },
  );

  router.post(
    "/quotes/:quoteId/submit",
    authenticateInternal,
    requireCapability("quotation.submit"),
    requireCsrf,
    async (request, response) => {
      const principal = internalPrincipal(response);
      const input = parseBody(QuoteCommandRequestSchema, request);
      const result = await prisma.$transaction((transaction) =>
        submitQuote(
          transaction,
          principal,
          parsePathId(request, "quoteId"),
          input.revision,
        ),
      );
      response.json(
        QuoteSubmitResponseSchema.parse({
          ...result,
          quote: mapQuote(result.quote),
        }),
      );
    },
  );

  router.post(
    "/quotes/:quoteId/send",
    authenticateInternal,
    requireCapability("quotation.send"),
    requireCsrf,
    async (request, response) => {
      const principal = internalPrincipal(response);
      const input = parseBody(SendQuoteRequestSchema, request);
      const quote = await prisma.$transaction((transaction) =>
        sendQuote(
          transaction,
          principal,
          parsePathId(request, "quoteId"),
          input.revision,
        ),
      );
      response.json(mapQuote(quote));
    },
  );

  router.get(
    "/quotes/:quoteId/versions",
    authenticateInternal,
    requireCapability("quotation.read"),
    async (request, response) => {
      const principal = internalPrincipal(response);
      const quoteId = parsePathId(request, "quoteId");
      await prisma.$transaction((transaction) =>
        loadOwnedQuote(transaction, principal, quoteId),
      );
      const versions = await prisma.quoteVersion.findMany({
        where: { organizationId: principal.organizationId, quoteId },
        include: versionInclude,
        orderBy: { revisionNumber: "desc" },
      });
      response.json(versions.map(mapQuoteVersion));
    },
  );

  router.get(
    "/quotes/:quoteId/version-diff",
    authenticateInternal,
    requireCapability("quotation.read"),
    async (request, response) => {
      const principal = internalPrincipal(response);
      const quoteId = parsePathId(request, "quoteId");
      const query = parseQuery(QuoteVersionDiffQuerySchema, request);
      await prisma.$transaction((transaction) =>
        loadOwnedQuote(transaction, principal, quoteId),
      );
      const revisionFilter =
        query.fromRevision !== undefined && query.toRevision !== undefined
          ? { revisionNumber: { in: [query.fromRevision, query.toRevision] } }
          : {};
      const candidates = await prisma.quoteVersion.findMany({
        where: {
          organizationId: principal.organizationId,
          quoteId,
          ...revisionFilter,
        },
        include: versionInclude,
        orderBy: { revisionNumber: "desc" },
        ...(query.fromRevision === undefined ? { take: 2 } : {}),
      });
      const fromRevision = query.fromRevision ?? candidates[1]?.revisionNumber;
      const toRevision = query.toRevision ?? candidates[0]?.revisionNumber;
      const before = candidates.find(
        (version) => version.revisionNumber === fromRevision,
      );
      const after = candidates.find(
        (version) => version.revisionNumber === toRevision,
      );
      if (before === undefined || after === undefined)
        notFound("Requested quote version pair");
      const differences = versionDifferences(before, after);
      response.json(
        QuoteVersionDiffDtoSchema.parse({
          quoteId,
          fromRevision,
          toRevision,
          materialChange: differences.some((difference) => difference.material),
          differences,
        }),
      );
    },
  );

  router.get(
    "/quotes/:quoteId/recommendations",
    authenticateInternal,
    requireCapability("recommendation.read"),
    async (request, response) => {
      const principal = internalPrincipal(response);
      const recommendations = await prisma.$transaction((transaction) =>
        recommendationsForQuote(
          transaction,
          principal,
          parsePathId(request, "quoteId"),
        ),
      );
      response.json(recommendations);
    },
  );

  router.post(
    "/quotes/:quoteId/recommendations/:productId/dismiss",
    authenticateInternal,
    requireCapability("recommendation.read"),
    requireCsrf,
    async (request, response) => {
      const principal = internalPrincipal(response);
      const quoteId = parsePathId(request, "quoteId");
      const productId = parsePathId(request, "productId");
      const parsed = RecordRecommendationInteractionRequestSchema.safeParse(
        request.body ?? {},
      );
      if (parsed.success && parsed.data.interaction !== "DISMISSAL") {
        throw new Error(
          "Dismiss endpoint accepts only a dismissal interaction",
        );
      }
      const interaction = await prisma.$transaction(async (transaction) => {
        const quote = await loadOwnedQuote(transaction, principal, quoteId);
        const product = await transaction.product.findFirst({
          where: { id: productId, organizationId: principal.organizationId },
          select: { id: true },
        });
        if (product === null) notFound("Product");
        return transaction.recommendationInteraction.create({
          data: {
            organizationId: principal.organizationId,
            quoteId,
            quoteVersionId: quote.currentVersion.id,
            productId,
            actorType: "USER",
            actorId: principal.userId,
            interaction: "DISMISSAL",
            scoreSnapshot: jsonInput({}),
          },
        });
      });
      response.json(
        RecommendationInteractionDtoSchema.parse({
          id: interaction.id,
          quoteId: interaction.quoteId,
          quoteVersionId: interaction.quoteVersionId,
          productId: interaction.productId,
          actorType: interaction.actorType,
          actorId: interaction.actorId,
          interaction: interaction.interaction,
          scoreSnapshot: toJsonValue(interaction.scoreSnapshot),
          reasonCodes: interaction.reasonCodes,
          expectedMarginDelta: null,
          resultingMarginDelta: null,
          createdAt: interaction.createdAt.toISOString(),
        }),
      );
    },
  );

  router.post(
    "/quotes/:quoteId/recommendations/:productId/add",
    authenticateInternal,
    requireCapability("quotation.editOwn"),
    requireCsrf,
    async (request, response) => {
      const principal = internalPrincipal(response);
      const quoteId = parsePathId(request, "quoteId");
      const productId = parsePathId(request, "productId");
      const input = parseBody(AddRecommendationRequestSchema, request);
      const quote = await prisma.$transaction(async (transaction) => {
        const before = await loadOwnedQuote(transaction, principal, quoteId);
        const recommendation = (
          await recommendationsForQuote(transaction, principal, quoteId)
        ).find((candidate) => candidate.productId === productId);
        const product = await transaction.product.findFirst({
          where: {
            id: productId,
            organizationId: principal.organizationId,
            status: "ACTIVE",
          },
        });
        if (product === null) notFound("Active product");
        const billingType =
          input.billingType ??
          (product.type === "SUBSCRIPTION" ? "RECURRING" : "ONE_TIME");
        const subscriptionPlanId =
          billingType === "RECURRING"
            ? (input.subscriptionPlanId ??
              (
                await transaction.subscriptionPlan.findFirst({
                  where: {
                    organizationId: principal.organizationId,
                    status: "ACTIVE",
                  },
                  orderBy: { createdAt: "asc" },
                  select: { id: true },
                })
              )?.id)
            : undefined;
        const addInput = AddQuoteLineRequestSchema.parse({
          revision: input.revision,
          productId,
          quantity: input.quantity,
          discountPercent: "0",
          billingType,
          subscriptionPlanId,
        });
        const updated = await addQuoteLine(
          transaction,
          principal,
          quoteId,
          addInput,
        );
        await transaction.recommendationInteraction.create({
          data: {
            organizationId: principal.organizationId,
            quoteId,
            quoteVersionId: updated.currentVersion.id,
            productId,
            actorType: "USER",
            actorId: principal.userId,
            interaction: "ACCEPTANCE",
            scoreSnapshot: jsonInput(recommendation?.score ?? {}),
            reasonCodes: recommendation?.reasonCodes ?? [],
            expectedMarginDelta:
              recommendation === undefined
                ? null
                : new Prisma.Decimal(recommendation.expectedMarginDelta),
            resultingMarginDelta: updated.currentVersion.grossMargin.minus(
              before.currentVersion.grossMargin,
            ),
          },
        });
        return updated;
      });
      response.json(mapQuote(quote));
    },
  );

  router.get(
    "/quotes/:quoteId/timeline",
    authenticateInternal,
    requireCapability("quotation.read"),
    async (request, response) => {
      const principal = internalPrincipal(response);
      const quoteId = parsePathId(request, "quoteId");
      const query = parseQuery(ListQuerySchema, request);
      const quote = await prisma.quote.findFirst({
        where: { id: quoteId, organizationId: principal.organizationId },
        include: quoteInclude,
      });
      if (quote === null || quote.currentVersion === null) notFound("Quote");
      if (!mayReadQuote(principal, quote)) notFound("Quote");
      const rows = await prisma.dealEvent.findMany({
        where: { organizationId: principal.organizationId, quoteId },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        ...cursorArgs(query.cursor, query.limit),
      });
      const actorIds = rows.flatMap((event) =>
        event.actorId === null ? [] : [event.actorId],
      );
      const [users, portalIdentities] = await Promise.all([
        prisma.user.findMany({
          where: {
            organizationId: principal.organizationId,
            id: { in: actorIds },
          },
          select: { id: true, firstName: true, lastName: true },
        }),
        prisma.portalIdentity.findMany({
          where: {
            organizationId: principal.organizationId,
            id: { in: actorIds },
          },
          select: { id: true, email: true },
        }),
      ]);
      const actorNames = new Map<string, string>([
        ...users.map(
          (user) => [user.id, `${user.firstName} ${user.lastName}`] as const,
        ),
        ...portalIdentities.map(
          (identity) => [identity.id, identity.email] as const,
        ),
      ]);
      const events = rows.map((event) =>
        DealEventDtoSchema.parse({
          id: event.id,
          quoteId: event.quoteId,
          visibility: event.visibility,
          eventType: event.eventType,
          title: event.title,
          message: event.message,
          actorType: event.actorType,
          actorName:
            event.actorId === null
              ? null
              : (actorNames.get(event.actorId) ?? null),
          sourceEntityType: event.sourceEntityType,
          sourceEntityId: event.sourceEntityId,
          sourceVersion: event.sourceVersion,
          metadata: toJsonValue(event.metadata),
          occurredAt: event.occurredAt.toISOString(),
        }),
      );
      response.json(pageFromRows(events, query.limit));
    },
  );

  return router;
}
