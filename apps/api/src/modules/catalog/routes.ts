import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "@repo/db";
import { Capabilities } from "@repo/contracts";
import { asyncHandler, requireAuth } from "../../middleware/validate.js";
import { requireCapability } from "../../middleware/auth.js";

export const productsRouter: ExpressRouter = Router();

productsRouter.get(
  "/",
  requireAuth,
  requireCapability(Capabilities.QUOTATION_VIEW),
  asyncHandler(async (req, res) => {
    const products = await prisma.product.findMany({
      where: { organizationId: req.auth!.organizationId, active: true },
      include: {
        category: true,
        variants: { where: { active: true } },
        tax: true,
      },
      orderBy: { name: "asc" },
    });
    res.json({
      items: products.map((p: any) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        type: p.type,
        categoryId: p.categoryId,
        categoryName: p.category.name,
        unit: p.unit,
        standardCost: String(p.standardCost),
        variants: p.variants.map((v: any) => ({
          id: v.id,
          sku: v.sku,
          name: v.name,
          priceSurcharge: String(v.priceSurcharge),
        })),
      })),
    });
  }),
);

export const customersRouter: ExpressRouter = Router();

customersRouter.get(
  "/",
  requireAuth,
  requireCapability(Capabilities.QUOTATION_VIEW),
  asyncHandler(async (req, res) => {
    const customers = await prisma.customerAccount.findMany({
      where: { organizationId: req.auth!.organizationId, active: true },
      include: { tier: true },
      orderBy: { name: "asc" },
    });
    res.json({
      items: customers.map((c: any) => ({
        id: c.id,
        name: c.name,
        tier: c.tier.name,
        tierCode: c.tier.code,
        creditLimit: String(c.creditLimit),
        currentExposure: String(c.currentExposure),
        overdueBalance: String(c.overdueBalance),
      })),
    });
  }),
);

export const warehousesRouter: ExpressRouter = Router();

warehousesRouter.get(
  "/",
  requireAuth,
  requireCapability(Capabilities.FULFILLMENT_VIEW),
  asyncHandler(async (req, res) => {
    const warehouses = await prisma.warehouse.findMany({
      where: { organizationId: req.auth!.organizationId, active: true },
      include: { inventoryBalances: true },
    });
    res.json({ items: warehouses });
  }),
);

export const subscriptionPlansRouter: ExpressRouter = Router();

subscriptionPlansRouter.get(
  "/",
  requireAuth,
  requireCapability(Capabilities.QUOTATION_VIEW),
  asyncHandler(async (req, res) => {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { organizationId: req.auth!.organizationId, active: true },
    });
    res.json({ items: plans });
  }),
);
