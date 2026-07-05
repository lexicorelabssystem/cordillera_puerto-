import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { NotificationsService } from "../../notifications/notifications.service.js";
import { AnswerStatus } from "@prisma/client";
import {
  assertAssessmentScope,
  assertCourseScope,
  assertGradeScope,
  assertStudentScope,
} from "../../../common/authz/access-scope.js";

@Injectable()
export class GradingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

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
    await assertAssessmentScope(this.prisma, teacherUserId, answer.attempt.assessmentId);

    if (answer.attempt.assessment.teacher.userId !== teacherUserId && answerId === "__scope_checked__") {
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

    await this.recalculateAssessment(answer.attempt.assessmentId, teacherUserId);

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
    if (!grades.length) {
      return {
        total: 0,
        successCount: 0,
        errorCount: 0,
        results,
      };
    }

    const answerIds = [...new Set(grades.map((item) => item.answerId))];
    const answers = await this.prisma.studentAnswer.findMany({
      where: { id: { in: answerIds } },
      include: {
        attempt: {
          select: {
            assessmentId: true,
            assessment: {
              select: {
                status: true,
                teacher: { select: { userId: true } },
              },
            },
          },
        },
        question: { select: { id: true, points: true } },
      },
    });
    const answerById = new Map(answers.map((answer) => [answer.id, answer]));
    const assessmentIds = [...new Set(answers.map((answer) => answer.attempt.assessmentId))];

    for (const assessmentId of assessmentIds) {
      await assertAssessmentScope(this.prisma, teacherUserId, assessmentId);
    }

    const assessmentQuestions = assessmentIds.length > 0
      ? await this.prisma.assessmentQuestion.findMany({
        where: { assessmentId: { in: assessmentIds } },
        select: { assessmentId: true, questionId: true, points: true },
      })
      : [];
    const pointsByAssessmentQuestion = new Map(
      assessmentQuestions.map((question) => [`${question.assessmentId}:${question.questionId}`, question.points]),
    );
    const validGrades: {
      answerId: string;
      assessmentId: string;
      score: number;
      status: AnswerStatus;
      isCorrect: boolean;
    }[] = [];

    for (const item of grades) {
      try {
        const answer = answerById.get(item.answerId);
        if (!answer) throw new NotFoundException("Respuesta no encontrada");

        if (answer.attempt.assessment.teacher.userId !== teacherUserId && item.answerId === "__scope_checked__") {
          throw new ForbiddenException("Solo el profesor a cargo puede corregir esta evaluación");
        }

        if (answer.attempt.assessment.status !== "IN_GRADING" && answer.attempt.assessment.status !== "CLOSED") {
          throw new BadRequestException(
            `La evaluación debe estar en IN_GRADING o CLOSED para corregir (actual: ${answer.attempt.assessment.status})`,
          );
        }

        const maxPoints = pointsByAssessmentQuestion.get(`${answer.attempt.assessmentId}:${answer.questionId}`) ?? answer.question.points;
        if (item.score > maxPoints) {
          throw new BadRequestException(`El puntaje (${item.score}) no puede superar el máximo (${maxPoints})`);
        }

        const isCorrect = item.score >= maxPoints;
        const status: AnswerStatus = item.status as AnswerStatus ?? (item.score <= 0 ? "INCORRECT" : item.score < maxPoints ? "PARTIAL" : "CORRECT");

        validGrades.push({
          answerId: item.answerId,
          assessmentId: answer.attempt.assessmentId,
          score: item.score,
          status,
          isCorrect,
        });
        results.push({ answerId: item.answerId, success: true });
      } catch (error) {
        results.push({
          answerId: item.answerId,
          success: false,
          error: error instanceof Error ? error.message : "Error desconocido",
        });
      }
    }

    if (validGrades.length > 0) {
      await this.prisma.$transaction(
        validGrades.map((item) => this.prisma.studentAnswer.update({
          where: { id: item.answerId },
          data: {
            score: item.score,
            isCorrect: item.isCorrect,
            status: item.status,
            isGraded: true,
          },
        })),
      );

      const affectedAssessmentIds = [...new Set(validGrades.map((item) => item.assessmentId))];
      for (const assessmentId of affectedAssessmentIds) {
        await this.recalculateAssessment(assessmentId, teacherUserId);
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

    await assertAssessmentScope(this.prisma, teacherUserId, assessmentId);

    if (assessment.teacher.userId !== teacherUserId && assessmentId === "__scope_checked__") {
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

    await assertAssessmentScope(this.prisma, teacherUserId, assessmentId);

    if (assessment.teacher.userId !== teacherUserId && assessmentId === "__scope_checked__") {
      throw new ForbiddenException("Solo el profesor a cargo puede recalcular");
    }

    const maxScore = assessment.questions.reduce((sum, q) => sum + q.points, 0);
    let recalculatedGrades = 0;
    let pendingAttempts = 0;

    for (const attempt of assessment.attempts) {
      const totalScore = attempt.answers.reduce((sum, a) => sum + (a.score ?? 0), 0);
      const percentage = maxScore > 0 ? Number(((totalScore / maxScore) * 100).toFixed(1)) : 0;
      const hasPendingManual = attempt.answers.some((answer) => !answer.isGraded);

      await this.prisma.assessmentAttempt.update({
        where: { id: attempt.id },
        data: { totalScore, percentage },
      });

      if (hasPendingManual) {
        pendingAttempts++;
        continue;
      }

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
      pendingAttempts,
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

    await assertAssessmentScope(this.prisma, teacherUserId, assessmentId);

    if (assessment.teacher.userId !== teacherUserId && assessmentId === "__scope_checked__") {
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

    await assertAssessmentScope(this.prisma, teacherUserId, assessmentId);

    if (assessment.teacher.userId !== teacherUserId && assessmentId === "__scope_checked__") {
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
  //  COURSE GRADE BOOK — Libro de Evaluaciones
  // ══════════════════════════════════════════════════════

  async getCourseGradeBook(courseId: string, subjectId?: string, userId?: string) {
    if (userId) await assertCourseScope(this.prisma, userId, courseId, subjectId);

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, name: true, gradeLevel: true, institutionId: true },
    });
    if (!course) throw new NotFoundException("Curso no encontrado");

    const assessmentWhere: Record<string, unknown> = {
      courseId,
      status: { not: "DRAFT" },
    };
    if (subjectId) assessmentWhere.subjectId = subjectId;

    const [students, assessments] = await Promise.all([
      this.prisma.student.findMany({
        where: { enrollments: { some: { courseId, isActive: true } } },
        include: {
          user: { select: { id: true } },
        },
        orderBy: { lastName: "asc" },
      }),
      this.prisma.assessment.findMany({
        where: assessmentWhere,
        include: {
          subject: { select: { id: true, name: true } },
          questions: {
            include: { question: { select: { id: true, learningObjectiveId: true, learningObjective: { select: { code: true, description: true } } } } },
          },
        },
        orderBy: [{ semester: "asc" }, { createdAt: "desc" }],
      }),
    ]);

    const studentIds = students.map((s) => s.id);
    const assessmentIds = assessments.map((a) => a.id);

    const grades = await this.prisma.grade.findMany({
      where: {
        assessmentId: { in: assessmentIds },
        studentId: { in: studentIds },
      },
    });

    const attempts = await this.prisma.assessmentAttempt.findMany({
      where: {
        assessmentId: { in: assessmentIds },
        studentId: { in: studentIds },
      },
      select: { assessmentId: true, studentId: true, totalScore: true, percentage: true, status: true },
    });

    const gradeMap = new Map<string, Map<string, typeof grades[0]>>();
    for (const g of grades) {
      if (!gradeMap.has(g.studentId)) gradeMap.set(g.studentId, new Map());
      gradeMap.get(g.studentId)!.set(g.assessmentId, g);
    }

    const attemptMap = new Map<string, Map<string, typeof attempts[0]>>();
    for (const a of attempts) {
      if (!attemptMap.has(a.studentId)) attemptMap.set(a.studentId, new Map());
      attemptMap.get(a.studentId)!.set(a.assessmentId, a);
    }

    const studentRows = students.map((s) => {
      const studentGrades: {
        gradeId: string;
        assessmentId: string;
        assessmentTitle: string;
        assessmentType: string;
        semester: number;
        subjectName: string;
        subjectId: string;
        weight: number;
        maxScore: number;
        score: number | null;
        percentage: number | null;
        grade: number | null;
        status: string;
        oaCode: string | null;
        oaDescription: string | null;
      }[] = [];

      let totalWeightedSum = 0;
      let totalWeight = 0;

      for (const a of assessments) {
        const g = gradeMap.get(s.id)?.get(a.id);
        const att = attemptMap.get(s.id)?.get(a.id);
        const oa = a.questions[0]?.question?.learningObjective;

        const score = g?.score ?? att?.totalScore ?? null;
        const percentage = g?.percentage ?? att?.percentage ?? null;
        const gradeValue = g?.grade ?? null;

        if (gradeValue !== null && a.weight) {
          totalWeightedSum += gradeValue * a.weight;
          totalWeight += a.weight;
        }

        studentGrades.push({
          gradeId: g?.id || "",
          assessmentId: a.id,
          assessmentTitle: a.title,
          assessmentType: a.assessmentType,
          semester: a.semester,
          subjectName: a.subject?.name || "",
          subjectId: a.subject?.id || "",
          weight: a.weight || 0,
          maxScore: a.maxScore,
          score,
          percentage,
          grade: gradeValue,
          status: att?.status || "PENDING",
          oaCode: oa?.code || null,
          oaDescription: oa?.description || null,
        });
      }

      const avgGrade = totalWeight > 0
        ? Number((totalWeightedSum / totalWeight).toFixed(1))
        : studentGrades.filter((sg) => sg.grade !== null).reduce((sum, sg) => sum + (sg.grade || 0), 0) / (studentGrades.filter((sg) => sg.grade !== null).length || 1);

      return {
        studentId: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        rut: s.rut || "",
        grades: studentGrades,
        average: Number(avgGrade.toFixed(1)),
        atRisk: Number(avgGrade.toFixed(1)) < 4.0,
        hasPending: studentGrades.some((sg) => sg.grade === null),
      };
    });

    const allGrades = grades.map((g) => g.grade);
    const courseAvg = allGrades.length > 0
      ? Number((allGrades.reduce((s, v) => s + v, 0) / allGrades.length).toFixed(1))
      : 0;

    const atRiskCount = studentRows.filter((s) => s.atRisk).length;
    const pendingsCount = studentRows.filter((s) => s.hasPending).length;
    const approvedCount = studentRows.filter((s) => s.average >= 4.0 && !s.hasPending).length;
    const approvalRate = studentRows.length > 0 ? Math.round((approvedCount / studentRows.length) * 100) : 0;

    // Detect OA with low performance
    const oaPerformance: Record<string, { code: string; description: string; grades: number[] }> = {};
    for (const s of studentRows) {
      for (const g of s.grades) {
        if (g.oaCode && g.grade !== null) {
          const key = g.oaCode;
          if (!oaPerformance[key]) oaPerformance[key] = { code: g.oaCode, description: g.oaDescription || "", grades: [] };
          oaPerformance[key].grades.push(g.grade);
        }
      }
    }
    const oaDescendidos = Object.values(oaPerformance)
      .filter((oa) => {
        const avg = oa.grades.reduce((s, v) => s + v, 0) / oa.grades.length;
        return avg < 4.0;
      })
      .map((oa) => ({
        code: oa.code,
        description: oa.description,
        average: Number((oa.grades.reduce((s, v) => s + v, 0) / oa.grades.length).toFixed(1)),
        count: oa.grades.length,
      }));

    return {
      course: { id: course.id, name: course.name, gradeLevel: course.gradeLevel },
      subjectId: subjectId || null,
      assessments: assessments.map((a) => ({
        id: a.id,
        title: a.title,
        type: a.assessmentType,
        status: a.status,
        weight: a.weight || 0,
        maxScore: a.maxScore,
        semester: a.semester,
        subjectName: a.subject?.name || "",
        subjectId: a.subject?.id || "",
        oaCode: a.questions[0]?.question?.learningObjective?.code || null,
        oaDescription: a.questions[0]?.question?.learningObjective?.description || null,
      })),
      students: studentRows,
      stats: {
        courseAvg,
        approvalRate,
        approvedCount,
        atRiskCount,
        pendingsCount,
        totalNotes: allGrades.length,
        totalStudents: students.length,
        totalAssessments: assessments.length,
        simceCount: assessments.filter((a) => a.assessmentType === "SIMCE").length,
        appliedCount: assessments.filter((a) => a.status !== "DRAFT" && a.status !== "PUBLISHED").length,
      },
      oaDescendidos,
    };
  }

  // ══════════════════════════════════════════════════════
  //  PRIVATE
  // ══════════════════════════════════════════════════════

  async updateGradeRecord(gradeId: string, grade: number, comments?: string, userId?: string, reason?: string) {
    if (userId) await assertGradeScope(this.prisma, userId, gradeId);

    const record = await this.prisma.grade.findUnique({
      where: { id: gradeId },
      include: {
        assessment: {
          select: {
            id: true,
            status: true,
            title: true,
            courseId: true,
            course: { select: { name: true, institutionId: true } },
          },
        },
        student: { select: { firstName: true, lastName: true } },
      },
    });
    if (!record) throw new NotFoundException("Registro de nota no encontrado");

    if (record.assessment.status === "ACTIVE") {
      throw new BadRequestException("No se puede modificar la nota mientras la evaluación está activa");
    }

    if (grade < 1.0 || grade > 7.0) {
      throw new BadRequestException("La nota debe estar entre 1.0 y 7.0");
    }

    const oldGrade = record.grade;
    const updated = await this.prisma.grade.update({
      where: { id: gradeId },
      data: {
        grade,
        ...(comments !== undefined && { comments }),
        ...(userId && { recordedBy: userId }),
      },
    });

    const changeReason = reason || comments || "No se especificó motivo";
    const studentName = `${record.assessment.course?.name || "Curso"} - ${record.student.firstName} ${record.student.lastName}`;

    if (userId && oldGrade !== grade) {
      const requestingUser = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true, role: true },
      });

      const teacherName = requestingUser ? `${requestingUser.firstName} ${requestingUser.lastName}` : "Docente";

      await this.notificationsService.createForRole({
        role: "UTP",
        institutionId: record.assessment.course?.institutionId || undefined,
        type: "GRADE_CHANGE",
        title: `Cambio de nota en evaluacion`,
        message: `${teacherName} modifico la nota de ${record.student.firstName} ${record.student.lastName} en "${record.assessment.title}" de ${oldGrade.toFixed(1)} a ${grade.toFixed(1)}.\n\nMotivo: ${changeReason}`,
        metadata: {
          gradeId,
          oldGrade,
          newGrade: grade,
          reason: changeReason,
          changedBy: userId,
          assessmentTitle: record.assessment.title,
          courseName: record.assessment.course?.name || "",
          studentName: `${record.student.firstName} ${record.student.lastName}`,
        },
      });
    }

    return { ok: true, gradeId: updated.id, grade: updated.grade, comments: updated.comments };
  }

  // ══════════════════════════════════════════════════════
  //  DIRECT GRADE — Crear/actualizar nota desde el Libro
  // ══════════════════════════════════════════════════════

  async directGradeRecord(
    assessmentId: string,
    studentId: string,
    grade: number,
    userId: string,
    comments?: string,
    reason?: string,
  ) {
    await assertAssessmentScope(this.prisma, userId, assessmentId);
    await assertStudentScope(this.prisma, userId, studentId);

    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { id: true, status: true, title: true, courseId: true, course: { select: { name: true, institutionId: true } } },
    });
    if (!assessment) throw new NotFoundException("Evaluación no encontrada");

    const enrollment = await this.prisma.enrollment.findFirst({
      where: { studentId, courseId: assessment.courseId, isActive: true },
    });
    if (!enrollment) throw new BadRequestException("El estudiante no pertenece a este curso");

    if (grade < 1.0 || grade > 7.0) {
      throw new BadRequestException("La nota debe estar entre 1.0 y 7.0");
    }

    const existing = await this.prisma.grade.findUnique({
      where: { assessmentId_studentId: { assessmentId, studentId } },
    });
    const oldGrade = existing?.grade;

    const record = await this.prisma.grade.upsert({
      where: { assessmentId_studentId: { assessmentId, studentId } },
      create: {
        assessmentId,
        studentId,
        grade,
        comments: comments || null,
        recordedBy: userId,
      },
      update: {
        grade,
        comments: comments !== undefined ? comments : undefined,
        recordedBy: userId,
      },
    });

    if (oldGrade !== undefined && oldGrade !== grade) {
      const student = await this.prisma.student.findUnique({
        where: { id: studentId },
        select: { firstName: true, lastName: true },
      });

      const requestingUser = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true, role: true },
      });

      const changeReason = reason || comments || "No se especificó motivo";
      const teacherName = requestingUser ? `${requestingUser.firstName} ${requestingUser.lastName}` : "Docente";
      const studentName = student ? `${student.firstName} ${student.lastName}` : "Estudiante";

      await this.notificationsService.createForRole({
        role: "UTP",
        institutionId: assessment.course?.institutionId || undefined,
        type: "GRADE_CHANGE",
        title: `Cambio de nota en evaluacion`,
        message: `${teacherName} modifico la nota de ${studentName} en "${assessment.title}" de ${oldGrade.toFixed(1)} a ${grade.toFixed(1)}.\n\nMotivo: ${changeReason}`,
        metadata: {
          gradeId: record.id,
          oldGrade,
          newGrade: grade,
          reason: changeReason,
          changedBy: userId,
          assessmentTitle: assessment.title,
          courseName: assessment.course?.name || "",
          studentName,
        },
      });
    }

    return { ok: true, gradeId: record.id, grade: record.grade, comments: record.comments };
  }

  async bulkDirectGrades(
    items: { assessmentId: string; studentId: string; grade: number; comments?: string }[],
    userId: string,
  ) {
    const results: { ok: boolean; gradeId: string; assessmentId: string; studentId: string; error?: string }[] = [];

    for (const item of items) {
      try {
        const r = await this.directGradeRecord(item.assessmentId, item.studentId, item.grade, userId, item.comments);
        results.push({ ok: true, gradeId: r.gradeId, assessmentId: item.assessmentId, studentId: item.studentId });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Error desconocido";
        results.push({ ok: false, gradeId: "", assessmentId: item.assessmentId, studentId: item.studentId, error: message });
      }
    }

    return {
      total: results.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  }

  private percentageToGrade(percentage: number): number {
    const grade = 1.0 + (percentage / 100) * 6.0;
    return Number(Math.min(7.0, Math.max(1.0, Math.round(grade * 10) / 10)));
  }
}
