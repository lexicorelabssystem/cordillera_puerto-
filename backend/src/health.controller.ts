import { Controller, Get, VERSION_NEUTRAL, Version } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { PrismaService } from "./modules/prisma/prisma.service.js";
import { QueueService } from "./modules/queue/queue.service.js";
import { Public } from "./common/decorators/public.decorator.js";

const startTime = Date.now();

@ApiTags("Health")
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  @Public()
  @Version(VERSION_NEUTRAL)
  @Get("health")
  @ApiOperation({ summary: "Health check: API, base de datos y colas BullMQ" })
  async health() {
    const dbStart = Date.now();
    const dbOk = await this.prisma.healthCheck();
    const dbLatency = Date.now() - dbStart;
    const uptimeSec = Math.floor((Date.now() - startTime) / 1000);
    const memUsage = process.memoryUsage();

    let queueHealth: Awaited<ReturnType<QueueService["getHealth"]>> | { status: "unavailable"; error: string };
    try {
      queueHealth = await this.queueService.getHealth();
    } catch (error) {
      queueHealth = { status: "unavailable", error: error instanceof Error ? error.message : String(error) };
    }

    return {
      ok: dbOk && queueHealth.status !== "unavailable",
      service: "cordillera-api",
      version: "3.0.0",
      timestamp: new Date().toISOString(),
      uptimeSec,
      database: { status: dbOk ? "connected" : "disconnected", latencyMs: dbLatency },
      bullmq: queueHealth,
      memory: {
        heapUsedMB: Number((memUsage.heapUsed / 1024 / 1024).toFixed(1)),
        heapTotalMB: Number((memUsage.heapTotal / 1024 / 1024).toFixed(1)),
        rssMB: Number((memUsage.rss / 1024 / 1024).toFixed(1)),
      },
      node: process.version,
    };
  }
}