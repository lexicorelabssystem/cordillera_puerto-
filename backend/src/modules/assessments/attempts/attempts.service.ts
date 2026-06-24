import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { AnswerStatus } from "@prisma/client";
import {
  assertAssessmentScope,
  assertStudentScope,
  resolveUserScope,
} from "../../../common/authz/access-scope.js";

@Injectable()
export class AttemptsService {
  constructor(private readonly prisma: PrismaService) {}

  // ══════════════════════════════════════════════════════
  //  START ATTEMPT
  // ══════════════════════════════════════════════════════

  async startAttempt(assessmentId: string, userId: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        course: { include: { enrollments: { where: { isActive: true } } } },
        questions: { include: { question: { include: { options: { select: { id: true, text: true, sortOrder: true } } } } } },
      },
    });
    if (!assessment) throw new NotFoundException("Evaluación no encontrada");

    if (assessment.status !== "ACTIVE") {
      throw new BadRequestException(`La evaluación no está activa (estado actual: ${assessment.status})`);
    }

    if (assessment.deliveryMode !== "ONLINE" && assessment.deliveryMode !== "MIXED") {
      throw new BadRequestException(
        `Esta evaluación es de modalidad ${assessment.deliveryMode} y no acepta respuestas online`,
      );
    }

    const student = await this.prisma.student.findUnique({ where: { userId } });
    if (!student) throw new ForbiddenException("Perfil de estudiante no encontrado");

    const isEnrolled = assessment.course.enrollments.some((e) => e.studentId === student.id);
    if (!isEnrolled) throw new ForbiddenException("No estás matriculado en el curso de esta evaluación");

    // Check existing attempts
    const existingAttempt = await this.prisma.assessmentAttempt.findFirst({
      where: { assessmentId, studentId: student.id },
      orderBy: { startedAt: "desc" },
    });

    // If student has an IN_PROGRESS attempt, return it (continue)
    if (existingAttempt && existingAttempt.status === "IN_PROGRESS") {
      // Check if time expired
      const timeStatus = this.checkTimeExpired(assessment.timeLimitMin, existingAttempt.startedAt);
      if (timeStatus.expired && existingAttempt.status === "IN_PROGRESS") {
        await this.prisma.assessmentAttempt.update({
          where: { id: existingAttempt.id },
          data: { status: "TIMED_OUT", submittedAt: new Date(), timeSpentSec: timeStatus.elapsedSec },
        });
        throw new BadRequestException("El tiempo de la evaluación ha expirado");
      }

      return this.formatAttemptResponse(existingAttempt, assessment);
    }

    // If COMPLETED or TIMED_OUT and no retake
    if (existingAttempt && !assessment.allowRetake) {
      throw new BadRequestException("Ya completaste esta evaluación. No se permiten reintentos.");
    }

    // Check if endDate has passed
    if (assessment.endDate && new Date() > assessment.endDate) {
      throw new BadRequestException("La fecha de cierre de la evaluación ya pasó");
    }

    if (assessment.startDate && new Date() < assessment.startDate) {
      throw new BadRequestException("La evaluación aún no comienza");
    }

    // Create new attempt
    const attempt = await this.prisma.assessmentAttempt.create({
      data: {
        assessmentId,
        studentId: student.id,
        userId,
        status: "IN_PROGRESS",
        startedAt: new Date(),
      },
    });

    return this.formatAttemptResponse(attempt, assessment);
  }

  // ══════════════════════════════════════════════════════
  //  SAVE ANSWERS (auto-save compatible)
  // ══════════════════════════════════════════════════════

  async saveAnswers(
    attemptId: string,
    userId: string,
    answers: { questionId: string; selectedOptionId?: string; textAnswer?: string }[],
    timeSpentSec?: number,
  ) {
    const scope = await resolveUserScope(this.prisma, userId);
    if (!scope.studentId) throw new ForbiddenException("Perfil de estudiante no encontrado");

    const attempt = await this.prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      include: { assessment: { include: { questions: { include: { question: true } } } } },
    });
    if (!attempt) throw new NotFoundException("Intento no encontrado");

    if (attempt.studentId !== scope.studentId) throw new ForbiddenException("Este intento no te pertenece");

    if (attempt.status !== "IN_PROGRESS") {
      throw new BadRequestException(`No se pueden guardar respuestas: el intento está ${attempt.status}`);
    }

    // Check time expiration
    const timeStatus = this.checkTimeExpired(attempt.assessment.timeLimitMin, attempt.startedAt);
    if (timeStatus.expired) {
      await this.prisma.assessmentAttempt.update({
        where: { id: attemptId },
        data: { status: "TIMED_OUT", submittedAt: new Date(), timeSpentSec: timeStatus.elapsedSec },
      });
      throw new BadRequestException("El tiempo de la evaluación ha expirado");
    }

    const questionIds = attempt.assessment.questions.map((aq) => aq.questionId);

    const results = [];
    for (const answer of answers) {
      if (!questionIds.includes(answer.questionId)) {
        throw new BadRequestException(`La pregunta ${answer.questionId} no pertenece a esta evaluación`);
      }

      const aq = attempt.assessment.questions.find((q) => q.questionId === answer.questionId);
      if (!aq) continue;

      // Auto-grade if possible
      let isCorrect: boolean | null = null;
      let score: number | null = null;
      let isGraded = false;
      let status: AnswerStatus = "PENDING";

      if (answer.selectedOptionId && ["MULTIPLE_CHOICE", "TRUE_FALSE"].includes(aq.question.type)) {
        const option = await this.prisma.questionOption.findUnique({
          where: { id: answer.selectedOptionId },
        });
        isCorrect = option?.isCorrect ?? false;
        score = isCorrect ? aq.points : 0;
        isGraded = true;
        status = isCorrect ? "CORRECT" : "INCORRECT";
      } else if (answer.textAnswer && ["SHORT_ANSWER", "ESSAY"].includes(aq.question.type)) {
        status = "MANUAL_REVIEW";
        isGraded = false;
      } else if (!answer.selectedOptionId && !answer.textAnswer) {
        status = "OMITTED";
        score = 0;
      }

      const saved = await this.prisma.studentAnswer.upsert({
        where: { attemptId_questionId: { attemptId, questionId: answer.questionId } },
        create: {
          attemptId,
          questionId: answer.questionId,
          selectedOptionId: answer.selectedOptionId ?? null,
          textAnswer: answer.textAnswer ?? null,
          isCorrect,
          score,
          status,
          isGraded,
          answeredAt: new Date(),
        },
        update: {
          selectedOptionId: answer.selectedOptionId ?? null,
          textAnswer: answer.textAnswer ?? null,
          isCorrect,
          score,
          status,
          isGraded,
          answeredAt: new Date(),
        },
      });

      results.push(saved);
    }

    // Update time spent
    if (timeSpentSec !== undefined) {
      await this.prisma.assessmentAttempt.update({
        where: { id: attemptId },
        data: { timeSpentSec },
      });
    }

    return {
      saved: results.length,
      answers: results.map((a) => ({
        questionId: a.questionId,
        isCorrect: a.isCorrect,
        score: a.score,
        isGraded: a.isGraded,
      })),
    };
  }

  // ══════════════════════════════════════════════════════
  //  SUBMIT ATTEMPT
  // ══════════════════════════════════════════════════════

  async submitAttempt(attemptId: string, userId: string, timeSpentSec?: number, confirmEmpty?: boolean) {
    const scope = await resolveUserScope(this.prisma, userId);
    if (!scope.studentId) throw new ForbiddenException("Perfil de estudiante no encontrado");

    const attempt = await this.prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      include: {
        assessment: {
          include: {
            questions: { include: { question: true } },
            course: { include: { academicYear: true } },
          },
        },
        answers: true,
      },
    });
    if (!attempt) throw new NotFoundException("Intento no encontrado");

    if (attempt.studentId !== scope.studentId) throw new ForbiddenException("Este intento no te pertenece");

    if (attempt.status !== "IN_PROGRESS") {
      throw new BadRequestException(`El intento ya fue ${attempt.status === "COMPLETED" ? "enviado" : attempt.status}`);
    }

    // Check for unanswered questions
    if (!confirmEmpty) {
      const answeredIds = new Set(attempt.answers.map((a) => a.questionId));
      const unanswered = attempt.assessment.questions.filter((q) => !answeredIds.has(q.questionId));
      if (unanswered.length > 0) {
        throw new BadRequestException({
          message: `Hay ${unanswered.length} pregunta(s) sin responder`,
          unansweredCount: unanswered.length,
          requireConfirmation: true,
        });
      }
    }

    // Auto-grade any remaining ungraded answers
    const ungradedAnswers = attempt.answers.filter(
      (a) => !a.isGraded && a.selectedOptionId,
    );

    for (const answer of ungradedAnswers) {
      const aq = attempt.assessment.questions.find((q) => q.questionId === answer.questionId);
      if (!aq || !["MULTIPLE_CHOICE", "TRUE_FALSE"].includes(aq.question.type)) continue;

      const option = await this.prisma.questionOption.findUnique({
        where: { id: answer.selectedOptionId! },
      });

      await this.prisma.studentAnswer.update({
        where: { id: answer.id },
        data: {
          isCorrect: option?.isCorrect ?? false,
          score: (option?.isCorrect ?? false) ? aq.points : 0,
          isGraded: true,
        },
      });
    }

    const savedAnswerIds = new Set(attempt.answers.map((answer) => answer.questionId));
    const omittedQuestions = attempt.assessment.questions.filter((question) => !savedAnswerIds.has(question.questionId));
    for (const question of omittedQuestions) {
      await this.prisma.studentAnswer.create({
        data: {
          attemptId,
          questionId: question.questionId,
          selectedOptionId: null,
          textAnswer: null,
          isCorrect: false,
          score: 0,
          status: "OMITTED",
          isGraded: true,
          answeredAt: new Date(),
        },
      });
    }

    // Calculate total score
    const allAnswers = await this.prisma.studentAnswer.findMany({
      where: { attemptId },
    });

    const totalScore = allAnswers.reduce((sum, a) => sum + (a.score ?? 0), 0);
    const maxScore = attempt.assessment.questions.reduce((sum, q) => sum + q.points, 0);
    const percentage = maxScore > 0 ? Number(((totalScore / maxScore) * 100).toFixed(1)) : 0;
    const pendingManualCount = allAnswers.filter((a) => !a.isGraded).length;
    const finalGrade = this.percentageToGrade(percentage);

    const elapsed = timeSpentSec ?? Math.floor(
      (Date.now() - attempt.startedAt.getTime()) / 1000,
    );

    await this.prisma.assessmentAttempt.update({
      where: { id: attemptId },
      data: {
        status: "COMPLETED",
        submittedAt: new Date(),
        timeSpentSec: elapsed,
        totalScore,
        percentage,
      },
    });

    if (pendingManualCount === 0) {
      await this.prisma.grade.upsert({
        where: { assessmentId_studentId: { assessmentId: attempt.assessmentId, studentId: attempt.studentId } },
        create: {
          assessmentId: attempt.assessmentId,
          studentId: attempt.studentId,
          grade: finalGrade,
          score: totalScore,
          percentage,
          recordedBy: userId,
        },
        update: {
          grade: finalGrade,
          score: totalScore,
          percentage,
        },
      });
    }

    return {
      attemptId,
      status: "COMPLETED",
      totalScore,
      maxScore,
      percentage,
      grade: pendingManualCount === 0 ? finalGrade : null,
      gradedCount: allAnswers.filter((a) => a.isGraded).length,
      pendingManualCount,
    };
  }

  // ══════════════════════════════════════════════════════
  //  GET ATTEMPT STATUS (for student view)
  // ══════════════════════════════════════════════════════

  async getAttempt(attemptId: string, userId: string) {
    const attempt = await this.prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      include: {
        assessment: {
          select: {
            id: true, title: true, status: true, timeLimitMin: true,
            deliveryMode: true, maxScore: true, allowRetake: true,
            shuffleQuestions: true,
          },
        },
        answers: {
          include: {
            question: {
              include: {
                options: { orderBy: { sortOrder: "asc" }, select: { id: true, text: true, sortOrder: true, isCorrect: true } },
              },
            },
          },
        },
      },
    });
    if (!attempt) throw new NotFoundException("Intento no encontrado");

    if (attempt.userId !== userId) {
      await assertAssessmentScope(this.prisma, userId, attempt.assessmentId);
    }

    // Check time expiration
    const timeStatus = this.checkTimeExpired(attempt.assessment.timeLimitMin, attempt.startedAt);
    if (timeStatus.expired && attempt.status === "IN_PROGRESS") {
      await this.prisma.assessmentAttempt.update({
        where: { id: attemptId },
        data: { status: "TIMED_OUT", submittedAt: new Date(), timeSpentSec: timeStatus.elapsedSec },
      });
      return { ...attempt, status: "TIMED_OUT", timeExpired: true };
    }

    return {
      ...attempt,
      timeRemainingSec: timeStatus.remainingSec,
      timeExpired: timeStatus.expired,
      // Ocultar isCorrect de las opciones si el intento está en progreso
      answers: attempt.answers.map((answer) => {
        if (attempt.status !== "IN_PROGRESS") return answer;
        const { isCorrect: _isCorrect, score: _score, status: _status, isGraded: _isGraded, question, ...safeAnswer } = answer;
        const { explanation: _explanation, options, ...safeQuestion } = question;
        return {
          ...safeAnswer,
          question: {
            ...safeQuestion,
            options: options.map(({ isCorrect: _optionIsCorrect, ...option }) => option),
          },
        };
      }),
    };
  }

  // ══════════════════════════════════════════════════════
  //  TEACHER ACTIONS
  // ══════════════════════════════════════════════════════

  async teacherForceClose(assessmentId: string, teacherUserId: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { teacher: true },
    });
    if (!assessment) throw new NotFoundException("Evaluación no encontrada");

    await assertAssessmentScope(this.prisma, teacherUserId, assessmentId);

    const openAttempts = await this.prisma.assessmentAttempt.findMany({
      where: { assessmentId, status: "IN_PROGRESS" },
    });

    if (openAttempts.length === 0) return { closed: 0, message: "No hay intentos abiertos" };

    await this.prisma.assessmentAttempt.updateMany({
      where: { assessmentId, status: "IN_PROGRESS" },
      data: { status: "CLOSED", submittedAt: new Date() },
    });

    return { closed: openAttempts.length };
  }

  async teacherCancelAttempt(attemptId: string, teacherUserId: string) {
    const attempt = await this.prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      include: { assessment: { include: { teacher: true } } },
    });
    if (!attempt) throw new NotFoundException("Intento no encontrado");

    await assertAssessmentScope(this.prisma, teacherUserId, attempt.assessmentId);

    if (!["IN_PROGRESS", "COMPLETED"].includes(attempt.status)) {
      throw new BadRequestException(`Solo se pueden cancelar intentos en progreso o completados`);
    }

    return this.prisma.assessmentAttempt.update({
      where: { id: attemptId },
      data: { status: "CANCELLED" },
    });
  }

  // ══════════════════════════════════════════════════════
  //  LIST ATTEMPTS
  // ══════════════════════════════════════════════════════

  async listByAssessment(assessmentId: string, teacherUserId: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { teacher: true },
    });
    if (!assessment) throw new NotFoundException("Evaluación no encontrada");

    await assertAssessmentScope(this.prisma, teacherUserId, assessmentId);

    // Teacher must own the assessment OR be admin/direction
    return this.prisma.assessmentAttempt.findMany({
      where: { assessmentId },
      orderBy: { startedAt: "desc" },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { answers: true } },
      },
    });
  }

  async listByStudent(studentId: string, userId: string) {
    await assertStudentScope(this.prisma, userId, studentId);

    return this.prisma.assessmentAttempt.findMany({
      where: { studentId },
      orderBy: { startedAt: "desc" },
      include: {
        assessment: {
          select: { id: true, title: true, subject: { select: { name: true } }, assessmentType: true },
        },
      },
    });
  }

  // ══════════════════════════════════════════════════════
  //  PRIVATE HELPERS
  // ══════════════════════════════════════════════════════

  private checkTimeExpired(timeLimitMin: number | null, startedAt: Date): { expired: boolean; elapsedSec: number; remainingSec: number | null } {
    if (!timeLimitMin) return { expired: false, elapsedSec: 0, remainingSec: null };

    const elapsedMs = Date.now() - startedAt.getTime();
    const elapsedSec = Math.floor(elapsedMs / 1000);
    const limitSec = timeLimitMin * 60;
    const remainingSec = Math.max(0, limitSec - elapsedSec);

    return {
      expired: elapsedSec >= limitSec,
      elapsedSec,
      remainingSec: remainingSec > 0 ? remainingSec : 0,
    };
  }

  private percentageToGrade(percentage: number): number {
    // 0% = 1.0, 100% = 7.0 (Chilean scale)
    // Formula: 1 + (percentage / 100) * 6
    const grade = 1.0 + (percentage / 100) * 6.0;
    return Number(Math.min(7.0, Math.max(1.0, Math.round(grade * 10) / 10)));
  }

  private formatAttemptResponse(attempt: { id: string; assessmentId: string; startedAt: Date; status: string }, assessment: { timeLimitMin: number | null; questions: unknown[] }) {
    const timeStatus = this.checkTimeExpired(assessment.timeLimitMin, attempt.startedAt);
    return {
      attemptId: attempt.id,
      assessmentId: attempt.assessmentId,
      startedAt: attempt.startedAt.toISOString(),
      deadline: assessment.timeLimitMin
        ? new Date(attempt.startedAt.getTime() + assessment.timeLimitMin * 60000).toISOString()
        : null,
      timeLimitMin: assessment.timeLimitMin,
      totalQuestions: assessment.questions.length,
      remainingSec: timeStatus.remainingSec,
      status: attempt.status,
    };
  }
}
