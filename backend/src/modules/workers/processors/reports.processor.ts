import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";
import { ReportsService } from "../../insights/reports/reports.service.js";
import type { ReportJobPayload } from "../../queue/queue.service.js";
import { StorageService } from "../../storage/storage.service.js";

@Injectable()
export class ReportsProcessor {
  private readonly logger = new Logger(ReportsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reportsService: ReportsService,
    private readonly storage: StorageService,
  ) {}

  async processReport(job: { data: ReportJobPayload; id?: string }) {
    const payload = job.data;
    await this.prisma.report.update({ where: { id: payload.reportId }, data: { status: "PROCESSING" } });
    await this.prisma.backgroundJob.updateMany({
      where: { bullJobId: job.id ?? undefined },
      data: { status: "PROCESSING" },
    });

    let data: unknown;
    switch (payload.type) {
      case "STUDENT":
        data = await this.reportsService.generateStudentReport(payload.studentId!);
        break;
      case "COURSE":
        data = await this.reportsService.generateCourseReport(payload.courseId!, payload.subjectId);
        break;
      case "OA":
data = await this.reportsService.generateLearningObjectiveReport({
          institutionId: payload.institutionId,
          academicYearId: payload.academicYearId,
          courseId: payload.courseId,
          subjectId: payload.subjectId,
          learningObjectiveId: payload.learningObjectiveId,
        });
        break;
      case "RISK":
data = await this.reportsService.generateRiskReport({
          institutionId: payload.institutionId,
          academicYearId: payload.academicYearId,
          courseId: payload.courseId,
          subjectId: payload.subjectId,
          threshold: payload.threshold,
        });
        break;
      case "INSTITUTIONAL":
        data = await this.reportsService.generateInstitutionalReport(payload.institutionId!, payload.academicYearId);
        break;
      default:
        throw new Error(`Unsupported report type: ${payload.type}`);
    }

    const filters = {
      institutionId: payload.institutionId,
      academicYearId: payload.academicYearId,
      courseId: payload.courseId,
      subjectId: payload.subjectId,
      studentId: payload.studentId,
      learningObjectiveId: payload.learningObjectiveId,
      threshold: payload.threshold,
    } as Prisma.InputJsonValue;

    const reportBuffer = Buffer.from(JSON.stringify(data), "utf8");
    const fileName = `${payload.reportId}.json`;
    const storagePath = await this.storage.put(
      this.storage.documentsBucket,
      `reports/${fileName}`,
      reportBuffer,
      "application/json",
    );

    try {
      await this.prisma.$transaction(async (tx) => {
        const fileAsset = await tx.fileAsset.create({
          data: {
            entityType: "REPORT",
            entityId: payload.reportId,
            fileName,
            originalName: `report-${payload.reportId}.json`,
            mimeType: "application/json",
            size: reportBuffer.length,
            storagePath,
            createdBy: payload.userId,
          },
        });
        await tx.report.update({
          where: { id: payload.reportId },
          data: { status: "GENERATED", filters, fileAssetId: fileAsset.id, generatedAt: new Date() },
        });
        await tx.backgroundJob.updateMany({
          where: { bullJobId: job.id ?? undefined },
          data: {
            status: "COMPLETED",
            result: { reportId: payload.reportId },
            completedAt: new Date(),
          },
        });
      });
    } catch (error) {
      await this.storage.remove(storagePath).catch(() => undefined);
      throw error;
    }
    this.logger.log(`Report ${payload.reportId} generated`);
    return { reportId: payload.reportId };
  }
}
