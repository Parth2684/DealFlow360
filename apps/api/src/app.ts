import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { authRouter } from "./modules/auth/routes.js";
import { quotesRouter } from "./modules/quotations/routes.js";
import { negotiationRouter } from "./modules/negotiation/routes.js";
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
      origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
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
  v1.use("/quotes", quotesRouter);
  v1.use("/negotiation", negotiationRouter);

  app.use("/api/v1", v1);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
