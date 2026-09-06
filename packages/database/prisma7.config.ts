// Database scripts invoke Prisma with `bunx --bun prisma ... --config prisma7.config.ts`.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";
import { getDatabaseSettings } from "./src/database-url.js";

const { prismaUrl } = getDatabaseSettings({
  DATABASE_SCHEMA: process.env.DATABASE_SCHEMA,
  DATABASE_URL: env("DATABASE_URL"),
});

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "bun run prisma/seed.ts",
  },
  datasource: {
    url: prismaUrl,
  },
});
