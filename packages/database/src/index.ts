export { prisma } from "./client.js"; // exports instance of prisma
export {
  DEFAULT_DATABASE_SCHEMA,
  getDatabaseSettings,
  type DatabaseSettings,
} from "./database-url.js";
export * from "../generated/prisma/client.js"; // exports generated types from prisma
