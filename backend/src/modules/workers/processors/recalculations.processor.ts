import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { GradingService } from "../../assessments/grading/grading.service.js";
import type { RecalculationJobPayload } from "../../queue/queue.service.js";

@Injectable()
export class RecalculationsProcessor {
  private readonly logger = new Logger(RecalculationsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gradingService: GradingService,
  ) {}

  async processRecalculation(job: { data: RecalculationJobPayload; id?: string }) {
    const { assessmentId, teacherUserId } = job.data;
    this.logger.log(`Processing recalculation for assessment ${assessmentId}`);

    const result = await this.gradingService.recalculateAssessment(assessmentId, teacherUserId);

    await this.prisma.backgroundJob.updateMany({
      where: { bullJobId: job.id ?? undefined },
      data: {
        status: "COMPLETED",
        result: result as unknown as Record<string, unknown> as any,
        completedAt: new Date(),
      },
    });

    this.logger.log(
      `Recalculation completed for assessment ${assessmentId}: ${result.gradesRecalculated} grades, ${result.pendingAttempts} pending`,
    );
    return result;
  }
}
