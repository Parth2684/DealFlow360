import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { pricingService } from "./service.js";
import {
  asyncHandler,
  requireAuth,
  validateBody,
  validateParams,
} from "../../middleware/validate.js";
import { Capabilities } from "@repo/contracts";
import { requireCapability } from "../../middleware/auth.js";

export const pricingRouter: ExpressRouter = Router();

// Price Lists
pricingRouter.get(
  "/price-lists",
  requireAuth,
  requireCapability(Capabilities.QUOTATION_VIEW),
  asyncHandler(async (req, res) => {
    const priceLists = await pricingService.listPriceLists(req.auth!);
    res.json({ items: priceLists });
  }),
);

pricingRouter.post(
  "/price-lists",
  requireAuth,
  requireCapability(Capabilities.CONFIGURATION_MANAGE),
  asyncHandler(async (req, res) => {
    const priceList = await pricingService.createPriceList(req.auth!, req.body);
    res.status(201).json(priceList);
  }),
);

pricingRouter.patch(
  "/price-lists/:priceListId",
  requireAuth,
  requireCapability(Capabilities.CONFIGURATION_MANAGE),
  validateParams(z.object({ priceListId: z.string() })),
  asyncHandler(async (req, res) => {
    const priceList = await pricingService.updatePriceList(req.auth!, req.params.priceListId, req.body);
    res.json(priceList);
  }),
);

// Price Rules
pricingRouter.get(
  "/price-lists/:priceListId/rules",
  requireAuth,
  requireCapability(Capabilities.QUOTATION_VIEW),
  validateParams(z.object({ priceListId: z.string() })),
  asyncHandler(async (req, res) => {
    const rules = await pricingService.listPriceRules(req.auth!, req.params.priceListId);
    res.json({ items: rules });
  }),
);

pricingRouter.post(
  "/price-lists/:priceListId/rules",
  requireAuth,
  requireCapability(Capabilities.CONFIGURATION_MANAGE),
  validateParams(z.object({ priceListId: z.string() })),
  asyncHandler(async (req, res) => {
    const rule = await pricingService.createPriceRule(req.auth!, req.params.priceListId, req.body);
    res.status(201).json(rule);
  }),
);

pricingRouter.patch(
  "/price-rules/:ruleId",
  requireAuth,
  requireCapability(Capabilities.CONFIGURATION_MANAGE),
  validateParams(z.object({ ruleId: z.string() })),
  asyncHandler(async (req, res) => {
    const rule = await pricingService.updatePriceRule(req.auth!, req.params.ruleId, req.body);
    res.json(rule);
  }),
);

pricingRouter.delete(
  "/price-rules/:ruleId",
  requireAuth,
  requireCapability(Capabilities.CONFIGURATION_MANAGE),
  validateParams(z.object({ ruleId: z.string() })),
  asyncHandler(async (req, res) => {
    await pricingService.deletePriceRule(req.auth!, req.params.ruleId);
    res.status(204).send();
  }),
);

// Discount Limits
pricingRouter.get(
  "/discount-limits",
  requireAuth,
  requireCapability(Capabilities.QUOTATION_VIEW),
  asyncHandler(async (req, res) => {
    const limits = await pricingService.listDiscountLimits(req.auth!);
    res.json({ items: limits });
  }),
);

pricingRouter.post(
  "/discount-limits",
  requireAuth,
  requireCapability(Capabilities.CONFIGURATION_MANAGE),
  asyncHandler(async (req, res) => {
    const limit = await pricingService.createDiscountLimit(req.auth!, req.body);
    res.status(201).json(limit);
  }),
);

pricingRouter.patch(
  "/discount-limits/:limitId",
  requireAuth,
  requireCapability(Capabilities.CONFIGURATION_MANAGE),
  validateParams(z.object({ limitId: z.string() })),
  asyncHandler(async (req, res) => {
    const limit = await pricingService.updateDiscountLimit(req.auth!, req.params.limitId, req.body);
    res.json(limit);
  }),
);

// Taxes
pricingRouter.get(
  "/taxes",
  requireAuth,
  requireCapability(Capabilities.QUOTATION_VIEW),
  asyncHandler(async (req, res) => {
    const taxes = await pricingService.listTaxes(req.auth!);
    res.json({ items: taxes });
  }),
);

pricingRouter.post(
  "/taxes",
  requireAuth,
  requireCapability(Capabilities.CONFIGURATION_MANAGE),
  asyncHandler(async (req, res) => {
    const tax = await pricingService.createTax(req.auth!, req.body);
    res.status(201).json(tax);
  }),
);

pricingRouter.patch(
  "/taxes/:taxId",
  requireAuth,
  requireCapability(Capabilities.CONFIGURATION_MANAGE),
  validateParams(z.object({ taxId: z.string() })),
  asyncHandler(async (req, res) => {
    const tax = await pricingService.updateTax(req.auth!, req.params.taxId, req.body);
    res.json(tax);
  }),
);

// Subscription Plans
pricingRouter.get(
  "/subscription-plans",
  requireAuth,
  requireCapability(Capabilities.QUOTATION_VIEW),
  asyncHandler(async (req, res) => {
    const plans = await pricingService.listSubscriptionPlans(req.auth!);
    res.json({ items: plans });
  }),
);

pricingRouter.post(
  "/subscription-plans",
  requireAuth,
  requireCapability(Capabilities.CONFIGURATION_MANAGE),
  asyncHandler(async (req, res) => {
    const plan = await pricingService.createSubscriptionPlan(req.auth!, req.body);
    res.status(201).json(plan);
  }),
);

pricingRouter.patch(
  "/subscription-plans/:planId",
  requireAuth,
  requireCapability(Capabilities.CONFIGURATION_MANAGE),
  validateParams(z.object({ planId: z.string() })),
  asyncHandler(async (req, res) => {
    const plan = await pricingService.updateSubscriptionPlan(req.auth!, req.params.planId, req.body);
    res.json(plan);
  }),
);
