import { BadRequestException, Injectable } from "@nestjs/common";
import type { Job } from "bullmq";
import { ArchivesService } from "../../archives/archives.service.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { ArchiveJobPayload } from "../../queue/queue.service.js";

@Injectable()
export class ArchiveProcessor {
  constructor(private readonly archives: ArchivesService, private readonly prisma: PrismaService) {}

  async process(job: Job<ArchiveJobPayload>) {
    if (job.data.action === "ARCHIVE_SCHEDULE") {
      const cutoff = new Date();
      cutoff.setUTCDate(1);
      cutoff.setUTCMonth(cutoff.getUTCMonth() - 6);
      cutoff.setUTCDate(0);
      cutoff.setUTCHours(23, 59, 59, 999);
      const semester = cutoff.getUTCMonth() < 6 ? 1 : 2;
      const institutions = await this.prisma.institution.findMany({ where: { isActive: true }, select: { id: true } });
      const results = [];
      for (const institution of institutions) {
        const record = await this.archives.createRequest({ cutoffDate: cutoff.toISOString(), institutionId: institution.id, semester, retentionYears: 7 });
        results.push(await this.archives.archive(record.id));
      }
      return { cutoffDate: cutoff.toISOString(), institutions: results.length, results };
    }
    if (!job.data.archiveRecordId) throw new BadRequestException("archiveRecordId es requerido");
    return job.data.action === "RESTORE"
      ? this.archives.restore(job.data.archiveRecordId)
      : this.archives.archive(job.data.archiveRecordId);
  }
}