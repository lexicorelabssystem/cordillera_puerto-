import { Injectable, Logger, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { QueueService } from "../queue/queue.service.js";
import { resolveUserScope } from "../../common/authz/access-scope.js";
import type { JwtPayload } from "../../common/decorators/current-user.decorator.js";

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  async getExportJobForUser(exportJobId: string, user: JwtPayload) {
    const exportJob = await this.prisma.exportJob.findUnique({ where: { id: exportJobId } });
    if (!exportJob) return null;

    const scope = await resolveUserScope(this.prisma, user.sub);
    if (scope.isSuperAdmin) {
      return this.formatExportJob(exportJob);
    }

    if (exportJob.actorId !== user.sub) {
      throw new ForbiddenException("No tienes acceso a esta exportacion");
    }

    return this.formatExportJob(exportJob);
  }

  async getBackgroundJobForUser(jobId: string, user: JwtPayload) {
    const bgJob = await this.prisma.backgroundJob.findUnique({ where: { id: jobId } });
    if (!bgJob) return null;

    const scope = await resolveUserScope(this.prisma, user.sub);
    if (scope.isSuperAdmin) {
      return this.formatBackgroundJob(bgJob);
    }

    if (bgJob.requestedById !== user.sub) {
      throw new ForbiddenException("No tienes acceso a este job");
    }

    return this.formatBackgroundJob(bgJob);
  }

  async listMyExportJobs(userId: string, limit = 20) {
    limit = Number.isFinite(limit) ? Math.min(100, Math.max(1, Math.floor(limit))) : 20;
    const jobs = await this.prisma.exportJob.findMany({
      where: { actorId: userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return jobs.map((job) => this.formatExportJob(job));
  }

  async listMyBackgroundJobs(userId: string, limit = 20) {
    limit = Number.isFinite(limit) ? Math.min(100, Math.max(1, Math.floor(limit))) : 20;
    const jobs = await this.prisma.backgroundJob.findMany({
      where: { requestedById: userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return jobs.map((job) => this.formatBackgroundJob(job));
  }

  private async formatExportJob(exportJob: { id: string; entityType: string; format: string; status: string; bullJobId?: string | null; fileUrl?: string | null; errorMessage?: string | null; rowCount?: number | null; createdAt: Date; completedAt?: Date | null }) {
    let bullStatus: string | null = null;
    if (exportJob.bullJobId) {
      const jobStatus = await this.queueService.getJobStatus("exports", exportJob.bullJobId);
      bullStatus = jobStatus?.status ?? null;
    }

    return {
      id: exportJob.id,
      entityType: exportJob.entityType,
      format: exportJob.format,
      status: bullStatus ?? exportJob.status,
      fileUrl: exportJob.fileUrl,
      errorMessage: exportJob.errorMessage,
      rowCount: exportJob.rowCount,
      createdAt: exportJob.createdAt,
      completedAt: exportJob.completedAt,
    };
  }

  private async formatBackgroundJob(bgJob: { id: string; jobType: string; queueName: string; status: string; bullJobId?: string | null; result?: unknown; errorMessage?: string | null; createdAt: Date; completedAt?: Date | null; failedAt?: Date | null }) {
    let bullStatus: string | null = null;
    if (bgJob.bullJobId) {
      const jobStatus = await this.queueService.getJobStatus(bgJob.queueName, bgJob.bullJobId);
      bullStatus = jobStatus?.status ?? null;
    }

    return {
      id: bgJob.id,
      jobType: bgJob.jobType,
      queueName: bgJob.queueName,
      status: bullStatus ?? bgJob.status,
      bullJobId: bgJob.bullJobId,
      result: bgJob.result,
      errorMessage: bgJob.errorMessage,
      createdAt: bgJob.createdAt,
      completedAt: bgJob.completedAt,
      failedAt: bgJob.failedAt,
    };
  }
}
