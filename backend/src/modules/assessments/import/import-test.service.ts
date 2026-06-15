import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AssessmentDeliveryMode, Prisma, QuestionType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";
import { FilesService } from "../../data-ops/files/files.service.js";
import { assertCourseScope, resolveUserScope } from "../../../common/authz/access-scope.js";
import type { JwtPayload } from "../../../common/decorators/current-user.decorator.js";
import type {
  CommitImportedQuestionDto,
  CommitImportedTestDto,
  CreateAssessmentFromImportedTestDto,
} from "./import-test.dto.js";
import { DocumentAssessmentParserService } from "./document-assessment-parser.service.js";

@Injectable()
export class ImportTestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: DocumentAssessmentParserService,
    private readonly filesService: FilesService,
  ) {}

  async importPdf(params: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
    fileSize: number;
    subjectId: string;
    courseId?: string;
    user: JwtPayload;
  }) {
    return this.importDocument(params);
  }

  async importDocument(params: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
    fileSize: number;
    subjectId: string;
    courseId?: string;
    user: JwtPayload;
  }) {
    const scope = params.courseId
      ? (await assertCourseScope(this.prisma, params.user, params.courseId, params.subjectId)).scope
      : await resolveUserScope(this.prisma, params.user);

    if (scope.role === "TEACHER" && !scope.teacherId) {
      throw new ForbiddenException("Perfil docente no encontrado");
    }

    const subject = await this.prisma.subject.findUnique({
      where: { id: params.subjectId },
      select: { id: true },
    });
    if (!subject) throw new NotFoundException("Asignatura no encontrada");

    const parsed = await this.parser.parse({
      buffer: params.buffer,
      fileName: params.fileName,
      mimeType: params.mimeType,
    });
    const file = await this.filesService.uploadFile(
      params.buffer,
      params.fileName,
      params.mimeType,
      "assessment-import",
      null,
      scope.userId,
    );

    const draft = await this.prisma.importedTestDraft.create({
      data: {
        courseId: params.courseId ?? null,
        subjectId: params.subjectId,
        teacherId: scope.teacherId,
        createdBy: scope.userId,
        fileAssetId: file.fileId,
        fileName: params.fileName,
        fileSize: params.fileSize,
        mimeType: params.mimeType,
        instructions: parsed.instructions,
        rawText: parsed.rawText,
        status: "REVIEW",
        questions: {
          create: parsed.questions.map((question) => ({
            number: question.number,
            statement: question.statement,
            type: question.type,
            alternatives: question.alternatives,
            correctAnswer: null,
            points: question.points,
            confidence: question.confidence,
          })),
        },
      },
      include: { questions: { orderBy: { number: "asc" } } },
    });

    return this.formatDraft(draft);
  }

  async commitDraft(draftId: string, dto: CommitImportedTestDto, user: JwtPayload) {
    const { draft, scope } = await this.getDraftWithScope(draftId, dto.subjectId, dto.courseId, user);
    const approved = this.validateApprovedQuestions(dto.questions);

    const created = await this.prisma.$transaction(async (tx) => {
      const rows = [];
      for (const item of approved) {
        const question = await this.createQuestionFromImportedItem(tx, item, dto.subjectId, scope.userId);
        await this.markDraftQuestionApproved(tx, item, question.id);
        rows.push(question);
      }

      await tx.importedTestDraft.update({
        where: { id: draft.id },
        data: { status: "COMMITTED", committedAt: new Date() },
      });

      return rows;
    });

    return { draftId, createdCount: created.length, questions: created };
  }

  async createAssessmentFromDraft(draftId: string, dto: CreateAssessmentFromImportedTestDto, user: JwtPayload) {
    if (!dto.courseId) throw new BadRequestException("El curso es obligatorio para crear la evaluacion");
    const { draft, scope } = await this.getDraftWithScope(draftId, dto.subjectId, dto.courseId, user);
    const approved = this.validateApprovedQuestions(dto.questions);
    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
      include: { academicYear: true },
    });
    if (!course) throw new NotFoundException("Curso no encontrado");
    if (!course.academicYear.isActive) {
      throw new BadRequestException("No se pueden crear evaluaciones en un ano academico inactivo");
    }
    if (dto.endDate && dto.startDate && new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new BadRequestException("La fecha de cierre debe ser posterior a la de inicio");
    }

    const teacherId = await this.resolveTeacherId(scope, dto.courseId, dto.subjectId);
    const totalPoints = approved.reduce((sum, question) => sum + question.points, 0);
    if (totalPoints <= 0) throw new BadRequestException("El puntaje total debe ser mayor a 0");

    const created = await this.prisma.$transaction(async (tx) => {
      const assessment = await tx.assessment.create({
        data: {
          courseId: dto.courseId!,
          subjectId: dto.subjectId,
          teacherId,
          periodId: dto.periodId ?? null,
          title: dto.title.trim(),
          description: dto.description?.trim() || draft.instructions || null,
          assessmentType: dto.assessmentType,
          deliveryMode: dto.deliveryMode ?? AssessmentDeliveryMode.ONLINE,
          status: "DRAFT",
          semester: dto.semester,
          maxScore: totalPoints,
          weight: dto.weight ?? 0,
          timeLimitMin: dto.timeLimitMin ?? null,
          startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          allowRetake: dto.allowRetake ?? false,
          shuffleQuestions: dto.shuffleQuestions ?? false,
          sourceFileId: draft.fileAssetId,
          createdBy: scope.userId,
        },
      });

      const questionRows = [];
      for (const [index, item] of approved.entries()) {
        const question = await this.createQuestionFromImportedItem(tx, item, dto.subjectId, scope.userId);
        await tx.assessmentQuestion.create({
          data: {
            assessmentId: assessment.id,
            questionId: question.id,
            sortOrder: index,
            points: item.points,
          },
        });
        await this.markDraftQuestionApproved(tx, item, question.id);
        questionRows.push(question);
      }

      await tx.importedTestDraft.update({
        where: { id: draft.id },
        data: { status: "COMMITTED", courseId: dto.courseId, committedAt: new Date() },
      });

      if (draft.fileAssetId) {
        await tx.fileAsset.update({
          where: { id: draft.fileAssetId },
          data: { entityType: "assessment", entityId: assessment.id },
        });
      }

      return { assessment, questionRows };
    });

    return {
      draftId,
      assessmentId: created.assessment.id,
      createdCount: created.questionRows.length,
      maxScore: totalPoints,
      assessment: created.assessment,
    };
  }

  private async getDraftWithScope(draftId: string, subjectId: string, courseId: string | undefined, user: JwtPayload) {
    const draft = await this.prisma.importedTestDraft.findUnique({
      where: { id: draftId },
      include: { questions: true },
    });
    if (!draft) throw new NotFoundException("Borrador de importacion no encontrado");

    const effectiveCourseId = courseId ?? draft.courseId ?? undefined;
    const scope = effectiveCourseId
      ? (await assertCourseScope(this.prisma, user, effectiveCourseId, subjectId)).scope
      : await resolveUserScope(this.prisma, user);

    if (!scope.isGlobalAdmin && draft.createdBy !== scope.userId && scope.role === "TEACHER") {
      throw new ForbiddenException("No tienes acceso a este borrador");
    }
    if (draft.subjectId !== subjectId) {
      throw new BadRequestException("La asignatura no coincide con el borrador importado");
    }
    return { draft, scope };
  }

  private validateApprovedQuestions(questions: CommitImportedQuestionDto[]) {
    const approved = questions.filter((question) => question.statement.trim());
    if (!approved.length) throw new BadRequestException("Debes aprobar al menos una pregunta");

    for (const question of approved) {
      if (question.points <= 0) {
        throw new BadRequestException(`La pregunta ${question.number} debe tener puntaje mayor a 0`);
      }
      if (question.type === "MULTIPLE_CHOICE" || question.type === "TRUE_FALSE") {
        const alternatives = this.cleanAlternatives(question.alternatives);
        if (alternatives.length < 2) {
          throw new BadRequestException(`La pregunta ${question.number} debe tener al menos dos alternativas`);
        }
        if (!question.correctAnswer || !alternatives.includes(question.correctAnswer)) {
          throw new BadRequestException(`La pregunta ${question.number} requiere respuesta correcta confirmada por el profesor`);
        }
      }
    }
    return approved;
  }

  private async resolveTeacherId(
    scope: Awaited<ReturnType<typeof resolveUserScope>>,
    courseId: string,
    subjectId: string,
  ) {
    if (scope.role === "TEACHER") {
      if (!scope.teacherId) throw new ForbiddenException("Perfil docente no encontrado");
      return scope.teacherId;
    }

    const teacher = await this.prisma.teacher.findFirst({
      where: { courseAssignments: { some: { courseId, subjectId } } },
      select: { id: true },
    });
    if (!teacher) throw new BadRequestException("No hay profesores asignados a este curso/asignatura");
    return teacher.id;
  }

  private async createQuestionFromImportedItem(
    tx: Prisma.TransactionClient,
    item: CommitImportedQuestionDto,
    subjectId: string,
    userId: string,
  ) {
    const alternatives = this.cleanAlternatives(item.alternatives);
    return tx.question.create({
      data: {
        subjectId,
        type: item.type as QuestionType,
        statement: item.statement.trim(),
        points: item.points,
        difficulty: 2,
        createdBy: userId,
        options: alternatives.length
          ? {
              create: alternatives.map((text, index) => ({
                text,
                sortOrder: index,
                isCorrect: text === item.correctAnswer,
              })),
            }
          : undefined,
      },
      include: { options: { orderBy: { sortOrder: "asc" } } },
    });
  }

  private async markDraftQuestionApproved(
    tx: Prisma.TransactionClient,
    item: CommitImportedQuestionDto,
    questionId: string,
  ) {
    if (!item.draftQuestionId) return;
    await tx.importedTestDraftQuestion.update({
      where: { id: item.draftQuestionId },
      data: {
        statement: item.statement.trim(),
        alternatives: this.cleanAlternatives(item.alternatives),
        correctAnswer: item.correctAnswer ?? null,
        points: item.points,
        type: item.type,
        status: "APPROVED",
        questionId,
      },
    });
  }

  private cleanAlternatives(alternatives: string[]) {
    return alternatives.map((item) => item.trim()).filter(Boolean).slice(0, 8);
  }

  private formatDraft(draft: {
    id: string;
    status: string;
    fileName: string;
    subjectId: string;
    courseId: string | null;
    instructions: string | null;
    fileAssetId: string | null;
    questions: {
      id: string;
      number: number;
      statement: string;
      type: string;
      alternatives: unknown;
      correctAnswer: string | null;
      points: number;
      confidence: number;
    }[];
  }) {
    return {
      draftId: draft.id,
      status: draft.status,
      fileName: draft.fileName,
      fileAssetId: draft.fileAssetId,
      subjectId: draft.subjectId,
      courseId: draft.courseId,
      instructions: draft.instructions,
      questions: draft.questions.map((question) => ({
        draftQuestionId: question.id,
        numero: question.number,
        enunciado: question.statement,
        tipo: question.type,
        alternativas: Array.isArray(question.alternatives) ? question.alternatives : [],
        respuestaCorrecta: question.correctAnswer,
        puntaje: question.points,
        confianza: question.confidence,
      })),
    };
  }
}
