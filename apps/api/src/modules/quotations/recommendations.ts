import { RecommendationDtoSchema, type RecommendationDto } from "@repo/common";
import { Prisma } from "@repo/db";

import { jsonInput, type TransactionClient } from "../../shared/activity.js";
import type { InternalPrincipal } from "../../shared/types.js";
import { loadOwnedQuote } from "./service.js";

const ZERO = new Prisma.Decimal(0);
const ONE = new Prisma.Decimal(1);
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function clampUnit(value: Prisma.Decimal): Prisma.Decimal {
  if (value.lessThan(ZERO)) return ZERO;
  if (value.greaterThan(ONE)) return ONE;
  return value;
}

function positiveConditionNumber(
  conditions: unknown,
  key: string,
  fallback: number,
): number {
  if (
    conditions === null ||
    typeof conditions !== "object" ||
    Array.isArray(conditions)
  ) {
    return fallback;
  }
  const value = Reflect.get(conditions, key);
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

export async function recommendationsForQuote(
  transaction: TransactionClient,
  principal: InternalPrincipal,
  quoteId: string,
): Promise<RecommendationDto[]> {
  const quote = await loadOwnedQuote(transaction, principal, quoteId);
  const now = new Date();
  const existingProductIds = quote.currentVersion.lines.map(
    (line) => line.productId,
  );
  const dismissals = await transaction.recommendationInteraction.findMany({
    where: {
      organizationId: principal.organizationId,
      quoteId,
      interaction: "DISMISSAL",
    },
    select: { productId: true },
  });
  const excluded = [
    ...new Set([
      ...existingProductIds,
      ...dismissals.map((row) => row.productId),
    ]),
  ];
  const products = await transaction.product.findMany({
    where: {
      organizationId: principal.organizationId,
      status: "ACTIVE",
      id: { notIn: excluded },
      category: { status: "ACTIVE" },
    },
    include: {
      priceRules: { include: { priceList: true } },
      inventoryBalances: { include: { warehouse: true } },
      promotionProducts: { include: { promotion: true } },
      recommendationRules: true,
    },
    orderBy: { id: "asc" },
    take: 100,
  });
  const affinities =
    existingProductIds.length === 0
      ? []
      : await transaction.productAffinity.findMany({
          where: {
            organizationId: principal.organizationId,
            sourceProductId: { in: existingProductIds },
            targetProductId: { in: products.map((product) => product.id) },
            status: "ACTIVE",
            effectiveFrom: { lte: now },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
          },
        });
  const genericRules = await transaction.recommendationRule.findMany({
    where: {
      organizationId: principal.organizationId,
      productId: null,
      status: "ACTIVE",
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    },
    orderBy: [{ priority: "desc" }, { version: "desc" }, { id: "asc" }],
  });

  const recommendations = products
    .flatMap((product) => {
      const activeBalances = product.inventoryBalances.filter(
        (balance) => balance.warehouse.status === "ACTIVE",
      );
      const available = activeBalances.reduce(
        (sum, balance) => sum.plus(balance.available),
        ZERO,
      );
      if (product.type === "HARDWARE" && !available.greaterThan(ZERO))
        return [];
      const prices = product.priceRules
        .filter(
          (rule) =>
            rule.status === "ACTIVE" &&
            rule.effectiveFrom <= now &&
            (rule.effectiveTo === null || rule.effectiveTo >= now) &&
            rule.minQuantity.lessThanOrEqualTo(1) &&
            (rule.tierId === null ||
              rule.tierId === quote.customerAccount.tierId) &&
            rule.priceList.status === "ACTIVE" &&
            rule.priceList.currency === quote.currentVersion.currency &&
            rule.priceList.effectiveFrom <= now &&
            (rule.priceList.effectiveTo === null ||
              rule.priceList.effectiveTo >= now),
        )
        .sort(
          (left, right) =>
            (right.tierId === quote.customerAccount.tierId ? 1 : 0) -
              (left.tierId === quote.customerAccount.tierId ? 1 : 0) ||
            right.priority - left.priority ||
            right.priceList.priority - left.priceList.priority ||
            left.id.localeCompare(right.id),
        );
      const price = prices[0]?.unitPrice;
      if (price === undefined || price.isZero()) return [];
      const rule =
        product.recommendationRules
          .filter(
            (candidate) =>
              candidate.status === "ACTIVE" &&
              candidate.effectiveFrom <= now &&
              (candidate.effectiveTo === null || candidate.effectiveTo >= now),
          )
          .sort(
            (left, right) =>
              right.priority - left.priority ||
              right.version - left.version ||
              left.id.localeCompare(right.id),
          )[0] ?? genericRules[0];
      const marginPercent = price
        .minus(product.standardCost)
        .div(price)
        .mul(100);
      if (rule !== undefined && marginPercent.lessThan(rule.minimumMargin))
        return [];
      const affinity = clampUnit(
        affinities
          .filter((candidate) => candidate.targetProductId === product.id)
          .reduce(
            (maximum, candidate) =>
              Prisma.Decimal.max(maximum, candidate.affinityScore),
            ZERO,
          ),
      );
      const promotion = clampUnit(
        product.promotionProducts
          .filter(
            (candidate) =>
              candidate.promotion.status === "ACTIVE" &&
              candidate.promotion.effectiveFrom <= now &&
              (candidate.promotion.effectiveTo === null ||
                candidate.promotion.effectiveTo >= now),
          )
          .reduce(
            (maximum, candidate) =>
              Prisma.Decimal.max(
                maximum,
                candidate.promotion.recommendationBoost,
              ),
            ZERO,
          ),
      );
      const margin = clampUnit(marginPercent.div(100));
      const availabilityTarget = positiveConditionNumber(
        rule?.conditions,
        "availabilityTargetUnits",
        10,
      );
      const availability =
        product.type === "HARDWARE"
          ? clampUnit(available.div(availabilityTarget))
          : ONE;
      const stockAgeTargetDays = positiveConditionNumber(
        rule?.conditions,
        "stockAgeTargetDays",
        90,
      );
      const availableWithAge = activeBalances.filter(
        (balance) =>
          balance.available.greaterThan(ZERO) && balance.stockedSince !== null,
      );
      const ageWeightedQuantity = availableWithAge.reduce((total, balance) => {
        const ageDays = Math.max(
          0,
          Math.floor(
            (now.getTime() -
              (balance.stockedSince?.getTime() ?? now.getTime())) /
              MILLISECONDS_PER_DAY,
          ),
        );
        return total.plus(balance.available.mul(ageDays));
      }, ZERO);
      const ageTrackedQuantity = availableWithAge.reduce(
        (total, balance) => total.plus(balance.available),
        ZERO,
      );
      const stockAgeDays =
        product.type === "HARDWARE" && ageTrackedQuantity.greaterThan(ZERO)
          ? Math.max(
              0,
              ageWeightedQuantity
                .div(ageTrackedQuantity)
                .toDecimalPlaces(0, Prisma.Decimal.ROUND_FLOOR)
                .toNumber(),
            )
          : null;
      const stockAge =
        stockAgeDays === null
          ? ZERO
          : clampUnit(new Prisma.Decimal(stockAgeDays).div(stockAgeTargetDays));
      const affinityWeight = rule?.affinityWeight ?? new Prisma.Decimal("0.35");
      const marginWeight = rule?.marginWeight ?? new Prisma.Decimal("0.2");
      const promotionWeight =
        rule?.promotionWeight ?? new Prisma.Decimal("0.15");
      const availabilityWeight =
        rule?.availabilityWeight ?? new Prisma.Decimal("0.15");
      const stockAgeWeight = rule?.stockAgeWeight ?? new Prisma.Decimal("0.15");
      const total = affinity
        .mul(affinityWeight)
        .plus(margin.mul(marginWeight))
        .plus(promotion.mul(promotionWeight))
        .plus(availability.mul(availabilityWeight))
        .plus(stockAge.mul(stockAgeWeight))
        .toDecimalPlaces(4);
      const reasonCodes = [
        ...(affinity.greaterThan(ZERO) ? ["FREQUENTLY_BOUGHT_TOGETHER"] : []),
        ...(promotion.greaterThan(ZERO) ? ["ACTIVE_PROMOTION"] : []),
        ...(availability.greaterThanOrEqualTo("0.5") ? ["AVAILABLE_NOW"] : []),
        ...(stockAge.greaterThanOrEqualTo("0.5") ? ["AGING_STOCK"] : []),
        ...(margin.greaterThanOrEqualTo("0.25") ? ["POSITIVE_MARGIN"] : []),
      ];
      if (reasonCodes.length === 0) reasonCodes.push("CATALOG_MATCH");
      const explanation = [
        ...(affinity.greaterThan(ZERO)
          ? ["Customer-product affinity contributes to the rank."]
          : []),
        ...(promotion.greaterThan(ZERO)
          ? ["An active promotion contributes to the rank."]
          : []),
        ...(product.type === "HARDWARE"
          ? [
              `${available.toString()} unit(s) are currently available across active warehouses.`,
            ]
          : ["This service is not constrained by warehouse stock."]),
        ...(stockAgeDays === null
          ? []
          : [
              `Available units have an availability-weighted continuous stock age of ${stockAgeDays} day(s), measured against a ${stockAgeTargetDays}-day target.`,
            ]),
        `The projected gross-margin contribution is ${price.minus(product.standardCost).toDecimalPlaces(4).toString()} ${quote.currentVersion.currency}.`,
      ];
      return [
        RecommendationDtoSchema.parse({
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          productType: product.type,
          suggestedQuantity: "1",
          suggestedUnitPrice: price.toString(),
          score: {
            affinity: affinity.toDecimalPlaces(4).toString(),
            margin: margin.toDecimalPlaces(4).toString(),
            promotion: promotion.toDecimalPlaces(4).toString(),
            availability: availability.toDecimalPlaces(4).toString(),
            stockAge: stockAge.toDecimalPlaces(4).toString(),
            total: total.toString(),
          },
          expectedMarginDelta: price
            .minus(product.standardCost)
            .toDecimalPlaces(4)
            .toString(),
          availableQuantity: (product.type === "HARDWARE"
            ? available
            : ONE
          ).toString(),
          stockAgeDays,
          reasonCodes,
          explanation: explanation.join(" "),
          pricingSnapshot: {
            priceRuleId: prices[0]?.id,
            priceListId: prices[0]?.priceListId,
            recommendationRuleId: rule?.id,
            scoreWeights: {
              affinity: affinityWeight.toString(),
              margin: marginWeight.toString(),
              promotion: promotionWeight.toString(),
              availability: availabilityWeight.toString(),
              stockAge: stockAgeWeight.toString(),
            },
            availabilityTargetUnits: availabilityTarget,
            stockAgeBasis: {
              metric: "availability-weighted-continuous-on-hand-age",
              targetDays: stockAgeTargetDays,
            },
          },
        }),
      ];
    })
    .sort(
      (left, right) =>
        Number(right.score.total) - Number(left.score.total) ||
        left.productId.localeCompare(right.productId),
    )
    .slice(0, 8);

  if (recommendations.length > 0) {
    await transaction.recommendationInteraction.createMany({
      data: recommendations.map((recommendation) => ({
        organizationId: principal.organizationId,
        quoteId,
        quoteVersionId: quote.currentVersion.id,
        productId: recommendation.productId,
        actorType: "USER",
        actorId: principal.userId,
        interaction: "IMPRESSION",
        scoreSnapshot: jsonInput(recommendation.score),
        reasonCodes: recommendation.reasonCodes,
        expectedMarginDelta: new Prisma.Decimal(
          recommendation.expectedMarginDelta,
        ),
      })),
    });
  }
  return recommendations;
}
