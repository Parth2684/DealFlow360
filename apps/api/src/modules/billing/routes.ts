import { Router, type RequestHandler } from "express";

import {
  ApplyCreditNoteRequestSchema,
  IssueInvoiceRequestSchema,
  ListQuerySchema,
  RecordPaymentRequestSchema,
  SubscriptionCancellationPreviewRequestSchema,
  SubscriptionCancelRequestSchema,
  SubscriptionChangeRequestSchema,
} from "@repo/common";
import { prisma } from "@repo/db";

import {
  authenticateInternal,
  internalPrincipal,
  requireCapability,
  requireCsrf,
} from "../../middleware/auth.js";
import { conflict, notFound } from "../../shared/errors.js";
import {
  cursorArgs,
  pageFromRows,
  parseBody,
  parsePathId,
  parseQuery,
} from "../../shared/http.js";
import { runIdempotent } from "../../shared/idempotency.js";
import {
  invoiceVisibilityWhere,
  orderVisibilityWhere,
} from "../operations/access.js";
import {
  mapBillingSchedule,
  mapCreditNote,
  mapInvoice,
  mapInvoiceSummary,
  mapPayment,
  mapSubscription,
  mapSubscriptionSummary,
} from "./mappers.js";
import {
  calculateCancellation,
  calculateSubscriptionChange,
  type SubscriptionForProration,
} from "./proration.js";
import {
  applyCreditNote,
  applySubscriptionChange,
  cancelSubscription,
  issueInvoice,
  recordPayment,
} from "./service.js";

function subscriptionSearch(search: string | undefined) {
  if (search === undefined) return {};
  return {
    OR: [
      {
        subscriptionNumber: { contains: search, mode: "insensitive" as const },
      },
      {
        customerAccount: {
          name: { contains: search, mode: "insensitive" as const },
        },
      },
      {
        subscriptionPlan: {
          name: { contains: search, mode: "insensitive" as const },
        },
      },
    ],
  };
}

function invoiceSearch(search: string | undefined) {
  if (search === undefined) return {};
  return {
    OR: [
      { invoiceNumber: { contains: search, mode: "insensitive" as const } },
      {
        customerAccount: {
          name: { contains: search, mode: "insensitive" as const },
        },
      },
    ],
  };
}

export function createBillingRouter(): Router {
  const router = Router();

  router.get(
    "/subscriptions",
    authenticateInternal,
    requireCapability("subscription.read"),
    async (request, response) => {
      const actor = internalPrincipal(response);
      const query = parseQuery(ListQuerySchema, request);
      const subscriptions = await prisma.subscription.findMany({
        where: {
          organizationId: actor.organizationId,
          AND: [
            { order: orderVisibilityWhere(actor) },
            subscriptionSearch(query.search),
          ],
        },
        include: { customerAccount: true, subscriptionPlan: true },
        orderBy: { id: query.direction },
        ...cursorArgs(query.cursor, query.limit),
      });
      response.json(
        pageFromRows(subscriptions.map(mapSubscriptionSummary), query.limit),
      );
    },
  );

  router.get(
    "/subscriptions/:subscriptionId",
    authenticateInternal,
    requireCapability("subscription.read"),
    async (request, response) => {
      const actor = internalPrincipal(response);
      const subscriptionId = parsePathId(request, "subscriptionId");
      const subscription = await prisma.subscription.findFirst({
        where: {
          id: subscriptionId,
          organizationId: actor.organizationId,
          order: orderVisibilityWhere(actor),
        },
        include: {
          customerAccount: true,
          subscriptionPlan: true,
          items: { orderBy: { id: "asc" } },
        },
      });
      if (subscription === null) notFound("Subscription");
      response.json(mapSubscription(subscription));
    },
  );

  router.post(
    "/subscriptions/:subscriptionId/preview-change",
    authenticateInternal,
    requireCapability("subscription.manage"),
    requireCsrf,
    async (request, response) => {
      const actor = internalPrincipal(response);
      const subscriptionId = parsePathId(request, "subscriptionId");
      const input = parseBody(SubscriptionChangeRequestSchema, request);
      const subscription = await prisma.subscription.findFirst({
        where: {
          id: subscriptionId,
          organizationId: actor.organizationId,
          order: orderVisibilityWhere(actor),
        },
        include: {
          customerAccount: true,
          subscriptionPlan: true,
          items: { orderBy: { id: "asc" } },
        },
      });
      if (subscription === null) notFound("Subscription");
      if (
        input.revision !== undefined &&
        input.revision !== subscription.revision
      ) {
        conflict(
          "The subscription changed after this request was prepared",
          "STALE_REVISION",
        );
      }
      const nextPlan =
        input.planId === undefined
          ? null
          : await prisma.subscriptionPlan.findFirst({
              where: {
                id: input.planId,
                organizationId: actor.organizationId,
                status: "ACTIVE",
              },
            });
      response.json(
        calculateSubscriptionChange(
          subscription as SubscriptionForProration,
          input,
          nextPlan,
        ).dto,
      );
    },
  );

  router.post(
    "/subscriptions/:subscriptionId/preview-cancellation",
    authenticateInternal,
    requireCapability("subscription.manage"),
    requireCsrf,
    async (request, response) => {
      const actor = internalPrincipal(response);
      const subscriptionId = parsePathId(request, "subscriptionId");
      const input = parseBody(
        SubscriptionCancellationPreviewRequestSchema,
        request,
      );
      const subscription = await prisma.subscription.findFirst({
        where: {
          id: subscriptionId,
          organizationId: actor.organizationId,
          order: orderVisibilityWhere(actor),
        },
        include: {
          customerAccount: true,
          subscriptionPlan: true,
          items: { orderBy: { id: "asc" } },
        },
      });
      if (subscription === null) notFound("Subscription");
      if (
        input.revision !== undefined &&
        input.revision !== subscription.revision
      ) {
        conflict(
          "The subscription changed after this request was prepared",
          "STALE_REVISION",
        );
      }
      response.json(
        calculateCancellation(subscription as SubscriptionForProration, input)
          .dto,
      );
    },
  );

  router.post(
    "/subscriptions/:subscriptionId/change",
    authenticateInternal,
    requireCapability("subscription.manage"),
    requireCsrf,
    async (request, response) => {
      const actor = internalPrincipal(response);
      const subscriptionId = parsePathId(request, "subscriptionId");
      const input = parseBody(SubscriptionChangeRequestSchema, request);
      const result = await runIdempotent(
        request,
        actor,
        "subscription.change",
        { subscriptionId, ...input },
        async (transaction) => ({
          status: 200,
          body: await applySubscriptionChange(
            transaction,
            actor.organizationId,
            subscriptionId,
            input,
            actor,
          ),
          entityType: "Subscription",
          entityId: subscriptionId,
        }),
      );
      response.status(result.status).json(result.body);
    },
  );

  router.post(
    "/subscriptions/:subscriptionId/cancel",
    authenticateInternal,
    requireCapability("subscription.manage"),
    requireCsrf,
    async (request, response) => {
      const actor = internalPrincipal(response);
      const subscriptionId = parsePathId(request, "subscriptionId");
      const input = parseBody(SubscriptionCancelRequestSchema, request);
      const result = await runIdempotent(
        request,
        actor,
        "subscription.cancel",
        { subscriptionId, ...input },
        async (transaction) => ({
          status: 200,
          body: await cancelSubscription(
            transaction,
            actor.organizationId,
            subscriptionId,
            input,
            actor,
          ),
          entityType: "Subscription",
          entityId: subscriptionId,
        }),
      );
      response.status(result.status).json(result.body);
    },
  );

  router.get(
    "/subscriptions/:subscriptionId/schedules",
    authenticateInternal,
    requireCapability("subscription.read"),
    async (request, response) => {
      const actor = internalPrincipal(response);
      const subscriptionId = parsePathId(request, "subscriptionId");
      const subscription = await prisma.subscription.findFirst({
        where: {
          id: subscriptionId,
          organizationId: actor.organizationId,
          order: orderVisibilityWhere(actor),
        },
        select: { id: true },
      });
      if (subscription === null) notFound("Subscription");
      const schedules = await prisma.billingSchedule.findMany({
        where: { organizationId: actor.organizationId, subscriptionId },
        orderBy: [{ periodStart: "asc" }, { id: "asc" }],
      });
      response.json(schedules.map(mapBillingSchedule));
    },
  );

  const listInvoices: RequestHandler = async (request, response) => {
    const actor = internalPrincipal(response);
    const query = parseQuery(ListQuerySchema, request);
    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId: actor.organizationId,
        AND: [invoiceVisibilityWhere(actor), invoiceSearch(query.search)],
      },
      include: { customerAccount: true },
      orderBy: { id: query.direction },
      ...cursorArgs(query.cursor, query.limit),
    });
    response.json(pageFromRows(invoices.map(mapInvoiceSummary), query.limit));
  };
  router.get(
    "/billing/invoices",
    authenticateInternal,
    requireCapability("billing.read"),
    listInvoices,
  );
  router.get(
    "/invoices",
    authenticateInternal,
    requireCapability("billing.read"),
    listInvoices,
  );

  router.get(
    "/billing/invoices/:invoiceId",
    authenticateInternal,
    requireCapability("billing.read"),
    async (request, response) => {
      const actor = internalPrincipal(response);
      const invoiceId = parsePathId(request, "invoiceId");
      const invoice = await prisma.invoice.findFirst({
        where: {
          id: invoiceId,
          organizationId: actor.organizationId,
          ...invoiceVisibilityWhere(actor),
        },
        include: {
          customerAccount: true,
          lines: { orderBy: { position: "asc" } },
        },
      });
      if (invoice === null) notFound("Invoice");
      response.json(mapInvoice(invoice));
    },
  );

  router.post(
    "/billing/invoices/:invoiceId/issue",
    authenticateInternal,
    requireCapability("billing.issueInvoice"),
    requireCsrf,
    async (request, response) => {
      const actor = internalPrincipal(response);
      const invoiceId = parsePathId(request, "invoiceId");
      const input = parseBody(IssueInvoiceRequestSchema, request);
      const result = await runIdempotent(
        request,
        actor,
        "billing.issue-invoice",
        { invoiceId, ...input },
        async (transaction) => ({
          status: 200,
          body: await issueInvoice(
            transaction,
            actor.organizationId,
            invoiceId,
            input.revision,
            actor,
          ),
          entityType: "Invoice",
          entityId: invoiceId,
        }),
      );
      response.status(result.status).json(result.body);
    },
  );

  router.get(
    "/billing/invoices/:invoiceId/payments",
    authenticateInternal,
    requireCapability("billing.read"),
    async (request, response) => {
      const actor = internalPrincipal(response);
      const invoiceId = parsePathId(request, "invoiceId");
      const invoice = await prisma.invoice.findFirst({
        where: {
          id: invoiceId,
          organizationId: actor.organizationId,
          ...invoiceVisibilityWhere(actor),
        },
        select: { id: true },
      });
      if (invoice === null) notFound("Invoice");
      const payments = await prisma.payment.findMany({
        where: { organizationId: actor.organizationId, invoiceId },
        include: { recordedBy: true },
        orderBy: [{ paymentDate: "desc" }, { id: "desc" }],
      });
      response.json(payments.map(mapPayment));
    },
  );

  const createPayment: RequestHandler = async (request, response) => {
    const actor = internalPrincipal(response);
    const invoiceId = parsePathId(request, "invoiceId");
    const input = parseBody(RecordPaymentRequestSchema, request);
    const result = await runIdempotent(
      request,
      actor,
      "billing.record-payment",
      { invoiceId, ...input },
      async (transaction) => {
        const body = await recordPayment(
          transaction,
          actor.organizationId,
          invoiceId,
          input,
          actor,
        );
        return {
          status: 201,
          body,
          entityType: "Payment",
          entityId: body.id,
        };
      },
    );
    response.status(result.status).json(result.body);
  };
  router.post(
    "/billing/invoices/:invoiceId/payments",
    authenticateInternal,
    requireCapability("billing.recordPayment"),
    requireCsrf,
    createPayment,
  );
  router.post(
    "/invoices/:invoiceId/payments",
    authenticateInternal,
    requireCapability("billing.recordPayment"),
    requireCsrf,
    createPayment,
  );

  router.get(
    "/billing/credit-notes",
    authenticateInternal,
    requireCapability("billing.read"),
    async (request, response) => {
      const actor = internalPrincipal(response);
      const query = parseQuery(ListQuerySchema, request);
      const notes = await prisma.creditNote.findMany({
        where: {
          organizationId: actor.organizationId,
          sourceInvoice: invoiceVisibilityWhere(actor),
          ...(query.search === undefined
            ? {}
            : {
                creditNoteNumber: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              }),
        },
        include: { lines: { orderBy: { position: "asc" } } },
        orderBy: { id: query.direction },
        ...cursorArgs(query.cursor, query.limit),
      });
      response.json(pageFromRows(notes.map(mapCreditNote), query.limit));
    },
  );

  router.post(
    "/billing/credit-notes/:creditNoteId/apply",
    authenticateInternal,
    requireCapability("billing.manageCredit"),
    requireCsrf,
    async (request, response) => {
      const actor = internalPrincipal(response);
      const creditNoteId = parsePathId(request, "creditNoteId");
      const input = parseBody(ApplyCreditNoteRequestSchema, request);
      const result = await runIdempotent(
        request,
        actor,
        "billing.apply-credit-note",
        { creditNoteId, ...input },
        async (transaction) => ({
          status: 200,
          body: await applyCreditNote(
            transaction,
            actor.organizationId,
            creditNoteId,
            input,
            actor,
          ),
          entityType: "CreditNote",
          entityId: creditNoteId,
        }),
      );
      response.status(result.status).json(result.body);
    },
  );

  return router;
}
