import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { approvalDecisionSchema, Capabilities } from "@repo/contracts";
import { approvalService } from "./service.js";
import {
  asyncHandler,
  requireAuth,
  validateBody,
  validateParams,
} from "../../middleware/validate.js";
import { requireCapability } from "../../middleware/auth.js";

export const approvalsRouter: ExpressRouter = Router();

const requestIdParam = z.object({ requestId: z.string() });

approvalsRouter.get(
  "/inbox",
  requireAuth,
  asyncHandler(async (req, res) => {
    const items = await approvalService.inbox(req.auth!);
    res.json({ items });
  }),
);

approvalsRouter.post(
  "/:requestId/approve",
  requireAuth,
  requireCapability(Capabilities.APPROVAL_MANAGER_ACT, Capabilities.APPROVAL_FINANCE_ACT),
  validateParams(requestIdParam),
  validateBody(approvalDecisionSchema),
  asyncHandler(async (req, res) => {
    const result = await approvalService.decide(req.auth!, req.params.requestId as string, {
      ...req.body,
      action: "APPROVE",
    });
    res.json(result);
  }),
);

approvalsRouter.post(
  "/:requestId/reject",
  requireAuth,
  requireCapability(Capabilities.APPROVAL_MANAGER_ACT, Capabilities.APPROVAL_FINANCE_ACT),
  validateParams(requestIdParam),
  validateBody(approvalDecisionSchema),
  asyncHandler(async (req, res) => {
    const result = await approvalService.decide(req.auth!, req.params.requestId as string, {
      ...req.body,
      action: "REJECT",
    });
    res.json(result);
  }),
);

approvalsRouter.post(
  "/:requestId/request-revision",
  requireAuth,
  requireCapability(Capabilities.APPROVAL_MANAGER_ACT, Capabilities.APPROVAL_FINANCE_ACT),
  validateParams(requestIdParam),
  validateBody(approvalDecisionSchema),
  asyncHandler(async (req, res) => {
    const result = await approvalService.decide(req.auth!, req.params.requestId as string, {
      ...req.body,
      action: "REQUEST_REVISION",
    });
    res.json(result);
  }),
);
