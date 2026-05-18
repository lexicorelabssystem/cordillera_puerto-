import { Injectable, OnModuleDestroy, Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === "development"
          ? [{ emit: "stdout", level: "warn" }, { emit: "stdout", level: "error" }]
          : [{ emit: "stdout", level: "error" }],
    });
  }

  async onModuleDestroy() {
    this.logger.log("Disconnecting from database...");
    await this.$disconnect();
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
