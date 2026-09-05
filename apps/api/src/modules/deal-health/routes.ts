import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { dealHealthService } from "./service.js";
import {
  asyncHandler,
  requireAuth,
  validateBody,
  validateParams,
} from "../../middleware/validate.js";
import { Capabilities } from "@repo/contracts";
import { requireCapability } from "../../middleware/auth.js";

export const dealHealthRouter: ExpressRouter = Router();

const alertIdParam = z.object({ alertId: z.string() });

// Alerts
dealHealthRouter.get(
  "/alerts",
  requireAuth,
  requireCapability(Capabilities.QUOTATION_VIEW),
  asyncHandler(async (req, res) => {
    const alerts = await dealHealthService.listAlerts(req.auth!);
    res.json({ items: alerts });
  }),
);

dealHealthRouter.get(
  "/alerts/:alertId",
  requireAuth,
  requireCapability(Capabilities.QUOTATION_VIEW),
  validateParams(alertIdParam),
  asyncHandler(async (req, res) => {
    const alert = await dealHealthService.getAlert(req.auth!, req.params.alertId);
    res.json(alert);
  }),
);

dealHealthRouter.post(
  "/alerts/:alertId/acknowledge",
  requireAuth,
  requireCapability(Capabilities.QUOTATION_VIEW),
  validateParams(alertIdParam),
  asyncHandler(async (req, res) => {
    const result = await dealHealthService.acknowledgeAlert(req.auth!, req.params.alertId);
    res.json(result);
  }),
);

dealHealthRouter.post(
  "/alerts/:alertId/snooze",
  requireAuth,
  requireCapability(Capabilities.QUOTATION_VIEW),
  validateParams(alertIdParam),
  validateBody(z.object({ until: z.string() })),
  asyncHandler(async (req, res) => {
    const result = await dealHealthService.snoozeAlert(req.auth!, req.params.alertId, req.body.until);
    res.json(result);
  }),
);

// Snapshots
dealHealthRouter.get(
  "/quotes/:quoteId/snapshots",
  requireAuth,
  requireCapability(Capabilities.QUOTATION_VIEW),
  validateParams(z.object({ quoteId: z.string() })),
  asyncHandler(async (req, res) => {
    const snapshots = await dealHealthService.listSnapshots(req.auth!, req.params.quoteId);
    res.json({ items: snapshots });
  }),
);

dealHealthRouter.get(
  "/quotes/:quoteId/snapshots/:snapshotId",
  requireAuth,
  requireCapability(Capabilities.QUOTATION_VIEW),
  validateParams(z.object({ quoteId: z.string(), snapshotId: z.string() })),
  asyncHandler(async (req, res) => {
    const snapshot = await dealHealthService.getSnapshot(req.auth!, req.params.snapshotId);
    res.json(snapshot);
  }),
);

dealHealthRouter.post(
  "/quotes/:quoteId/snapshots",
  requireAuth,
  requireCapability(Capabilities.QUOTATION_EDIT_OWN),
  validateParams(z.object({ quoteId: z.string() })),
  validateBody(z.object({ reason: z.string() })),
  asyncHandler(async (req, res) => {
    const snapshot = await dealHealthService.createSnapshot(req.auth!, req.params.quoteId, req.body.reason);
    res.status(201).json(snapshot);
  }),
);

// Health Score
dealHealthRouter.get(
  "/quotes/:quoteId/health-score",
  requireAuth,
  requireCapability(Capabilities.QUOTATION_VIEW),
  validateParams(z.object({ quoteId: z.string() })),
  asyncHandler(async (req, res) => {
    const score = await dealHealthService.calculateHealthScore(req.auth!, req.params.quoteId);
    res.json(score);
  }),
);
