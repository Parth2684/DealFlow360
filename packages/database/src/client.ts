import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { getDatabaseSettings } from "./database-url.js";

const globalForDealFlowDatabase = globalThis as typeof globalThis & {
  dealFlowPrisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const { connectionString, schema } = getDatabaseSettings();
  const adapter = new PrismaPg({ connectionString }, { schema });

  return new PrismaClient({
    adapter,
    errorFormat: process.env.NODE_ENV === "production" ? "minimal" : "pretty",
  });
}

export const prisma =
  globalForDealFlowDatabase.dealFlowPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForDealFlowDatabase.dealFlowPrisma = prisma;
}
