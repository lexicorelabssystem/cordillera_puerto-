import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hora

@Injectable()
export class TokenCleanupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TokenCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap() {
    this.cleanup().finally(() => {
      setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
    });
  }

  private async cleanup() {
    try {
      const now = new Date();

      const { count: revoked } = await this.prisma.refreshToken.deleteMany({
        where: { revokedAt: { not: null } },
      });

      const { count: expired } = await this.prisma.refreshToken.deleteMany({
        where: { expiresAt: { lt: now } },
      });

      if (revoked > 0 || expired > 0) {
        this.logger.log(`Tokens limpiados: ${revoked} revocados, ${expired} expirados`);
      }
    } catch (error) {
      this.logger.warn("Error limpiando refresh tokens", error instanceof Error ? error.message : String(error));
    }
  }
}
