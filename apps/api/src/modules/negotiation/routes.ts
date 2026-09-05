import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { negotiationService } from "./service.js";
import {
  asyncHandler,
  requireAuth,
  validateBody,
  validateParams,
} from "../../middleware/validate.js";
import { Capabilities } from "@repo/contracts";
import { requireCapability } from "../../middleware/auth.js";

export const negotiationRouter: ExpressRouter = Router();

const quoteIdParam = z.object({ quoteId: z.string() });
const requestIdParam = z.object({ requestId: z.string() });

// Customer Portal - View quote for negotiation
negotiationRouter.get(
  "/portal/:quoteId",
  requireAuth,
  requireCapability(Capabilities.CUSTOMER_PORTAL),
  validateParams(quoteIdParam),
  asyncHandler(async (req, res) => {
    const quote = await negotiationService.getPortalQuote(req.auth!, req.params.quoteId);
    res.json(quote);
  }),
);

// Change Requests
negotiationRouter.post(
  "/portal/:quoteId/change-request",
  requireAuth,
  requireCapability(Capabilities.CUSTOMER_PORTAL),
  validateParams(quoteIdParam),
  validateBody(z.object({
    message: z.string(),
    requestedChanges: z.array(z.object({
      quoteLineId: z.string(),
      action: z.enum(["REMOVE", "CHANGE_QUANTITY", "CHANGE_PRICE"]),
      quantity: z.string().optional(),
      unitPrice: z.string().optional(),
    })),
  })),
  asyncHandler(async (req, res) => {
    const request = await negotiationService.createChangeRequest(req.auth!, req.params.quoteId, req.body);
    res.status(201).json(request);
  }),
);

negotiationRouter.get(
  "/portal/:quoteId/change-requests",
  requireAuth,
  requireCapability(Capabilities.CUSTOMER_PORTAL),
  validateParams(quoteIdParam),
  asyncHandler(async (req, res) => {
    const requests = await negotiationService.listChangeRequests(req.auth!, req.params.quoteId);
    res.json({ items: requests });
  }),
);

// Counteroffers (Internal)
negotiationRouter.post(
  "/change-requests/:requestId/counteroffer",
  requireAuth,
  requireCapability(Capabilities.QUOTATION_EDIT_OWN),
  validateParams(requestIdParam),
  validateBody(z.object({
    message: z.string(),
    proposedChanges: z.array(z.object({
      quoteLineId: z.string(),
      quantity: z.string().optional(),
      unitPrice: z.string().optional(),
      discountPercent: z.string().optional(),
    })),
  })),
  asyncHandler(async (req, res) => {
    const counteroffer = await negotiationService.createCounteroffer(req.auth!, req.params.requestId, req.body);
    res.status(201).json(counteroffer);
  }),
);

negotiationRouter.post(
  "/change-requests/:requestId/accept",
  requireAuth,
  requireCapability(Capabilities.QUOTATION_EDIT_OWN),
  validateParams(requestIdParam),
  asyncHandler(async (req, res) => {
    const result = await negotiationService.acceptChangeRequest(req.auth!, req.params.requestId);
    res.json(result);
  }),
);

negotiationRouter.post(
  "/change-requests/:requestId/reject",
  requireAuth,
  requireCapability(Capabilities.QUOTATION_EDIT_OWN),
  validateParams(requestIdParam),
  validateBody(z.object({ reason: z.string() })),
  asyncHandler(async (req, res) => {
    const result = await negotiationService.rejectChangeRequest(req.auth!, req.params.requestId, req.body.reason);
    res.json(result);
  }),
);

// Customer Accept Counteroffer
negotiationRouter.post(
  "/portal/counteroffers/:counterofferId/accept",
  requireAuth,
  requireCapability(Capabilities.CUSTOMER_PORTAL),
  validateParams(z.object({ counterofferId: z.string() })),
  asyncHandler(async (req, res) => {
    const result = await negotiationService.acceptCounteroffer(req.auth!, req.params.counterofferId);
    res.json(result);
  }),
);

negotiationRouter.post(
  "/portal/counteroffers/:counterofferId/reject",
  requireAuth,
  requireCapability(Capabilities.CUSTOMER_PORTAL),
  validateParams(z.object({ counterofferId: z.string() })),
  validateBody(z.object({ reason: z.string() })),
  asyncHandler(async (req, res) => {
    const result = await negotiationService.rejectCounteroffer(req.auth!, req.params.counterofferId, req.body.reason);
    res.json(result);
  }),
);
