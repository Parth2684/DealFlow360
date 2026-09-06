import "dotenv/config";

import { z } from "zod";

const BooleanStringSchema = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const EnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    API_PUBLIC_URL: z.url().default("http://localhost:3000"),
    WEB_ORIGIN: z.url().default("http://localhost:3001"),

    SMTP_HOST: z.string().default("smtp.gmail.com"),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(465),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().optional(),
    PORTAL_ORGANIZATION_SLUG: z.string().optional(),
    SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(8),
    REFRESH_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(14),
    PORTAL_SESSION_TTL_MINUTES: z.coerce
      .number()
      .int()
      .min(5)
      .max(1_440)
      .default(60),
    MAGIC_LINK_TTL_MINUTES: z.coerce.number().int().min(5).max(60).default(15),
    COOKIE_SECURE: BooleanStringSchema,
    WORKER_POLL_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(250)
      .max(60_000)
      .default(2_000),
    WORKER_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(20),
    WORKER_BILLING_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(86_400_000)
      .default(60_000),
    WORKER_INVOICE_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(86_400_000)
      .default(60_000),
    WORKER_HEALTH_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(86_400_000)
      .default(300_000),
    WORKER_APPROVAL_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(86_400_000)
      .default(60_000),
    WORKER_BACKORDER_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(86_400_000)
      .default(60_000),
    WORKER_CLEANUP_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(86_400_000)
      .default(60_000),
    APPROVAL_ESCALATION_AFTER_HOURS: z.coerce
      .number()
      .int()
      .min(1)
      .max(720)
      .default(24),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === "production" && !value.COOKIE_SECURE) {
      context.addIssue({
        code: "custom",
        path: ["COOKIE_SECURE"],
        message: "COOKIE_SECURE must be true in production",
      });
    }
  });

export const env = EnvSchema.parse(process.env);
