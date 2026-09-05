import { prisma } from "@repo/db";
import {
  Capabilities,
  Errors,
  OutboxEventTypes,
  QuoteStages,
  type CreateQuoteInput,
  type CreateQuoteLineInput,
} from "@repo/contracts";
import { d, toMoneyString, toRateString } from "../../shared/decimal.js";
import { termsFingerprint } from "../../shared/crypto.js";
import {
  writeAuditEvent,
  writeDealEvent,
  writeOutboxEvent,
} from "../../shared/outbox.js";
import {
  calculateQuoteTotals,
  resolveUnitPrice,
  serializeTotals,
  type QuoteLineCalcInput,
} from "./domain/pricing.js";
import {
  evaluateDiscountRisk,
  resolveAllowedDiscount,
  type DiscountCeiling,
} from "./domain/risk.js";
import { quoteRepository } from "./repository.js";
import type { AuthContext } from "../../shared/context.js";

export class QuoteService {
  async list(auth: AuthContext) {
    const ownerFilter =
      auth.capabilities.includes(Capabilities.QUOTATION_EDIT_ANY)
        ? undefined
        : auth.userId;
    const quotes = await quoteRepository.list(auth.organizationId, ownerFilter);
    return quotes.map((q) => this.toQuoteDto(q));
  }

  async get(auth: AuthContext, quoteId: string) {
    const quote = await quoteRepository.findById(auth.organizationId, quoteId);
    if (!quote) throw Errors.notFound("Quote");
    this.assertViewAccess(auth, quote);
    return this.toQuoteDto(quote);
  }

  async create(auth: AuthContext, input: CreateQuoteInput) {
    if (!auth.capabilities.includes(Capabilities.QUOTATION_CREATE)) {
      throw Errors.forbidden();
    }

    const customer = await prisma.customerAccount.findFirst({
      where: { id: input.customerAccountId, organizationId: auth.organizationId },
    });
    if (!customer) throw Errors.notFound("Customer");

    const quoteNumber = await quoteRepository.getNextQuoteNumber(auth.organizationId);

    const result = await prisma.$transaction(async (tx) => {
      const quote = await tx.quote.create({
        data: {
          organizationId: auth.organizationId,
          customerAccountId: input.customerAccountId,
          ownerId: auth.userId,
          quoteNumber,
          stage: QuoteStages.DRAFT,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        },
      });

      const version = await tx.quoteVersion.create({
        data: {
          organizationId: auth.organizationId,
          quoteId: quote.id,
          revisionNumber: 1,
          status: "DRAFT",
          currency: input.currency,
          paymentTermsDays: input.paymentTermsDays,
          termsFingerprint: termsFingerprint([quote.id, "1"]),
          notes: input.notes,
        },
      });

      await tx.quote.update({
        where: { id: quote.id },
        data: { currentVersionId: version.id },
      });

      await writeOutboxEvent(tx, {
        organizationId: auth.organizationId,
        eventType: OutboxEventTypes.QUOTE_CREATED,
        payload: { quoteId: quote.id, versionId: version.id },
      });

      await writeDealEvent(tx, {
        organizationId: auth.organizationId,
        quoteId: quote.id,
        eventType: "quote.created",
        title: "Quotation created",
        actorId: auth.userId,
        visibility: "INTERNAL",
      });

      return quote.id;
    });

    return this.get(auth, result);
  }

  async addLine(auth: AuthContext, quoteId: string, input: CreateQuoteLineInput) {
    const quote = await quoteRepository.findById(auth.organizationId, quoteId);
    if (!quote) throw Errors.notFound("Quote");
    this.assertEditAccess(auth, quote);
    quoteRepository.assertEditable(quote);

    const product = await prisma.product.findFirst({
      where: { id: input.productId, organizationId: auth.organizationId, active: true },
      include: { tax: true, category: true, variants: true },
    });
    if (!product) throw Errors.notFound("Product");

    const variant = input.variantId
      ? product.variants.find((v) => v.id === input.variantId)
      : null;
    if (input.variantId && !variant) throw Errors.notFound("Product variant");

    const customer = quote.customerAccount;
    const priceRules = await quoteRepository.getPriceRules(
      auth.organizationId,
      customer.tierId,
    );

    const resolved = resolveUnitPrice(
      priceRules.map((r) => ({
        unitPrice: d(r.unitPrice),
        priority: r.priority,
        minQuantity: d(r.minQuantity),
        tierId: r.tierId,
        productId: r.productId,
        categoryId: r.categoryId,
      })),
      {
        productId: product.id,
        categoryId: product.categoryId,
        tierId: customer.tierId,
        quantity: d(input.quantity),
        unitPriceOverride: input.unitPriceOverride ? d(input.unitPriceOverride) : undefined,
        variantSurcharge: variant ? d(variant.priceSurcharge) : undefined,
      },
      d(product.standardCost),
    );

    const lineNumber =
      (quote.currentVersion?.lines.length ?? 0) + 1;

    await prisma.$transaction(async (tx) => {
      await tx.quoteLine.create({
        data: {
          organizationId: auth.organizationId,
          quoteVersionId: quote.currentVersion!.id,
          productId: product.id,
          variantId: variant?.id,
          lineNumber,
          productName: product.name,
          productType: product.type,
          sku: variant?.sku,
          quantity: input.quantity,
          unitPrice: resolved.unitPrice,
          unitCost: resolved.unitCost,
          discountPercent: input.discountPercent,
          taxRate: product.tax?.rate ?? 0,
          billingType: input.billingType,
          subscriptionPlanId: input.subscriptionPlanId,
        },
      });

      await tx.quote.update({
        where: { id: quoteId },
        data: { revision: { increment: 1 } },
      });
    });

    await this.calculate(auth, quoteId, quote.revision + 1);
    return this.get(auth, quoteId);
  }

  async calculate(auth: AuthContext, quoteId: string, expectedRevision?: number) {
    const quote = await quoteRepository.findById(auth.organizationId, quoteId);
    if (!quote?.currentVersion) throw Errors.notFound("Quote");
    if (expectedRevision !== undefined) {
      quoteRepository.assertRevision(quote.revision, expectedRevision);
    }

    const version = quote.currentVersion;
    const customer = quote.customerAccount;

    const calcInputs: QuoteLineCalcInput[] = version.lines.map((line) => ({
      lineId: line.id,
      productId: line.productId,
      categoryId: "", // filled below
      quantity: d(line.quantity),
      unitPrice: d(line.unitPrice),
      unitCost: d(line.unitCost),
      discountPercent: d(line.discountPercent),
      taxRate: d(line.taxRate),
      taxBehavior: "EXCLUSIVE" as const,
    }));

    const products = await prisma.product.findMany({
      where: {
        id: { in: version.lines.map((l) => l.productId) },
        organizationId: auth.organizationId,
      },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const input of calcInputs) {
      input.categoryId = productMap.get(input.productId)?.categoryId ?? "";
    }

    const totals = calculateQuoteTotals(calcInputs);
    const lineCalcMap = new Map(totals.lines.map((l) => [l.lineId, l]));

    const discountLimits = await quoteRepository.getDiscountLimits(
      auth.organizationId,
      customer.tierId,
      version.lines.map((l) => l.productId),
      products.map((p) => p.categoryId),
    );

    const riskLines = version.lines.map((line) => {
      const product = productMap.get(line.productId)!;
      const calc = lineCalcMap.get(line.id)!;
      const ceilings: DiscountCeiling[] = discountLimits
        .filter(
          (lim) =>
            (!lim.tierId || lim.tierId === customer.tierId) &&
            (!lim.productId || lim.productId === line.productId) &&
            (!lim.categoryId || lim.categoryId === product.categoryId),
        )
        .map((lim) => ({
          limitId: lim.id,
          name: lim.name,
          maxDiscountPct: d(lim.maxDiscountPct),
          priority: lim.priority,
        }));

      return {
        lineId: line.id,
        productName: line.productName,
        appliedDiscountPct: d(line.discountPercent),
        preDiscountValue: calc.preDiscountValue,
        ceilings,
      };
    });

    const policy = await quoteRepository.getActiveApprovalPolicy(auth.organizationId);
    const predicates = (policy?.predicates ?? {}) as Record<string, Record<string, number>>;

    const risk = evaluateDiscountRisk({
      lines: riskLines,
      marginPercent: totals.marginPercent,
      creditLimit: d(customer.creditLimit),
      currentExposure: d(customer.currentExposure),
      overdueBalance: d(customer.overdueBalance),
      policyThresholds: {
        managerBlendedExcessGte: predicates.managerApproval?.blendedExcessGte,
        financeMaxLineExcessGte: predicates.financeApproval?.maxLineExcessGte,
        financeBlendedExcessGte: predicates.financeApproval?.blendedExcessGte,
        financeMarginPercentLt: predicates.financeApproval?.marginPercentLt,
        financeCreditExposureRatioGt: predicates.financeApproval?.creditExposureGt,
      },
    });

    const riskFacts = {
      blendedExcess: toRateString(risk.blendedExcess),
      maxLineExcess: toRateString(risk.maxLineExcess),
      marginPercent: toRateString(totals.marginPercent),
      creditExposure: toMoneyString(d(customer.currentExposure)),
      overdueBalance: toMoneyString(d(customer.overdueBalance)),
      lineContributions: risk.lineContributions.map((lc) => ({
        lineId: lc.lineId,
        productName: lc.productName,
        allowedDiscount: toRateString(lc.allowedDiscount),
        appliedDiscount: toRateString(lc.appliedDiscount),
        excess: toRateString(lc.excess),
        weight: toRateString(lc.weight),
        weightedExcess: toRateString(lc.weightedExcess),
        violatingCeilings: lc.violatingCeilings,
      })),
      routeReasons: risk.routeReasons,
      requiredApprovers: risk.requiredApprovers,
      safeDiscountSuggestion: risk.safeDiscountSuggestion
        ? {
          lineId: risk.safeDiscountSuggestion.lineId,
          suggestedDiscount: toRateString(risk.safeDiscountSuggestion.suggestedDiscount),
          reason: risk.safeDiscountSuggestion.reason,
        }
        : null,
    };

    await prisma.$transaction(async (tx) => {
      for (const line of version.lines) {
        const calc = lineCalcMap.get(line.id)!;
        const lc = risk.lineContributions.find((r) => r.lineId === line.id)!;
        await tx.quoteLine.update({
          where: { id: line.id },
          data: {
            discountAmount: calc.discountAmount,
            taxAmount: calc.taxAmount,
            lineTotal: calc.lineTotal,
            riskContribution: {
              allowedDiscount: toRateString(lc.allowedDiscount),
              excess: toRateString(lc.excess),
              weightedExcess: toRateString(lc.weightedExcess),
            },
          },
        });
      }

      await tx.quoteVersion.update({
        where: { id: version.id },
        data: {
          subtotal: totals.subtotal,
          taxTotal: totals.taxTotal,
          discountTotal: totals.discountTotal,
          total: totals.total,
          costTotal: totals.costTotal,
          grossMargin: totals.grossMargin,
          marginPercent: totals.marginPercent,
          riskFacts,
          policyVersion: policy ? `${policy.id}:v${policy.version}` : null,
        },
      });
    });

    return {
      quoteId,
      revision: quote.revision,
      totals: serializeTotals(totals),
      riskFacts,
      requiresApproval: risk.requiresManager || risk.requiresFinance,
    };
  }

  async submit(auth: AuthContext, quoteId: string, expectedRevision: number) {
    const quote = await quoteRepository.findById(auth.organizationId, quoteId);
    if (!quote?.currentVersion) throw Errors.notFound("Quote");
    this.assertEditAccess(auth, quote);
    quoteRepository.assertEditable(quote);
    quoteRepository.assertRevision(quote.revision, expectedRevision);

    if (quote.currentVersion.lines.length === 0) {
      throw Errors.badRequest("Cannot submit a quote with no lines");
    }

    const calc = await this.calculate(auth, quoteId, expectedRevision);
    const version = (await quoteRepository.findById(auth.organizationId, quoteId))!;

    const riskFacts = version.currentVersion!.riskFacts as {
      requiredApprovers?: string[];
    };
    const requiresApproval = (riskFacts.requiredApprovers?.length ?? 0) > 0;

    await prisma.$transaction(async (tx) => {
      if (requiresApproval) {
        await tx.quote.update({
          where: { id: quoteId },
          data: { stage: QuoteStages.PENDING_APPROVAL },
        });
        await tx.quoteVersion.update({
          where: { id: version.currentVersion!.id },
          data: { status: "PENDING_APPROVAL" },
        });

        const policy = await quoteRepository.getActiveApprovalPolicy(auth.organizationId);
        const approvalRequest = await tx.approvalRequest.create({
          data: {
            organizationId: auth.organizationId,
            quoteVersionId: version.currentVersion!.id,
            termsFingerprint: version.currentVersion!.termsFingerprint,
            status: "PENDING",
            ruleFacts: version.currentVersion!.riskFacts as object,
            routeReason: (riskFacts as { routeReasons?: string[] }).routeReasons?.join("; ") ?? null,
            explainerData: version.currentVersion!.riskFacts as object,
          },
        });

        if (policy) {
          const steps = policy.stepTemplates.filter((t) => {
            if (t.requiredCapability === "approval.managerAct") {
              return calc.riskFacts.requiredApprovers?.includes("manager");
            }
            if (t.requiredCapability === "approval.financeAct") {
              return calc.riskFacts.requiredApprovers?.includes("finance");
            }
            return true;
          });

          for (let i = 0; i < steps.length; i++) {
            const step = steps[i]!;
            await tx.approvalStep.create({
              data: {
                organizationId: auth.organizationId,
                approvalRequestId: approvalRequest.id,
                sequence: step.sequence,
                requiredCapability: step.requiredCapability,
                status: i === 0 ? "ACTIVE" : "PENDING",
                dueAt: step.slaHours
                  ? new Date(Date.now() + step.slaHours * 60 * 60 * 1000)
                  : undefined,
                activatedAt: i === 0 ? new Date() : undefined,
              },
            });
          }
        }

        await writeOutboxEvent(tx, {
          organizationId: auth.organizationId,
          eventType: OutboxEventTypes.APPROVAL_REQUESTED,
          payload: { quoteId, approvalRequestId: approvalRequest.id },
        });
      } else {
        await tx.quote.update({
          where: { id: quoteId },
          data: { stage: QuoteStages.READY_TO_SEND },
        });
        await tx.quoteVersion.update({
          where: { id: version.currentVersion!.id },
          data: { status: "APPROVED" },
        });
      }

      await writeOutboxEvent(tx, {
        organizationId: auth.organizationId,
        eventType: OutboxEventTypes.QUOTE_SUBMITTED,
        payload: { quoteId },
      });

      await writeDealEvent(tx, {
        organizationId: auth.organizationId,
        quoteId,
        eventType: "quote.submitted",
        title: requiresApproval ? "Submitted for approval" : "Ready to send",
        actorId: auth.userId,
        visibility: "INTERNAL",
      });
    });

    return this.get(auth, quoteId);
  }

  private assertViewAccess(
    auth: AuthContext,
    quote: { ownerId: string },
  ) {
    if (auth.capabilities.includes(Capabilities.QUOTATION_EDIT_ANY)) return;
    if (quote.ownerId !== auth.userId) throw Errors.forbidden();
  }

  private assertEditAccess(
    auth: AuthContext,
    quote: { ownerId: string },
  ) {
    this.assertViewAccess(auth, quote);
    if (
      !auth.capabilities.includes(Capabilities.QUOTATION_EDIT_OWN) &&
      !auth.capabilities.includes(Capabilities.QUOTATION_EDIT_ANY)
    ) {
      throw Errors.forbidden();
    }
  }

  private toQuoteDto(quote: {
    id: string;
    quoteNumber: string;
    stage: string;
    customerAccountId: string;
    customerAccount: { name: string };
    ownerId: string;
    owner: { firstName: string; lastName: string };
    revision: number;
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    currentVersion: {
      id: string;
      revisionNumber: number;
      status: string;
      currency: string;
      subtotal: unknown;
      taxTotal: unknown;
      discountTotal: unknown;
      total: unknown;
      grossMargin: unknown;
      marginPercent: unknown;
      termsFingerprint: string;
      paymentTermsDays: number;
      riskFacts: unknown;
      lines: Array<{
        id: string;
        lineNumber: number;
        productId: string;
        productName: string;
        productType: string;
        sku: string | null;
        quantity: unknown;
        unitPrice: unknown;
        discountPercent: unknown;
        discountAmount: unknown;
        taxRate: unknown;
        taxAmount: unknown;
        lineTotal: unknown;
        billingType: string;
        subscriptionPlanId: string | null;
        riskContribution: unknown;
      }>;
    } | null;
  }) {
    return {
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      stage: quote.stage,
      customerAccountId: quote.customerAccountId,
      customerName: quote.customerAccount.name,
      ownerId: quote.ownerId,
      ownerName: `${quote.owner.firstName} ${quote.owner.lastName}`,
      revision: quote.revision,
      expiresAt: quote.expiresAt?.toISOString() ?? null,
      currentVersion: quote.currentVersion
        ? {
          id: quote.currentVersion.id,
          revisionNumber: quote.currentVersion.revisionNumber,
          status: quote.currentVersion.status,
          currency: quote.currentVersion.currency,
          subtotal: String(quote.currentVersion.subtotal),
          taxTotal: String(quote.currentVersion.taxTotal),
          discountTotal: String(quote.currentVersion.discountTotal),
          total: String(quote.currentVersion.total),
          grossMargin: String(quote.currentVersion.grossMargin),
          marginPercent: String(quote.currentVersion.marginPercent),
          termsFingerprint: quote.currentVersion.termsFingerprint,
          paymentTermsDays: quote.currentVersion.paymentTermsDays,
          riskFacts: quote.currentVersion.riskFacts,
          lines: quote.currentVersion.lines.map((l) => ({
            id: l.id,
            lineNumber: l.lineNumber,
            productId: l.productId,
            productName: l.productName,
            productType: l.productType,
            sku: l.sku,
            quantity: String(l.quantity),
            unitPrice: String(l.unitPrice),
            discountPercent: String(l.discountPercent),
            discountAmount: String(l.discountAmount),
            taxRate: String(l.taxRate),
            taxAmount: String(l.taxAmount),
            lineTotal: String(l.lineTotal),
            billingType: l.billingType,
            subscriptionPlanId: l.subscriptionPlanId,
            riskContribution: l.riskContribution,
          })),
        }
        : null,
      createdAt: quote.createdAt.toISOString(),
      updatedAt: quote.updatedAt.toISOString(),
    };
  }
}

export const quoteService = new QuoteService();
