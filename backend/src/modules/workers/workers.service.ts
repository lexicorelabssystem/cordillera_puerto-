import { Injectable, Inject, Logger } from "@nestjs/common";
import { Worker } from "bullmq";
import {
  QUEUE_NAMES,
  EXPORT_CONCURRENCY,
  RECALCULATION_CONCURRENCY,
  SIMCE_PDF_CONCURRENCY,
  REPORTS_CONCURRENCY,
  ARCHIVES_CONCURRENCY,
  createRedisConnection,
} from "../queue/queue.constants.js";
import { ExportsProcessor } from "./processors/exports.processor.js";
import { RecalculationsProcessor } from "./processors/recalculations.processor.js";
import { SimcePdfProcessor } from "./processors/simce-pdf.processor.js";
import { ReportsProcessor } from "./processors/reports.processor.js";
import { CleanupProcessor } from "./processors/cleanup.processor.js";
import { ArchiveProcessor } from "./processors/archive.processor.js";
import { QueueService } from "../queue/queue.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

interface RedisConfig { redisUrl: string; }

@Injectable()
export class WorkersService {
  private readonly logger = new Logger(WorkersService.name);
  private workers: Worker[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly exportsProcessor: ExportsProcessor,
    private readonly recalculationsProcessor: RecalculationsProcessor,
    private readonly simcePdfProcessor: SimcePdfProcessor,
    private readonly reportsProcessor: ReportsProcessor,
    private readonly cleanupProcessor: CleanupProcessor,
    private readonly archiveProcessor: ArchiveProcessor,
    private readonly queueService: QueueService,
    @Inject("APP_CONFIG") private readonly config: RedisConfig,
  ) {}

  async startAll() {
    if (!this.config.redisUrl) throw new Error("REDIS_URL is required for BullMQ Workers");
    const connection = createRedisConnection(this.config.redisUrl);

    const exportsWorker = new Worker(QUEUE_NAMES.EXPORTS, async (job) => {
      try {
        return await this.exportsProcessor.processExport(job);
      } catch (error) {
        await this.prisma.exportJob.updateMany({
          where: { bullJobId: job.id ?? undefined },
          data: { status: "FAILED", errorMessage: (error as Error).message, completedAt: new Date() },
        });
        throw error;
      }
    }, { connection, concurrency: EXPORT_CONCURRENCY });

    const recalculationWorker = new Worker(QUEUE_NAMES.RECALCULATIONS, async (job) => {
      try {
        return await this.recalculationsProcessor.processRecalculation(job);
      } catch (error) {
        await this.failBackgroundJob(job.id, error);
        throw error;
      }
    }, { connection, concurrency: RECALCULATION_CONCURRENCY });

    const simcePdfWorker = new Worker(QUEUE_NAMES.SIMCE_PDF, async (job) => {
      try {
        return await this.simcePdfProcessor.processSimcePdf(job);
      } catch (error) {
        await this.failBackgroundJob(job.id, error);
        throw error;
      }
    }, { connection, concurrency: SIMCE_PDF_CONCURRENCY });

    const reportsWorker = new Worker(QUEUE_NAMES.REPORTS, async (job) => {
      try {
        return await this.reportsProcessor.processReport(job);
      } catch (error) {
        const reportId = (job.data as { reportId?: string }).reportId;
        await this.prisma.$transaction([
          this.prisma.backgroundJob.updateMany({
            where: { bullJobId: job.id ?? undefined },
            data: { status: "FAILED", errorMessage: (error as Error).message, failedAt: new Date() },
          }),
          ...(reportId ? [this.prisma.report.update({ where: { id: reportId }, data: { status: "FAILED" } })] : []),
        ]);
        throw error;
      }
    }, { connection, concurrency: REPORTS_CONCURRENCY });

    const cleanupWorker = new Worker(
      QUEUE_NAMES.CLEANUP,
      () => this.cleanupProcessor.processCleanup(),
      { connection, concurrency: 1 },
    );

    const archiveWorker = new Worker(
      QUEUE_NAMES.ARCHIVES,
      async (job) => {
        try {
          const result = await this.archiveProcessor.process(job);
          await this.prisma.backgroundJob.updateMany({ where: { bullJobId: job.id ?? undefined }, data: { status: "COMPLETED", result: result as any, completedAt: new Date() } });
          return result;
        } catch (error) {
          await this.failBackgroundJob(job.id, error);
          throw error;
        }
      },
      { connection, concurrency: ARCHIVES_CONCURRENCY },
    );
    this.workers.push(exportsWorker, recalculationWorker, simcePdfWorker, reportsWorker, cleanupWorker, archiveWorker);
    await this.queueService.ensureCleanupSchedule();
    await this.queueService.ensureArchiveSchedule();
    const labels = ["Exports", "Recalculations", "SIMCE PDF", "Reports", "Cleanup", "Archives"];
    this.workers.forEach((worker, index) => {
      worker.on("error", (error) => this.logger.error(`${labels[index]} worker error: ${error.message}`));
    });
    this.logger.log("All BullMQ workers started successfully");
  }

  async shutdownAll() {
    await Promise.all(this.workers.map((worker) => worker.close()));
    this.workers = [];
  }

  private async failBackgroundJob(jobId: string | undefined, error: unknown) {
    await this.prisma.backgroundJob.updateMany({
      where: { bullJobId: jobId },
      data: { status: "FAILED", errorMessage: (error as Error).message, failedAt: new Date() },
    });
  }
}