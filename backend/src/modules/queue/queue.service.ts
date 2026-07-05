import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Queue } from "bullmq";
import { JOB_NAMES, DEFAULT_JOB_OPTS } from "./queue.constants.js";
import { PrismaService } from "../prisma/prisma.service.js";

export interface ExportJobPayload {
  entityType: string;
  format: string;
  courseId?: string;
  subjectId?: string;
  institutionId?: string;
  academicYearId?: string;
  userId: string;
  exportJobId: string;
}

export interface RecalculationJobPayload {
  assessmentId: string;
  teacherUserId: string;
}

export interface SimcePdfJobPayload {
  assessmentId: string;
  pdfFileId: string;
  userId: string;
}

export interface ReportJobPayload {
  reportId: string;
  type: string;
  userId: string;
  studentId?: string;
  courseId?: string;
  subjectId?: string;
  institutionId?: string;
  academicYearId?: string;
  learningObjectiveId?: string;
  threshold?: number;
  format: string;
}
export interface ArchiveJobPayload {
  action: "ARCHIVE" | "RESTORE" | "ARCHIVE_SCHEDULE";
  archiveRecordId?: string;
  userId?: string;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @Inject("EXPORTS_QUEUE") private readonly exportsQueue: Queue,
    @Inject("RECALCULATIONS_QUEUE") private readonly recalculationsQueue: Queue,
    @Inject("SIMCE_PDF_QUEUE") private readonly simcePdfQueue: Queue,
    @Inject("REPORTS_QUEUE") private readonly reportsQueue: Queue,
    @Inject("CLEANUP_QUEUE") private readonly cleanupQueue: Queue,
    @Inject("ARCHIVES_QUEUE") private readonly archivesQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  async enqueueExport(payload: ExportJobPayload): Promise<{ exportJobId: string; bullJobId: string }> {
    const job = await this.exportsQueue.add(JOB_NAMES.EXPORT_DATA, payload, {
      ...DEFAULT_JOB_OPTS,
      jobId: `export:${payload.exportJobId}`,
    });
    await this.prisma.exportJob.update({
      where: { id: payload.exportJobId },
      data: { bullJobId: job.id ?? undefined, status: "QUEUED" },
    });
    this.logger.log(`Export job enqueued: ${job.id} (exportJob: ${payload.exportJobId})`);
    return { exportJobId: payload.exportJobId, bullJobId: job.id ?? "" };
  }

  async enqueueRecalculation(payload: RecalculationJobPayload) {
    const jobId = `recalculation:assessment:${payload.assessmentId}`;
    const existing = await this.recalculationsQueue.getJob(jobId);
    if (existing && (await existing.isActive() || await existing.isWaiting())) {
      const backgroundJob = await this.prisma.backgroundJob.findFirst({
        where: { bullJobId: existing.id ?? jobId },
        orderBy: { createdAt: "desc" },
      });
      return { backgroundJobId: backgroundJob?.id ?? "", bullJobId: existing.id ?? jobId };
    }

    const job = await this.recalculationsQueue.add(JOB_NAMES.RECALCULATE_ASSESSMENT, payload, {
      ...DEFAULT_JOB_OPTS,
      jobId,
    });
    const backgroundJob = await this.prisma.backgroundJob.create({
      data: {
        jobType: "RECALCULATE_ASSESSMENT",
        queueName: "recalculations",
        bullJobId: job.id ?? undefined,
        status: "QUEUED",
        payload: payload as any,
        requestedById: payload.teacherUserId,
      },
    });
    return { backgroundJobId: backgroundJob.id, bullJobId: job.id ?? "" };
  }

  async enqueueSimcePdfProcessing(payload: SimcePdfJobPayload) {
    const jobId = `simce-pdf:${payload.pdfFileId}`;
    const existing = await this.simcePdfQueue.getJob(jobId);
    if (existing && (await existing.isActive() || await existing.isWaiting())) {
      const backgroundJob = await this.prisma.backgroundJob.findFirst({
        where: { bullJobId: existing.id ?? jobId },
        orderBy: { createdAt: "desc" },
      });
      return { backgroundJobId: backgroundJob?.id ?? "", bullJobId: existing.id ?? jobId };
    }

    const job = await this.simcePdfQueue.add(JOB_NAMES.PROCESS_SIMCE_PDF, payload, {
      ...DEFAULT_JOB_OPTS,
      jobId,
    });
    const backgroundJob = await this.prisma.backgroundJob.create({
      data: {
        jobType: "PROCESS_SIMCE_PDF",
        queueName: "simce-pdf",
        bullJobId: job.id ?? undefined,
        status: "QUEUED",
        payload: payload as any,
        requestedById: payload.userId,
      },
    });
    return { backgroundJobId: backgroundJob.id, bullJobId: job.id ?? "" };
  }

  async enqueueReport(payload: ReportJobPayload) {
    const job = await this.reportsQueue.add(JOB_NAMES.GENERATE_REPORT, payload, {
      ...DEFAULT_JOB_OPTS,
      jobId: `report:${payload.reportId}`,
    });
    const backgroundJob = await this.prisma.backgroundJob.create({
      data: {
        jobType: "GENERATE_REPORT",
        queueName: "reports",
        bullJobId: job.id ?? undefined,
        status: "QUEUED",
        payload: payload as any,
        requestedById: payload.userId,
        institutionId: payload.institutionId,
      },
    });
    return { backgroundJobId: backgroundJob.id, bullJobId: job.id ?? "", reportId: payload.reportId };
  }

  async enqueueArchive(payload: ArchiveJobPayload) {
    const job = await this.archivesQueue.add(JOB_NAMES.ARCHIVE_SEMESTER, payload, {
      ...DEFAULT_JOB_OPTS,
      jobId: `archive:${payload.action.toLowerCase()}:${payload.archiveRecordId ?? Date.now()}`,
    });
    const backgroundJob = await this.prisma.backgroundJob.create({
      data: {
        jobType: payload.action === "RESTORE" ? "RESTORE_ARCHIVE" : "ARCHIVE_SEMESTER",
        queueName: "archives",
        bullJobId: job.id ?? undefined,
        status: "QUEUED",
        payload: payload as any,
        requestedById: payload.userId,
      },
    });
    return { backgroundJobId: backgroundJob.id, bullJobId: job.id ?? "", archiveRecordId: payload.archiveRecordId };
  }
  async ensureCleanupSchedule() {
    await this.cleanupQueue.add(JOB_NAMES.CLEANUP_TEMP, {}, {
      ...DEFAULT_JOB_OPTS,
      jobId: "cleanup-temp-hourly",
      repeat: { every: 60 * 60 * 1000 },
    });
  }
  async ensureArchiveSchedule() {
    await this.archivesQueue.add(JOB_NAMES.ARCHIVE_SEMESTER, { action: "ARCHIVE_SCHEDULE" }, {
      ...DEFAULT_JOB_OPTS,
      jobId: "archive-semester-schedule",
      repeat: { pattern: "0 3 1 1,7 *" },
    });
  }

  async getJobStatus(queueName: string, jobId: string) {
    const queue = this.getQueueByName(queueName);
    if (!queue) return null;
    const job = await queue.getJob(jobId);
    if (!job) return null;
    const state = await job.getState();
    return {
      status: state,
      progress: job.progress as number | undefined,
      ...(state === "completed" ? { result: job.returnvalue } : {}),
      ...(state === "failed" ? { error: job.failedReason } : {}),
    };
  }

  async getHealth() {
    const queues = [
      ["exports", this.exportsQueue],
      ["recalculations", this.recalculationsQueue],
      ["simce-pdf", this.simcePdfQueue],
      ["reports", this.reportsQueue],
      ["cleanup", this.cleanupQueue],
      ["archives", this.archivesQueue],
    ] as const;
    const details = await Promise.all(queues.map(async ([name, queue]) => {
      const [counts, workers] = await Promise.all([
        queue.getJobCounts("waiting", "active", "completed", "failed", "delayed"),
        queue.getWorkers(),
      ]);
      return { name, workers: workers.length, counts };
    }));
    return {
      status: details.every((queue) => queue.workers > 0) ? "healthy" : "degraded",
      queues: details,
    };
  }

  private getQueueByName(name: string): Queue | null {
    switch (name) {
      case "exports": return this.exportsQueue;
      case "recalculations": return this.recalculationsQueue;
      case "simce-pdf": return this.simcePdfQueue;
      case "reports": return this.reportsQueue;
      case "cleanup": return this.cleanupQueue;
      case "archives": return this.archivesQueue;
      default: return null;
    }
  }
}