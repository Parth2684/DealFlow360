import { Router } from "express";

import {
  ChangeRequestDtoSchema,
  InternalNegotiationDtoSchema,
  CounterofferDtoSchema,
  CreateChangeRequestSchema,
  CreateCounterofferRequestSchema,
  CreateCustomerCounterproposalRequestSchema,
  CreateNegotiationMessageRequestSchema,
  NegotiationDecisionRequestSchema,
  NegotiationMessageDtoSchema,
  PortalNegotiationMessagesDtoSchema,
  PortalNegotiationMessagesQuerySchema,
  PortalQuoteConfirmationRequestSchema,
  PortalQuoteConfirmationResponseSchema,
  PortalQuoteDtoSchema,
  PortalQuoteListDtoSchema,
  ListQuerySchema,
  PortalQuoteVersionDiffDtoSchema,
  PortalQuoteVersionDiffQuerySchema,
  PortalQuoteVersionDtoSchema,
  PortalQuoteVersionHistoryDtoSchema,
  CustomerCounterproposalDtoSchema,
  ROLE_CAPABILITIES,
  RoleSchema,
  resolveOrganizationLocale,
  type Role,
} from "@repo/common";
import { prisma, Prisma } from "@repo/db";

import {
  authenticateInternal,
  authenticatePortal,
  internalPrincipal,
  portalPrincipal,
  requireCapability,
  requireCsrf,
} from "../../middleware/auth.js";
import { portalRateLimit } from "../../middleware/rate-limit.js";
import {
  jsonInput,
  recordActivity,
  type TransactionClient,
} from "../../shared/activity.js";
import { conflict, forbidden, notFound } from "../../shared/errors.js";
import {
  cursorArgs,
  pageFromRows,
  parseBody,
  parsePathId,
  parseQuery,
  toJsonValue,
} from "../../shared/http.js";
import { runIdempotent } from "../../shared/idempotency.js";
import { portalShareabilityWhere } from "../../shared/portal-access.js";
import type { InternalPrincipal, PortalPrincipal } from "../../shared/types.js";
import {
  applyNegotiatedChanges,
  assertCanEditQuote,
  assertCanReadQuote,
  type NegotiatedCommercialChange,
} from "../quotations/service.js";
import { submitQuote } from "../quotations/workflow.js";

const portalVersionInclude = {
  lines: {
    include: { subscriptionPlan: true },
    orderBy: { lineNumber: "asc" as const },
  },
} satisfies Prisma.QuoteVersionInclude;

const portalQuoteInclude = {
  organization: true,
  customerAccount: true,
  owner: true,
  currentVersion: { include: portalVersionInclude },
  approvalRequests: { orderBy: { requestedAt: "desc" }, take: 1 },
} satisfies Prisma.QuoteInclude;

type PortalQuoteRecord = Prisma.QuoteGetPayload<{
  include: typeof portalQuoteInclude;
}>;

type PortalVersionRecord = Prisma.QuoteVersionGetPayload<{
  include: typeof portalVersionInclude;
}>;

type PortalLineRecord = PortalVersionRecord["lines"][number];

const changeRequestInclude = {
  requestedByPortal: { include: { customerContact: true } },
  items: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.ChangeRequestInclude;

type ChangeRecord = Prisma.ChangeRequestGetPayload<{
  include: typeof changeRequestInclude;
}>;

const counterofferInclude = {
  offeredByUser: true,
  items: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.CounterofferInclude;

type CounterRecord = Prisma.CounterofferGetPayload<{
  include: typeof counterofferInclude;
}>;

function jsonObject(value: unknown): Record<string, unknown> {
  const converted = toJsonValue(value);
  return converted !== null &&
    typeof converted === "object" &&
    !Array.isArray(converted)
    ? (converted as Record<string, unknown>)
    : {};
}

function mapChangeRequest(change: ChangeRecord) {
  return ChangeRequestDtoSchema.parse({
    id: change.id,
    sourceQuoteVersionId: change.sourceQuoteVersionId,
    sourceTermsFingerprint: change.sourceTermsFingerprint,
    message: change.message,
    status: change.status,
    requestedByName: `${change.requestedByPortal.customerContact.firstName} ${change.requestedByPortal.customerContact.lastName}`,
    resolutionReason: change.resolutionReason,
    resultingQuoteVersionId: change.resultingQuoteVersionId,
    items: change.items.map((item) => ({
      id: item.id,
      quoteLineId: item.quoteLineId ?? undefined,
      action: item.action,
      quantity: item.requestedQuantity?.toString(),
      unitPrice: item.requestedUnitPrice?.toString(),
      discountPercent: item.requestedDiscountPercent?.toString(),
      terms:
        item.requestedTerms === null
          ? undefined
          : jsonObject(item.requestedTerms),
    })),
    createdAt: change.createdAt.toISOString(),
    resolvedAt: change.resolvedAt?.toISOString() ?? null,
  });
}

function mapCounteroffer(counteroffer: CounterRecord) {
  return CounterofferDtoSchema.parse({
    id: counteroffer.id,
    changeRequestId: counteroffer.changeRequestId,
    sourceQuoteVersionId: counteroffer.sourceQuoteVersionId,
    sourceTermsFingerprint: counteroffer.sourceTermsFingerprint,
    offeredByName: `${counteroffer.offeredByUser.firstName} ${counteroffer.offeredByUser.lastName}`,
    message: counteroffer.message,
    status: counteroffer.status,
    customerDecisionReason: counteroffer.customerDecisionReason,
    resultingQuoteVersionId: counteroffer.resultingQuoteVersionId,
    proposedChanges: counteroffer.items.map((item) => ({
      quoteLineId: item.quoteLineId,
      quantity: item.proposedQuantity?.toString(),
      unitPrice: item.proposedUnitPrice?.toString(),
      discountPercent: item.proposedDiscountPercent?.toString(),
    })),
    createdAt: counteroffer.createdAt.toISOString(),
    decidedAt: counteroffer.decidedAt?.toISOString() ?? null,
  });
}

function intervalLabel(snapshot: unknown, fallback: string): string {
  const object = jsonObject(snapshot);
  const interval = object["interval"];
  const count = object["intervalCount"];
  if (typeof interval !== "string") return fallback;
  return `${typeof count === "number" ? count : 1} ${interval.toLowerCase()}`;
}

function mapPortalLine(line: PortalLineRecord) {
  return {
    id: line.id,
    lineNumber: line.lineNumber,
    productCode: line.productCode,
    productName: line.productName,
    productDescription: line.productDescription,
    productType: line.productType,
    sku: line.sku,
    unit: line.unit,
    quantity: line.quantity.toString(),
    listUnitPrice: line.listUnitPrice.toString(),
    unitPrice: line.unitPrice.toString(),
    discountPercent: line.discountPercent.toString(),
    lineDiscountAmount: line.lineDiscountAmount.toString(),
    preTaxSubtotal: line.preTaxSubtotal.toString(),
    taxCode: line.taxCode,
    taxRate: line.taxRate.toString(),
    taxBehavior: line.taxBehavior,
    taxAmount: line.taxAmount.toString(),
    total: line.total.toString(),
    billingType: line.billingType,
    subscription:
      line.subscriptionPlan === null
        ? null
        : {
            planName: line.subscriptionPlan.name,
            intervalLabel: intervalLabel(
              line.subscriptionSnapshot,
              `${line.subscriptionPlan.intervalCount} ${line.subscriptionPlan.interval.toLowerCase()}`,
            ),
          },
  };
}

function mapPortalVersion(
  version: PortalVersionRecord,
  currentVersionId: string,
) {
  return PortalQuoteVersionDtoSchema.parse({
    id: version.id,
    revisionNumber: version.revisionNumber,
    termsFingerprint: version.termsFingerprint,
    currency: version.currency,
    paymentTermsDays: version.paymentTermsDays,
    subtotal: version.subtotal.toString(),
    discountTotal: version.lineDiscountTotal
      .plus(version.orderDiscountTotal)
      .toString(),
    taxTotal: version.taxTotal.toString(),
    total: version.total.toString(),
    notes: null,
    lines: version.lines.map(mapPortalLine),
    isCurrent: version.id === currentVersionId,
    createdAt: version.createdAt.toISOString(),
  });
}

function mapPortalQuote(quote: PortalQuoteRecord) {
  const version = quote.currentVersion;
  if (version === null) notFound("Shared quote version");
  const latestApproval = quote.approvalRequests[0];
  const approvalValid =
    version.status === "READY_TO_SEND" ||
    version.status === "APPROVED" ||
    version.status === "CUSTOMER_ACCEPTED" ||
    (latestApproval?.status === "APPROVED" &&
      latestApproval.quoteVersionId === version.id &&
      latestApproval.termsFingerprint === version.termsFingerprint);
  const active = quote.expiresAt === null || quote.expiresAt > new Date();
  return PortalQuoteDtoSchema.parse({
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    stage: quote.stage,
    revision: quote.revision,
    versionId: version.id,
    termsFingerprint: version.termsFingerprint,
    customer: {
      id: quote.customerAccount.id,
      name: quote.customerAccount.name,
    },
    seller: {
      organizationName: quote.organization.name,
      representativeName: `${quote.owner.firstName} ${quote.owner.lastName}`,
    },
    formatting: {
      locale: resolveOrganizationLocale(quote.organization.settings),
      timezone: quote.organization.timezone,
    },
    currency: version.currency,
    paymentTermsDays: version.paymentTermsDays,
    expiresAt: quote.expiresAt?.toISOString() ?? null,
    subtotal: version.subtotal.toString(),
    discountTotal: version.lineDiscountTotal
      .plus(version.orderDiscountTotal)
      .toString(),
    taxTotal: version.taxTotal.toString(),
    total: version.total.toString(),
    notes: null,
    lines: version.lines.map(mapPortalLine),
    canNegotiate: active && ["SENT", "UNDER_NEGOTIATION"].includes(quote.stage),
    canConfirm:
      active &&
      approvalValid &&
      ["SENT", "UNDER_NEGOTIATION"].includes(quote.stage),
    updatedAt: quote.updatedAt.toISOString(),
  });
}

async function loadPortalQuote(
  transaction: TransactionClient,
  principal: PortalPrincipal,
  quoteId: string,
): Promise<
  PortalQuoteRecord & {
    currentVersion: NonNullable<PortalQuoteRecord["currentVersion"]>;
  }
> {
  if (principal.quoteId !== null && principal.quoteId !== quoteId) forbidden();
  const quote = await transaction.quote.findFirst({
    where: {
      id: quoteId,
      organizationId: principal.organizationId,
      customerAccountId: principal.customerAccountId,
      ...portalShareabilityWhere(principal.customerAccountId),
    },
    include: portalQuoteInclude,
  });
  if (quote === null || quote.currentVersion === null) notFound("Shared quote");
  return { ...quote, currentVersion: quote.currentVersion };
}

async function loadPortalVersionHistory(
  transaction: TransactionClient,
  principal: PortalPrincipal,
  quoteId: string,
): Promise<{
  quote: PortalQuoteRecord & {
    currentVersion: NonNullable<PortalQuoteRecord["currentVersion"]>;
  };
  versions: PortalVersionRecord[];
}> {
  const quote = await loadPortalQuote(transaction, principal, quoteId);
  const [sentEvents, messages, changes, counteroffers, acceptances] =
    await Promise.all([
      transaction.dealEvent.findMany({
        where: {
          organizationId: principal.organizationId,
          quoteId,
          eventType: "quote.sent",
          visibility: { in: ["CUSTOMER", "BOTH"] },
          sourceVersion: { not: null },
        },
        select: { sourceVersion: true },
      }),
      transaction.negotiationMessage.findMany({
        where: {
          organizationId: principal.organizationId,
          thread: { quoteId, customerAccountId: principal.customerAccountId },
          visibility: { in: ["CUSTOMER", "BOTH"] },
        },
        select: { quoteVersionId: true },
      }),
      transaction.changeRequest.findMany({
        where: {
          organizationId: principal.organizationId,
          thread: { quoteId, customerAccountId: principal.customerAccountId },
        },
        select: { sourceQuoteVersionId: true, resultingQuoteVersionId: true },
      }),
      transaction.counteroffer.findMany({
        where: {
          organizationId: principal.organizationId,
          changeRequest: {
            thread: { quoteId, customerAccountId: principal.customerAccountId },
          },
        },
        select: { sourceQuoteVersionId: true, resultingQuoteVersionId: true },
      }),
      transaction.customerAcceptance.findMany({
        where: {
          organizationId: principal.organizationId,
          quoteId,
          quote: { customerAccountId: principal.customerAccountId },
        },
        select: { quoteVersionId: true },
      }),
    ]);
  const versionIds = new Set<string>([quote.currentVersion.id]);
  for (const message of messages) versionIds.add(message.quoteVersionId);
  for (const change of changes) {
    versionIds.add(change.sourceQuoteVersionId);
    if (change.resultingQuoteVersionId !== null) {
      versionIds.add(change.resultingQuoteVersionId);
    }
  }
  for (const counteroffer of counteroffers) {
    versionIds.add(counteroffer.sourceQuoteVersionId);
    if (counteroffer.resultingQuoteVersionId !== null) {
      versionIds.add(counteroffer.resultingQuoteVersionId);
    }
  }
  for (const acceptance of acceptances)
    versionIds.add(acceptance.quoteVersionId);
  const sentRevisions = sentEvents.flatMap((event) =>
    event.sourceVersion === null ? [] : [event.sourceVersion],
  );
  const versions = await transaction.quoteVersion.findMany({
    where: {
      organizationId: principal.organizationId,
      quoteId,
      customerAccountId: principal.customerAccountId,
      OR: [
        { id: { in: [...versionIds] } },
        ...(sentRevisions.length === 0
          ? []
          : [{ revisionNumber: { in: sentRevisions } }]),
      ],
    },
    include: portalVersionInclude,
    orderBy: { revisionNumber: "desc" },
  });
  return { quote, versions };
}

function portalLineIdentity(line: PortalLineRecord): string {
  return `${line.lineNumber}:${line.productCode}:${line.sku ?? "base"}:${line.billingType}`;
}

function portalVersionDifferences(
  before: PortalVersionRecord,
  after: PortalVersionRecord,
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
  compare("notes", "Quote notes", before.notes, after.notes);
  compare(
    "subtotal",
    "Subtotal",
    before.subtotal.toString(),
    after.subtotal.toString(),
  );
  compare(
    "discountTotal",
    "Discount total",
    before.lineDiscountTotal.plus(before.orderDiscountTotal).toString(),
    after.lineDiscountTotal.plus(after.orderDiscountTotal).toString(),
  );
  compare(
    "taxTotal",
    "Tax total",
    before.taxTotal.toString(),
    after.taxTotal.toString(),
  );
  compare(
    "total",
    "Quote total",
    before.total.toString(),
    after.total.toString(),
  );
  const beforeLines = new Map(
    before.lines.map((line) => [portalLineIdentity(line), line]),
  );
  const afterLines = new Map(
    after.lines.map((line) => [portalLineIdentity(line), line]),
  );
  for (const key of new Set([...beforeLines.keys(), ...afterLines.keys()])) {
    const left = beforeLines.get(key);
    const right = afterLines.get(key);
    const label = right?.productName ?? left?.productName ?? "Quote line";
    if (left === undefined || right === undefined) {
      differences.push({
        path: `lines.${right?.id ?? left?.id ?? key}`,
        label,
        before: left === undefined ? null : mapPortalLine(left),
        after: right === undefined ? null : mapPortalLine(right),
        material: true,
      });
      continue;
    }
    const path = `lines.${right.id}`;
    compare(
      `${path}.quantity`,
      `${label} quantity`,
      left.quantity.toString(),
      right.quantity.toString(),
    );
    compare(
      `${path}.unitPrice`,
      `${label} unit price`,
      left.unitPrice.toString(),
      right.unitPrice.toString(),
    );
    compare(
      `${path}.discountPercent`,
      `${label} discount`,
      left.discountPercent.toString(),
      right.discountPercent.toString(),
    );
    compare(
      `${path}.taxCode`,
      `${label} tax code`,
      left.taxCode,
      right.taxCode,
    );
    compare(
      `${path}.taxRate`,
      `${label} tax rate`,
      left.taxRate.toString(),
      right.taxRate.toString(),
    );
    compare(
      `${path}.taxBehavior`,
      `${label} tax treatment`,
      left.taxBehavior,
      right.taxBehavior,
    );
    compare(
      `${path}.billingType`,
      `${label} billing`,
      left.billingType,
      right.billingType,
    );
    compare(
      `${path}.subscription`,
      `${label} subscription interval`,
      mapPortalLine(left).subscription?.intervalLabel ?? null,
      mapPortalLine(right).subscription?.intervalLabel ?? null,
    );
    compare(
      `${path}.total`,
      `${label} total`,
      left.total.toString(),
      right.total.toString(),
    );
  }
  return differences;
}

async function createCustomerChangeRequest(
  transaction: TransactionClient,
  principal: PortalPrincipal,
  quoteId: string,
  input: {
    message?: string;
    quoteRevision?: number;
    termsFingerprint?: string;
    requestedChanges: Array<{
      quoteLineId?: string;
      action:
        | "REMOVE"
        | "CHANGE_QUANTITY"
        | "CHANGE_PRICE"
        | "CHANGE_DISCOUNT"
        | "CHANGE_TERMS";
      quantity?: string;
      unitPrice?: string;
      discountPercent?: string;
      terms?: Record<string, unknown>;
    }>;
  },
): Promise<ChangeRecord> {
  const quote = await loadPortalQuote(transaction, principal, quoteId);
  if (
    !(["SENT", "UNDER_NEGOTIATION"] as const).some(
      (stage) => quote.stage === stage,
    )
  ) {
    conflict("This quote is not open for negotiation", "NEGOTIATION_CLOSED");
  }
  if (
    input.quoteRevision !== undefined &&
    input.quoteRevision !== quote.revision
  ) {
    conflict("The visible quote revision changed", "REVISION_CONFLICT");
  }
  if (
    input.termsFingerprint !== undefined &&
    input.termsFingerprint !== quote.currentVersion.termsFingerprint
  ) {
    conflict("The visible commercial terms changed", "TERMS_CHANGED");
  }
  const currentLineIds = new Set(
    quote.currentVersion.lines.map((line) => line.id),
  );
  for (const item of input.requestedChanges) {
    if (
      item.quoteLineId !== undefined &&
      !currentLineIds.has(item.quoteLineId)
    ) {
      notFound("Current shared quote line");
    }
  }
  const claimedCurrentTerms = input.quoteRevision !== undefined;
  if (claimedCurrentTerms) {
    const expectedFingerprint =
      input.termsFingerprint ?? quote.currentVersion.termsFingerprint;
    const claimed = await transaction.quote.updateMany({
      where: {
        id: quote.id,
        organizationId: principal.organizationId,
        revision: input.quoteRevision,
        currentVersionId: quote.currentVersion.id,
        currentVersion: {
          is: { termsFingerprint: expectedFingerprint },
        },
        stage: { in: ["SENT", "UNDER_NEGOTIATION"] },
      },
      data: {
        stage: "UNDER_NEGOTIATION",
        revision: { increment: 1 },
      },
    });
    if (claimed.count !== 1) {
      conflict(
        "The quote changed while the counterproposal was being submitted",
        "REVISION_CONFLICT",
      );
    }
  }
  const thread = await transaction.negotiationThread.upsert({
    where: {
      organizationId_quoteId: {
        organizationId: principal.organizationId,
        quoteId,
      },
    },
    update: { status: "OPEN", closedAt: null },
    create: {
      organizationId: principal.organizationId,
      quoteId,
      customerAccountId: principal.customerAccountId,
    },
  });
  const created = await transaction.changeRequest.create({
    data: {
      organizationId: principal.organizationId,
      threadId: thread.id,
      sourceQuoteVersionId: quote.currentVersion.id,
      sourceTermsFingerprint: quote.currentVersion.termsFingerprint,
      requestedByPortalId: principal.portalIdentityId,
      message: input.message,
      items: {
        create: input.requestedChanges.map((item) => ({
          organizationId: principal.organizationId,
          quoteLineId: item.quoteLineId,
          action: item.action,
          requestedQuantity: item.quantity,
          requestedUnitPrice: item.unitPrice,
          requestedDiscountPercent: item.discountPercent,
          requestedTerms:
            item.terms === undefined ? undefined : jsonInput(item.terms),
        })),
      },
    },
    include: changeRequestInclude,
  });
  if (input.message !== undefined) {
    await transaction.negotiationMessage.create({
      data: {
        organizationId: principal.organizationId,
        threadId: thread.id,
        quoteVersionId: quote.currentVersion.id,
        authorType: "PORTAL",
        portalIdentityId: principal.portalIdentityId,
        body: input.message,
        visibility: "BOTH",
      },
    });
  }
  if (!claimedCurrentTerms) {
    await transaction.quote.updateMany({
      where: {
        id: quote.id,
        organizationId: principal.organizationId,
        stage: "SENT",
      },
      data: { stage: "UNDER_NEGOTIATION", revision: { increment: 1 } },
    });
  }
  await recordActivity(transaction, {
    organizationId: principal.organizationId,
    actor: principal,
    eventType: "customer.countered",
    entityType: "ChangeRequest",
    entityId: created.id,
    entityVersion: quote.currentVersion.revisionNumber,
    termsFingerprint: quote.currentVersion.termsFingerprint,
    quoteId,
    title: "Customer requested commercial changes",
    message: input.message,
    customerVisible: true,
    metadata:
      input.quoteRevision === undefined || input.termsFingerprint === undefined
        ? {}
        : {
            clientQuoteRevision: input.quoteRevision,
            clientTermsFingerprint: input.termsFingerprint,
          },
  });
  return created;
}

function rolesAndCapabilities(
  assignments: Array<{ role: string; salesTeamId: string | null }>,
) {
  const roles = [
    ...new Set(
      assignments.map((assignment) => RoleSchema.parse(assignment.role)),
    ),
  ];
  return {
    roles,
    capabilities: [
      ...new Set(roles.flatMap((role) => ROLE_CAPABILITIES[role])),
    ],
    salesTeamIds: assignments.flatMap((assignment) =>
      assignment.salesTeamId === null ? [] : [assignment.salesTeamId],
    ),
  };
}

function actorPrincipal(user: {
  id: string;
  organizationId: string;
  email: string;
  firstName: string;
  lastName: string;
  roleAssignments: Array<{ role: Role; salesTeamId: string | null }>;
}): InternalPrincipal {
  const authority = rolesAndCapabilities(user.roleAssignments);
  return {
    kind: "internal",
    sessionId: "automated-counteroffer-acceptance",
    sessionExpiresAt: new Date(Date.now() + 60_000),
    organizationId: user.organizationId,
    userId: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    ...authority,
    csrfHash: "",
  };
}

export function createNegotiationRouter(): Router {
  const router = Router();

  router.get(
    "/negotiation/quotes/:quoteId",
    authenticateInternal,
    requireCapability("negotiation.read"),
    async (request, response) => {
      const actor = internalPrincipal(response);
      const quoteId = parsePathId(request, "quoteId");
      const quote = await prisma.quote.findFirst({
        where: { id: quoteId, organizationId: actor.organizationId },
      });
      if (!quote) notFound("Quotation");
      assertCanReadQuote(actor, quote);
      const thread = await prisma.negotiationThread.findFirst({
        where: { quoteId, organizationId: actor.organizationId },
        include: {
          messages: {
            include: {
              authorUser: true,
              portalIdentity: { include: { customerContact: true } },
            },
            orderBy: { createdAt: "asc" },
          },
          changeRequests: {
            include: {
              ...changeRequestInclude,
              counteroffers: { include: counterofferInclude },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });
      response.json(
        InternalNegotiationDtoSchema.parse({
          messages: (thread?.messages ?? []).map((message) => ({
            id: message.id,
            quoteVersionId: message.quoteVersionId,
            quoteLineId: message.quoteLineId,
            authorType: message.authorType,
            authorName: message.authorUser
              ? `${message.authorUser.firstName} ${message.authorUser.lastName}`
              : message.portalIdentity
                ? `${message.portalIdentity.customerContact.firstName} ${message.portalIdentity.customerContact.lastName}`
                : "DealFlow360",
            body: message.body,
            visibility: message.visibility,
            createdAt: message.createdAt.toISOString(),
          })),
          changeRequests: (thread?.changeRequests ?? []).map(mapChangeRequest),
          counteroffers: (thread?.changeRequests ?? []).flatMap((change) =>
            change.counteroffers.map(mapCounteroffer),
          ),
        }),
      );
    },
  );

  router.post(
    "/negotiation/quotes/:quoteId/comments",
    authenticateInternal,
    requireCapability("negotiation.respond"),
    requireCsrf,
    async (request, response) => {
      const actor = internalPrincipal(response);
      const quoteId = parsePathId(request, "quoteId");
      const input = parseBody(CreateNegotiationMessageRequestSchema, request);
      const message = await prisma.$transaction(async (transaction) => {
        const quote = await transaction.quote.findFirst({
          where: { id: quoteId, organizationId: actor.organizationId },
          include: { currentVersion: { include: { lines: true } } },
        });
        if (!quote || !quote.currentVersion) notFound("Quotation");
        assertCanEditQuote(actor, quote);
        if (quote.revision !== input.quoteRevision)
          conflict(
            "The quotation changed; reload before replying",
            "REVISION_CONFLICT",
          );
        if (
          ![
            "SENT",
            "UNDER_NEGOTIATION",
            "CUSTOMER_ACCEPTED",
            "CONFIRMED",
          ].includes(quote.stage)
        )
          conflict("Share the quotation before replying to the customer");
        if (
          input.quoteLineId &&
          !quote.currentVersion.lines.some(
            (line) => line.id === input.quoteLineId,
          )
        )
          notFound("Quotation line");
        const thread = await transaction.negotiationThread.upsert({
          where: {
            organizationId_quoteId: {
              organizationId: actor.organizationId,
              quoteId,
            },
          },
          update: {},
          create: {
            organizationId: actor.organizationId,
            quoteId,
            customerAccountId: quote.customerAccountId,
          },
        });
        const created = await transaction.negotiationMessage.create({
          data: {
            organizationId: actor.organizationId,
            threadId: thread.id,
            quoteVersionId: quote.currentVersion.id,
            quoteLineId: input.quoteLineId,
            authorType: "USER",
            authorUserId: actor.userId,
            body: input.body,
            visibility: "BOTH",
          },
        });
        await recordActivity(transaction, {
          organizationId: actor.organizationId,
          actor,
          eventType: "deal.activityRecorded",
          entityType: "NegotiationMessage",
          entityId: created.id,
          quoteId,
          title: "Sales team reply",
          message: input.body,
          customerVisible: true,
        });
        return created;
      });
      response
        .status(201)
        .json(
          NegotiationMessageDtoSchema.parse({
            ...(toJsonValue(message) as object),
            authorName: `${actor.firstName} ${actor.lastName}`,
          }),
        );
    },
  );

  router.get(
    "/portal/quotes",
    authenticatePortal,
    async (request, response) => {
      const actor = portalPrincipal(response);
      const query = parseQuery(ListQuerySchema, request);
      const rows = await prisma.quote.findMany({
        where: {
          organizationId: actor.organizationId,
          customerAccountId: actor.customerAccountId,
          ...(actor.quoteId ? { id: actor.quoteId } : {}),
          AND: [
            portalShareabilityWhere(actor.customerAccountId),
            {
              currentVersion: {
                is: { customerAccountId: actor.customerAccountId },
              },
            },
          ],
          ...(query.search
            ? { quoteNumber: { contains: query.search, mode: "insensitive" } }
            : {}),
        },
        select: {
          id: true,
          quoteNumber: true,
          stage: true,
          expiresAt: true,
          updatedAt: true,
          currentVersion: { select: { currency: true, total: true } },
        },
        orderBy: { id: query.direction },
        ...cursorArgs(query.cursor, query.limit),
      });
      response.json(
        PortalQuoteListDtoSchema.parse(
          pageFromRows(
            rows.map((quote) => ({
              id: quote.id,
              quoteNumber: quote.quoteNumber,
              stage: quote.stage,
              expiresAt: quote.expiresAt?.toISOString() ?? null,
              updatedAt: quote.updatedAt.toISOString(),
              currency: quote.currentVersion!.currency,
              total: quote.currentVersion!.total.toString(),
            })),
            query.limit,
          ),
        ),
      );
    },
  );

  const portalQuote = async (
    request: import("express").Request,
    response: import("express").Response,
  ) => {
    const principal = portalPrincipal(response);
    const quote = await prisma.$transaction((transaction) =>
      loadPortalQuote(transaction, principal, parsePathId(request, "quoteId")),
    );
    response.json(mapPortalQuote(quote));
  };
  router.get("/negotiation/portal/:quoteId", authenticatePortal, portalQuote);
  router.get("/portal/quotes/:quoteId", authenticatePortal, portalQuote);

  router.get(
    "/portal/quotes/:quoteId/versions",
    authenticatePortal,
    async (request, response) => {
      const principal = portalPrincipal(response);
      const history = await prisma.$transaction((transaction) =>
        loadPortalVersionHistory(
          transaction,
          principal,
          parsePathId(request, "quoteId"),
        ),
      );
      response.json(
        PortalQuoteVersionHistoryDtoSchema.parse({
          quoteId: history.quote.id,
          versions: history.versions.map((version) =>
            mapPortalVersion(version, history.quote.currentVersion.id),
          ),
        }),
      );
    },
  );

  router.get(
    "/portal/quotes/:quoteId/version-diff",
    authenticatePortal,
    async (request, response) => {
      const principal = portalPrincipal(response);
      const query = parseQuery(PortalQuoteVersionDiffQuerySchema, request);
      const history = await prisma.$transaction((transaction) =>
        loadPortalVersionHistory(
          transaction,
          principal,
          parsePathId(request, "quoteId"),
        ),
      );
      const before = history.versions.find(
        (version) => version.id === query.fromVersionId,
      );
      const after = history.versions.find(
        (version) => version.id === query.toVersionId,
      );
      if (before === undefined || after === undefined) {
        notFound("Customer-visible quote version pair");
      }
      const differences = portalVersionDifferences(before, after);
      response.json(
        PortalQuoteVersionDiffDtoSchema.parse({
          quoteId: history.quote.id,
          fromVersionId: before.id,
          toVersionId: after.id,
          fromRevision: before.revisionNumber,
          toRevision: after.revisionNumber,
          materialChange: differences.some((difference) => difference.material),
          differences,
        }),
      );
    },
  );

  const createChange = async (
    request: import("express").Request,
    response: import("express").Response,
  ) => {
    const principal = portalPrincipal(response);
    const input = parseBody(CreateChangeRequestSchema, request);
    const created = await prisma.$transaction((transaction) =>
      createCustomerChangeRequest(
        transaction,
        principal,
        parsePathId(request, "quoteId"),
        input,
      ),
    );
    response.status(201).json(mapChangeRequest(created));
  };
  router.post(
    "/negotiation/portal/:quoteId/change-request",
    authenticatePortal,
    portalRateLimit,
    requireCsrf,
    createChange,
  );
  router.post(
    "/portal/quotes/:quoteId/change-requests",
    authenticatePortal,
    portalRateLimit,
    requireCsrf,
    createChange,
  );

  router.post(
    "/portal/quotes/:quoteId/counteroffers",
    authenticatePortal,
    portalRateLimit,
    requireCsrf,
    async (request, response) => {
      const principal = portalPrincipal(response);
      const input = parseBody(
        CreateCustomerCounterproposalRequestSchema,
        request,
      );
      // Counteroffer.changeRequestId and offeredByUserId are mandatory. A
      // customer-originated quote-level proposal is therefore represented as
      // one umbrella ChangeRequest, preserving provenance without fabricating
      // an internal seller as the offer author.
      const requestedChanges = input.proposedChanges.flatMap((item) => [
        ...(item.quantity === undefined
          ? []
          : [
              {
                quoteLineId: item.quoteLineId,
                action: "CHANGE_QUANTITY" as const,
                quantity: item.quantity,
              },
            ]),
        ...(item.unitPrice === undefined
          ? []
          : [
              {
                quoteLineId: item.quoteLineId,
                action: "CHANGE_PRICE" as const,
                unitPrice: item.unitPrice,
              },
            ]),
        ...(item.discountPercent === undefined
          ? []
          : [
              {
                quoteLineId: item.quoteLineId,
                action: "CHANGE_DISCOUNT" as const,
                discountPercent: item.discountPercent,
              },
            ]),
      ]);
      const created = await prisma.$transaction((transaction) =>
        createCustomerChangeRequest(
          transaction,
          principal,
          parsePathId(request, "quoteId"),
          {
            message: input.message,
            quoteRevision: input.quoteRevision,
            termsFingerprint: input.termsFingerprint,
            requestedChanges,
          },
        ),
      );
      response
        .status(201)
        .json(
          CustomerCounterproposalDtoSchema.parse(mapChangeRequest(created)),
        );
    },
  );

  router.get(
    "/negotiation/portal/:quoteId/change-requests",
    authenticatePortal,
    async (request, response) => {
      const principal = portalPrincipal(response);
      const quoteId = parsePathId(request, "quoteId");
      const quote = await prisma.$transaction((transaction) =>
        loadPortalQuote(transaction, principal, quoteId),
      );
      const changes = await prisma.changeRequest.findMany({
        where: {
          organizationId: principal.organizationId,
          thread: { quoteId: quote.id },
        },
        include: changeRequestInclude,
        orderBy: { createdAt: "desc" },
      });
      response.json(changes.map(mapChangeRequest));
    },
  );

  router.get(
    "/portal/quotes/:quoteId/comments",
    authenticatePortal,
    async (request, response) => {
      const principal = portalPrincipal(response);
      const quoteId = parsePathId(request, "quoteId");
      const query = parseQuery(PortalNegotiationMessagesQuerySchema, request);
      const quote = await prisma.$transaction((transaction) =>
        loadPortalQuote(transaction, principal, quoteId),
      );
      const rows = await prisma.negotiationMessage.findMany({
        where: {
          organizationId: principal.organizationId,
          visibility: { in: ["CUSTOMER", "BOTH"] },
          thread: {
            quoteId: quote.id,
            customerAccountId: principal.customerAccountId,
          },
        },
        include: {
          authorUser: { select: { firstName: true, lastName: true } },
          portalIdentity: {
            include: {
              customerContact: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...cursorArgs(query.cursor, query.limit),
      });
      response.json(
        PortalNegotiationMessagesDtoSchema.parse(
          pageFromRows(
            rows.map((message) =>
              NegotiationMessageDtoSchema.parse({
                id: message.id,
                quoteVersionId: message.quoteVersionId,
                quoteLineId: message.quoteLineId,
                authorType: message.authorType,
                authorName:
                  message.authorUser === null
                    ? message.portalIdentity === null
                      ? "DealFlow360"
                      : `${message.portalIdentity.customerContact.firstName} ${message.portalIdentity.customerContact.lastName}`
                    : `${message.authorUser.firstName} ${message.authorUser.lastName}`,
                body: message.body,
                visibility: message.visibility,
                createdAt: message.createdAt.toISOString(),
              }),
            ),
            query.limit,
          ),
        ),
      );
    },
  );

  router.post(
    "/portal/quotes/:quoteId/comments",
    authenticatePortal,
    portalRateLimit,
    requireCsrf,
    async (request, response) => {
      const principal = portalPrincipal(response);
      const input = parseBody(CreateNegotiationMessageRequestSchema, request);
      const message = await prisma.$transaction(async (transaction) => {
        const quote = await loadPortalQuote(
          transaction,
          principal,
          parsePathId(request, "quoteId"),
        );
        if (quote.revision !== input.quoteRevision)
          conflict("The visible quote changed", "REVISION_CONFLICT");
        if (
          input.quoteLineId !== undefined &&
          !quote.currentVersion.lines.some(
            (line) => line.id === input.quoteLineId,
          )
        ) {
          notFound("Current shared quote line");
        }
        const thread = await transaction.negotiationThread.upsert({
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
            customerAccountId: principal.customerAccountId,
          },
        });
        const created = await transaction.negotiationMessage.create({
          data: {
            organizationId: principal.organizationId,
            threadId: thread.id,
            quoteVersionId: quote.currentVersion.id,
            quoteLineId: input.quoteLineId,
            authorType: "PORTAL",
            portalIdentityId: principal.portalIdentityId,
            body: input.body,
            visibility: "BOTH",
          },
        });
        await recordActivity(transaction, {
          organizationId: principal.organizationId,
          actor: principal,
          eventType: "deal.activityRecorded",
          entityType: "NegotiationMessage",
          entityId: created.id,
          entityVersion: quote.currentVersion.revisionNumber,
          quoteId: quote.id,
          title: "Customer comment",
          message: input.body,
          customerVisible: true,
        });
        return created;
      });
      response.status(201).json(
        NegotiationMessageDtoSchema.parse({
          id: message.id,
          quoteVersionId: message.quoteVersionId,
          quoteLineId: message.quoteLineId,
          authorType: message.authorType,
          authorName: principal.email,
          body: message.body,
          visibility: message.visibility,
          createdAt: message.createdAt.toISOString(),
        }),
      );
    },
  );

  router.post(
    "/negotiation/change-requests/:requestId/counteroffer",
    authenticateInternal,
    requireCapability("negotiation.respond"),
    requireCsrf,
    async (request, response) => {
      const principal = internalPrincipal(response);
      const input = parseBody(CreateCounterofferRequestSchema, request);
      const created = await prisma.$transaction(async (transaction) => {
        const change = await transaction.changeRequest.findFirst({
          where: {
            id: parsePathId(request, "requestId"),
            organizationId: principal.organizationId,
          },
          include: {
            ...changeRequestInclude,
            thread: {
              include: {
                quote: {
                  include: { currentVersion: { include: { lines: true } } },
                },
              },
            },
          },
        });
        if (change === null) notFound("Change request");
        assertCanEditQuote(principal, change.thread.quote);
        if (change.status !== "PENDING")
          conflict("The change request is not pending", "NEGOTIATION_CLOSED");
        const version = change.thread.quote.currentVersion;
        if (
          version === null ||
          version.id !== change.sourceQuoteVersionId ||
          version.termsFingerprint !== change.sourceTermsFingerprint
        ) {
          conflict(
            "The change request is based on superseded terms",
            "TERMS_CHANGED",
          );
        }
        const lineIds = new Set(version.lines.map((line) => line.id));
        if (
          input.proposedChanges.some((item) => !lineIds.has(item.quoteLineId))
        ) {
          notFound("Current counteroffer quote line");
        }
        const counteroffer = await transaction.counteroffer.create({
          data: {
            organizationId: principal.organizationId,
            changeRequestId: change.id,
            sourceQuoteVersionId: version.id,
            sourceTermsFingerprint: version.termsFingerprint,
            offeredByUserId: principal.userId,
            message: input.message,
            items: {
              create: input.proposedChanges.map((item) => ({
                organizationId: principal.organizationId,
                quoteLineId: item.quoteLineId,
                proposedQuantity: item.quantity,
                proposedUnitPrice: item.unitPrice,
                proposedDiscountPercent: item.discountPercent,
              })),
            },
          },
          include: counterofferInclude,
        });
        await transaction.changeRequest.update({
          where: { id: change.id },
          data: { status: "COUNTERED", resolvedByUserId: principal.userId },
        });
        return counteroffer;
      });
      response.status(201).json(mapCounteroffer(created));
    },
  );

  const resolveChange = (action: "ACCEPT" | "REJECT") =>
    [
      authenticateInternal,
      requireCapability("negotiation.respond"),
      requireCsrf,
      async (
        request: import("express").Request,
        response: import("express").Response,
      ) => {
        const principal = internalPrincipal(response);
        const input = parseBody(NegotiationDecisionRequestSchema, request);
        const requestId = parsePathId(request, "requestId");
        const updated = await prisma.$transaction(async (transaction) => {
          const change = await transaction.changeRequest.findFirst({
            where: { id: requestId, organizationId: principal.organizationId },
            include: {
              ...changeRequestInclude,
              thread: {
                include: { quote: { include: { currentVersion: true } } },
              },
            },
          });
          if (change === null) notFound("Change request");
          assertCanEditQuote(principal, change.thread.quote);
          if (change.status !== "PENDING")
            conflict("The change request is not pending", "NEGOTIATION_CLOSED");
          if (action === "REJECT") {
            const claimed = await transaction.changeRequest.updateMany({
              where: {
                id: change.id,
                organizationId: principal.organizationId,
                status: "PENDING",
              },
              data: {
                status: "REJECTED",
                resolvedByUserId: principal.userId,
                resolutionReason: input.reason,
                resolvedAt: new Date(),
              },
            });
            if (claimed.count !== 1)
              conflict("The request was already resolved", "DECISION_RACE");
          } else {
            const changes: NegotiatedCommercialChange[] = change.items.map(
              (item) => ({
                quoteLineId: item.quoteLineId,
                action: item.action,
                quantity: item.requestedQuantity,
                unitPrice: item.requestedUnitPrice,
                discountPercent: item.requestedDiscountPercent,
                terms:
                  item.requestedTerms === null
                    ? null
                    : jsonObject(item.requestedTerms),
              }),
            );
            const revised = await applyNegotiatedChanges(transaction, {
              organizationId: principal.organizationId,
              quoteId: change.thread.quoteId,
              sourceQuoteVersionId: change.sourceQuoteVersionId,
              sourceTermsFingerprint: change.sourceTermsFingerprint,
              actor: principal,
              createdById: principal.userId,
              changes,
              reason: `Accepted customer change request ${change.id}`,
            });
            await submitQuote(
              transaction,
              principal,
              revised.id,
              revised.revision,
            );
            await transaction.changeRequest.update({
              where: { id: change.id },
              data: {
                status: "ACCEPTED",
                resolvedByUserId: principal.userId,
                resolutionReason: input.reason,
                resultingQuoteVersionId: revised.currentVersion.id,
                resolvedAt: new Date(),
              },
            });
          }
          const result = await transaction.changeRequest.findUnique({
            where: { id: change.id },
            include: changeRequestInclude,
          });
          if (result === null) notFound("Change request");
          return result;
        });
        response.json(mapChangeRequest(updated));
      },
    ] as const;

  router.post(
    "/negotiation/change-requests/:requestId/accept",
    ...resolveChange("ACCEPT"),
  );
  router.post(
    "/negotiation/change-requests/:requestId/reject",
    ...resolveChange("REJECT"),
  );

  const decideCounteroffer = (action: "ACCEPT" | "REJECT") =>
    [
      authenticatePortal,
      portalRateLimit,
      requireCsrf,
      async (
        request: import("express").Request,
        response: import("express").Response,
      ) => {
        const principal = portalPrincipal(response);
        const input = parseBody(NegotiationDecisionRequestSchema, request);
        const counterofferId = parsePathId(request, "counterofferId");
        const updated = await prisma.$transaction(async (transaction) => {
          const counteroffer = await transaction.counteroffer.findFirst({
            where: {
              id: counterofferId,
              organizationId: principal.organizationId,
            },
            include: {
              ...counterofferInclude,
              offeredByUser: {
                include: {
                  roleAssignments: {
                    where: {
                      active: true,
                      organizationId: principal.organizationId,
                    },
                  },
                },
              },
              changeRequest: {
                include: {
                  thread: {
                    include: { quote: { include: { currentVersion: true } } },
                  },
                },
              },
            },
          });
          if (counteroffer === null) notFound("Counteroffer");
          const quoteId = counteroffer.changeRequest.thread.quoteId;
          await loadPortalQuote(transaction, principal, quoteId);
          if (counteroffer.status !== "PENDING")
            conflict(
              "The counteroffer was already decided",
              "NEGOTIATION_CLOSED",
            );
          if (action === "REJECT") {
            const claimed = await transaction.counteroffer.updateMany({
              where: { id: counteroffer.id, status: "PENDING" },
              data: {
                status: "REJECTED",
                customerDecisionPortalId: principal.portalIdentityId,
                customerDecisionReason: input.reason,
                decidedAt: new Date(),
              },
            });
            if (claimed.count !== 1)
              conflict("The counteroffer was already decided", "DECISION_RACE");
          } else {
            const seller = actorPrincipal(counteroffer.offeredByUser);
            const changes: NegotiatedCommercialChange[] =
              counteroffer.items.map((item) => ({
                quoteLineId: item.quoteLineId,
                action:
                  item.proposedQuantity !== null
                    ? "CHANGE_QUANTITY"
                    : item.proposedUnitPrice !== null
                      ? "CHANGE_PRICE"
                      : "CHANGE_DISCOUNT",
                quantity: item.proposedQuantity,
                unitPrice: item.proposedUnitPrice,
                discountPercent: item.proposedDiscountPercent,
              }));
            const revised = await applyNegotiatedChanges(transaction, {
              organizationId: principal.organizationId,
              quoteId,
              sourceQuoteVersionId: counteroffer.sourceQuoteVersionId,
              sourceTermsFingerprint: counteroffer.sourceTermsFingerprint,
              actor: principal,
              createdById: counteroffer.offeredByUserId,
              changes,
              reason: `Customer accepted counteroffer ${counteroffer.id}`,
            });
            await transaction.customerAcceptance.upsert({
              where: {
                organizationId_quoteVersionId_acceptedFingerprint: {
                  organizationId: principal.organizationId,
                  quoteVersionId: revised.currentVersion.id,
                  acceptedFingerprint: revised.currentVersion.termsFingerprint,
                },
              },
              update: {
                portalIdentityId: principal.portalIdentityId,
                acceptedAt: new Date(),
              },
              create: {
                organizationId: principal.organizationId,
                quoteId,
                quoteVersionId: revised.currentVersion.id,
                portalIdentityId: principal.portalIdentityId,
                acceptedFingerprint: revised.currentVersion.termsFingerprint,
              },
            });
            await submitQuote(
              transaction,
              seller,
              revised.id,
              revised.revision,
            );
            await transaction.counteroffer.update({
              where: { id: counteroffer.id },
              data: {
                status: "ACCEPTED",
                customerDecisionPortalId: principal.portalIdentityId,
                customerDecisionReason: input.reason,
                resultingQuoteVersionId: revised.currentVersion.id,
                decidedAt: new Date(),
              },
            });
            await transaction.changeRequest.update({
              where: { id: counteroffer.changeRequestId },
              data: {
                status: "ACCEPTED",
                resultingQuoteVersionId: revised.currentVersion.id,
                resolvedAt: new Date(),
              },
            });
            await recordActivity(transaction, {
              organizationId: principal.organizationId,
              actor: principal,
              eventType: "customer.accepted",
              entityType: "Counteroffer",
              entityId: counteroffer.id,
              entityVersion: revised.currentVersion.revisionNumber,
              termsFingerprint: revised.currentVersion.termsFingerprint,
              quoteId,
              title: "Customer accepted counteroffer",
              customerVisible: true,
            });
          }
          const result = await transaction.counteroffer.findUnique({
            where: { id: counteroffer.id },
            include: counterofferInclude,
          });
          if (result === null) notFound("Counteroffer");
          return result;
        });
        response.json(mapCounteroffer(updated));
      },
    ] as const;

  router.post(
    "/negotiation/portal/counteroffers/:counterofferId/accept",
    ...decideCounteroffer("ACCEPT"),
  );
  router.post(
    "/negotiation/portal/counteroffers/:counterofferId/reject",
    ...decideCounteroffer("REJECT"),
  );

  router.post(
    "/portal/quotes/:quoteId/confirm",
    authenticatePortal,
    portalRateLimit,
    requireCsrf,
    async (request, response) => {
      const principal = portalPrincipal(response);
      const input = parseBody(PortalQuoteConfirmationRequestSchema, request);
      const quoteId = parsePathId(request, "quoteId");
      const result = await runIdempotent(
        request,
        principal,
        "portal.confirm-quote",
        { quoteId, ...input },
        async (transaction) => {
          const quote = await loadPortalQuote(transaction, principal, quoteId);
          if (
            quote.currentVersion.termsFingerprint !== input.termsFingerprint
          ) {
            conflict(
              "The submitted fingerprint does not match the visible terms",
              "TERMS_CHANGED",
            );
          }

          // A retry with a different idempotency key is still side-effect free.
          // CustomerAcceptance is unique for an exact immutable terms snapshot.
          const existing = await transaction.customerAcceptance.findUnique({
            where: {
              organizationId_quoteVersionId_acceptedFingerprint: {
                organizationId: principal.organizationId,
                quoteVersionId: quote.currentVersion.id,
                acceptedFingerprint: input.termsFingerprint,
              },
            },
          });
          if (existing !== null) {
            return {
              status: 200,
              body: PortalQuoteConfirmationResponseSchema.parse({
                accepted: true,
                acceptedAt: existing.acceptedAt.toISOString(),
                quoteId: existing.quoteId,
                quoteVersionId: existing.quoteVersionId,
              }),
              entityType: "CustomerAcceptance",
              entityId: existing.id,
            };
          }

          const portalDto = mapPortalQuote(quote);
          if (!portalDto.canConfirm) {
            conflict(
              "The quote is not ready for confirmation",
              "QUOTE_NOT_CONFIRMABLE",
            );
          }
          if (quote.revision !== input.revision) {
            conflict("The visible quote changed", "REVISION_CONFLICT");
          }

          // Claim the exact quote revision before writing acceptance. The
          // tenant, version, fingerprint, and permitted state are all part of
          // the compare-and-swap so parallel confirmations cannot both win.
          const claimed = await transaction.quote.updateMany({
            where: {
              id: quote.id,
              organizationId: principal.organizationId,
              customerAccountId: principal.customerAccountId,
              currentVersionId: quote.currentVersion.id,
              revision: input.revision,
              stage: { in: ["SENT", "UNDER_NEGOTIATION"] },
              currentVersion: {
                is: {
                  termsFingerprint: input.termsFingerprint,
                  status: { in: ["READY_TO_SEND", "APPROVED"] },
                },
              },
            },
            data: { stage: "CUSTOMER_ACCEPTED", revision: { increment: 1 } },
          });
          if (claimed.count !== 1) {
            conflict(
              "The visible quote changed while it was being confirmed",
              "REVISION_CONFLICT",
            );
          }
          const versionClaimed = await transaction.quoteVersion.updateMany({
            where: {
              id: quote.currentVersion.id,
              organizationId: principal.organizationId,
              termsFingerprint: input.termsFingerprint,
              status: { in: ["READY_TO_SEND", "APPROVED"] },
            },
            data: { status: "CUSTOMER_ACCEPTED" },
          });
          if (versionClaimed.count !== 1) {
            conflict(
              "The commercial terms changed while they were being confirmed",
              "TERMS_CHANGED",
            );
          }
          const accepted = await transaction.customerAcceptance.create({
            data: {
              organizationId: principal.organizationId,
              quoteId: quote.id,
              quoteVersionId: quote.currentVersion.id,
              portalIdentityId: principal.portalIdentityId,
              acceptedFingerprint: input.termsFingerprint,
            },
          });
          await transaction.negotiationThread.updateMany({
            where: {
              organizationId: principal.organizationId,
              quoteId: quote.id,
              status: "OPEN",
            },
            data: { status: "CLOSED", closedAt: new Date() },
          });
          await recordActivity(transaction, {
            organizationId: principal.organizationId,
            actor: principal,
            eventType: "customer.accepted",
            entityType: "CustomerAcceptance",
            entityId: accepted.id,
            entityVersion: quote.currentVersion.revisionNumber,
            termsFingerprint: input.termsFingerprint,
            quoteId: quote.id,
            title: "Customer accepted quote",
            customerVisible: true,
          });
          return {
            status: 200,
            body: PortalQuoteConfirmationResponseSchema.parse({
              accepted: true,
              acceptedAt: accepted.acceptedAt.toISOString(),
              quoteId: accepted.quoteId,
              quoteVersionId: accepted.quoteVersionId,
            }),
            entityType: "CustomerAcceptance",
            entityId: accepted.id,
          };
        },
      );
      response.status(result.status).json(result.body);
    },
  );

  return router;
}
