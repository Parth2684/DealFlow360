import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import {
  createQuoteSchema,
  createQuoteLineSchema,
  calculateQuoteSchema,
  submitQuoteSchema,
  Capabilities,
} from "@repo/contracts";
import { quoteService } from "./service.js";
import {
  asyncHandler,
  requireAuth,
  validateBody,
  validateParams,
} from "../../middleware/validate.js";
import { requireCapability } from "../../middleware/auth.js";

export const quotesRouter: ExpressRouter = Router();

const quoteIdParam = z.object({ quoteId: z.string() });

quotesRouter.get(
  "/",
  requireAuth,
  requireCapability(Capabilities.QUOTATION_VIEW),
  asyncHandler(async (req, res) => {
    const quotes = await quoteService.list(req.auth!);
    res.json({ items: quotes });
  }),
);

quotesRouter.get(
  "/:quoteId",
  requireAuth,
  requireCapability(Capabilities.QUOTATION_VIEW),
  validateParams(quoteIdParam),
  asyncHandler(async (req, res) => {
    const quote = await quoteService.get(req.auth!, req.params.quoteId as string);
    res.json(quote);
  }),
);

quotesRouter.post(
  "/",
  requireAuth,
  requireCapability(Capabilities.QUOTATION_CREATE),
  validateBody(createQuoteSchema),
  asyncHandler(async (req, res) => {
    const quote = await quoteService.create(req.auth!, req.body);
    res.status(201).json(quote);
  }),
);

quotesRouter.post(
  "/:quoteId/lines",
  requireAuth,
  requireCapability(Capabilities.QUOTATION_EDIT_OWN),
  validateParams(quoteIdParam),
  validateBody(createQuoteLineSchema),
  asyncHandler(async (req, res) => {
    const quote = await quoteService.addLine(
      req.auth!,
      req.params.quoteId as string,
      req.body,
    );
    res.status(201).json(quote);
  }),
);

quotesRouter.post(
  "/:quoteId/calculate",
  requireAuth,
  requireCapability(Capabilities.QUOTATION_VIEW),
  validateParams(quoteIdParam),
  validateBody(calculateQuoteSchema),
  asyncHandler(async (req, res) => {
    const result = await quoteService.calculate(
      req.auth!,
      req.params.quoteId as string,
      req.body.revision,
    );
    res.json(result);
  }),
);

quotesRouter.post(
  "/:quoteId/submit",
  requireAuth,
  requireCapability(Capabilities.QUOTATION_SUBMIT),
  validateParams(quoteIdParam),
  validateBody(submitQuoteSchema),
  asyncHandler(async (req, res) => {
    const quote = await quoteService.submit(
      req.auth!,
      req.params.quoteId as string,
      req.body.revision,
    );
    res.json(quote);
  }),
);
