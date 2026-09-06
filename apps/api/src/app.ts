import express, { type Express } from "express";

import { API_V1_PREFIX, HealthResponseSchema } from "@repo/common";
import { prisma } from "@repo/db";

import { exactOriginCors, requestContext } from "./middleware/request.js";
import { createApprovalRouter } from "./modules/approvals/routes.js";
import { createAuthRouter } from "./modules/auth/routes.js";
import { createCustomerAccessRouter } from "./modules/auth/customer-access.js";
import type { EmailSender } from "./shared/email.js";
import { createTeamRouter } from "./modules/auth/team.js";
import { createBillingRouter } from "./modules/billing/routes.js";
import { createConfigurationRouter } from "./modules/configuration/routes.js";
import { createInsightsRouter } from "./modules/insights/routes.js";
import { createNegotiationRouter } from "./modules/negotiation/routes.js";
import { createOperationsRouter } from "./modules/operations/routes.js";
import { createQuotationRouter } from "./modules/quotations/routes.js";
import { errorHandler, HttpError } from "./shared/errors.js";

export function createApp(options: { sendEmail?: EmailSender } = {}): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(requestContext);
  app.use(exactOriginCors);
  app.use((request, response, next) => {
    void request;
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
    response.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use(express.json({ limit: "1mb", strict: true }));

  const api = express.Router();
  api.get("/health", async (_request, response) => {
    let database: "ok" | "degraded" = "ok";
    try {
      await prisma.organization.count();
    } catch {
      database = "degraded";
    }
    const body = HealthResponseSchema.parse({
      status: database,
      service: "dealflow360-api",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      dependencies: { database },
    });
    response.status(database === "ok" ? 200 : 503).json(body);
  });
  api.use(createAuthRouter());
  api.use(createTeamRouter());
  api.use(createCustomerAccessRouter(options.sendEmail));
  api.use(createConfigurationRouter());
  api.use(createQuotationRouter());
  api.use(createApprovalRouter());
  api.use(createOperationsRouter());
  api.use(createBillingRouter());
  api.use(createNegotiationRouter());
  api.use(createInsightsRouter());
  app.use(API_V1_PREFIX, api);

  app.use((request, _response, next) => {
    next(
      new HttpError(
        404,
        "Route not found",
        `No API operation matches ${request.method} ${request.originalUrl}`,
        { code: "ROUTE_NOT_FOUND" },
      ),
    );
  });
  app.use(errorHandler);
  return app;
}
