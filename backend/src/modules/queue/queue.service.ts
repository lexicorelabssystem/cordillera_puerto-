import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Queue, Job } from "bullmq";
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

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @Inject("EXPORTS_QUEUE") private readonly exportsQueue: Queue,
    @Inject("RECALCULATIONS_QUEUE") private readonly recalculationsQueue: Queue,
    @Inject("SIMCE_PDF_QUEUE") private readonly simcePdfQueue: Queue,
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

  async enqueueRecalculation(payload: RecalculationJobPayload): Promise<{ bullJobId: string }> {
    const jobId = `recalculation:assessment:${payload.assessmentId}`;

    const existing = await this.recalculationsQueue.getJob(jobId);
    if (existing && (await existing.isActive() || await existing.isWaiting())) {
      this.logger.warn(`Recalculation already in queue for assessment ${payload.assessmentId}`);
      return { bullJobId: existing.id ?? jobId };
    }

    const job = await this.recalculationsQueue.add(
      JOB_NAMES.RECALCULATE_ASSESSMENT,
      payload,
      { ...DEFAULT_JOB_OPTS, jobId },
    );

    await this.prisma.backgroundJob.create({
      data: {
        jobType: "RECALCULATE_ASSESSMENT",
        queueName: "recalculations",
        bullJobId: job.id ?? undefined,
        status: "QUEUED",
        payload: payload as unknown as Record<string, unknown> as any,
        requestedById: payload.teacherUserId,
      },
    });

    this.logger.log(`Recalculation job enqueued: ${job.id} for assessment ${payload.assessmentId}`);
    return { bullJobId: job.id ?? "" };
  }

  async enqueueSimcePdfProcessing(payload: SimcePdfJobPayload): Promise<{ bullJobId: string }> {
    const jobId = `simce-pdf:${payload.pdfFileId}`;

    const existing = await this.simcePdfQueue.getJob(jobId);
    if (existing && (await existing.isActive() || await existing.isWaiting())) {
      this.logger.warn(`SIMCE PDF processing already in queue for file ${payload.pdfFileId}`);
      return { bullJobId: existing.id ?? jobId };
    }

    const job = await this.simcePdfQueue.add(JOB_NAMES.PROCESS_SIMCE_PDF, payload, {
      ...DEFAULT_JOB_OPTS,
      jobId,
    });

    await this.prisma.backgroundJob.create({
      data: {
        jobType: "PROCESS_SIMCE_PDF",
        queueName: "simce-pdf",
        bullJobId: job.id ?? undefined,
        status: "QUEUED",
        payload: payload as unknown as Record<string, unknown> as any,
        requestedById: payload.userId,
        institutionId: undefined,
      },
    });

    this.logger.log(`SIMCE PDF job enqueued: ${job.id} for file ${payload.pdfFileId}`);
    return { bullJobId: job.id ?? "" };
  }

  async getJobStatus(queueName: string, jobId: string): Promise<{ status: string; progress?: number; result?: unknown; error?: string } | null> {
    const queue = this.getQueueByName(queueName);
    if (!queue) return null;

    const job = await queue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    const result: { status: string; progress?: number; result?: unknown; error?: string } = {
      status: state,
      progress: job.progress as number | undefined,
    };

    if (state === "completed") {
      result.result = job.returnvalue;
    } else if (state === "failed") {
      result.error = job.failedReason;
    }

    return result;
  }

  private getQueueByName(name: string): Queue | null {
    switch (name) {
      case "exports": return this.exportsQueue;
      case "recalculations": return this.recalculationsQueue;
      case "simce-pdf": return this.simcePdfQueue;
      default: return null;
    }
  }
}
