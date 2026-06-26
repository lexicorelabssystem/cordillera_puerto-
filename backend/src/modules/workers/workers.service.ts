import { Injectable, Inject, Logger } from "@nestjs/common";
import { Worker, type Queue } from "bullmq";
import {
  QUEUE_NAMES,
  JOB_NAMES,
  EXPORT_CONCURRENCY,
  RECALCULATION_CONCURRENCY,
  SIMCE_PDF_CONCURRENCY,
  createRedisConnection,
} from "../queue/queue.constants.js";
import { ExportsProcessor } from "./processors/exports.processor.js";
import { RecalculationsProcessor } from "./processors/recalculations.processor.js";
import { SimcePdfProcessor } from "./processors/simce-pdf.processor.js";
import { PrismaService } from "../prisma/prisma.service.js";

interface RedisConfig {
  redisUrl: string;
}

@Injectable()
export class WorkersService {
  private readonly logger = new Logger(WorkersService.name);
  private workers: Worker[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly exportsProcessor: ExportsProcessor,
    private readonly recalculationsProcessor: RecalculationsProcessor,
    private readonly simcePdfProcessor: SimcePdfProcessor,
    @Inject("APP_CONFIG") private readonly config: RedisConfig,
  ) {}

  async startAll() {
    if (!this.config.redisUrl) {
      throw new Error("REDIS_URL is required for BullMQ Workers");
    }
    const connection = createRedisConnection(this.config.redisUrl);
    this.logger.log(`Starting workers with Redis: ${this.config.redisUrl.replace(/\/\/.*@/, "//****@")}`);

    const exportsWorker = new Worker(
      QUEUE_NAMES.EXPORTS,
      async (job) => {
        try {
          return await this.exportsProcessor.processExport(job);
        } catch (err) {
          this.logger.error(`Export job ${job.id} failed: ${(err as Error).message}`);
          await this.prisma.exportJob.updateMany({
            where: { bullJobId: job.id ?? undefined },
            data: { status: "FAILED", errorMessage: (err as Error).message, completedAt: new Date() },
          });
          throw err;
        }
      },
      { connection, concurrency: EXPORT_CONCURRENCY },
    );
    this.workers.push(exportsWorker);
    this.logger.log(`Exports worker started (concurrency: ${EXPORT_CONCURRENCY})`);

    const recalculationWorker = new Worker(
      QUEUE_NAMES.RECALCULATIONS,
      async (job) => {
        try {
          return await this.recalculationsProcessor.processRecalculation(job);
        } catch (err) {
          this.logger.error(`Recalculation job ${job.id} failed: ${(err as Error).message}`);
          await this.prisma.backgroundJob.updateMany({
            where: { bullJobId: job.id ?? undefined },
            data: { status: "FAILED", errorMessage: (err as Error).message, failedAt: new Date() },
          });
          throw err;
        }
      },
      { connection, concurrency: RECALCULATION_CONCURRENCY },
    );
    this.workers.push(recalculationWorker);
    this.logger.log(`Recalculations worker started (concurrency: ${RECALCULATION_CONCURRENCY})`);

    const simcePdfWorker = new Worker(
      QUEUE_NAMES.SIMCE_PDF,
      async (job) => {
        try {
          return await this.simcePdfProcessor.processSimcePdf(job);
        } catch (err) {
          this.logger.error(`SIMCE PDF job ${job.id} failed: ${(err as Error).message}`);
          await this.prisma.backgroundJob.updateMany({
            where: { bullJobId: job.id ?? undefined },
            data: { status: "FAILED", errorMessage: (err as Error).message, failedAt: new Date() },
          });
          throw err;
        }
      },
      { connection, concurrency: SIMCE_PDF_CONCURRENCY },
    );
    this.workers.push(simcePdfWorker);
    this.logger.log(`SIMCE PDF worker started (concurrency: ${SIMCE_PDF_CONCURRENCY})`);

    exportsWorker.on("error", (err) => this.logger.error(`Exports worker error: ${err.message}`));
    recalculationWorker.on("error", (err) => this.logger.error(`Recalculations worker error: ${err.message}`));
    simcePdfWorker.on("error", (err) => this.logger.error(`SIMCE PDF worker error: ${err.message}`));

    this.logger.log("All workers started successfully");
  }

  async shutdownAll() {
    this.logger.log("Shutting down workers...");
    await Promise.all(this.workers.map((w) => w.close()));
    this.logger.log("All workers shut down");
  }
}
