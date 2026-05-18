import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { PrismaService } from "./modules/prisma/prisma.service.js";
import { Public } from "./common/decorators/public.decorator.js";

const startTime = Date.now();

@ApiTags("Health")
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get("health")
  @ApiOperation({ summary: "Health check: uptime, memoria, base de datos" })
  async health() {
    const dbStart = Date.now();
    const dbOk = await this.prisma.healthCheck();
    const dbLatency = Date.now() - dbStart;

    const uptimeSec = Math.floor((Date.now() - startTime) / 1000);
    const memUsage = process.memoryUsage();

    return {
      ok: true,
      service: "cordillera-api",
      version: "3.0.0",
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m ${uptimeSec % 60}s`,
      uptimeSec,
      database: {
        status: dbOk ? "connected" : "disconnected",
        latencyMs: dbLatency,
      },
      memory: {
        heapUsedMB: Number((memUsage.heapUsed / 1024 / 1024).toFixed(1)),
        heapTotalMB: Number((memUsage.heapTotal / 1024 / 1024).toFixed(1)),
        rssMB: Number((memUsage.rss / 1024 / 1024).toFixed(1)),
      },
      node: process.version,
    };
  }
}
