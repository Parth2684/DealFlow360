import { prisma } from "@repo/db";
import { Errors } from "@repo/contracts";
import { writeAuditEvent } from "../../shared/outbox.js";
import type { AuthContext } from "../../shared/context.js";

export class PricingService {
  // Price Lists
  async listPriceLists(auth: AuthContext) {
    const priceLists = await prisma.priceList.findMany({
      where: { organizationId: auth.organizationId },
      orderBy: [{ priority: "desc" }, { name: "asc" }],
    });
    return priceLists.map((pl: any) => ({
      id: pl.id,
      name: pl.name,
      currency: pl.currency,
      effectiveFrom: pl.effectiveFrom.toISOString(),
      effectiveTo: pl.effectiveTo?.toISOString() ?? null,
      active: pl.active,
      priority: pl.priority,
    }));
  }

  async createPriceList(
    auth: AuthContext,
    input: {
      name: string;
      currency?: string;
      effectiveFrom: string;
      effectiveTo?: string;
      priority?: number;
    },
  ) {
    const priceList = await prisma.priceList.create({
      data: {
        organizationId: auth.organizationId,
        name: input.name,
        currency: input.currency ?? "USD",
        effectiveFrom: new Date(input.effectiveFrom),
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
        priority: input.priority ?? 0,
      },
    });

    await writeAuditEvent(prisma, {
      organizationId: auth.organizationId,
      actorId: auth.userId,
      entityType: "price_list",
      entityId: priceList.id,
      eventType: "price_list.created",
      afterSummary: { name: priceList.name, currency: priceList.currency },
    });

    return this.toPriceListDto(priceList);
  }

  async updatePriceList(
    auth: AuthContext,
    priceListId: string,
    input: {
      name?: string;
      active?: boolean;
      effectiveTo?: string;
    },
  ) {
    const priceList = await prisma.priceList.findFirst({
      where: { id: priceListId, organizationId: auth.organizationId },
    });
    if (!priceList) throw Errors.notFound("Price list");

    const updated = await prisma.priceList.update({
      where: { id: priceListId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.active !== undefined && { active: input.active }),
        ...(input.effectiveTo !== undefined && { effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null }),
      },
    });

    await writeAuditEvent(prisma, {
      organizationId: auth.organizationId,
      actorId: auth.userId,
      entityType: "price_list",
      entityId: priceListId,
      eventType: "price_list.updated",
      beforeSummary: { name: priceList.name },
      afterSummary: { name: updated.name },
    });

    return this.toPriceListDto(updated);
  }

  // Price Rules
  async listPriceRules(auth: AuthContext, priceListId: string) {
    const priceList = await prisma.priceList.findFirst({
      where: { id: priceListId, organizationId: auth.organizationId },
    });
    if (!priceList) throw Errors.notFound("Price list");

    const rules = await prisma.priceRule.findMany({
      where: { priceListId },
      include: { product: true, category: true, tier: true },
      orderBy: [{ priority: "desc" }, { minQuantity: "asc" }],
    });

    return rules.map((r: any) => ({
      id: r.id,
      productId: r.productId,
      productName: r.product?.name ?? null,
      categoryId: r.categoryId,
      categoryName: r.category?.name ?? null,
      tierId: r.tierId,
      tierCode: r.tier?.code ?? null,
      minQuantity: String(r.minQuantity),
      unitPrice: String(r.unitPrice),
      priority: r.priority,
      effectiveFrom: r.effectiveFrom.toISOString(),
      effectiveTo: r.effectiveTo?.toISOString() ?? null,
    }));
  }

  async createPriceRule(
    auth: AuthContext,
    priceListId: string,
    input: {
      productId?: string;
      categoryId?: string;
      tierId?: string;
      minQuantity?: string;
      unitPrice: string;
      priority?: number;
      effectiveFrom: string;
      effectiveTo?: string;
    },
  ) {
    const priceList = await prisma.priceList.findFirst({
      where: { id: priceListId, organizationId: auth.organizationId },
    });
    if (!priceList) throw Errors.notFound("Price list");

    if (input.productId) {
      const product = await prisma.product.findFirst({
        where: { id: input.productId, organizationId: auth.organizationId },
      });
      if (!product) throw Errors.notFound("Product");
    }

    if (input.categoryId) {
      const category = await prisma.productCategory.findFirst({
        where: { id: input.categoryId, organizationId: auth.organizationId },
      });
      if (!category) throw Errors.notFound("Product category");
    }

    if (input.tierId) {
      const tier = await prisma.customerTier.findFirst({
        where: { id: input.tierId, organizationId: auth.organizationId },
      });
      if (!tier) throw Errors.notFound("Customer tier");
    }

    const rule = await prisma.priceRule.create({
      data: {
        organizationId: auth.organizationId,
        priceListId,
        productId: input.productId,
        categoryId: input.categoryId,
        tierId: input.tierId,
        minQuantity: input.minQuantity ?? "1",
        unitPrice: input.unitPrice,
        priority: input.priority ?? 0,
        effectiveFrom: new Date(input.effectiveFrom),
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
      },
    });

    await writeAuditEvent(prisma, {
      organizationId: auth.organizationId,
      actorId: auth.userId,
      entityType: "price_rule",
      entityId: rule.id,
      eventType: "price_rule.created",
      afterSummary: { unitPrice: String(rule.unitPrice) },
    });

    return this.toPriceRuleDto(rule);
  }

  async updatePriceRule(
    auth: AuthContext,
    ruleId: string,
    input: {
      unitPrice?: string;
      priority?: number;
      effectiveTo?: string;
    },
  ) {
    const rule = await prisma.priceRule.findFirst({
      where: { id: ruleId, organizationId: auth.organizationId },
    });
    if (!rule) throw Errors.notFound("Price rule");

    const updated = await prisma.priceRule.update({
      where: { id: ruleId },
      data: {
        ...(input.unitPrice && { unitPrice: input.unitPrice }),
        ...(input.priority !== undefined && { priority: input.priority }),
        ...(input.effectiveTo !== undefined && { effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null }),
      },
    });

    await writeAuditEvent(prisma, {
      organizationId: auth.organizationId,
      actorId: auth.userId,
      entityType: "price_rule",
      entityId: ruleId,
      eventType: "price_rule.updated",
      beforeSummary: { unitPrice: String(rule.unitPrice) },
      afterSummary: { unitPrice: String(updated.unitPrice) },
    });

    return this.toPriceRuleDto(updated);
  }

  async deletePriceRule(auth: AuthContext, ruleId: string) {
    const rule = await prisma.priceRule.findFirst({
      where: { id: ruleId, organizationId: auth.organizationId },
    });
    if (!rule) throw Errors.notFound("Price rule");

    await prisma.priceRule.delete({
      where: { id: ruleId },
    });

    await writeAuditEvent(prisma, {
      organizationId: auth.organizationId,
      actorId: auth.userId,
      entityType: "price_rule",
      entityId: ruleId,
      eventType: "price_rule.deleted",
      beforeSummary: { unitPrice: String(rule.unitPrice) },
    });
  }

  // Discount Limits
  async listDiscountLimits(auth: AuthContext) {
    const limits = await prisma.discountLimit.findMany({
      where: { organizationId: auth.organizationId },
      include: { tier: true, category: true, product: true },
      orderBy: [{ priority: "desc" }, { name: "asc" }],
    });

    return limits.map((l: any) => ({
      id: l.id,
      name: l.name,
      tierId: l.tierId,
      tierName: l.tier?.name ?? null,
      categoryId: l.categoryId,
      categoryName: l.category?.name ?? null,
      productId: l.productId,
      productName: l.product?.name ?? null,
      maxDiscountPct: String(l.maxDiscountPct),
      priority: l.priority,
      active: l.active,
      effectiveFrom: l.effectiveFrom.toISOString(),
      effectiveTo: l.effectiveTo?.toISOString() ?? null,
    }));
  }

  async createDiscountLimit(
    auth: AuthContext,
    input: {
      name: string;
      tierId?: string;
      categoryId?: string;
      productId?: string;
      maxDiscountPct: string;
      priority?: number;
      effectiveFrom: string;
      effectiveTo?: string;
    },
  ) {
    if (input.productId) {
      const product = await prisma.product.findFirst({
        where: { id: input.productId, organizationId: auth.organizationId },
      });
      if (!product) throw Errors.notFound("Product");
    }

    if (input.categoryId) {
      const category = await prisma.productCategory.findFirst({
        where: { id: input.categoryId, organizationId: auth.organizationId },
      });
      if (!category) throw Errors.notFound("Product category");
    }

    if (input.tierId) {
      const tier = await prisma.customerTier.findFirst({
        where: { id: input.tierId, organizationId: auth.organizationId },
      });
      if (!tier) throw Errors.notFound("Customer tier");
    }

    const limit = await prisma.discountLimit.create({
      data: {
        organizationId: auth.organizationId,
        name: input.name,
        tierId: input.tierId,
        categoryId: input.categoryId,
        productId: input.productId,
        maxDiscountPct: input.maxDiscountPct,
        priority: input.priority ?? 0,
        effectiveFrom: new Date(input.effectiveFrom),
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
      },
    });

    await writeAuditEvent(prisma, {
      organizationId: auth.organizationId,
      actorId: auth.userId,
      entityType: "discount_limit",
      entityId: limit.id,
      eventType: "discount_limit.created",
      afterSummary: { name: limit.name, maxDiscountPct: String(limit.maxDiscountPct) },
    });

    return this.toDiscountLimitDto(limit);
  }

  async updateDiscountLimit(
    auth: AuthContext,
    limitId: string,
    input: {
      maxDiscountPct?: string;
      active?: boolean;
      effectiveTo?: string;
    },
  ) {
    const limit = await prisma.discountLimit.findFirst({
      where: { id: limitId, organizationId: auth.organizationId },
    });
    if (!limit) throw Errors.notFound("Discount limit");

    const updated = await prisma.discountLimit.update({
      where: { id: limitId },
      data: {
        ...(input.maxDiscountPct && { maxDiscountPct: input.maxDiscountPct }),
        ...(input.active !== undefined && { active: input.active }),
        ...(input.effectiveTo !== undefined && { effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null }),
      },
    });

    await writeAuditEvent(prisma, {
      organizationId: auth.organizationId,
      actorId: auth.userId,
      entityType: "discount_limit",
      entityId: limitId,
      eventType: "discount_limit.updated",
      beforeSummary: { name: limit.name },
      afterSummary: { name: updated.name },
    });

    return this.toDiscountLimitDto(updated);
  }

  // Taxes
  async listTaxes(auth: AuthContext) {
    const taxes = await prisma.tax.findMany({
      where: { organizationId: auth.organizationId },
      orderBy: [{ effectiveFrom: "desc" }, { name: "asc" }],
    });

    return taxes.map((t: any) => ({
      id: t.id,
      name: t.name,
      rate: String(t.rate),
      behavior: t.behavior,
      effectiveFrom: t.effectiveFrom.toISOString(),
      effectiveTo: t.effectiveTo?.toISOString() ?? null,
      active: t.active,
    }));
  }

  async createTax(
    auth: AuthContext,
    input: {
      name: string;
      rate: string;
      behavior: "INCLUSIVE" | "EXCLUSIVE";
      effectiveFrom: string;
      effectiveTo?: string;
    },
  ) {
    const tax = await prisma.tax.create({
      data: {
        organizationId: auth.organizationId,
        name: input.name,
        rate: input.rate,
        behavior: input.behavior,
        effectiveFrom: new Date(input.effectiveFrom),
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
      },
    });

    await writeAuditEvent(prisma, {
      organizationId: auth.organizationId,
      actorId: auth.userId,
      entityType: "tax",
      entityId: tax.id,
      eventType: "tax.created",
      afterSummary: { name: tax.name, rate: String(tax.rate) },
    });

    return this.toTaxDto(tax);
  }

  async updateTax(
    auth: AuthContext,
    taxId: string,
    input: {
      rate?: string;
      active?: boolean;
      effectiveTo?: string;
    },
  ) {
    const tax = await prisma.tax.findFirst({
      where: { id: taxId, organizationId: auth.organizationId },
    });
    if (!tax) throw Errors.notFound("Tax");

    const updated = await prisma.tax.update({
      where: { id: taxId },
      data: {
        ...(input.rate && { rate: input.rate }),
        ...(input.active !== undefined && { active: input.active }),
        ...(input.effectiveTo !== undefined && { effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null }),
      },
    });

    await writeAuditEvent(prisma, {
      organizationId: auth.organizationId,
      actorId: auth.userId,
      entityType: "tax",
      entityId: taxId,
      eventType: "tax.updated",
      beforeSummary: { name: tax.name },
      afterSummary: { name: updated.name },
    });

    return this.toTaxDto(updated);
  }

  // Subscription Plans
  async listSubscriptionPlans(auth: AuthContext) {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { organizationId: auth.organizationId, active: true },
      orderBy: { name: "asc" },
    });

    return plans.map((p: any) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      interval: p.interval,
      intervalCount: p.intervalCount,
      prorationConvention: p.prorationConvention,
      active: p.active,
    }));
  }

  async createSubscriptionPlan(
    auth: AuthContext,
    input: {
      name: string;
      code: string;
      interval: "DAY" | "WEEK" | "MONTH" | "YEAR";
      intervalCount?: number;
      prorationConvention?: "CALENDAR_DAYS" | "THIRTY_DAY_MONTH";
      cancellationRules?: Record<string, unknown>;
    },
  ) {
    const existing = await prisma.subscriptionPlan.findFirst({
      where: { organizationId: auth.organizationId, code: input.code },
    });
    if (existing) throw Errors.conflict("Subscription plan code already exists");

    const plan = await prisma.subscriptionPlan.create({
      data: {
        organizationId: auth.organizationId,
        name: input.name,
        code: input.code,
        interval: input.interval,
        intervalCount: input.intervalCount ?? 1,
        prorationConvention: input.prorationConvention ?? "CALENDAR_DAYS",
        cancellationRules: input.cancellationRules ?? {},
      },
    });

    await writeAuditEvent(prisma, {
      organizationId: auth.organizationId,
      actorId: auth.userId,
      entityType: "subscription_plan",
      entityId: plan.id,
      eventType: "subscription_plan.created",
      afterSummary: { name: plan.name, code: plan.code },
    });

    return this.toSubscriptionPlanDto(plan);
  }

  async updateSubscriptionPlan(
    auth: AuthContext,
    planId: string,
    input: {
      name?: string;
      active?: boolean;
      cancellationRules?: Record<string, unknown>;
    },
  ) {
    const plan = await prisma.subscriptionPlan.findFirst({
      where: { id: planId, organizationId: auth.organizationId },
    });
    if (!plan) throw Errors.notFound("Subscription plan");

    const updated = await prisma.subscriptionPlan.update({
      where: { id: planId },
      data: input,
    });

    await writeAuditEvent(prisma, {
      organizationId: auth.organizationId,
      actorId: auth.userId,
      entityType: "subscription_plan",
      entityId: planId,
      eventType: "subscription_plan.updated",
      beforeSummary: { name: plan.name },
      afterSummary: { name: updated.name },
    });

    return this.toSubscriptionPlanDto(updated);
  }

  private toPriceListDto(pl: any) {
    return {
      id: pl.id,
      name: pl.name,
      currency: pl.currency,
      effectiveFrom: pl.effectiveFrom.toISOString(),
      effectiveTo: pl.effectiveTo?.toISOString() ?? null,
      active: pl.active,
      priority: pl.priority,
    };
  }

  private toPriceRuleDto(rule: any) {
    return {
      id: rule.id,
      priceListId: rule.priceListId,
      productId: rule.productId,
      categoryId: rule.categoryId,
      tierId: rule.tierId,
      minQuantity: String(rule.minQuantity),
      unitPrice: String(rule.unitPrice),
      priority: rule.priority,
      effectiveFrom: rule.effectiveFrom.toISOString(),
      effectiveTo: rule.effectiveTo?.toISOString() ?? null,
    };
  }

  private toDiscountLimitDto(limit: any) {
    return {
      id: limit.id,
      name: limit.name,
      tierId: limit.tierId,
      categoryId: limit.categoryId,
      productId: limit.productId,
      maxDiscountPct: String(limit.maxDiscountPct),
      priority: limit.priority,
      active: limit.active,
      effectiveFrom: limit.effectiveFrom.toISOString(),
      effectiveTo: limit.effectiveTo?.toISOString() ?? null,
    };
  }

  private toTaxDto(tax: any) {
    return {
      id: tax.id,
      name: tax.name,
      rate: String(tax.rate),
      behavior: tax.behavior,
      effectiveFrom: tax.effectiveFrom.toISOString(),
      effectiveTo: tax.effectiveTo?.toISOString() ?? null,
      active: tax.active,
    };
  }

  private toSubscriptionPlanDto(plan: any) {
    return {
      id: plan.id,
      name: plan.name,
      code: plan.code,
      interval: plan.interval,
      intervalCount: plan.intervalCount,
      prorationConvention: plan.prorationConvention,
      active: plan.active,
    };
  }
}

export const pricingService = new PricingService();
