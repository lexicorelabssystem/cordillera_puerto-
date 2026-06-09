import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import * as ExcelJS from "exceljs";
import * as path from "node:path";
import * as fs from "node:fs";
import * as crypto from "node:crypto";
import type { SimceStatus } from "@prisma/client";
import type {
  CreateSimceAssessmentDto, UpdateSimceAssessmentDto,
  SaveAnswerKeyDto, SaveStudentResponsesDto, BatchStudentResponsesDto,
} from "./dto/simce.dto.js";
import { resolveUserScope } from "../../common/authz/access-scope.js";
import type { JwtPayload } from "../../common/decorators/current-user.decorator.js";

const VALID_STATUS_TRANSITIONS: Record<SimceStatus, SimceStatus[]> = {
  DRAFT:            ["KEY_PENDING"],
  KEY_PENDING:      ["READY_TO_CORRECT", "DRAFT"],
  READY_TO_CORRECT: ["CORRECTED", "KEY_PENDING"],
  CORRECTED:        ["READY_TO_CORRECT"],
};

function assertScopeForCourse(
  scope: Awaited<ReturnType<typeof resolveUserScope>>,
  courseInstitutionId: string,
  courseId: string,
  subjectId?: string | null,
) {
  if (scope.isGlobalAdmin) return;

  if (["ADMIN", "DIRECTION", "UTP"].includes(scope.role)) {
    if (!scope.institutionId || courseInstitutionId !== scope.institutionId) {
      throw new ForbiddenException("No tienes acceso a este curso");
    }
    return;
  }

  if (scope.role === "TEACHER") {
    const assigned = scope.assignments.some(
      (a) => a.courseId === courseId && (!subjectId || a.subjectId === subjectId),
    );
    if (!assigned) throw new ForbiddenException("No tienes asignado este curso/asignatura");
    return;
  }

  if (scope.role === "STUDENT" && scope.studentId) {
    return; // handled separately per student
  }

  throw new ForbiddenException("No tienes acceso a este recurso");
}

function assertScopeForStudent(
  scope: Awaited<ReturnType<typeof resolveUserScope>>,
  enrollment: { course: { id: string; institutionId: string } } | null,
  studentId: string,
) {
  if (scope.isGlobalAdmin) return;
  if (["ADMIN", "DIRECTION", "UTP"].includes(scope.role)) {
    if (enrollment && scope.institutionId && enrollment.course.institutionId === scope.institutionId) return;
    throw new ForbiddenException("No tienes acceso a este estudiante");
  }
  if (scope.role === "TEACHER") {
    if (!enrollment || !scope.assignments.some((a) => a.courseId === enrollment.course.id)) {
      throw new ForbiddenException("No tienes acceso a este estudiante");
    }
    return;
  }
  if (scope.role === "STUDENT") {
    if (!scope.studentId || scope.studentId !== studentId) {
      throw new ForbiddenException("No tienes acceso a este estudiante");
    }
    return;
  }
  throw new ForbiddenException("No tienes acceso a este estudiante");
}

@Injectable()
export class SimceService {
  constructor(private readonly prisma: PrismaService) {}

  // ══════════════════════════════════════════════════════
  //  CRUD SimceAssessment
  // ══════════════════════════════════════════════════════

  async create(dto: CreateSimceAssessmentDto, userId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
      select: { id: true, institutionId: true, gradeLevel: true },
    });
    if (!course) throw new NotFoundException("Curso no encontrado");

    const scope = await resolveUserScope(this.prisma, userId);
    assertScopeForCourse(scope, course.institutionId, dto.courseId, scope.role === "TEACHER" ? null : dto.subjectId);

    let teacherId: string;
    if (scope.teacherId) {
      teacherId = scope.teacherId;
    } else {
      const teacher = await this.prisma.teacher.findFirst({
        where: {
          courseAssignments: { some: { courseId: dto.courseId, subjectId: dto.subjectId } },
        },
        select: { id: true },
      }) ?? await this.prisma.teacher.findFirst({
        where: {
          courseAssignments: { some: { courseId: dto.courseId } },
        },
        select: { id: true },
      });
      if (!teacher) throw new BadRequestException("No hay profesor asignado a este curso");
      teacherId = teacher.id;
    }

    return this.prisma.simceAssessment.create({
      data: {
        title: dto.title,
        courseId: dto.courseId,
        subjectId: dto.subjectId,
        teacherId,
        creatorId: userId,
        academicYearId: dto.academicYearId ?? null,
        gradeLevel: dto.gradeLevel,
        date: dto.date ? new Date(dto.date) : new Date(),
        description: dto.description ?? null,
        status: "DRAFT",
      },
      include: {
        course: { select: { id: true, name: true, gradeLevel: true } },
        subject: { select: { id: true, name: true } },
        teacher: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        academicYear: { select: { id: true, year: true } },
        _count: { select: { answerKeys: true, responses: true } },
      },
    });
  }

  async findAll(
    filters: { courseId?: string; subjectId?: string; status?: string; teacherId?: string; academicYearId?: string },
    page: number,
    limit: number,
    user: JwtPayload,
  ) {
    const scope = await resolveUserScope(this.prisma, user);
    const where: Record<string, unknown> = {};

    if (filters.subjectId) where.subjectId = filters.subjectId;
    if (filters.status) where.status = filters.status;
    if (filters.academicYearId) where.academicYearId = filters.academicYearId;

    if (filters.courseId) {
      const course = await this.prisma.course.findUnique({
        where: { id: filters.courseId },
        select: { id: true, institutionId: true },
      });
      if (!course) throw new NotFoundException("Curso no encontrado");
      assertScopeForCourse(scope, course.institutionId, filters.courseId, filters.subjectId);
      where.courseId = filters.courseId;
    } else if (scope.role === "TEACHER") {
      const courseIds = scope.assignments.map((a) => a.courseId);
      if (!courseIds.length) return { data: [], meta: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrevious: false } };
      where.courseId = { in: courseIds };
    } else if (!scope.isGlobalAdmin && scope.institutionId) {
      where.course = { institutionId: scope.institutionId };
    }

    if (filters.teacherId && scope.role !== "TEACHER") where.teacherId = filters.teacherId;

    const [data, total] = await Promise.all([
      this.prisma.simceAssessment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: {
          course: { select: { id: true, name: true, gradeLevel: true } },
          subject: { select: { id: true, name: true } },
          teacher: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
          academicYear: { select: { id: true, year: true } },
          _count: { select: { answerKeys: true, responses: true } },
        },
      }),
      this.prisma.simceAssessment.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrevious: page > 1 },
    };
  }

  async findById(id: string, user: JwtPayload) {
    const scope = await resolveUserScope(this.prisma, user);
    const assessment = await this.prisma.simceAssessment.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, name: true, gradeLevel: true, institutionId: true } },
        subject: { select: { id: true, name: true } },
        teacher: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        creator: { select: { id: true, firstName: true, lastName: true } },
        academicYear: { select: { id: true, year: true } },
        pdfFile: { select: { id: true, originalName: true, fileName: true, url: true, mimeType: true } },
        _count: { select: { answerKeys: true, responses: true } },
      },
    });
    if (!assessment) throw new NotFoundException("Prueba SIMCE no encontrada");

    assertScopeForCourse(scope, assessment.course.institutionId, assessment.courseId, assessment.subjectId);

    return assessment;
  }

  async update(id: string, dto: UpdateSimceAssessmentDto, user: JwtPayload) {
    const assessment = await this.findById(id, user);

    if (dto.status) {
      const currentStatus = assessment.status as SimceStatus;
      const allowed = VALID_STATUS_TRANSITIONS[currentStatus];
      if (!allowed || !allowed.includes(dto.status)) {
        throw new BadRequestException(
          `No puedes cambiar de ${currentStatus} a ${dto.status}. Transiciones válidas: ${allowed?.join(", ") ?? "ninguna"}`,
        );
      }
    }

    return this.prisma.simceAssessment.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.date && { date: new Date(dto.date) }),
        ...(dto.pdfFileId !== undefined && { pdfFileId: dto.pdfFileId }),
        ...(dto.academicYearId !== undefined && { academicYearId: dto.academicYearId }),
        ...(dto.status && { status: dto.status }),
      },
      include: {
        course: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        academicYear: { select: { id: true, year: true } },
        pdfFile: { select: { id: true, originalName: true, url: true } },
      },
    });
  }

  async delete(id: string, user: JwtPayload) {
    await this.findById(id, user);
    await this.prisma.simceAssessment.delete({ where: { id } });
    return { ok: true };
  }

  // ══════════════════════════════════════════════════════
  //  Pauta de corrección (Answer Key)
  // ══════════════════════════════════════════════════════

  async saveAnswerKey(assessmentId: string, dto: SaveAnswerKeyDto, user: JwtPayload) {
    const assessment = await this.findById(assessmentId, user);
    if (assessment.status === "CORRECTED") {
      throw new BadRequestException("No puedes modificar la pauta de una prueba ya corregida");
    }

    const ops = dto.items.map((item) =>
      this.prisma.simceAnswerKey.upsert({
        where: { assessmentId_questionNumber: { assessmentId, questionNumber: item.questionNumber } },
        create: {
          assessmentId,
          questionNumber: item.questionNumber,
          correctOption: item.correctOption.toUpperCase(),
          score: item.score ?? 1.0,
          axisId: item.axisId ?? null,
          skillId: item.skillId ?? null,
          oaId: item.oaId ?? null,
          observation: item.observation ?? null,
        },
        update: {
          correctOption: item.correctOption.toUpperCase(),
          score: item.score ?? 1.0,
          axisId: item.axisId ?? null,
          skillId: item.skillId ?? null,
          oaId: item.oaId ?? null,
          observation: item.observation ?? null,
        },
      }),
    );

    await Promise.all(ops);

    if (assessment.status === "DRAFT") {
      await this.prisma.simceAssessment.update({
        where: { id: assessmentId },
        data: { status: "KEY_PENDING" },
      });
    }

    return this.getAnswerKey(assessmentId, user);
  }

  async getAnswerKey(assessmentId: string, user: JwtPayload) {
    const assessment = await this.findById(assessmentId, user);
    const keys = await this.prisma.simceAnswerKey.findMany({
      where: { assessmentId },
      orderBy: { questionNumber: "asc" },
      include: {
        axis: { select: { id: true, name: true } },
        skill: { select: { id: true, name: true } },
        oa: { select: { id: true, code: true, description: true } },
      },
    });

    const totalQuestions = keys.length;
    const totalScore = keys.reduce((sum, k) => sum + k.score, 0);

    return { assessmentId, totalQuestions, totalScore, items: keys };
  }

  async confirmAnswerKey(assessmentId: string, user: JwtPayload) {
    const assessment = await this.findById(assessmentId, user);
    const keyCount = await this.prisma.simceAnswerKey.count({ where: { assessmentId } });
    if (!keyCount) throw new BadRequestException("Debes crear la pauta antes de confirmarla");

    return this.prisma.simceAssessment.update({
      where: { id: assessmentId },
      data: { status: "READY_TO_CORRECT" },
    });
  }

  // ══════════════════════════════════════════════════════
  //  Respuestas de estudiantes
  // ══════════════════════════════════════════════════════

  async saveStudentResponses(
    assessmentId: string,
    studentId: string,
    dto: SaveStudentResponsesDto,
    user: JwtPayload,
  ) {
    const assessment = await this.findById(assessmentId, user);
    if (assessment.status !== "READY_TO_CORRECT" && assessment.status !== "CORRECTED") {
      throw new BadRequestException("La pauta debe estar confirmada antes de ingresar respuestas");
    }

    const enrollment = await this.prisma.enrollment.findFirst({
      where: { studentId, courseId: assessment.courseId, isActive: true },
      select: { id: true, course: { select: { id: true, institutionId: true } } },
    });
    if (!enrollment) throw new BadRequestException("El estudiante no está matriculado en este curso");

    const scope = await resolveUserScope(this.prisma, user);
    assertScopeForStudent(scope, enrollment, studentId);

    const answerKeys = await this.prisma.simceAnswerKey.findMany({
      where: { assessmentId },
      select: { questionNumber: true, correctOption: true, score: true },
    });

    const ops = dto.responses.map((resp) => {
      const key = answerKeys.find((k) => k.questionNumber === resp.questionNumber);
      const selected = resp.selectedOption?.toUpperCase() || null;
      const isCorrect = selected === null ? null : (key ? selected === key.correctOption : null);
      const scoreObtained = isCorrect === true && key ? key.score : 0;

      return this.prisma.simceStudentResponse.upsert({
        where: {
          assessmentId_studentId_questionNumber: {
            assessmentId, studentId, questionNumber: resp.questionNumber,
          },
        },
        create: {
          assessmentId,
          studentId,
          questionNumber: resp.questionNumber,
          selectedOption: selected,
          isCorrect,
          scoreObtained,
        },
        update: {
          selectedOption: selected,
          isCorrect,
          scoreObtained,
        },
      });
    });

    await Promise.all(ops);

    return this.getStudentResult(assessmentId, studentId, user);
  }

  async batchSaveResponses(
    assessmentId: string,
    dto: BatchStudentResponsesDto[],
    user: JwtPayload,
  ) {
    const results = [];
    for (const batch of dto) {
      const result = await this.saveStudentResponses(
        assessmentId,
        batch.studentId,
        { responses: batch.responses },
        user,
      );
      results.push(result);
    }
    return results;
  }

  // ══════════════════════════════════════════════════════
  //  Auto-corrección y resultados
  // ══════════════════════════════════════════════════════

  async autoCorrectAll(assessmentId: string, user: JwtPayload) {
    const assessment = await this.findById(assessmentId, user);
    if (assessment.status !== "READY_TO_CORRECT" && assessment.status !== "CORRECTED") {
      throw new BadRequestException("La pauta debe estar confirmada");
    }

    const answerKeys = await this.prisma.simceAnswerKey.findMany({
      where: { assessmentId },
      select: { questionNumber: true, correctOption: true, score: true },
    });

    const studentIds = await this.prisma.simceStudentResponse.groupBy({
      by: ["studentId"],
      where: { assessmentId },
    });

    for (const { studentId } of studentIds) {
      const responses = await this.prisma.simceStudentResponse.findMany({
        where: { assessmentId, studentId },
        select: { id: true, questionNumber: true, selectedOption: true },
      });

      for (const resp of responses) {
        const key = answerKeys.find((k) => k.questionNumber === resp.questionNumber);
        const selected = resp.selectedOption?.toUpperCase() || null;
        const isCorrect = key && selected ? selected === key.correctOption : null;
        const scoreObtained = isCorrect && key ? key.score : 0;

        await this.prisma.simceStudentResponse.update({
          where: { id: resp.id },
          data: { isCorrect, scoreObtained },
        });
      }
    }

    await this.prisma.simceAssessment.update({
      where: { id: assessmentId },
      data: { status: "CORRECTED" },
    });

    return this.getResultsSummary(assessmentId, user);
  }

  async getStudentResult(assessmentId: string, studentId: string, user: JwtPayload) {
    const assessment = await this.findById(assessmentId, user);

    const enrollment = await this.prisma.enrollment.findFirst({
      where: { studentId, courseId: assessment.courseId, isActive: true },
      include: { course: { select: { id: true, institutionId: true } } },
    });

    const scope = await resolveUserScope(this.prisma, user);
    assertScopeForStudent(scope, enrollment, studentId);

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, firstName: true, lastName: true, rut: true },
    });
    if (!student) throw new NotFoundException("Estudiante no encontrado");

    const answerKeys = await this.prisma.simceAnswerKey.findMany({
      where: { assessmentId },
      orderBy: { questionNumber: "asc" },
    });

    const responses = await this.prisma.simceStudentResponse.findMany({
      where: { assessmentId, studentId },
      orderBy: { questionNumber: "asc" },
    });

    const questions = answerKeys.map((key) => {
      const resp = responses.find((r) => r.questionNumber === key.questionNumber);
      return {
        questionNumber: key.questionNumber,
        correctOption: key.correctOption,
        score: key.score,
        selectedOption: resp?.selectedOption ?? null,
        isCorrect: resp?.isCorrect ?? null,
        scoreObtained: resp?.scoreObtained ?? 0,
        status: resp?.selectedOption === null || resp?.selectedOption === undefined
          ? "OMITTED" : resp?.isCorrect ? "CORRECT" : "INCORRECT",
      };
    });

    const totalCorrect = questions.filter((q) => q.isCorrect === true).length;
    const totalIncorrect = questions.filter((q) => q.isCorrect === false).length;
    const totalOmitted = questions.filter((q) => q.selectedOption === null).length;
    const totalScore = questions.reduce((s, q) => s + q.scoreObtained, 0);
    const maxScore = answerKeys.reduce((s, k) => s + k.score, 0);
    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    const performanceLevel = percentage >= 80 ? "Avanzado"
      : percentage >= 60 ? "Adecuado"
      : percentage >= 40 ? "Básico"
      : "Crítico";

    return {
      student,
      assessment: { id: assessment.id, title: assessment.title },
      summary: { totalCorrect, totalIncorrect, totalOmitted, totalQuestions: questions.length, totalScore, maxScore, percentage, performanceLevel },
      questions,
    };
  }

  async getResultsSummary(assessmentId: string, user: JwtPayload) {
    const assessment = await this.findById(assessmentId, user);

    const answerKeys = await this.prisma.simceAnswerKey.findMany({
      where: { assessmentId },
      orderBy: { questionNumber: "asc" },
      include: {
        axis: { select: { id: true, name: true } },
        skill: { select: { id: true, name: true } },
        oa: { select: { id: true, code: true, description: true } },
      },
    });
    const maxScore = answerKeys.reduce((s, k) => s + k.score, 0);

    const enrolledStudents = await this.prisma.enrollment.findMany({
      where: { courseId: assessment.courseId, isActive: true },
      include: { student: { select: { id: true, firstName: true, lastName: true, rut: true } } },
      orderBy: { student: { lastName: "asc" } },
    });

    const allFullResponses = await this.prisma.simceStudentResponse.findMany({
      where: { assessmentId },
    });

    const responsesByQuestion: Record<number, { correct: number; incorrect: number; total: number }> = {};
    for (const r of allFullResponses) {
      if (!responsesByQuestion[r.questionNumber]) {
        responsesByQuestion[r.questionNumber] = { correct: 0, incorrect: 0, total: 0 };
      }
      responsesByQuestion[r.questionNumber].total++;
      if (r.isCorrect === true) responsesByQuestion[r.questionNumber].correct++;
      else if (r.isCorrect === false) responsesByQuestion[r.questionNumber].incorrect++;
    }

    const responsesByStudent: Record<string, typeof allFullResponses> = {};
    for (const r of allFullResponses) {
      if (!responsesByStudent[r.studentId]) responsesByStudent[r.studentId] = [];
      responsesByStudent[r.studentId].push(r);
    }

    const results: Array<{
      student: { id: string; firstName: string; lastName: string; rut: string | null };
      answered: boolean;
      totalCorrect: number;
      totalIncorrect: number;
      totalOmitted: number;
      totalQuestions: number;
      totalScore: number;
      percentage: number;
    }> = [];

    for (const enrollment of enrolledStudents) {
      const responses = responsesByStudent[enrollment.studentId] || [];

      const totalCorrect = responses.filter((r) => r.isCorrect === true).length;
      const totalIncorrect = responses.filter((r) => r.isCorrect === false).length;
      const totalOmitted = responses.filter((r) => r.selectedOption === null).length;
      const totalScore = responses.reduce((s, r) => s + r.scoreObtained, 0);
      const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
      const answered = responses.length > 0;

      results.push({
        student: enrollment.student,
        answered,
        totalCorrect,
        totalIncorrect,
        totalOmitted,
        totalQuestions: answerKeys.length,
        totalScore,
        percentage,
      });
    }

    const answeredResults = results.filter((r) => r.answered);
    const avgPercentage = answeredResults.length
      ? Math.round(answeredResults.reduce((s, r) => s + r.percentage, 0) / answeredResults.length)
      : 0;

    const questionsAnalysis = answerKeys.map((key) => {
      const stats = responsesByQuestion[key.questionNumber] || { correct: 0, incorrect: 0, total: 0 };
      const total = stats.total;
      const correctPercent = total > 0 ? Math.round((stats.correct / total) * 100) : 0;
      return {
        questionNumber: key.questionNumber,
        correctOption: key.correctOption,
        correctCount: stats.correct,
        incorrectCount: stats.incorrect,
        totalResponses: total,
        correctPercent,
        axis: key.axis ? { id: key.axis.id, name: key.axis.name } : null,
        skill: key.skill ? { id: key.skill.id, name: key.skill.name } : null,
        oa: key.oa ? { id: key.oa.id, code: key.oa.code, description: key.oa.description } : null,
      };
    });

    const weakestQuestions = [...questionsAnalysis]
      .filter((q) => q.totalResponses > 0)
      .sort((a, b) => a.correctPercent - b.correctPercent)
      .slice(0, 8);

    function aggregateByField(
      questions: typeof questionsAnalysis,
      field: "axis" | "skill" | "oa",
    ) {
      const groups: Record<string, { id: string; name: string; totalQuestions: number; totalCorrect: number; totalResponses: number }> = {};
      for (const q of questions) {
        const ref = q[field];
        if (!ref) continue;
        const key = ref.id;
        const refName = ("name" in ref ? ref.name : (ref as { description: string }).description) || "";
        if (!groups[key]) {
          groups[key] = { id: ref.id, name: refName, totalQuestions: 0, totalCorrect: 0, totalResponses: 0 };
        }
        groups[key].totalQuestions++;
        groups[key].totalCorrect += q.correctCount;
        groups[key].totalResponses += q.totalResponses;
      }
      return Object.values(groups)
        .map((g) => ({
          ...g,
          avgCorrectPercent: g.totalResponses > 0 ? Math.round((g.totalCorrect / g.totalResponses) * 100) : 0,
        }))
        .sort((a, b) => a.avgCorrectPercent - b.avgCorrectPercent);
    }

    const skillsPerformance = aggregateByField(questionsAnalysis, "skill");
    const axesPerformance = aggregateByField(questionsAnalysis, "axis");
    const oasPerformance = aggregateByField(questionsAnalysis, "oa");

    return {
      assessment: { id: assessment.id, title: assessment.title, status: assessment.status },
      maxScore,
      totalQuestions: answerKeys.length,
      totalStudents: enrolledStudents.length,
      answeredCount: answeredResults.length,
      avgPercentage,
      results,
      weakestQuestions,
      skillsPerformance,
      axesPerformance,
      oasPerformance,
    };
  }

  async getGroupReview(assessmentId: string, user: JwtPayload) {
    const assessment = await this.findById(assessmentId, user);

    const answerKeys = await this.prisma.simceAnswerKey.findMany({
      where: { assessmentId },
      orderBy: { questionNumber: "asc" },
    });

    const allResponses = await this.prisma.simceStudentResponse.findMany({
      where: { assessmentId },
      select: { questionNumber: true, selectedOption: true, isCorrect: true },
    });

    const totalStudents = await this.prisma.enrollment.count({
      where: { courseId: assessment.courseId, isActive: true },
    });

    const questionStats = answerKeys.map((key) => {
      const responses = allResponses.filter((r) => r.questionNumber === key.questionNumber);
      const answered = responses.length;
      const correct = responses.filter((r) => r.isCorrect === true).length;
      const incorrect = responses.filter((r) => r.isCorrect === false).length;
      const omitted = totalStudents - answered;

      const optionDist: Record<string, number> = {};
      for (const r of responses) {
        if (r.selectedOption) {
          optionDist[r.selectedOption] = (optionDist[r.selectedOption] || 0) + 1;
        }
      }

      return {
        questionNumber: key.questionNumber,
        correctOption: key.correctOption,
        score: key.score,
        axis: key.axisId,
        skill: key.skillId,
        oa: key.oaId,
        totalStudents,
        answered,
        omitted,
        correct,
        incorrect,
        correctPercent: answered > 0 ? Math.round((correct / totalStudents) * 100) : 0,
        optionDistribution: optionDist,
      };
    });

    return { assessmentId, totalStudents, totalQuestions: answerKeys.length, questions: questionStats };
  }

  async getQuestionStats(assessmentId: string, questionNumber: number, user: JwtPayload) {
    const assessment = await this.findById(assessmentId, user);

    const key = await this.prisma.simceAnswerKey.findUnique({
      where: { assessmentId_questionNumber: { assessmentId, questionNumber } },
    });
    if (!key) throw new NotFoundException("Pregunta no encontrada en la pauta");

    const totalStudents = await this.prisma.enrollment.count({
      where: { courseId: assessment.courseId, isActive: true },
    });

    const responses = await this.prisma.simceStudentResponse.findMany({
      where: { assessmentId, questionNumber },
      select: { selectedOption: true, isCorrect: true },
    });

    const optionDist: Record<string, number> = {};
    let correct = 0;
    let incorrect = 0;
    for (const r of responses) {
      if (r.selectedOption) {
        optionDist[r.selectedOption] = (optionDist[r.selectedOption] || 0) + 1;
      }
      if (r.isCorrect === true) correct++;
      else if (r.isCorrect === false) incorrect++;
    }
    const omitted = Math.max(0, totalStudents - correct - incorrect);

    return {
      questionNumber,
      correctOption: key.correctOption,
      totalStudents,
      correct,
      incorrect,
      omitted,
      correctPercent: totalStudents > 0 ? Math.round((correct / totalStudents) * 100) : 0,
      optionDistribution: optionDist,
    };
  }

  // ══════════════════════════════════════════════════════
  //  Exportación Excel
  // ══════════════════════════════════════════════════════

  private readonly exportDir = path.resolve("uploads", "exports");

  async exportResultsExcel(assessmentId: string, type: "course" | "student", studentId: string | undefined, user: JwtPayload) {
    fs.mkdirSync(this.exportDir, { recursive: true });

    const workbook = new ExcelJS.Workbook();

    if (type === "student" && studentId) {
      const result = await this.getStudentResult(assessmentId, studentId, user);
      const sheet = workbook.addWorksheet("Resultado Estudiante");

      sheet.addRow(["Resultado SIMCE - Estudiante"]);
      sheet.addRow([result.assessment.title]);
      sheet.addRow(["Estudiante", `${result.student.lastName}, ${result.student.firstName}`]);
      sheet.addRow([]);
      sheet.addRow(["Correctas", "Incorrectas", "Omitidas", "Puntaje", "Porcentaje", "Nivel"]);
      sheet.addRow([
        result.summary.totalCorrect,
        result.summary.totalIncorrect,
        result.summary.totalOmitted,
        `${result.summary.totalScore}/${result.summary.maxScore}`,
        `${result.summary.percentage}%`,
        result.summary.performanceLevel,
      ]);
      sheet.addRow([]);
      sheet.addRow(["Pregunta", "Alternativa correcta", "Marcó", "Correcta?", "Puntaje"]);
      for (const q of result.questions) {
        sheet.addRow([
          q.questionNumber,
          q.correctOption,
          q.selectedOption || "—",
          q.status === "CORRECT" ? "Sí" : q.status === "INCORRECT" ? "No" : "Omitida",
          `${q.scoreObtained}/${q.score}`,
        ]);
      }

      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, size: 14 };
      sheet.getRow(2).font = { bold: true };
      sheet.columns.forEach((col) => { col.width = 25; });
    } else {
      const summary = await this.getResultsSummary(assessmentId, user);
      const sheet = workbook.addWorksheet("Resultados Curso");

      sheet.addRow(["Resultados SIMCE - Curso"]);
      sheet.addRow([summary.assessment.title]);
      sheet.addRow([]);
      sheet.addRow(["Promedio", "Máx Puntaje", "Preguntas", "Estudiantes", "Respondieron"]);
      sheet.addRow([
        `${summary.avgPercentage}%`,
        summary.maxScore,
        summary.totalQuestions,
        summary.totalStudents,
        summary.answeredCount,
      ]);
      sheet.addRow([]);
      sheet.addRow(["#", "Estudiante", "Correctas", "Incorrectas", "Omitidas", "Puntaje", "%", "Nivel"]);
      for (let i = 0; i < summary.results.length; i++) {
        const r = summary.results[i];
        const level = r.percentage >= 80 ? "Avanzado" : r.percentage >= 60 ? "Adecuado" : r.percentage >= 40 ? "Básico" : "Crítico";
        sheet.addRow([
          i + 1,
          r.answered ? `${r.student.lastName}, ${r.student.firstName}` : `${r.student.lastName}, ${r.student.firstName} (sin responder)`,
          r.answered ? r.totalCorrect : "—",
          r.answered ? r.totalIncorrect : "—",
          r.answered ? r.totalOmitted : "—",
          r.answered ? `${r.totalScore}/${summary.maxScore}` : "—",
          r.answered ? `${r.percentage}%` : "—",
          r.answered ? level : "—",
        ]);
      }

      if (summary.weakestQuestions && summary.weakestQuestions.length > 0) {
        sheet.addRow([]);
        sheet.addRow(["Preguntas con mayor dificultad"]);
        sheet.addRow(["Pregunta", "Alt. Correcta", "Aciertos", "Errores", "% Acierto"]);
        for (const q of summary.weakestQuestions) {
          sheet.addRow([q.questionNumber, q.correctOption, q.correctCount, q.incorrectCount, `${q.correctPercent}%`]);
        }
      }

      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, size: 14 };
      sheet.getRow(2).font = { bold: true };
      sheet.columns.forEach((col) => { col.width = 25; });
    }

    const fileId = crypto.randomUUID();
    const fileName = `simce_export_${fileId}.xlsx`;
    const filePath = path.join(this.exportDir, fileName);
    await workbook.xlsx.writeFile(filePath);

    return { fileName, format: "xlsx", downloadUrl: `/api/v1/files/download/${fileName}` };
  }

  async getStudentSimceResults(user: JwtPayload) {
    const scope = await resolveUserScope(this.prisma, user);
    if (!scope.studentId) throw new ForbiddenException("Solo los estudiantes pueden ver sus resultados SIMCE");

    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId: scope.studentId, isActive: true },
      select: { courseId: true },
    });
    const courseIds = enrollments.map((e) => e.courseId);
    if (!courseIds.length) return [];

    const assessments = await this.prisma.simceAssessment.findMany({
      where: { courseId: { in: courseIds }, status: "CORRECTED" },
      orderBy: { date: "desc" },
      include: {
        course: { select: { id: true, name: true, gradeLevel: true } },
        subject: { select: { id: true, name: true } },
        teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        _count: { select: { answerKeys: true } },
      },
    });

    const results = [];
    for (const assessment of assessments) {
      const answerKeys = await this.prisma.simceAnswerKey.findMany({
        where: { assessmentId: assessment.id },
      });
      const maxScore = answerKeys.reduce((s, k) => s + k.score, 0);

      const responses = await this.prisma.simceStudentResponse.findMany({
        where: { assessmentId: assessment.id, studentId: scope.studentId },
      });

      const totalCorrect = responses.filter((r) => r.isCorrect === true).length;
      const totalIncorrect = responses.filter((r) => r.isCorrect === false).length;
      const totalOmitted = responses.filter((r) => r.selectedOption === null).length;
      const totalScore = responses.reduce((s, r) => s + r.scoreObtained, 0);
      const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

      results.push({
        id: assessment.id,
        title: assessment.title,
        date: assessment.date,
        course: assessment.course.name,
        gradeLevel: assessment.course.gradeLevel,
        subject: assessment.subject.name,
        teacher: `${assessment.teacher.user.firstName} ${assessment.teacher.user.lastName}`,
        totalQuestions: answerKeys.length,
        maxScore,
        totalCorrect,
        totalIncorrect,
        totalOmitted,
        totalScore,
        percentage,
        pdfFile: assessment.pdfFileId ? { id: assessment.pdfFileId } : null,
      });
    }

    return results;
  }

  async getStudentSimceDetail(assessmentId: string, user: JwtPayload) {
    const scope = await resolveUserScope(this.prisma, user);
    if (!scope.studentId) throw new ForbiddenException("Solo los estudiantes pueden ver sus resultados SIMCE");

    return this.getStudentResult(assessmentId, scope.studentId, user);
  }

  async getStudentSimceEssays(user: JwtPayload) {
    const scope = await resolveUserScope(this.prisma, user);
    if (!scope.studentId) throw new ForbiddenException("Solo los estudiantes pueden ver sus ensayos SIMCE");

    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId: scope.studentId, isActive: true },
      select: {
        courseId: true,
        course: { select: { gradeLevel: true, institutionId: true } },
      },
    });
    const courseIds = enrollments.map((e) => e.courseId);
    const gradeLevels = [...new Set(enrollments.map((e) => e.course.gradeLevel))];
    const institutionIds = [...new Set(enrollments.map((e) => e.course.institutionId))];
    if (!courseIds.length) return [];

    const assessments = await this.prisma.simceAssessment.findMany({
      where: {
        OR: [
          { courseId: { in: courseIds } },
          {
            gradeLevel: { in: gradeLevels },
            course: { institutionId: { in: institutionIds } },
          },
        ],
      },
      orderBy: { date: "desc" },
      include: {
        course: { select: { id: true, name: true, gradeLevel: true } },
        subject: { select: { id: true, name: true } },
        teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        pdfFile: { select: { id: true, originalName: true, fileName: true, url: true } },
        _count: { select: { answerKeys: true } },
      },
    });

    return assessments.map((a) => ({
      id: a.id,
      title: a.title,
      date: a.date,
      description: a.description,
      status: a.status,
      course: a.course.name,
      gradeLevel: a.course.gradeLevel,
      subject: a.subject.name,
      teacher: `${a.teacher.user.firstName} ${a.teacher.user.lastName}`,
      totalQuestions: a._count.answerKeys,
      pdfFile: a.pdfFile ? {
        id: a.pdfFile.id,
        originalName: a.pdfFile.originalName,
        fileName: a.pdfFile.fileName,
      } : null,
    }));
  }
}
