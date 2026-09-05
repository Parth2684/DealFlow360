import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { fulfillmentService } from "./service.js";
import {
  asyncHandler,
  requireAuth,
  validateBody,
  validateParams,
} from "../../middleware/validate.js";
import { Capabilities } from "@repo/contracts";
import { requireCapability } from "../../middleware/auth.js";

export const fulfillmentRouter: ExpressRouter = Router();

const orderIdParam = z.object({ orderId: z.string() });

// Fulfillment Preview
fulfillmentRouter.get(
  "/orders/:orderId/fulfillment/preview",
  requireAuth,
  requireCapability(Capabilities.FULFILLMENT_VIEW),
  validateParams(orderIdParam),
  asyncHandler(async (req, res) => {
    const preview = await fulfillmentService.previewAllocation(req.auth!, req.params.orderId);
    res.json(preview);
  }),
);

// Fulfillment Reservation
fulfillmentRouter.post(
  "/orders/:orderId/fulfillment/reserve",
  requireAuth,
  requireCapability(Capabilities.FULFILLMENT_OVERRIDE),
  validateParams(orderIdParam),
  validateBody(z.object({ planId: z.string().optional() })),
  asyncHandler(async (req, res) => {
    const result = await fulfillmentService.reserveStock(req.auth!, req.params.orderId, req.body.planId);
    res.json(result);
  }),
);

// Fulfillment Override
fulfillmentRouter.post(
  "/orders/:orderId/fulfillment/override",
  requireAuth,
  requireCapability(Capabilities.FULFILLMENT_OVERRIDE),
  validateParams(orderIdParam),
  validateBody(z.object({
    allocations: z.array(z.object({
      warehouseId: z.string(),
      quoteLineId: z.string(),
      quantity: z.string(),
    })),
    reason: z.string(),
  })),
  asyncHandler(async (req, res) => {
    const result = await fulfillmentService.overrideAllocation(req.auth!, req.params.orderId, req.body);
    res.json(result);
  }),
);

// Shipments
fulfillmentRouter.get(
  "/orders/:orderId/shipments",
  requireAuth,
  requireCapability(Capabilities.FULFILLMENT_VIEW),
  validateParams(orderIdParam),
  asyncHandler(async (req, res) => {
    const shipments = await fulfillmentService.listShipments(req.auth!, req.params.orderId);
    res.json({ items: shipments });
  }),
);

fulfillmentRouter.post(
  "/shipments/:shipmentId/ship",
  requireAuth,
  requireCapability(Capabilities.FULFILLMENT_OVERRIDE),
  validateParams(z.object({ shipmentId: z.string() })),
  validateBody(z.object({ trackingNumber: z.string().optional() })),
  asyncHandler(async (req, res) => {
    const result = await fulfillmentService.shipShipment(req.auth!, req.params.shipmentId, req.body.trackingNumber);
    res.json(result);
  }),
);

// Backorders
fulfillmentRouter.get(
  "/backorders",
  requireAuth,
  requireCapability(Capabilities.FULFILLMENT_VIEW),
  asyncHandler(async (req, res) => {
    const backorders = await fulfillmentService.listBackorders(req.auth!);
    res.json({ items: backorders });
  }),
);

fulfillmentRouter.post(
  "/backorders/:backorderId/consolidate",
  requireAuth,
  requireCapability(Capabilities.FULFILLMENT_OVERRIDE),
  validateParams(z.object({ backorderId: z.string() })),
  asyncHandler(async (req, res) => {
    const result = await fulfillmentService.consolidateBackorder(req.auth!, req.params.backorderId);
    res.json(result);
  }),
);
