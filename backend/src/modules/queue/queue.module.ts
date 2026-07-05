import { Global, Module, Inject, Optional, type OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import { QUEUE_NAMES, createRedisConnection } from "./queue.constants.js";
import { QueueService } from "./queue.service.js";
import { PrismaModule } from "../prisma/prisma.module.js";

function createQueue(name: string, redisUrl: string): Queue {
  return new Queue(name, { connection: createRedisConnection(redisUrl) });
}

function queueProvider(token: string, name: string) {
  return {
    provide: token,
    useFactory: (appConfig: { redisUrl?: string }) => {
      const url = appConfig?.redisUrl;
      if (!url) throw new Error("REDIS_URL is required for BullMQ queues");
      return createQueue(name, url);
    },
    inject: ["APP_CONFIG"],
  };
}

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    queueProvider("EXPORTS_QUEUE", QUEUE_NAMES.EXPORTS),
    queueProvider("RECALCULATIONS_QUEUE", QUEUE_NAMES.RECALCULATIONS),
    queueProvider("SIMCE_PDF_QUEUE", QUEUE_NAMES.SIMCE_PDF),
    queueProvider("REPORTS_QUEUE", QUEUE_NAMES.REPORTS),
    queueProvider("CLEANUP_QUEUE", QUEUE_NAMES.CLEANUP),
    queueProvider("ARCHIVES_QUEUE", QUEUE_NAMES.ARCHIVES),
    QueueService,
  ],
  exports: ["EXPORTS_QUEUE", "RECALCULATIONS_QUEUE", "SIMCE_PDF_QUEUE", "REPORTS_QUEUE", "CLEANUP_QUEUE", "ARCHIVES_QUEUE", QueueService],
})
export class QueueModule implements OnModuleDestroy {
  constructor(
    @Optional() @Inject("EXPORTS_QUEUE") private readonly exportsQueue?: Queue,
    @Optional() @Inject("RECALCULATIONS_QUEUE") private readonly recalculationsQueue?: Queue,
    @Optional() @Inject("SIMCE_PDF_QUEUE") private readonly simcePdfQueue?: Queue,
    @Optional() @Inject("REPORTS_QUEUE") private readonly reportsQueue?: Queue,
    @Optional() @Inject("CLEANUP_QUEUE") private readonly cleanupQueue?: Queue,
    @Optional() @Inject("ARCHIVES_QUEUE") private readonly archivesQueue?: Queue,
  ) {}

  async onModuleDestroy() {
    const queues = [this.exportsQueue, this.recalculationsQueue, this.simcePdfQueue, this.reportsQueue, this.cleanupQueue, this.archivesQueue]
      .filter(Boolean) as Queue[];
    await Promise.all(queues.map((queue) => queue.close()));
  }
}