import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { orderService } from "./service.js";
import {
  asyncHandler,
  requireAuth,
  validateBody,
  validateParams,
} from "../../middleware/validate.js";
import { Capabilities } from "@repo/contracts";
import { requireCapability } from "../../middleware/auth.js";

export const ordersRouter: ExpressRouter = Router();

const orderIdParam = z.object({ orderId: z.string() });

ordersRouter.get(
  "/",
  requireAuth,
  requireCapability(Capabilities.QUOTATION_VIEW),
  asyncHandler(async (req, res) => {
    const orders = await orderService.list(req.auth!);
    res.json({ items: orders });
  }),
);

ordersRouter.get(
  "/:orderId",
  requireAuth,
  requireCapability(Capabilities.QUOTATION_VIEW),
  validateParams(orderIdParam),
  asyncHandler(async (req, res) => {
    const order = await orderService.get(req.auth!, req.params.orderId);
    res.json(order);
  }),
);

ordersRouter.post(
  "/quotes/:quoteId/confirm",
  requireAuth,
  requireCapability(Capabilities.QUOTATION_SUBMIT),
  validateParams(z.object({ quoteId: z.string() })),
  validateBody(z.object({ revision: z.number() })),
  asyncHandler(async (req, res) => {
    const order = await orderService.confirmFromQuote(req.auth!, req.params.quoteId, req.body.revision);
    res.status(201).json(order);
  }),
);

ordersRouter.get(
  "/:orderId/billing",
  requireAuth,
  requireCapability(Capabilities.BILLING_VIEW),
  validateParams(orderIdParam),
  asyncHandler(async (req, res) => {
    const billing = await orderService.getBilling(req.auth!, req.params.orderId);
    res.json(billing);
  }),
);
