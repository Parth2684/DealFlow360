import { prisma } from "@repo/db";

import { startBackgroundWorker } from "./worker/runtime.js";

const worker = startBackgroundWorker();
console.log("DealFlow360 background worker started");

let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; stopping DealFlow360 background worker`);
  await worker.stop();
  await prisma.$disconnect();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
