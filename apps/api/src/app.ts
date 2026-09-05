import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { authRouter } from "./modules/auth/routes.js";
import { quotesRouter } from "./modules/quotations/routes.js";
import { approvalsRouter } from "./modules/approvals/routes.js";
import { productsRouter, customersRouter, warehousesRouter, subscriptionPlansRouter } from "./modules/catalog/routes.js";
import { createRecommendationsRouter } from "./modules/recommendations/routes.js";
import { customersRouter as customersModuleRouter } from "./modules/customers/routes.js";
import { pricingRouter } from "./modules/pricing/routes.js";
import { inventoryRouter } from "./modules/inventory/routes.js";
import { fulfillmentRouter } from "./modules/fulfillment/routes.js";
import { ordersRouter } from "./modules/orders/routes.js";
import { subscriptionsRouter } from "./modules/subscriptions/routes.js";
import { billingRouter } from "./modules/billing/routes.js";
import { negotiationRouter } from "./modules/negotiation/routes.js";
import { dealHealthRouter } from "./modules/deal-health/routes.js";
import { reportingRouter } from "./modules/reporting/routes.js";
import { authMiddleware } from "./middleware/auth.js";
import {
  errorHandler,
  notFoundHandler,
  requestIdMiddleware,
} from "./middleware/error-handler.js";
import { prisma } from "@repo/db";

export function createApp(): Express {
  const app = express();

  app.use(
    cors({
      origin: process.env.WEB_ORIGIN ?? "http://localhost:3001",
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());
  app.use(requestIdMiddleware);
  app.use(authMiddleware);

  app.get("/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ok", service: "dealflow360-api" });
    } catch {
      res.status(503).json({ status: "degraded", service: "dealflow360-api" });
    }
  });

  const v1 = express.Router();
  v1.use("/auth", authRouter);
  // v1.use("/quotes", quotesRouter);
  // v1.use("/quotes/:quoteId/recommendations", createRecommendationsRouter());
  // v1.use("/approvals", approvalsRouter);
  // v1.use("/products", productsRouter);
  // v1.use("/customers", customersRouter);
  // v1.use("/warehouses", warehousesRouter);
  // v1.use("/subscription-plans", subscriptionPlansRouter);
  // v1.use("/customer-accounts", customersModuleRouter);
  // v1.use("/pricing", pricingRouter);
  // v1.use("/inventory", inventoryRouter);
  // v1.use("/fulfillment", fulfillmentRouter);
  // v1.use("/orders", ordersRouter);
  // v1.use("/subscriptions", subscriptionsRouter);
  // v1.use("/billing", billingRouter);
  v1.use("/negotiation", negotiationRouter);
  // v1.use("/deal-health", dealHealthRouter);
  // v1.use("/reporting", reportingRouter);

  app.use("/api/v1", v1);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
