import { prisma } from "@repo/db";

import {
  buildExportArtifact,
  EXPORT_FAILURE_MESSAGE,
  persistedExportStorage,
} from "../../modules/insights/exports.js";
import type { TransactionClient } from "../../shared/activity.js";
import type { ClaimedOutboxEvent } from "../job-events.js";

function artifactBytes(body: Buffer | string): Uint8Array<ArrayBuffer> {
  const source = typeof body === "string" ? Buffer.from(body, "utf8") : body;
  return Uint8Array.from(source);
}

export async function generateExport(event: ClaimedOutboxEvent): Promise<void> {
  const claimed = await prisma.exportJob.updateMany({
    where: {
      id: event.aggregateId,
      organizationId: event.organizationId,
      status: "QUEUED",
    },
    data: {
      status: "PROCESSING",
      progress: 10,
      startedAt: new Date(),
      completedAt: null,
      expiresAt: null,
      resultLocation: null,
      errorMessage: null,
    },
  });
  const job = await prisma.exportJob.findFirst({
    where: { id: event.aggregateId, organizationId: event.organizationId },
  });
  if (job === null || job.status === "CANCELLED") return;
  if (job.status === "COMPLETED" || job.status === "EXPIRED") return;
  if (job.status === "FAILED") {
    throw new Error(
      `Export ${event.aggregateId} cannot be generated from FAILED`,
    );
  }
  if (claimed.count !== 1 && job.status !== "PROCESSING") {
    throw new Error(
      `Export ${event.aggregateId} cannot be claimed from ${job.status}`,
    );
  }

  const artifact = await buildExportArtifact({
    organizationId: job.organizationId,
    reportType: job.reportType,
    format: job.format,
    filters: job.filters,
  });
  const completed = await prisma.$transaction(async (transaction) => {
    const changed = await transaction.exportJob.updateMany({
      where: {
        id: job.id,
        organizationId: job.organizationId,
        status: "PROCESSING",
      },
      data: {
        status: "COMPLETED",
        progress: 100,
        resultLocation: persistedExportStorage.resultLocation(job.format),
        errorMessage: null,
        completedAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60_000),
      },
    });
    if (changed.count !== 1) return false;
    await transaction.exportArtifact.create({
      data: {
        exportJobId: job.id,
        organizationId: job.organizationId,
        content: artifactBytes(artifact.body),
        contentType: artifact.contentType,
        filename: artifact.filename,
        rowCount: artifact.rowCount,
      },
    });
    return true;
  });
  if (completed) return;

  const current = await prisma.exportJob.findFirst({
    where: { id: job.id, organizationId: job.organizationId },
    select: { status: true },
  });
  if (
    current === null ||
    current.status === "CANCELLED" ||
    current.status === "COMPLETED" ||
    current.status === "EXPIRED"
  ) {
    return;
  }
  throw new Error("The export job changed while its artifact was generated");
}

export async function markExportFailed(
  transaction: TransactionClient,
  organizationId: string,
  exportJobId: string,
): Promise<void> {
  await transaction.exportJob.updateMany({
    where: {
      id: exportJobId,
      organizationId,
      status: { in: ["QUEUED", "PROCESSING"] },
    },
    data: {
      status: "FAILED",
      progress: 0,
      resultLocation: null,
      errorMessage: EXPORT_FAILURE_MESSAGE,
      completedAt: new Date(),
    },
  });
}
