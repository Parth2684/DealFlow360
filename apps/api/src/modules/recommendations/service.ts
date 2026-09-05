import { prisma } from "@repo/db";
import { d, roundRate, toMoneyString } from "../../shared/decimal.js";
import { Errors } from "@repo/contracts";
import type { AuthContext } from "../../shared/context.js";

const DEFAULT_WEIGHTS = {
  affinity: 0.4,
  margin: 0.25,
  promotion: 0.2,
  availability: 0.15,
};

export class RecommendationService {
  async getRecommendations(auth: AuthContext, quoteId: string) {
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, organizationId: auth.organizationId },
      include: {
        currentVersion: { include: { lines: true } },
      },
    });
    if (!quote?.currentVersion) throw Errors.notFound("Quote");

    const existingProductIds = new Set(
      quote.currentVersion.lines.map((l) => l.productId),
    );

    const lineProductIds = [...existingProductIds];
    const affinities = await prisma.productAffinity.findMany({
      where: {
        organizationId: auth.organizationId,
        sourceProductId: { in: lineProductIds },
      },
      include: {
        targetProduct: {
          include: { category: true, inventoryBalances: true },
        },
      },
    });

    const rule = await prisma.recommendationRule.findFirst({
      where: { organizationId: auth.organizationId, active: true },
    });
    const weights = { ...DEFAULT_WEIGHTS, ...(rule?.weights as object ?? {}) };
    const marginFloor = rule ? d(rule.marginFloor) : d(20);

    const activePromotions = await prisma.promotion.findMany({
      where: {
        organizationId: auth.organizationId,
        active: true,
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
    });

    const dismissed = await prisma.recommendationInteraction.findMany({
      where: {
        quoteId,
        interaction: "DISMISS",
      },
    });
    const dismissedIds = new Set(dismissed.map((d) => d.productId));

    const candidates = affinities
      .filter((a) => {
        const p = a.targetProduct;
        return (
          p.active &&
          !existingProductIds.has(p.id) &&
          !dismissedIds.has(p.id)
        );
      })
      .map((a) => {
        const product = a.targetProduct;
        const totalAvailable = product.inventoryBalances.reduce(
          (sum, b) => sum.add(d(b.available)),
          d(0),
        );
        const unitPrice = d(product.standardCost).mul(2.5);
        const marginPct = roundRate(
          unitPrice.sub(d(product.standardCost)).div(unitPrice).mul(100),
        );
        const affinityScore = d(a.affinityScore);
        const marginScore = roundRate(marginPct.div(100));
        const promoBoost = activePromotions.length > 0 ? d(0.8) : d(0);
        const availabilityScore = totalAvailable.gt(0) ? d(1) : d(0);

        const score = roundRate(
          affinityScore.mul(weights.affinity)
            .add(marginScore.mul(weights.margin))
            .add(promoBoost.mul(weights.promotion))
            .add(availabilityScore.mul(weights.availability)),
        );

        const reasonCodes: string[] = [];
        if (affinityScore.gte(0.7)) reasonCodes.push("HIGH_AFFINITY");
        if (marginPct.gte(marginFloor)) reasonCodes.push("HEALTHY_MARGIN");
        if (promoBoost.gt(0)) reasonCodes.push("ACTIVE_PROMOTION");
        if (totalAvailable.gt(0)) reasonCodes.push("IN_STOCK");

        return {
          productId: product.id,
          productName: product.name,
          productType: product.type,
          score: score.toNumber(),
          unitPrice: toMoneyString(unitPrice),
          expectedMarginDelta: toMoneyString(
            unitPrice.sub(d(product.standardCost)),
          ),
          reasonCodes,
          explanation: `Co-purchase affinity ${a.affinityScore}, margin ${marginPct.toFixed(1)}%, ${totalAvailable.gt(0) ? "in stock" : "out of stock"}`,
        };
      })
      .filter((c) => c.reasonCodes.includes("HEALTHY_MARGIN"))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    for (const c of candidates) {
      await prisma.recommendationInteraction.create({
        data: {
          organizationId: auth.organizationId,
          quoteId,
          productId: c.productId,
          interaction: "IMPRESSION",
        },
      }).catch(() => undefined);
    }

    return { items: candidates };
  }

  async dismiss(auth: AuthContext, quoteId: string, productId: string) {
    await prisma.recommendationInteraction.create({
      data: {
        organizationId: auth.organizationId,
        quoteId,
        productId,
        interaction: "DISMISS",
      },
    });
    return { success: true };
  }
}

export const recommendationService = new RecommendationService();
