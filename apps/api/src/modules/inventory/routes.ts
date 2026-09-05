import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { inventoryService } from "./service.js";
import {
  asyncHandler,
  requireAuth,
  validateBody,
  validateParams,
} from "../../middleware/validate.js";
import { Capabilities } from "@repo/contracts";
import { requireCapability } from "../../middleware/auth.js";

export const inventoryRouter: ExpressRouter = Router();

// Warehouses
inventoryRouter.get(
  "/warehouses",
  requireAuth,
  requireCapability(Capabilities.FULFILLMENT_VIEW),
  asyncHandler(async (req, res) => {
    const warehouses = await inventoryService.listWarehouses(req.auth!);
    res.json({ items: warehouses });
  }),
);

inventoryRouter.post(
  "/warehouses",
  requireAuth,
  requireCapability(Capabilities.CONFIGURATION_MANAGE),
  asyncHandler(async (req, res) => {
    const warehouse = await inventoryService.createWarehouse(req.auth!, req.body);
    res.status(201).json(warehouse);
  }),
);

inventoryRouter.patch(
  "/warehouses/:warehouseId",
  requireAuth,
  requireCapability(Capabilities.CONFIGURATION_MANAGE),
  validateParams(z.object({ warehouseId: z.string() })),
  asyncHandler(async (req, res) => {
    const warehouse = await inventoryService.updateWarehouse(req.auth!, req.params.warehouseId, req.body);
    res.json(warehouse);
  }),
);

// Inventory Balances
inventoryRouter.get(
  "/warehouses/:warehouseId/balances",
  requireAuth,
  requireCapability(Capabilities.FULFILLMENT_VIEW),
  validateParams(z.object({ warehouseId: z.string() })),
  asyncHandler(async (req, res) => {
    const balances = await inventoryService.listBalances(req.auth!, req.params.warehouseId);
    res.json({ items: balances });
  }),
);

inventoryRouter.post(
  "/warehouses/:warehouseId/adjust",
  requireAuth,
  requireCapability(Capabilities.FULFILLMENT_OVERRIDE),
  validateParams(z.object({ warehouseId: z.string() })),
  asyncHandler(async (req, res) => {
    const result = await inventoryService.adjustInventory(req.auth!, req.params.warehouseId, req.body);
    res.json(result);
  }),
);

// Stock Movements
inventoryRouter.get(
  "/stock-movements",
  requireAuth,
  requireCapability(Capabilities.FULFILLMENT_VIEW),
  asyncHandler(async (req, res) => {
    const movements = await inventoryService.listStockMovements(req.auth!);
    res.json({ items: movements });
  }),
);

inventoryRouter.post(
  "/stock-movements/receipt",
  requireAuth,
  requireCapability(Capabilities.FULFILLMENT_OVERRIDE),
  asyncHandler(async (req, res) => {
    const movement = await inventoryService.createReceipt(req.auth!, req.body);
    res.status(201).json(movement);
  }),
);
