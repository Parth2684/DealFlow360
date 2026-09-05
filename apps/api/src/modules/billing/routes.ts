import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { billingService } from "./service.js";
import {
  asyncHandler,
  requireAuth,
  validateBody,
  validateParams,
} from "../../middleware/validate.js";
import { Capabilities } from "@repo/contracts";
import { requireCapability } from "../../middleware/auth.js";

export const billingRouter: ExpressRouter = Router();

const invoiceIdParam = z.object({ invoiceId: z.string() });

// Invoices
billingRouter.get(
  "/invoices",
  requireAuth,
  requireCapability(Capabilities.BILLING_VIEW),
  asyncHandler(async (req, res) => {
    const invoices = await billingService.listInvoices(req.auth!);
    res.json({ items: invoices });
  }),
);

billingRouter.get(
  "/invoices/:invoiceId",
  requireAuth,
  requireCapability(Capabilities.BILLING_VIEW),
  validateParams(invoiceIdParam),
  asyncHandler(async (req, res) => {
    const invoice = await billingService.getInvoice(req.auth!, req.params.invoiceId);
    res.json(invoice);
  }),
);

billingRouter.post(
  "/invoices/:invoiceId/issue",
  requireAuth,
  requireCapability(Capabilities.BILLING_RECORD_PAYMENT),
  validateParams(invoiceIdParam),
  asyncHandler(async (req, res) => {
    const invoice = await billingService.issueInvoice(req.auth!, req.params.invoiceId);
    res.json(invoice);
  }),
);

// Payments
billingRouter.get(
  "/invoices/:invoiceId/payments",
  requireAuth,
  requireCapability(Capabilities.BILLING_VIEW),
  validateParams(invoiceIdParam),
  asyncHandler(async (req, res) => {
    const payments = await billingService.listPayments(req.auth!, req.params.invoiceId);
    res.json({ items: payments });
  }),
);

billingRouter.post(
  "/invoices/:invoiceId/payments",
  requireAuth,
  requireCapability(Capabilities.BILLING_RECORD_PAYMENT),
  validateParams(invoiceIdParam),
  validateBody(z.object({
    amount: z.string(),
    method: z.enum(["BANK_TRANSFER", "CREDIT_CARD", "CHECK", "OTHER"]),
    reference: z.string().optional(),
    paymentDate: z.string().optional(),
  })),
  asyncHandler(async (req, res) => {
    const payment = await billingService.recordPayment(req.auth!, req.params.invoiceId, req.body);
    res.status(201).json(payment);
  }),
);

// Credit Notes
billingRouter.get(
  "/credit-notes",
  requireAuth,
  requireCapability(Capabilities.BILLING_VIEW),
  asyncHandler(async (req, res) => {
    const creditNotes = await billingService.listCreditNotes(req.auth!);
    res.json({ items: creditNotes });
  }),
);

billingRouter.post(
  "/credit-notes/:creditNoteId/apply",
  requireAuth,
  requireCapability(Capabilities.BILLING_RECORD_PAYMENT),
  validateParams(z.object({ creditNoteId: z.string() })),
  validateBody(z.object({ invoiceId: z.string() })),
  asyncHandler(async (req, res) => {
    const result = await billingService.applyCreditNote(req.auth!, req.params.creditNoteId, req.body.invoiceId);
    res.json(result);
  }),
);
