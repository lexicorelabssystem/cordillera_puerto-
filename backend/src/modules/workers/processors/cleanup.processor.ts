import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { StorageService } from "../../storage/storage.service.js";
import * as path from "node:path";

@Injectable()
export class CleanupProcessor {
  private readonly logger = new Logger(CleanupProcessor.name);

  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {}

  async processCleanup() {
    const now = new Date();
    const exportCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const [expiredAssets, expiredExports] = await Promise.all([
      this.prisma.fileAsset.findMany({ where: { expiresAt: { lte: now } }, select: { id: true, storagePath: true } }),
      this.prisma.exportJob.findMany({
        where: { completedAt: { lte: exportCutoff }, fileUrl: { not: null } },
        select: { id: true, fileUrl: true },
      }),
    ]);

    let deletedAssets = 0;
    for (const asset of expiredAssets) {
      await this.storage.remove(asset.storagePath).catch(() => undefined);
      await this.prisma.fileAsset.delete({ where: { id: asset.id } });
      deletedAssets++;
    }

    let deletedExports = 0;
    for (const exportJob of expiredExports) {
      const fileName = path.basename(exportJob.fileUrl!);
      const storagePath = this.storage.isMinio
        ? this.storage.uri(this.storage.tempBucket, `exports/${fileName}`)
        : path.resolve("uploads", "exports", fileName);
      await this.storage.remove(storagePath).catch(() => undefined);
      await this.prisma.exportJob.update({ where: { id: exportJob.id }, data: { fileUrl: null } });
      deletedExports++;
    }

    const result = { deletedAssets, deletedExports };
    this.logger.log(`Temporary cleanup completed: ${JSON.stringify(result)}`);
    return result;
  }
}