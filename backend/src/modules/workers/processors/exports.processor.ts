import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { ExportsService } from "../../data-ops/exports/exports.service.js";
import type { ExportJobPayload } from "../../queue/queue.service.js";

@Injectable()
export class ExportsProcessor {
  private readonly logger = new Logger(ExportsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly exportsService: ExportsService,
  ) {}

  async processExport(job: { data: ExportJobPayload; id?: string }) {
    const { entityType, format, courseId, subjectId, institutionId, academicYearId, userId, exportJobId } = job.data;
    this.logger.log(`Processing export job ${job.id}: ${entityType} in ${format}`);

    await this.prisma.exportJob.update({
      where: { id: exportJobId },
      data: { status: "PROCESSING" },
    });

    let result: { fileName: string; format: string; rowCount: number; downloadUrl: string };

    switch (entityType) {
      case "students":
        result = await this.exportsService.exportStudents(courseId, institutionId, format, userId);
        break;
      case "grades":
        result = await this.exportsService.exportGrades(courseId, subjectId, format, userId);
        break;
      case "questions":
        result = await this.exportsService.exportQuestions(subjectId, format, userId);
        break;
      case "courses":
        result = await this.exportsService.exportCourses(institutionId, academicYearId, format, userId);
        break;
      default:
        result = await this.exportsService.exportStudents(courseId, institutionId, format, userId);
    }

    await this.prisma.exportJob.update({
      where: { id: exportJobId },
      data: {
        status: "COMPLETED",
        fileUrl: result.downloadUrl,
        rowCount: result.rowCount,
        completedAt: new Date(),
      },
    });

    this.logger.log(`Export job ${job.id} completed: ${result.fileName} (${result.rowCount} rows)`);
    return result;
  }
}
