import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { AnswerStatus } from "@prisma/client";

@Injectable()
export class GradingService {
  constructor(private readonly prisma: PrismaService) {}

  // ══════════════════════════════════════════════════════
  //  MANUAL GRADING — Single Answer
  // ══════════════════════════════════════════════════════

  async gradeAnswer(
    answerId: string,
    teacherUserId: string,
    score: number,
    feedback?: string,
    statusOverride?: string,
  ) {
    const answer = await this.prisma.studentAnswer.findUnique({
      where: { id: answerId },
      include: {
        attempt: {
          include: {
            assessment: {
              include: {
                teacher: { include: { user: true } },
                questions: { where: { questionId: undefined }, select: { questionId: true, points: true } },
              },
            },
          },
        },
        question: true,
      },
    });
    if (!answer) throw new NotFoundException("Respuesta no encontrada");

    // Verify teacher owns the assessment
    if (answer.attempt.assessment.teacher.userId !== teacherUserId) {
      throw new ForbiddenException("Solo el profesor a cargo puede corregir esta evaluación");
    }

    if (answer.attempt.assessment.status !== "IN_GRADING" && answer.attempt.assessment.status !== "CLOSED") {
      throw new BadRequestException(
        `La evaluación debe estar en IN_GRADING o CLOSED para corregir (actual: ${answer.attempt.assessment.status})`,
      );
    }

    const aq = await this.prisma.assessmentQuestion.findUnique({
      where: {
        assessmentId_questionId: {
          assessmentId: answer.attempt.assessmentId,
          questionId: answer.questionId,
        },
      },
    });

    const maxPoints = aq?.points ?? answer.question.points;
    if (score > maxPoints) {
      throw new BadRequestException(`El puntaje (${score}) no puede superar el máximo (${maxPoints})`);
    }

    const isCorrect = score >= maxPoints;
    const status: AnswerStatus = statusOverride as AnswerStatus ?? (score <= 0 ? "INCORRECT" : score < maxPoints ? "PARTIAL" : "CORRECT");

    const updated = await this.prisma.studentAnswer.update({
      where: { id: answerId },
      data: {
        score,
        isCorrect,
        status,
        isGraded: true,
      },
    });

    return {
      answerId: updated.id,
      score: updated.score,
      status: updated.status,
      isCorrect: updated.isCorrect,
      feedback,
    };
  }

  // ══════════════════════════════════════════════════════
  //  BULK GRADING
  // ══════════════════════════════════════════════════════

  async bulkGradeAnswers(
    grades: { answerId: string; score: number; feedback?: string; status?: string }[],
    teacherUserId: string,
  ) {
    const results: { answerId: string; success: boolean; error?: string }[] = [];

    for (const item of grades) {
      try {
        await this.gradeAnswer(item.answerId, teacherUserId, item.score, item.feedback, item.status);
        results.push({ answerId: item.answerId, success: true });
      } catch (error) {
        results.push({
          answerId: item.answerId,
          success: false,
          error: error instanceof Error ? error.message : "Error desconocido",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const errorCount = results.filter((r) => !r.success).length;

    return {
      total: grades.length,
      successCount,
      errorCount,
      results,
    };
  }

  // ══════════════════════════════════════════════════════
  //  PENDING GRADING — List answers needing manual review
  // ══════════════════════════════════════════════════════

  async getPendingGrading(assessmentId: string, teacherUserId: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { teacher: true },
    });
    if (!assessment) throw new NotFoundException("Evaluación no encontrada");

    if (assessment.teacher.userId !== teacherUserId) {
      throw new ForbiddenException("Solo el profesor a cargo puede ver las correcciones pendientes");
    }

    const pending = await this.prisma.studentAnswer.findMany({
      where: {
        attempt: { assessmentId },
        status: { in: ["MANUAL_REVIEW", "PENDING"] },
      },
      include: {
        attempt: {
          select: {
            id: true,
            student: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        question: {
          select: { id: true, type: true, statement: true, points: true, explanation: true },
        },
      },
      orderBy: [{ attempt: { student: { lastName: "asc" } } }, { answeredAt: "asc" }],
    });

    const byStudent: Record<string, { studentName: string; pendingCount: number; answers: typeof pending }> = {};

    for (const answer of pending) {
      const studentId = answer.attempt.student.id;
      if (!byStudent[studentId]) {
        byStudent[studentId] = {
          studentName: `${answer.attempt.student.firstName} ${answer.attempt.student.lastName}`,
          pendingCount: 0,
          answers: [],
        };
      }
      byStudent[studentId].pendingCount++;
      byStudent[studentId].answers.push(answer);
    }

    return {
      assessmentId,
      totalPending: pending.length,
      byStudent: Object.values(byStudent),
    };
  }

  // ══════════════════════════════════════════════════════
  //  RECALCULATE ASSESSMENT
  // ══════════════════════════════════════════════════════

  async recalculateAssessment(assessmentId: string, teacherUserId: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        teacher: true,
        questions: { include: { question: true } },
        attempts: {
          where: { status: { in: ["COMPLETED", "CLOSED", "TIMED_OUT"] } },
          include: { answers: true },
        },
      },
    });
    if (!assessment) throw new NotFoundException("Evaluación no encontrada");

    if (assessment.teacher.userId !== teacherUserId) {
      throw new ForbiddenException("Solo el profesor a cargo puede recalcular");
    }

    const maxScore = assessment.questions.reduce((sum, q) => sum + q.points, 0);
    let recalculatedGrades = 0;

    for (const attempt of assessment.attempts) {
      const totalScore = attempt.answers.reduce((sum, a) => sum + (a.score ?? 0), 0);
      const percentage = maxScore > 0 ? Number(((totalScore / maxScore) * 100).toFixed(1)) : 0;

      await this.prisma.assessmentAttempt.update({
        where: { id: attempt.id },
        data: { totalScore, percentage },
      });

      const grade = this.percentageToGrade(percentage);
      await this.prisma.grade.upsert({
        where: { assessmentId_studentId: { assessmentId, studentId: attempt.studentId } },
        create: {
          assessmentId,
          studentId: attempt.studentId,
          grade,
          score: totalScore,
          percentage,
          recordedBy: teacherUserId,
        },
        update: { grade, score: totalScore, percentage },
      });

      recalculatedGrades++;
    }

    return {
      assessmentId,
      attemptsProcessed: assessment.attempts.length,
      gradesRecalculated: recalculatedGrades,
      maxScore,
    };
  }

  // ══════════════════════════════════════════════════════
  //  VOID QUESTION — Anular pregunta y recalcular
  // ══════════════════════════════════════════════════════

  async voidQuestion(assessmentId: string, questionId: string, teacherUserId: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { teacher: true },
    });
    if (!assessment) throw new NotFoundException("Evaluación no encontrada");

    if (assessment.teacher.userId !== teacherUserId) {
      throw new ForbiddenException("Solo el profesor a cargo puede anular preguntas");
    }

    if (["ACTIVE"].includes(assessment.status)) {
      throw new BadRequestException(
        "No se puede anular una pregunta mientras la evaluación está activa. Ciérrela primero.",
      );
    }

    const aq = await this.prisma.assessmentQuestion.findUnique({
      where: { assessmentId_questionId: { assessmentId, questionId } },
    });
    if (!aq) throw new NotFoundException("La pregunta no pertenece a esta evaluación");

    // Set all answers for this question to score 0, status VOID/OMITTED
    const updated = await this.prisma.studentAnswer.updateMany({
      where: {
        attempt: { assessmentId },
        questionId,
      },
      data: {
        score: 0,
        status: "OMITTED",
        isCorrect: false,
        isGraded: true,
      },
    });

    // Recalculate all grades
    const recalculation = await this.recalculateAssessment(assessmentId, teacherUserId);

    return {
      questionId,
      answersUpdated: updated.count,
      recalculation,
    };
  }

  // ══════════════════════════════════════════════════════
  //  ASSESSMENT GRADING SUMMARY
  // ══════════════════════════════════════════════════════

  async getGradingSummary(assessmentId: string, teacherUserId: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { teacher: true, _count: { select: { attempts: true, questions: true } } },
    });
    if (!assessment) throw new NotFoundException("Evaluación no encontrada");

    if (assessment.teacher.userId !== teacherUserId) {
      throw new ForbiddenException("Solo el profesor a cargo puede ver el resumen");
    }

    const [answersSummary, gradesList] = await Promise.all([
      this.prisma.studentAnswer.groupBy({
        by: ["status"],
        where: { attempt: { assessmentId } },
        _count: true,
      }),
      this.prisma.grade.findMany({
        where: { assessmentId },
        include: { student: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { student: { lastName: "asc" } },
      }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const row of answersSummary) {
      byStatus[row.status] = row._count;
    }

    const avgGrade = gradesList.length > 0
      ? Number((gradesList.reduce((s, g) => s + g.grade, 0) / gradesList.length).toFixed(2))
      : 0;

    return {
      assessmentId,
      title: assessment.title,
      totalQuestions: assessment._count.questions,
      totalAttempts: assessment._count.attempts,
      answersByStatus: byStatus,
      grades: {
        count: gradesList.length,
        average: avgGrade,
        details: gradesList.map((g) => ({
          studentId: g.studentId,
          studentName: `${g.student.firstName} ${g.student.lastName}`,
          score: g.score,
          percentage: g.percentage,
          grade: g.grade,
        })),
      },
    };
  }

  // ══════════════════════════════════════════════════════
  //  PRIVATE
  // ══════════════════════════════════════════════════════

  async updateGradeRecord(gradeId: string, grade: number, comments?: string, userId?: string) {
    const record = await this.prisma.grade.findUnique({
      where: { id: gradeId },
      include: { assessment: { select: { status: true } } },
    });
    if (!record) throw new NotFoundException("Registro de nota no encontrado");

    if (record.assessment.status === "ACTIVE") {
      throw new BadRequestException("No se puede modificar la nota mientras la evaluación está activa");
    }

    if (grade < 1.0 || grade > 7.0) {
      throw new BadRequestException("La nota debe estar entre 1.0 y 7.0");
    }

    const updated = await this.prisma.grade.update({
      where: { id: gradeId },
      data: {
        grade,
        ...(comments !== undefined && { comments }),
        ...(userId && { recordedBy: userId }),
      },
    });

    return { ok: true, gradeId: updated.id, grade: updated.grade, comments: updated.comments };
  }

  private percentageToGrade(percentage: number): number {
    const grade = 1.0 + (percentage / 100) * 6.0;
    return Number(Math.min(7.0, Math.max(1.0, Math.round(grade * 10) / 10)));
  }
}
