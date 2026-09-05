import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { recommendationService } from "./service.js";
import { quoteService } from "../quotations/service.js";
import { asyncHandler, requireAuth, validateParams } from "../../middleware/validate.js";
import { Capabilities } from "@repo/contracts";
import { requireCapability } from "../../middleware/auth.js";

const quoteProductParams = z.object({
  quoteId: z.string(),
  productId: z.string(),
});

export function createRecommendationsRouter(): ExpressRouter {
  const router = Router({ mergeParams: true });

  router.get(
    "/",
    requireAuth,
    requireCapability(Capabilities.QUOTATION_VIEW),
    asyncHandler(async (req, res) => {
      const items = await recommendationService.getRecommendations(
        req.auth!,
        req.params.quoteId as string,
      );
      res.json(items);
    }),
  );

  router.post(
    "/:productId/dismiss",
    requireAuth,
    validateParams(quoteProductParams),
    asyncHandler(async (req, res) => {
      const result = await recommendationService.dismiss(
        req.auth!,
        req.params.quoteId as string,
        req.params.productId as string,
      );
      res.json(result);
    }),
  );

  router.post(
    "/:productId/add",
    requireAuth,
    requireCapability(Capabilities.QUOTATION_EDIT_OWN),
    validateParams(quoteProductParams),
    asyncHandler(async (req, res) => {
      const quote = await quoteService.addLine(req.auth!, req.params.quoteId, {
        productId: req.params.productId,
        quantity: 1,
        discountPercent: 0,
        billingType: "ONE_TIME",
      });
      await recommendationService.dismiss(
        req.auth!,
        req.params.quoteId as string,
        req.params.productId as string,
      );
      res.json(quote);
    }),
  );

  return router;
}
