import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { subscriptionService } from "./service.js";
import {
  asyncHandler,
  requireAuth,
  validateBody,
  validateParams,
} from "../../middleware/validate.js";
import { Capabilities } from "@repo/contracts";
import { requireCapability } from "../../middleware/auth.js";

export const subscriptionsRouter: ExpressRouter = Router();

const subscriptionIdParam = z.object({ subscriptionId: z.string() });

subscriptionsRouter.get(
  "/",
  requireAuth,
  requireCapability(Capabilities.BILLING_VIEW),
  asyncHandler(async (req, res) => {
    const subscriptions = await subscriptionService.list(req.auth!);
    res.json({ items: subscriptions });
  }),
);

subscriptionsRouter.get(
  "/:subscriptionId",
  requireAuth,
  requireCapability(Capabilities.BILLING_VIEW),
  validateParams(subscriptionIdParam),
  asyncHandler(async (req, res) => {
    const subscription = await subscriptionService.get(req.auth!, req.params.subscriptionId);
    res.json(subscription);
  }),
);

subscriptionsRouter.post(
  "/:subscriptionId/preview-change",
  requireAuth,
  requireCapability(Capabilities.BILLING_VIEW),
  validateParams(subscriptionIdParam),
  validateBody(z.object({
    quantity: z.number().optional(),
    planId: z.string().optional(),
  })),
  asyncHandler(async (req, res) => {
    const preview = await subscriptionService.previewChange(req.auth!, req.params.subscriptionId, req.body);
    res.json(preview);
  }),
);

subscriptionsRouter.post(
  "/:subscriptionId/change",
  requireAuth,
  requireCapability(Capabilities.BILLING_RECORD_PAYMENT),
  validateParams(subscriptionIdParam),
  validateBody(z.object({
    quantity: z.number().optional(),
    planId: z.string().optional(),
    effectiveDate: z.string(),
  })),
  asyncHandler(async (req, res) => {
    const result = await subscriptionService.change(req.auth!, req.params.subscriptionId, req.body);
    res.json(result);
  }),
);

subscriptionsRouter.post(
  "/:subscriptionId/cancel",
  requireAuth,
  requireCapability(Capabilities.BILLING_RECORD_PAYMENT),
  validateParams(subscriptionIdParam),
  validateBody(z.object({
    effectiveDate: z.string(),
    reason: z.string(),
  })),
  asyncHandler(async (req, res) => {
    const result = await subscriptionService.cancel(req.auth!, req.params.subscriptionId, req.body);
    res.json(result);
  }),
);

subscriptionsRouter.get(
  "/:subscriptionId/schedules",
  requireAuth,
  requireCapability(Capabilities.BILLING_VIEW),
  validateParams(subscriptionIdParam),
  asyncHandler(async (req, res) => {
    const schedules = await subscriptionService.listSchedules(req.auth!, req.params.subscriptionId);
    res.json({ items: schedules });
  }),
);
