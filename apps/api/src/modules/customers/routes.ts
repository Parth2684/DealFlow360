import { Router } from "express";
import { z } from "zod";
import { customerService } from "./service.js";
import {
  asyncHandler,
  requireAuth,
  validateBody,
  validateParams,
} from "../../middleware/validate.js";
import { Capabilities } from "@repo/contracts";
import { requireCapability } from "../../middleware/auth.js";

export const customersRouter = Router();

const customerIdParam = z.object({ customerId: z.string() });

// Customer Tiers
customersRouter.get(
  "/tiers",
  requireAuth,
  requireCapability(Capabilities.CONFIGURATION_MANAGE),
  asyncHandler(async (req, res) => {
    const tiers = await customerService.listTiers(req.auth!);
    res.json({ items: tiers });
  }),
);

customersRouter.post(
  "/tiers",
  requireAuth,
  requireCapability(Capabilities.CONFIGURATION_MANAGE),
  asyncHandler(async (req, res) => {
    const tier = await customerService.createTier(req.auth!, req.body);
    res.status(201).json(tier);
  }),
);

customersRouter.patch(
  "/tiers/:tierId",
  requireAuth,
  requireCapability(Capabilities.CONFIGURATION_MANAGE),
  validateParams(z.object({ tierId: z.string() })),
  asyncHandler(async (req, res) => {
    const tier = await customerService.updateTier(req.auth!, req.params.tierId, req.body);
    res.json(tier);
  }),
);

// Customer Accounts
customersRouter.get(
  "/accounts",
  requireAuth,
  requireCapability(Capabilities.QUOTATION_VIEW),
  asyncHandler(async (req, res) => {
    const accounts = await customerService.listAccounts(req.auth!);
    res.json({ items: accounts });
  }),
);

customersRouter.post(
  "/accounts",
  requireAuth,
  requireCapability(Capabilities.CONFIGURATION_MANAGE),
  asyncHandler(async (req, res) => {
    const account = await customerService.createAccount(req.auth!, req.body);
    res.status(201).json(account);
  }),
);

customersRouter.get(
  "/accounts/:customerId",
  requireAuth,
  requireCapability(Capabilities.QUOTATION_VIEW),
  validateParams(customerIdParam),
  asyncHandler(async (req, res) => {
    const account = await customerService.getAccount(req.auth!, req.params.customerId);
    res.json(account);
  }),
);

customersRouter.patch(
  "/accounts/:customerId",
  requireAuth,
  requireCapability(Capabilities.CONFIGURATION_MANAGE),
  validateParams(customerIdParam),
  asyncHandler(async (req, res) => {
    const account = await customerService.updateAccount(req.auth!, req.params.customerId, req.body);
    res.json(account);
  }),
);

// Customer Contacts
customersRouter.get(
  "/accounts/:customerId/contacts",
  requireAuth,
  requireCapability(Capabilities.QUOTATION_VIEW),
  validateParams(customerIdParam),
  asyncHandler(async (req, res) => {
    const contacts = await customerService.listContacts(req.auth!, req.params.customerId);
    res.json({ items: contacts });
  }),
);

customersRouter.post(
  "/accounts/:customerId/contacts",
  requireAuth,
  requireCapability(Capabilities.CONFIGURATION_MANAGE),
  validateParams(customerIdParam),
  asyncHandler(async (req, res) => {
    const contact = await customerService.createContact(req.auth!, req.params.customerId, req.body);
    res.status(201).json(contact);
  }),
);

customersRouter.patch(
  "/accounts/:customerId/contacts/:contactId",
  requireAuth,
  requireCapability(Capabilities.CONFIGURATION_MANAGE),
  validateParams(z.object({ customerId: z.string(), contactId: z.string() })),
  asyncHandler(async (req, res) => {
    const contact = await customerService.updateContact(
      req.auth!,
      req.params.customerId,
      req.params.contactId,
      req.body,
    );
    res.json(contact);
  }),
);
