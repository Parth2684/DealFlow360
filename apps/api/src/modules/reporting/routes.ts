import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { reportingService } from "./service.js";
import {
  asyncHandler,
  requireAuth,
  validateBody,
  validateParams,
} from "../../middleware/validate.js";
import { Capabilities } from "@repo/contracts";
import { requireCapability } from "../../middleware/auth.js";

export const reportingRouter: ExpressRouter = Router();

const jobIdParam = z.object({ jobId: z.string() });

// Export Jobs
reportingRouter.get(
  "/exports",
  requireAuth,
  requireCapability(Capabilities.REPORTS_VIEW),
  asyncHandler(async (req, res) => {
    const jobs = await reportingService.listExportJobs(req.auth!);
    res.json({ items: jobs });
  }),
);

reportingRouter.post(
  "/exports",
  requireAuth,
  requireCapability(Capabilities.REPORTS_EXPORT),
  validateBody(z.object({
    reportType: z.enum(["QUOTES", "ORDERS", "INVOICES", "CUSTOMERS", "INVENTORY"]),
    format: z.enum(["CSV", "XLSX", "PDF"]),
    filters: z.record(z.any()).optional(),
  })),
  asyncHandler(async (req, res) => {
    const job = await reportingService.createExportJob(req.auth!, req.body);
    res.status(201).json(job);
  }),
);

reportingRouter.get(
  "/exports/:jobId",
  requireAuth,
  requireCapability(Capabilities.REPORTS_VIEW),
  validateParams(jobIdParam),
  asyncHandler(async (req, res) => {
    const job = await reportingService.getExportJob(req.auth!, req.params.jobId);
    res.json(job);
  }),
);

reportingRouter.get(
  "/exports/:jobId/download",
  requireAuth,
  requireCapability(Capabilities.REPORTS_VIEW),
  validateParams(jobIdParam),
  asyncHandler(async (req, res) => {
    const result = await reportingService.downloadExport(req.auth!, req.params.jobId);
    if (result.url) {
      res.json({ downloadUrl: result.url });
    } else {
      res.status(202).json({ message: "Export is still processing" });
    }
  }),
);

reportingRouter.delete(
  "/exports/:jobId",
  requireAuth,
  requireCapability(Capabilities.REPORTS_EXPORT),
  validateParams(jobIdParam),
  asyncHandler(async (req, res) => {
    await reportingService.deleteExportJob(req.auth!, req.params.jobId);
    res.status(204).send();
  }),
);
