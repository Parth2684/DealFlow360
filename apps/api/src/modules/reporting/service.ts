import { prisma } from "@repo/db";
import { Errors } from "@repo/contracts";
import { writeAuditEvent } from "../../shared/outbox.js";
import type { AuthContext } from "../../shared/context.js";

export class ReportingService {
  async listExportJobs(auth: AuthContext) {
    const jobs = await prisma.exportJob.findMany({
      where: { organizationId: auth.organizationId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return jobs.map((j: any) => ({
      id: j.id,
      reportType: j.reportType,
      format: j.format,
      status: j.status,
      filters: j.filters,
      fileUrl: j.fileUrl,
      errorMessage: j.errorMessage,
      rowCount: j.rowCount,
      createdAt: j.createdAt.toISOString(),
      completedAt: j.completedAt?.toISOString() ?? null,
    }));
  }

  async createExportJob(
    auth: AuthContext,
    input: {
      reportType: "QUOTES" | "ORDERS" | "INVOICES" | "CUSTOMERS" | "INVENTORY";
      format: "CSV" | "XLSX" | "PDF";
      filters?: Record<string, unknown>;
    },
  ) {
    const job = await prisma.exportJob.create({
      data: {
        organizationId: auth.organizationId,
        requestedBy: auth.userId,
        reportType: input.reportType,
        format: input.format,
        filters: input.filters ?? {},
        status: "PENDING",
      },
    });

    await writeAuditEvent(prisma, {
      organizationId: auth.organizationId,
      actorId: auth.userId,
      entityType: "export_job",
      entityId: job.id,
      eventType: "export_job.created",
      afterSummary: { reportType: input.reportType, format: input.format },
    });

    return this.getExportJob(auth, job.id);
  }

  async getExportJob(auth: AuthContext, jobId: string) {
    const job = await prisma.exportJob.findFirst({
      where: { id: jobId, organizationId: auth.organizationId },
    });

    if (!job) throw Errors.notFound("Export job");

    return {
      id: job.id,
      reportType: job.reportType,
      format: job.format,
      status: job.status,
      filters: job.filters,
      fileUrl: job.fileUrl,
      errorMessage: job.errorMessage,
      rowCount: job.rowCount,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
    };
  }

  async downloadExport(auth: AuthContext, jobId: string) {
    const job = await prisma.exportJob.findFirst({
      where: { id: jobId, organizationId: auth.organizationId },
    });

    if (!job) throw Errors.notFound("Export job");

    if (job.status === "COMPLETED" && job.fileUrl) {
      return { url: job.fileUrl, fileName: `${job.reportType.toLowerCase()}_export_${job.id}.${job.format.toLowerCase()}` };
    }

    if (job.status === "FAILED") {
      throw Errors.badRequest("Export job failed: " + job.errorMessage);
    }

    return { url: null };
  }

  async deleteExportJob(auth: AuthContext, jobId: string) {
    const job = await prisma.exportJob.findFirst({
      where: { id: jobId, organizationId: auth.organizationId },
    });

    if (!job) throw Errors.notFound("Export job");

    await prisma.exportJob.delete({
      where: { id: jobId },
    });

    await writeAuditEvent(prisma, {
      organizationId: auth.organizationId,
      actorId: auth.userId,
      entityType: "export_job",
      entityId: jobId,
      eventType: "export_job.deleted",
      afterSummary: { jobId },
    });
  }
}

export const reportingService = new ReportingService();
