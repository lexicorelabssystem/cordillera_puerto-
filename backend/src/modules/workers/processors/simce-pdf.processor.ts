import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { SimceService } from "../../simce/simce.service.js";
import type { SimcePdfJobPayload } from "../../queue/queue.service.js";
import { StorageService } from "../../storage/storage.service.js";

@Injectable()
export class SimcePdfProcessor {
  private readonly logger = new Logger(SimcePdfProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly simceService: SimceService,
    private readonly storage: StorageService,
  ) {}

  async processSimcePdf(job: { data: SimcePdfJobPayload; id?: string }) {
    const { assessmentId, pdfFileId } = job.data;
    this.logger.log(`Processing SIMCE PDF parsing for file ${pdfFileId}`);

    const file = await this.prisma.fileAsset.findUnique({
      where: { id: pdfFileId },
      select: { id: true, originalName: true, fileName: true, storagePath: true, mimeType: true },
    });

    if (!file) {
      throw new Error(`FileAsset ${pdfFileId} not found`);
    }

    if (!(await this.storage.exists(file.storagePath))) {
      throw new Error(`PDF file not found: ${file.storagePath}`);
    }
    const buffer = await this.storage.getBuffer(file.storagePath);

    await this.prisma.backgroundJob.updateMany({
      where: { bullJobId: job.id ?? undefined },
      data: { status: "PROCESSING" },
    });

    await this.simceService.preParsePdfDocument({ ...file, buffer });

    await this.prisma.backgroundJob.updateMany({
      where: { bullJobId: job.id ?? undefined },
      data: {
        status: "COMPLETED",
        result: { parsed: true, pdfFileId },
        completedAt: new Date(),
      },
    });

    this.logger.log(`SIMCE PDF parsing completed for file ${pdfFileId}`);
    return { parsed: true, pdfFileId };
  }
}
