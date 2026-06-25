import { Global, Module, Inject, Optional, type OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import { QUEUE_NAMES } from "./queue.constants.js";
import { QueueService } from "./queue.service.js";
import { PrismaModule } from "../prisma/prisma.module.js";

function createQueue(name: string, redisUrl: string): Queue {
  return new Queue(name, { connection: { url: redisUrl } });
}

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: "EXPORTS_QUEUE",
      useFactory: (appConfig: { redisUrl?: string }) => {
        const url = appConfig?.redisUrl;
        if (!url) throw new Error("REDIS_URL is required for BullMQ queues");
        return createQueue(QUEUE_NAMES.EXPORTS, url);
      },
      inject: ["APP_CONFIG"],
    },
    {
      provide: "RECALCULATIONS_QUEUE",
      useFactory: (appConfig: { redisUrl?: string }) => {
        const url = appConfig?.redisUrl;
        if (!url) throw new Error("REDIS_URL is required for BullMQ queues");
        return createQueue(QUEUE_NAMES.RECALCULATIONS, url);
      },
      inject: ["APP_CONFIG"],
    },
    {
      provide: "SIMCE_PDF_QUEUE",
      useFactory: (appConfig: { redisUrl?: string }) => {
        const url = appConfig?.redisUrl;
        if (!url) throw new Error("REDIS_URL is required for BullMQ queues");
        return createQueue(QUEUE_NAMES.SIMCE_PDF, url);
      },
      inject: ["APP_CONFIG"],
    },
    QueueService,
  ],
  exports: ["EXPORTS_QUEUE", "RECALCULATIONS_QUEUE", "SIMCE_PDF_QUEUE", QueueService],
})
export class QueueModule implements OnModuleDestroy {
  constructor(
    @Optional() @Inject("EXPORTS_QUEUE") private readonly exportsQueue?: Queue,
    @Optional() @Inject("RECALCULATIONS_QUEUE") private readonly recalculationsQueue?: Queue,
    @Optional() @Inject("SIMCE_PDF_QUEUE") private readonly simcePdfQueue?: Queue,
  ) {}

  async onModuleDestroy() {
    const queues = [this.exportsQueue, this.recalculationsQueue, this.simcePdfQueue].filter(Boolean) as Queue[];
    await Promise.all(queues.map((q) => q.close()));
  }
}
