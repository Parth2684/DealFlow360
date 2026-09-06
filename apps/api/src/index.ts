import { prisma } from "@repo/db";

import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.log(`DealFlow360 API listening on ${env.API_PUBLIC_URL}`);
});

let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; stopping DealFlow360 API`);
  const forceTimer = setTimeout(() => {
    process.exitCode = 1;
    server.closeAllConnections();
  }, 10_000);
  forceTimer.unref();
  server.close(async (error) => {
    clearTimeout(forceTimer);
    await prisma.$disconnect();
    if (error !== undefined) {
      console.error("API shutdown failed", error);
      process.exitCode = 1;
    }
  });
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
