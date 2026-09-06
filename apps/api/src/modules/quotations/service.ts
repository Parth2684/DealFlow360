import type {
  AddQuoteLineRequest,
  CreateQuoteRequest,
  UpdateQuoteLineRequest,
  UpdateQuoteRequest,
  UpdateQuoteStageRequest,
} from "@repo/common";
import { Prisma, type QuoteStage } from "@repo/db";

import {
  recordActivity,
  jsonInput,
  type Actor,
  type TransactionClient,
} from "../../shared/activity.js";
import {
  conflict,
  forbidden,
  HttpError,
  notFound,
} from "../../shared/errors.js";
import { randomToken, stableFingerprint } from "../../shared/security.js";
import type { InternalPrincipal } from "../../shared/types.js";
import {
  recalculateQuote,
  loadQuote,
  type LoadedQuote,
} from "./calculation.js";
import type { QuoteRecord, VersionRecord } from "./mappers.js";

type StoredLine = VersionRecord["lines"][number];
type LineInput = Omit<
  Prisma.QuoteLineCreateManyInput,
  "organizationId" | "quoteVersionId" | "lineNumber"
>;

const MUTABLE_STAGES: readonly QuoteStage[] = [
  "DRAFT",
  "REVISION_REQUIRED",
  "READY_TO_SEND",
  "SENT",
  "UNDER_NEGOTIATION",
  "CUSTOMER_ACCEPTED",
];

function quoteNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `Q-${date}-${randomToken(6).replaceAll("_", "X").replaceAll("-", "Y").toUpperCase()}`;
}

export function mayReadQuote(
  principal: InternalPrincipal,
  quote: Pick<QuoteRecord, "ownerId" | "salesTeamId">,
): boolean {
  if (hasOrganizationWideQuoteAccess(principal)) return true;
  if (!principal.roles.includes("SALES_REP")) return false;
  return (
    quote.ownerId === principal.userId ||
    (quote.salesTeamId !== null &&
      principal.salesTeamIds.includes(quote.salesTeamId))
  );
}

export function hasOrganizationWideQuoteAccess(
  principal: InternalPrincipal,
): boolean {
  return principal.roles.some(
    (role) =>
      role === "ADMIN" ||
      role === "SALES_MANAGER" ||
      role === "FINANCE" ||
      role === "OPERATIONS",
  );
}

export function assertCanReadQuote(
  principal: InternalPrincipal,
  quote: Pick<QuoteRecord, "ownerId" | "salesTeamId">,
): void {
  if (!mayReadQuote(principal, quote)) forbidden();
}

export function assertCanEditQuote(
  principal: InternalPrincipal,
  quote: Pick<QuoteRecord, "ownerId" | "salesTeamId">,
): void {
  const mayEditAny = principal.capabilities.includes("quotation.editAny");
  const ownsOrSharesTeam =
    quote.ownerId === principal.userId ||
    (quote.salesTeamId !== null &&
      principal.salesTeamIds.includes(quote.salesTeamId));
  if (
    !mayEditAny &&
    !(principal.capabilities.includes("quotation.editOwn") && ownsOrSharesTeam)
  ) {
    forbidden("You may only edit quotations owned by you or your sales team");
  }
}

function assertEditableStage(stage: QuoteStage): void {
  if (!MUTABLE_STAGES.includes(stage)) {
    conflict(`A quote in ${stage} cannot be changed`, "QUOTE_NOT_EDITABLE");
  }
}

function assertRevision(
  actual: number,
  expected: number | undefined,
): asserts expected is number {
  if (expected === undefined) {
    throw new HttpError(
      428,
      "Revision required",
      "A quote revision precondition is required",
      {
        code: "REVISION_REQUIRED",
      },
    );
  }
  if (actual !== expected) {
    conflict(
      `The quote changed from revision ${expected} to ${actual}; reload before saving`,
      "REVISION_CONFLICT",
    );
  }
}

function cloneLine(line: StoredLine): LineInput {
  return {
    productId: line.productId,
    variantId: line.variantId,
    subscriptionPlanId: line.subscriptionPlanId,
    productCode: line.productCode,
    productName: line.productName,
    productDescription: line.productDescription,
    productType: line.productType,
    categoryCode: line.categoryCode,
    sku: line.sku,
    unit: line.unit,
    quantity: line.quantity,
    listUnitPrice: line.listUnitPrice,
    unitPrice: line.unitPrice,
    unitCost: line.unitCost,
    discountPercent: line.discountPercent,
    lineDiscountAmount: line.lineDiscountAmount,
    allocatedOrderDiscount: line.allocatedOrderDiscount,
    preTaxSubtotal: line.preTaxSubtotal,
    taxCode: line.taxCode,
    taxRate: line.taxRate,
    taxBehavior: line.taxBehavior,
    taxAmount: line.taxAmount,
    total: line.total,
    costTotal: line.costTotal,
    grossMargin: line.grossMargin,
    billingType: line.billingType,
    pricingSnapshot: jsonInput(line.pricingSnapshot),
    ...(line.subscriptionSnapshot === null
      ? {}
      : { subscriptionSnapshot: jsonInput(line.subscriptionSnapshot) }),
  };
}

function hasManualPriceOverride(line: StoredLine): boolean {
  return (
    line.pricingSnapshot !== null &&
    typeof line.pricingSnapshot === "object" &&
    !Array.isArray(line.pricingSnapshot) &&
    Reflect.get(line.pricingSnapshot, "override") === true
  );
}

async function resolveLine(
  transaction: TransactionClient,
  input: {
    organizationId: string;
    customerTierId: string;
    currency: string;
    productId: string;
    variantId?: string | null;
    subscriptionPlanId?: string | null;
    quantity: string | Prisma.Decimal;
    unitPrice?: string | Prisma.Decimal;
    discountPercent: string | Prisma.Decimal;
    billingType: "ONE_TIME" | "RECURRING";
  },
): Promise<LineInput> {
  const now = new Date();
  const quantity = new Prisma.Decimal(input.quantity);
  const product = await transaction.product.findFirst({
    where: {
      id: input.productId,
      organizationId: input.organizationId,
      status: "ACTIVE",
      category: { status: "ACTIVE" },
    },
    include: { category: true, tax: true, variants: true },
  });
  if (product === null) notFound("Active product");
  const variant =
    input.variantId === undefined || input.variantId === null
      ? null
      : product.variants.find(
          (candidate) =>
            candidate.id === input.variantId && candidate.status === "ACTIVE",
        );
  if (
    input.variantId !== undefined &&
    input.variantId !== null &&
    variant === undefined
  ) {
    throw new HttpError(
      422,
      "Invalid product variant",
      "The variant does not belong to the active product",
      {
        code: "INVALID_VARIANT",
      },
    );
  }
  if (product.type === "SUBSCRIPTION" && input.billingType !== "RECURRING") {
    throw new HttpError(
      422,
      "Invalid billing type",
      "Subscription products must use recurring billing",
      {
        code: "INVALID_BILLING_TYPE",
      },
    );
  }
  const subscriptionPlan =
    input.subscriptionPlanId === undefined || input.subscriptionPlanId === null
      ? null
      : await transaction.subscriptionPlan.findFirst({
          where: {
            id: input.subscriptionPlanId,
            organizationId: input.organizationId,
            status: "ACTIVE",
          },
        });
  if (input.billingType === "RECURRING" && subscriptionPlan === null) {
    throw new HttpError(
      422,
      "Subscription plan required",
      "An active subscription plan is required",
      {
        code: "SUBSCRIPTION_PLAN_REQUIRED",
      },
    );
  }
  if (input.billingType === "ONE_TIME" && input.subscriptionPlanId != null) {
    throw new HttpError(
      422,
      "Invalid subscription plan",
      "One-time lines cannot use a subscription plan",
      {
        code: "INVALID_SUBSCRIPTION_PLAN",
      },
    );
  }

  const rules = await transaction.priceRule.findMany({
    where: {
      organizationId: input.organizationId,
      status: "ACTIVE",
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      minQuantity: { lte: quantity },
      priceList: {
        currency: input.currency,
        status: "ACTIVE",
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      },
      AND: [
        {
          OR: [
            { productId: product.id },
            { productId: null, categoryId: product.categoryId },
            { productId: null, categoryId: null },
          ],
        },
        { OR: [{ tierId: input.customerTierId }, { tierId: null }] },
      ],
    },
    include: { priceList: true },
  });
  const selected = rules.sort((left, right) => {
    const specificity = (rule: (typeof rules)[number]) =>
      (rule.productId === product.id
        ? 4
        : rule.categoryId === product.categoryId
          ? 2
          : 0) + (rule.tierId === input.customerTierId ? 1 : 0);
    return (
      specificity(right) - specificity(left) ||
      right.priority - left.priority ||
      right.priceList.priority - left.priceList.priority ||
      right.minQuantity.comparedTo(left.minQuantity) ||
      left.id.localeCompare(right.id)
    );
  })[0];
  if (selected === undefined && input.unitPrice === undefined) {
    throw new HttpError(
      422,
      "Price unavailable",
      `No active ${input.currency} price rule matches ${product.name}`,
      { code: "PRICE_UNAVAILABLE" },
    );
  }
  const surcharge = variant?.priceSurcharge ?? new Prisma.Decimal(0);
  const listUnitPrice = (
    selected?.unitPrice ?? new Prisma.Decimal(input.unitPrice ?? 0)
  ).plus(surcharge);
  const unitPrice =
    input.unitPrice === undefined
      ? listUnitPrice
      : new Prisma.Decimal(input.unitPrice);
  const activeTax =
    product.tax !== null &&
    product.tax.status === "ACTIVE" &&
    product.tax.effectiveFrom <= now &&
    (product.tax.effectiveTo === null || product.tax.effectiveTo >= now)
      ? product.tax
      : null;

  return {
    productId: product.id,
    variantId: variant?.id ?? null,
    subscriptionPlanId: subscriptionPlan?.id ?? null,
    productCode: product.code,
    productName:
      variant?.name === null || variant?.name === undefined
        ? product.name
        : `${product.name} - ${variant.name}`,
    productDescription: product.description,
    productType: product.type,
    categoryCode: product.category.code,
    sku: variant?.sku ?? null,
    unit: product.unit,
    quantity,
    listUnitPrice,
    unitPrice,
    unitCost: product.standardCost,
    discountPercent: new Prisma.Decimal(input.discountPercent),
    lineDiscountAmount: new Prisma.Decimal(0),
    allocatedOrderDiscount: new Prisma.Decimal(0),
    preTaxSubtotal: new Prisma.Decimal(0),
    taxCode: activeTax?.code ?? null,
    taxRate: activeTax?.rate ?? new Prisma.Decimal(0),
    taxBehavior: activeTax?.behavior ?? "EXCLUSIVE",
    taxAmount: new Prisma.Decimal(0),
    total: new Prisma.Decimal(0),
    costTotal: new Prisma.Decimal(0),
    grossMargin: new Prisma.Decimal(0),
    billingType: input.billingType,
    pricingSnapshot: jsonInput({
      categoryId: product.categoryId,
      priceListId: selected?.priceListId ?? null,
      priceRuleId: selected?.id ?? null,
      variantSurcharge: surcharge.toString(),
      override: input.unitPrice !== undefined,
      explanation: [
        selected === undefined
          ? "Authorized manual unit price"
          : `Matched ${selected.priceList.name} price rule`,
        ...(variant === null || variant === undefined
          ? []
          : [`Applied ${variant.sku} variant surcharge`]),
      ],
    }),
    ...(subscriptionPlan === null
      ? {}
      : {
          subscriptionSnapshot: jsonInput({
            code: subscriptionPlan.code,
            name: subscriptionPlan.name,
            interval: subscriptionPlan.interval,
            intervalCount: subscriptionPlan.intervalCount,
            prorationConvention: subscriptionPlan.prorationConvention,
          }),
        }),
  };
}

async function supersedeOpenGovernance(
  transaction: TransactionClient,
  organizationId: string,
  quoteVersionId: string,
): Promise<void> {
  await transaction.approvalStep.updateMany({
    where: {
      organizationId,
      approvalRequest: { quoteVersionId },
      status: { in: ["WAITING", "ACTIVE"] },
    },
    data: { status: "SUPERSEDED", completedAt: new Date() },
  });
  await transaction.approvalRequest.updateMany({
    where: { organizationId, quoteVersionId, status: { not: "SUPERSEDED" } },
    data: { status: "SUPERSEDED", completedAt: new Date() },
  });
}

async function forkVersion(
  transaction: TransactionClient,
  quote: QuoteRecord & { currentVersion: VersionRecord },
  actor: Actor,
  createdById: string,
  expectedRevision: number,
  input: {
    customer: {
      id: string;
      name: string;
      accountCode: string;
      tierId: string;
      preferredCurrency: string;
      paymentTermsDays: number;
      creditLimit: Prisma.Decimal;
      currentExposure: Prisma.Decimal;
      overdueBalance: Prisma.Decimal;
      salesTeamId: string | null;
    };
    currency: string;
    paymentTermsDays: number;
    expiresAt: Date | null;
    notes: string | null;
    lines: LineInput[];
    reason: string;
  },
): Promise<LoadedQuote> {
  assertEditableStage(quote.stage);
  assertRevision(quote.revision, expectedRevision);
  const revisionNumber = quote.currentRevision + 1;
  await supersedeOpenGovernance(
    transaction,
    quote.organizationId,
    quote.currentVersion.id,
  );
  await transaction.quoteVersion.update({
    where: { id: quote.currentVersion.id },
    data: { status: "SUPERSEDED" },
  });
  const next = await transaction.quoteVersion.create({
    data: {
      organizationId: quote.organizationId,
      quoteId: quote.id,
      customerAccountId: input.customer.id,
      createdById,
      revisionNumber,
      status: "DRAFT",
      currency: input.currency,
      paymentTermsDays: input.paymentTermsDays,
      customerSnapshot: jsonInput({
        id: input.customer.id,
        accountCode: input.customer.accountCode,
        name: input.customer.name,
        tierId: input.customer.tierId,
        creditLimit: input.customer.creditLimit.toString(),
        currentExposure: input.customer.currentExposure.toString(),
        overdueBalance: input.customer.overdueBalance.toString(),
      }),
      pricingSnapshot: jsonInput({ sourceVersionId: quote.currentVersion.id }),
      termsFingerprint: stableFingerprint({ pendingRevision: revisionNumber }),
      notes: input.notes,
    },
  });
  if (input.lines.length > 0) {
    await transaction.quoteLine.createMany({
      data: input.lines.map((line, index) => ({
        ...line,
        organizationId: quote.organizationId,
        quoteVersionId: next.id,
        lineNumber: index + 1,
      })),
    });
  }
  const updated = await transaction.quote.updateMany({
    where: {
      id: quote.id,
      organizationId: quote.organizationId,
      revision: expectedRevision,
      currentVersionId: quote.currentVersion.id,
    },
    data: {
      customerAccountId: input.customer.id,
      salesTeamId: input.customer.salesTeamId,
      currentVersionId: next.id,
      currentRevision: revisionNumber,
      expiresAt: input.expiresAt,
      stage: "DRAFT",
      revision: { increment: 1 },
    },
  });
  if (updated.count !== 1) {
    conflict(
      "The quote changed while this version was being saved",
      "REVISION_CONFLICT",
    );
  }
  const calculated = await recalculateQuote(
    transaction,
    quote.organizationId,
    quote.id,
  );
  await recordActivity(transaction, {
    organizationId: quote.organizationId,
    actor,
    eventType: "quote.versioned",
    entityType: "Quote",
    entityId: quote.id,
    entityVersion: revisionNumber,
    termsFingerprint: calculated.currentVersion?.termsFingerprint,
    reason: input.reason,
    before: {
      revision: quote.currentRevision,
      fingerprint: quote.currentVersion.termsFingerprint,
    },
    after: {
      revision: revisionNumber,
      fingerprint: calculated.currentVersion?.termsFingerprint,
    },
    quoteId: quote.id,
    title: `Quote ${quote.quoteNumber} revised`,
    message: input.reason,
  });
  return calculated;
}

export async function createQuote(
  transaction: TransactionClient,
  principal: InternalPrincipal,
  input: CreateQuoteRequest,
): Promise<LoadedQuote> {
  const customer = await transaction.customerAccount.findFirst({
    where: {
      id: input.customerAccountId,
      organizationId: principal.organizationId,
      status: "ACTIVE",
    },
  });
  if (customer === null) notFound("Active customer account");
  const quote = await transaction.quote.create({
    data: {
      organizationId: principal.organizationId,
      customerAccountId: customer.id,
      ownerId: principal.userId,
      salesTeamId: customer.salesTeamId,
      quoteNumber: quoteNumber(),
      expiresAt:
        input.expiresAt === undefined ? null : new Date(input.expiresAt),
    },
  });
  const version = await transaction.quoteVersion.create({
    data: {
      organizationId: principal.organizationId,
      quoteId: quote.id,
      customerAccountId: customer.id,
      createdById: principal.userId,
      revisionNumber: 1,
      currency: input.currency,
      paymentTermsDays: input.paymentTermsDays,
      customerSnapshot: jsonInput({
        id: customer.id,
        accountCode: customer.accountCode,
        name: customer.name,
        tierId: customer.tierId,
        creditLimit: customer.creditLimit.toString(),
        currentExposure: customer.currentExposure.toString(),
        overdueBalance: customer.overdueBalance.toString(),
      }),
      pricingSnapshot: jsonInput({}),
      termsFingerprint: stableFingerprint({
        customerAccountId: customer.id,
        lines: [],
      }),
      notes: input.notes,
    },
  });
  await transaction.quote.update({
    where: { id: quote.id },
    data: { currentVersionId: version.id },
  });
  const calculated = await recalculateQuote(
    transaction,
    principal.organizationId,
    quote.id,
  );
  await recordActivity(transaction, {
    organizationId: principal.organizationId,
    actor: principal,
    eventType: "quote.created",
    entityType: "Quote",
    entityId: quote.id,
    entityVersion: 1,
    termsFingerprint: calculated.currentVersion?.termsFingerprint,
    quoteId: quote.id,
    title: `Quote ${quote.quoteNumber} created`,
  });
  return calculated;
}

export async function updateQuote(
  transaction: TransactionClient,
  principal: InternalPrincipal,
  quoteId: string,
  input: UpdateQuoteRequest,
): Promise<LoadedQuote> {
  const quote = await loadQuote(transaction, principal.organizationId, quoteId);
  assertCanEditQuote(principal, quote);
  assertRevision(quote.revision, input.revision);
  const customerId = input.customerAccountId ?? quote.customerAccountId;
  const customer = await transaction.customerAccount.findFirst({
    where: {
      id: customerId,
      organizationId: principal.organizationId,
      status: "ACTIVE",
    },
  });
  if (customer === null) notFound("Active customer account");
  const currency = input.currency ?? quote.currentVersion.currency;
  const customerOrCurrencyChanged =
    customer.id !== quote.customerAccountId ||
    currency !== quote.currentVersion.currency;
  const lines = customerOrCurrencyChanged
    ? await Promise.all(
        quote.currentVersion.lines.map((line) =>
          resolveLine(transaction, {
            organizationId: principal.organizationId,
            customerTierId: customer.tierId,
            currency,
            productId: line.productId,
            variantId: line.variantId,
            subscriptionPlanId: line.subscriptionPlanId,
            quantity: line.quantity,
            unitPrice: hasManualPriceOverride(line)
              ? line.unitPrice
              : undefined,
            discountPercent: line.discountPercent,
            billingType: line.billingType,
          }),
        ),
      )
    : quote.currentVersion.lines.map(cloneLine);
  return forkVersion(
    transaction,
    quote,
    principal,
    principal.userId,
    input.revision,
    {
      customer,
      currency,
      paymentTermsDays:
        input.paymentTermsDays ?? quote.currentVersion.paymentTermsDays,
      expiresAt:
        input.expiresAt === undefined
          ? quote.expiresAt
          : input.expiresAt === null
            ? null
            : new Date(input.expiresAt),
      notes:
        input.notes === undefined ? quote.currentVersion.notes : input.notes,
      lines,
      reason: "Commercial quote terms updated",
    },
  );
}

export async function transitionQuoteStage(
  transaction: TransactionClient,
  principal: InternalPrincipal,
  quoteId: string,
  input: UpdateQuoteStageRequest,
): Promise<LoadedQuote> {
  const quote = await loadQuote(transaction, principal.organizationId, quoteId);
  assertCanEditQuote(principal, quote);
  assertRevision(quote.revision, input.revision);

  if (quote.stage === input.stage) {
    conflict(
      "The quote is already in the requested stage",
      "QUOTE_STAGE_UNCHANGED",
    );
  }

  const cancellableStages = [
    "DRAFT",
    "PENDING_APPROVAL",
    "REVISION_REQUIRED",
    "READY_TO_SEND",
    "SENT",
    "UNDER_NEGOTIATION",
    "CUSTOMER_ACCEPTED",
  ] as const;
  const permitted =
    (quote.stage === "SENT" && input.stage === "UNDER_NEGOTIATION") ||
    (quote.stage === "UNDER_NEGOTIATION" && input.stage === "SENT") ||
    (input.stage === "CANCELLED" &&
      cancellableStages.includes(
        quote.stage as (typeof cancellableStages)[number],
      ));
  if (!permitted) {
    conflict(
      `The pipeline endpoint cannot move a quote from ${quote.stage} to ${input.stage}; use the dedicated workflow command`,
      "INVALID_QUOTE_STAGE_TRANSITION",
    );
  }

  const changed = await transaction.quote.updateMany({
    where: {
      id: quote.id,
      organizationId: principal.organizationId,
      revision: input.revision,
      stage: quote.stage,
    },
    data: { stage: input.stage, revision: { increment: 1 } },
  });
  if (changed.count !== 1) {
    conflict(
      "The quote changed during the stage transition",
      "REVISION_CONFLICT",
    );
  }
  if (input.stage === "UNDER_NEGOTIATION") {
    await transaction.negotiationThread.upsert({
      where: {
        organizationId_quoteId: {
          organizationId: principal.organizationId,
          quoteId: quote.id,
        },
      },
      update: { status: "OPEN", closedAt: null },
      create: {
        organizationId: principal.organizationId,
        quoteId: quote.id,
        customerAccountId: quote.customerAccountId,
      },
    });
  }
  if (input.stage === "CANCELLED") {
    await transaction.approvalStep.updateMany({
      where: {
        organizationId: principal.organizationId,
        approvalRequest: {
          quoteId: quote.id,
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
        status: { in: ["WAITING", "ACTIVE"] },
      },
      data: { status: "SUPERSEDED", completedAt: new Date() },
    });
    await transaction.approvalRequest.updateMany({
      where: {
        organizationId: principal.organizationId,
        quoteId: quote.id,
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
      data: {
        status: "SUPERSEDED",
        currentSequence: null,
        completedAt: new Date(),
      },
    });
  }
  if (input.stage === "CANCELLED" || input.stage === "SENT") {
    await transaction.negotiationThread.updateMany({
      where: {
        organizationId: principal.organizationId,
        quoteId: quote.id,
        status: "OPEN",
      },
      data: { status: "CLOSED", closedAt: new Date() },
    });
  }
  await recordActivity(transaction, {
    organizationId: principal.organizationId,
    actor: principal,
    eventType:
      input.stage === "CANCELLED"
        ? "quote.cancelled"
        : input.stage === "UNDER_NEGOTIATION"
          ? "quote.negotiation_started"
          : "quote.negotiation_paused",
    entityType: "Quote",
    entityId: quote.id,
    entityVersion: quote.currentRevision,
    termsFingerprint: quote.currentVersion.termsFingerprint,
    quoteId: quote.id,
    title:
      input.stage === "CANCELLED"
        ? "Quote cancelled"
        : input.stage === "UNDER_NEGOTIATION"
          ? "Quote moved into negotiation"
          : "Quote returned to sent",
    metadata: { fromStage: quote.stage, toStage: input.stage },
  });
  return loadQuote(transaction, principal.organizationId, quote.id);
}

export async function addQuoteLine(
  transaction: TransactionClient,
  principal: InternalPrincipal,
  quoteId: string,
  input: AddQuoteLineRequest,
): Promise<LoadedQuote> {
  const quote = await loadQuote(transaction, principal.organizationId, quoteId);
  assertCanEditQuote(principal, quote);
  assertRevision(quote.revision, input.revision);
  const line = await resolveLine(transaction, {
    organizationId: principal.organizationId,
    customerTierId: quote.customerAccount.tierId,
    currency: quote.currentVersion.currency,
    productId: input.productId,
    variantId: input.variantId,
    subscriptionPlanId: input.subscriptionPlanId,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    discountPercent: input.discountPercent,
    billingType: input.billingType,
  });
  return forkVersion(
    transaction,
    quote,
    principal,
    principal.userId,
    input.revision,
    {
      customer: quote.customerAccount,
      currency: quote.currentVersion.currency,
      paymentTermsDays: quote.currentVersion.paymentTermsDays,
      expiresAt: quote.expiresAt,
      notes: quote.currentVersion.notes,
      lines: [...quote.currentVersion.lines.map(cloneLine), line],
      reason: `Added ${line.productName}`,
    },
  );
}

export async function updateQuoteLine(
  transaction: TransactionClient,
  principal: InternalPrincipal,
  quoteId: string,
  lineId: string,
  input: UpdateQuoteLineRequest,
): Promise<LoadedQuote> {
  const quote = await loadQuote(transaction, principal.organizationId, quoteId);
  assertCanEditQuote(principal, quote);
  assertRevision(quote.revision, input.revision);
  const existing = quote.currentVersion.lines.find(
    (line) => line.id === lineId,
  );
  if (existing === undefined) notFound("Current quote line");
  const billingType = input.billingType ?? existing.billingType;
  const subscriptionPlanId =
    input.subscriptionPlanId === undefined
      ? existing.subscriptionPlanId
      : input.subscriptionPlanId;
  const replacement = await resolveLine(transaction, {
    organizationId: principal.organizationId,
    customerTierId: quote.customerAccount.tierId,
    currency: quote.currentVersion.currency,
    productId: existing.productId,
    variantId:
      input.variantId === undefined ? existing.variantId : input.variantId,
    subscriptionPlanId,
    quantity: input.quantity ?? existing.quantity,
    unitPrice:
      input.unitPrice ??
      (hasManualPriceOverride(existing) ? existing.unitPrice : undefined),
    discountPercent: input.discountPercent ?? existing.discountPercent,
    billingType,
  });
  const lines = quote.currentVersion.lines.map((line) =>
    line.id === lineId ? replacement : cloneLine(line),
  );
  return forkVersion(
    transaction,
    quote,
    principal,
    principal.userId,
    input.revision,
    {
      customer: quote.customerAccount,
      currency: quote.currentVersion.currency,
      paymentTermsDays: quote.currentVersion.paymentTermsDays,
      expiresAt: quote.expiresAt,
      notes: quote.currentVersion.notes,
      lines,
      reason: `Updated ${existing.productName}`,
    },
  );
}

export async function deleteQuoteLine(
  transaction: TransactionClient,
  principal: InternalPrincipal,
  quoteId: string,
  lineId: string,
  expectedRevision: number,
): Promise<LoadedQuote> {
  const quote = await loadQuote(transaction, principal.organizationId, quoteId);
  assertCanEditQuote(principal, quote);
  assertRevision(quote.revision, expectedRevision);
  const existing = quote.currentVersion.lines.find(
    (line) => line.id === lineId,
  );
  if (existing === undefined) notFound("Current quote line");
  return forkVersion(
    transaction,
    quote,
    principal,
    principal.userId,
    expectedRevision,
    {
      customer: quote.customerAccount,
      currency: quote.currentVersion.currency,
      paymentTermsDays: quote.currentVersion.paymentTermsDays,
      expiresAt: quote.expiresAt,
      notes: quote.currentVersion.notes,
      lines: quote.currentVersion.lines
        .filter((line) => line.id !== lineId)
        .map(cloneLine),
      reason: `Removed ${existing.productName}`,
    },
  );
}

export async function loadOwnedQuote(
  transaction: TransactionClient,
  principal: InternalPrincipal,
  quoteId: string,
): Promise<QuoteRecord & { currentVersion: VersionRecord }> {
  const quote = await loadQuote(transaction, principal.organizationId, quoteId);
  assertCanReadQuote(principal, quote);
  return quote;
}

export interface NegotiatedCommercialChange {
  quoteLineId?: string | null;
  action:
    | "REMOVE"
    | "CHANGE_QUANTITY"
    | "CHANGE_PRICE"
    | "CHANGE_DISCOUNT"
    | "CHANGE_TERMS";
  quantity?: string | Prisma.Decimal | null;
  unitPrice?: string | Prisma.Decimal | null;
  discountPercent?: string | Prisma.Decimal | null;
  terms?: Record<string, unknown> | null;
}

/**
 * Apply a complete negotiated proposal as one immutable quote version. Callers
 * must first authorize the actor against the change request/counteroffer.
 */
export async function applyNegotiatedChanges(
  transaction: TransactionClient,
  input: {
    organizationId: string;
    quoteId: string;
    sourceQuoteVersionId: string;
    sourceTermsFingerprint: string;
    actor: Actor;
    createdById: string;
    changes: NegotiatedCommercialChange[];
    reason: string;
  },
): Promise<LoadedQuote> {
  const quote = await loadQuote(
    transaction,
    input.organizationId,
    input.quoteId,
  );
  if (
    quote.currentVersion.id !== input.sourceQuoteVersionId ||
    quote.currentVersion.termsFingerprint !== input.sourceTermsFingerprint
  ) {
    conflict(
      "The negotiated proposal is based on superseded terms",
      "TERMS_CHANGED",
    );
  }
  const lineChanges = new Map<string, NegotiatedCommercialChange[]>();
  const termChanges = input.changes.filter(
    (change) => change.action === "CHANGE_TERMS",
  );
  for (const change of input.changes) {
    if (change.action === "CHANGE_TERMS") continue;
    if (change.quoteLineId === null || change.quoteLineId === undefined) {
      throw new HttpError(
        422,
        "Invalid negotiated change",
        "A line change requires quoteLineId",
        {
          code: "INVALID_NEGOTIATED_CHANGE",
        },
      );
    }
    if (
      !quote.currentVersion.lines.some((line) => line.id === change.quoteLineId)
    ) {
      notFound("Negotiated quote line");
    }
    const existing = lineChanges.get(change.quoteLineId) ?? [];
    existing.push(change);
    lineChanges.set(change.quoteLineId, existing);
  }
  let currency = quote.currentVersion.currency;
  let paymentTermsDays = quote.currentVersion.paymentTermsDays;
  let expiresAt = quote.expiresAt;
  let notes = quote.currentVersion.notes;
  for (const change of termChanges) {
    const terms = change.terms ?? {};
    const requestedCurrency = terms["currency"];
    if (requestedCurrency !== undefined) {
      if (
        typeof requestedCurrency !== "string" ||
        !/^[A-Z]{3}$/.test(requestedCurrency)
      ) {
        throw new HttpError(
          422,
          "Invalid currency",
          "Negotiated currency must be an ISO code",
          {
            code: "INVALID_NEGOTIATED_TERMS",
          },
        );
      }
      currency = requestedCurrency;
    }
    const requestedTerms = terms["paymentTermsDays"];
    if (requestedTerms !== undefined) {
      if (
        typeof requestedTerms !== "number" ||
        !Number.isInteger(requestedTerms) ||
        requestedTerms < 0 ||
        requestedTerms > 365
      ) {
        throw new HttpError(
          422,
          "Invalid payment terms",
          "Payment terms must be 0 to 365 days",
          {
            code: "INVALID_NEGOTIATED_TERMS",
          },
        );
      }
      paymentTermsDays = requestedTerms;
    }
    if ("expiresAt" in terms) {
      const requestedExpiry = terms["expiresAt"];
      if (requestedExpiry === null) {
        expiresAt = null;
      } else if (typeof requestedExpiry === "string") {
        const parsed = new Date(requestedExpiry);
        if (Number.isNaN(parsed.getTime())) {
          throw new HttpError(
            422,
            "Invalid expiry",
            "Negotiated expiry is not a date",
            {
              code: "INVALID_NEGOTIATED_TERMS",
            },
          );
        }
        expiresAt = parsed;
      } else {
        throw new HttpError(
          422,
          "Invalid expiry",
          "Negotiated expiry must be a date or null",
          {
            code: "INVALID_NEGOTIATED_TERMS",
          },
        );
      }
    }
    if ("notes" in terms) {
      const requestedNotes = terms["notes"];
      if (
        requestedNotes !== null &&
        (typeof requestedNotes !== "string" || requestedNotes.length > 4000)
      ) {
        throw new HttpError(
          422,
          "Invalid notes",
          "Negotiated notes must be at most 4000 characters",
          {
            code: "INVALID_NEGOTIATED_TERMS",
          },
        );
      }
      notes = requestedNotes;
    }
  }
  const forceReprice = currency !== quote.currentVersion.currency;
  const lines: LineInput[] = [];
  for (const line of quote.currentVersion.lines) {
    const changes = lineChanges.get(line.id) ?? [];
    if (changes.some((change) => change.action === "REMOVE")) {
      if (changes.length > 1) {
        conflict(
          "A removed line cannot contain additional changes",
          "CONFLICTING_CHANGES",
        );
      }
      continue;
    }
    const quantityChange = changes.find(
      (change) => change.action === "CHANGE_QUANTITY",
    );
    const priceChange = changes.find(
      (change) => change.action === "CHANGE_PRICE",
    );
    const discountChange = changes.find(
      (change) => change.action === "CHANGE_DISCOUNT",
    );
    if (changes.length === 0 && !forceReprice) {
      lines.push(cloneLine(line));
      continue;
    }
    const quantity = quantityChange?.quantity ?? line.quantity;
    const unitPrice =
      priceChange?.unitPrice ??
      (hasManualPriceOverride(line) ? line.unitPrice : undefined);
    const discountPercent =
      discountChange?.discountPercent ?? line.discountPercent;
    lines.push(
      await resolveLine(transaction, {
        organizationId: input.organizationId,
        customerTierId: quote.customerAccount.tierId,
        currency,
        productId: line.productId,
        variantId: line.variantId,
        subscriptionPlanId: line.subscriptionPlanId,
        quantity,
        unitPrice: unitPrice ?? undefined,
        discountPercent,
        billingType: line.billingType,
      }),
    );
  }
  return forkVersion(
    transaction,
    quote,
    input.actor,
    input.createdById,
    quote.revision,
    {
      customer: quote.customerAccount,
      currency,
      paymentTermsDays,
      expiresAt,
      notes,
      lines,
      reason: input.reason,
    },
  );
}
