import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { AssessmentDeliveryMode, AssessmentType, Prisma, QuestionType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";
import { FilesService } from "../../data-ops/files/files.service.js";
import { assertCourseScope, assertInstitutionScope, resolveUserScope } from "../../../common/authz/access-scope.js";
import type { JwtPayload } from "../../../common/decorators/current-user.decorator.js";
import * as path from "node:path";
import { DocumentAssessmentParserService } from "../import/document-assessment-parser.service.js";
import type {
  CreateAssessmentFromTemplateDto,
  UpdateAssessmentTemplateDto,
  UpsertAssessmentTemplateQuestionDto,
} from "./assessment-templates.dto.js";

type TemplateWithQuestions = Prisma.AssessmentTemplateGetPayload<{
  include: {
    questions: {
      orderBy: { sortOrder: "asc" };
      include: { options: { orderBy: { sortOrder: "asc" } } };
    };
  };
}>;

@Injectable()
export class AssessmentTemplatesService {
  private readonly logger = new Logger(AssessmentTemplatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: DocumentAssessmentParserService,
    private readonly filesService: FilesService,
  ) {}

  async upload(params: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
    title?: string;
    description?: string;
    institutionId?: string;
    subjectId?: string;
    gradeLevel?: number;
    user: JwtPayload;
  }) {
    const scope = await assertInstitutionScope(this.prisma, params.user, params.institutionId ?? params.user.institutionId ?? null);
    this.assertTemplateManager(scope.role);
    const institutionId = params.institutionId ?? scope.institutionId ?? null;

    if (params.subjectId) await this.assertSubjectExists(params.subjectId);

    const parsed = await this.parser.parse({
      buffer: params.buffer,
      fileName: params.fileName,
      mimeType: params.mimeType,
    });

    const title = params.title?.trim() || params.fileName.replace(/\.[^.]+$/, "") || "Prueba importada";
    const created = await this.prisma.assessmentTemplate.create({
      data: {
        institutionId,
        subjectId: params.subjectId ?? null,
        gradeLevel: params.gradeLevel ?? null,
        title,
        description: params.description?.trim() || null,
        status: "DRAFT",
        fileName: params.fileName,
        mimeType: params.mimeType,
        instructions: parsed.instructions,
        totalPoints: parsed.questions.reduce((sum, question) => sum + question.points, 0),
        createdBy: scope.userId,
        questions: {
          create: parsed.questions.map((question, index) => ({
            type: question.type,
            sortOrder: index,
            statement: question.statement,
            points: question.points,
            confidence: question.confidence,
            options: question.alternatives.length
              ? {
                  create: question.alternatives.map((text, optionIndex) => ({
                    label: String.fromCharCode(65 + optionIndex),
                    text,
                    sortOrder: optionIndex,
                    isCorrect: question.correctAnswer === String.fromCharCode(65 + optionIndex),
                  })),
                }
              : undefined,
          })),
        },
      },
      include: this.templateInclude(),
    });

    try {
      const extension = this.getOriginalExtension(params.fileName, params.mimeType);
      const storageName = `assessment-template-${created.id}${extension}`;
      const objectKey = this.getSourceObjectKey(created.id, params.fileName, extension);
      const file = await this.filesService.uploadFileAtKey(
        params.buffer,
        params.fileName,
        params.mimeType,
        "assessment-template",
        created.id,
        scope.userId,
        {
          storageName,
          bucket: this.filesService.documentsBucket,
          objectKey,
        },
      );

      this.logger.log(
        `Assessment template source stored driver=${file.storageProvider} bucket=${file.bucket ?? "local"} objectKey=${file.objectKey ?? objectKey} size=${file.size}`,
      );

      const updated = await this.prisma.assessmentTemplate.update({
        where: { id: created.id },
        data: { sourceFileId: file.fileId },
        include: this.templateInclude(),
      });

      return this.formatTemplate(updated);
    } catch (error) {
      await this.prisma.assessmentTemplate.delete({ where: { id: created.id } }).catch(() => undefined);
      throw error;
    }
  }

  async findAll(filters: {
    institutionId?: string;
    subjectId?: string;
    gradeLevel?: number;
    status?: string;
    search?: string;
  }, user: JwtPayload) {
    const scope = filters.institutionId
      ? await assertInstitutionScope(this.prisma, user, filters.institutionId)
      : await resolveUserScope(this.prisma, user);

    const and: Prisma.AssessmentTemplateWhereInput[] = [];
    if (filters.subjectId) and.push({ OR: [{ subjectId: filters.subjectId }, { subjectId: null }] });
    if (filters.gradeLevel) and.push({ OR: [{ gradeLevel: filters.gradeLevel }, { gradeLevel: null }] });
    if (filters.search) {
      and.push({
        OR: [
          { title: { contains: filters.search, mode: "insensitive" } },
          { description: { contains: filters.search, mode: "insensitive" } },
        ],
      });
    }

    if (scope.role === "TEACHER") {
      and.push({ status: "PUBLISHED" });
      if (scope.institutionId) and.push({ OR: [{ institutionId: scope.institutionId }, { institutionId: null }] });
    } else {
      if (filters.status) and.push({ status: filters.status });
      if (!scope.isGlobalAdmin) and.push({ OR: [{ institutionId: scope.institutionId }, { institutionId: null }] });
      if (scope.isGlobalAdmin && filters.institutionId) and.push({ institutionId: filters.institutionId });
    }

    const templates = await this.prisma.assessmentTemplate.findMany({
      where: and.length ? { AND: and } : {},
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { questions: true } },
      },
      take: 100,
    });

    return templates.map((template) => ({
      id: template.id,
      institutionId: template.institutionId,
      subjectId: template.subjectId,
      gradeLevel: template.gradeLevel,
      title: template.title,
      description: template.description,
      status: template.status,
      fileName: template.fileName,
      mimeType: template.mimeType,
      totalPoints: template.totalPoints,
      questionsCount: template._count.questions,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      publishedAt: template.publishedAt,
    }));
  }

  async findById(id: string, user: JwtPayload) {
    const template = await this.getTemplateForRead(id, user);
    return this.formatTemplate(template);
  }

  async downloadSource(id: string, user: JwtPayload) {
    const template = await this.getTemplateForRead(id, user);
    if (!template.sourceFileId) throw new NotFoundException("La plantilla no tiene archivo fuente asociado");
    return this.filesService.getDownloadInfoById(template.sourceFileId, user);
  }
  async update(id: string, dto: UpdateAssessmentTemplateDto, user: JwtPayload) {
    const template = await this.getTemplateForManage(id, user);
    if (template.status === "PUBLISHED") {
      throw new BadRequestException("Archiva o duplica la plantilla antes de modificar una prueba publicada.");
    }
    if (dto.subjectId) await this.assertSubjectExists(dto.subjectId);

    const updated = await this.prisma.assessmentTemplate.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.description !== undefined && { description: dto.description?.trim() || null }),
        ...(dto.subjectId !== undefined && { subjectId: dto.subjectId || null }),
        ...(dto.gradeLevel !== undefined && { gradeLevel: dto.gradeLevel ?? null }),
        ...(dto.instructions !== undefined && { instructions: dto.instructions?.trim() || null }),
      },
      include: this.templateInclude(),
    });
    return this.formatTemplate(updated);
  }

  async addQuestion(id: string, dto: UpsertAssessmentTemplateQuestionDto, user: JwtPayload) {
    const template = await this.getTemplateForManage(id, user);
    if (template.status === "PUBLISHED") throw new BadRequestException("No se puede editar una plantilla publicada.");
    this.validateQuestionDto(dto);

    const question = await this.prisma.assessmentTemplateQuestion.create({
      data: {
        templateId: id,
        type: dto.type as QuestionType,
        sortOrder: dto.sortOrder ?? template.questions.length,
        statement: dto.statement.trim(),
        points: dto.points,
        explanation: dto.explanation?.trim() || null,
        confidence: 1,
        options: dto.options?.length
          ? {
              create: this.cleanOptions(dto.options).map((option, index) => ({
                label: option.label ?? String.fromCharCode(65 + index),
                text: option.text,
                isCorrect: option.isCorrect,
                sortOrder: option.sortOrder ?? index,
              })),
            }
          : undefined,
      },
    });
    await this.recalculateTotalPoints(id);
    return question;
  }

  async updateQuestion(templateId: string, questionId: string, dto: UpsertAssessmentTemplateQuestionDto, user: JwtPayload) {
    const template = await this.getTemplateForManage(templateId, user);
    if (template.status === "PUBLISHED") throw new BadRequestException("No se puede editar una plantilla publicada.");
    this.validateQuestionDto(dto);

    const question = template.questions.find((item) => item.id === questionId);
    if (!question) throw new NotFoundException("Pregunta de plantilla no encontrada");

    await this.prisma.$transaction(async (tx) => {
      await tx.assessmentTemplateQuestion.update({
        where: { id: questionId },
        data: {
          type: dto.type as QuestionType,
          statement: dto.statement.trim(),
          points: dto.points,
          explanation: dto.explanation?.trim() || null,
          sortOrder: dto.sortOrder ?? question.sortOrder,
        },
      });
      if (dto.options) {
        await tx.assessmentTemplateOption.deleteMany({ where: { questionId } });
        const options = this.cleanOptions(dto.options);
        if (options.length) {
          await tx.assessmentTemplateOption.createMany({
            data: options.map((option, index) => ({
              questionId,
              label: option.label ?? String.fromCharCode(65 + index),
              text: option.text,
              isCorrect: option.isCorrect,
              sortOrder: option.sortOrder ?? index,
            })),
          });
        }
      }
    });

    await this.recalculateTotalPoints(templateId);
    return this.findById(templateId, user);
  }

  async deleteQuestion(templateId: string, questionId: string, user: JwtPayload) {
    const template = await this.getTemplateForManage(templateId, user);
    if (template.status === "PUBLISHED") throw new BadRequestException("No se puede editar una plantilla publicada.");
    if (!template.questions.some((item) => item.id === questionId)) throw new NotFoundException("Pregunta de plantilla no encontrada");

    await this.prisma.assessmentTemplateQuestion.delete({ where: { id: questionId } });
    await this.recalculateTotalPoints(templateId);
    return { ok: true };
  }

  async publish(id: string, user: JwtPayload) {
    const template = await this.getTemplateForManage(id, user);
    this.validatePublishable(template);
    const updated = await this.prisma.assessmentTemplate.update({
      where: { id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
      include: this.templateInclude(),
    });
    return this.formatTemplate(updated);
  }

  async archive(id: string, user: JwtPayload) {
    await this.getTemplateForManage(id, user);
    return this.prisma.assessmentTemplate.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });
  }

  async delete(id: string, user: JwtPayload) {
    const template = await this.getTemplateForManage(id, user);
    const linkedAssessments = await this.prisma.assessment.findMany({
      where: { sourceTemplateId: id },
      select: { id: true },
    });
    const assessmentIds = linkedAssessments.map((assessment) => assessment.id);

    if (template.sourceFileId) {
      await this.filesService.deleteFile(template.sourceFileId, user, { failOnStorageError: true });
    }

    const deleted = await this.prisma.$transaction(async (tx) => {
      if (assessmentIds.length > 0) {
        await tx.report.deleteMany({ where: { assessmentId: { in: assessmentIds } } });
        await tx.learningResource.updateMany({
          where: { assessmentId: { in: assessmentIds } },
          data: { assessmentId: null },
        });
        await tx.assessmentAttempt.deleteMany({ where: { assessmentId: { in: assessmentIds } } });
        await tx.grade.deleteMany({ where: { assessmentId: { in: assessmentIds } } });
        await tx.assessment.deleteMany({ where: { id: { in: assessmentIds } } });
      }
      await tx.assessmentTemplate.delete({ where: { id } });
      return { assessments: assessmentIds.length };
    });

    return { ok: true, deleted };
  }

  async createAssessment(id: string, dto: CreateAssessmentFromTemplateDto, user: JwtPayload) {
    const template = await this.getTemplateForRead(id, user);
    if (template.status !== "PUBLISHED") throw new BadRequestException("La plantilla debe estar publicada para asignarse a un curso.");
    this.validatePublishable(template);
    if (dto.publishNow) this.validateAnswerKey(template);

    const subjectId = dto.subjectId ?? template.subjectId;
    if (!subjectId) throw new BadRequestException("La plantilla no tiene asignatura; selecciona una asignatura para crear la evaluacion.");

    const { scope } = await assertCourseScope(this.prisma, user, dto.courseId, subjectId);
    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
      include: { academicYear: true },
    });
    if (!course) throw new NotFoundException("Curso no encontrado");
    if (!course.academicYear.isActive) throw new BadRequestException("No se pueden crear evaluaciones en un ano academico inactivo");
    if (template.gradeLevel && template.gradeLevel !== course.gradeLevel) {
      throw new BadRequestException("Esta plantilla no corresponde al nivel del curso seleccionado.");
    }
    if (dto.endDate && dto.startDate && new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new BadRequestException("La fecha de cierre debe ser posterior a la de inicio");
    }

    const teacherId = await this.resolveTeacherId(scope, dto.courseId, subjectId);
    const totalPoints = template.questions.reduce((sum, question) => sum + question.points, 0);

    const created = await this.prisma.$transaction(async (tx) => {
      const assessment = await tx.assessment.create({
        data: {
          courseId: dto.courseId,
          subjectId,
          teacherId,
          periodId: dto.periodId ?? null,
          title: dto.title?.trim() || template.title,
          description: dto.description?.trim() || template.description || template.instructions || null,
          assessmentType: dto.assessmentType ?? AssessmentType.PROCESO,
          deliveryMode: dto.deliveryMode ?? AssessmentDeliveryMode.ONLINE,
          status: dto.publishNow ? "PUBLISHED" : "DRAFT",
          semester: dto.semester ?? 1,
          maxScore: totalPoints,
          weight: dto.weight ?? 0,
          timeLimitMin: dto.timeLimitMin ?? null,
          startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          allowRetake: dto.allowRetake ?? false,
          shuffleQuestions: dto.shuffleQuestions ?? false,
          sourceFileId: template.sourceFileId,
          sourceTemplateId: template.id,
          publishedAt: dto.publishNow ? new Date() : null,
          teacherValidatedAt: dto.publishNow ? new Date() : null,
          teacherValidatedBy: dto.publishNow ? scope.userId : null,
          createdBy: scope.userId,
        },
      });

      for (const [index, item] of template.questions.entries()) {
        const question = await tx.question.create({
          data: {
            subjectId,
            type: item.type,
            statement: item.statement,
            explanation: item.explanation,
            points: item.points,
            difficulty: 2,
            createdBy: scope.userId,
            options: item.options.length
              ? {
                  create: item.options.map((option, optionIndex) => ({
                    text: option.text,
                    isCorrect: option.isCorrect,
                    sortOrder: option.sortOrder ?? optionIndex,
                  })),
                }
              : undefined,
          },
        });
        await tx.assessmentQuestion.create({
          data: {
            assessmentId: assessment.id,
            questionId: question.id,
            sortOrder: index,
            points: item.points,
          },
        });
      }

      return assessment;
    });

    return {
      templateId: id,
      assessmentId: created.id,
      createdCount: template.questions.length,
      maxScore: totalPoints,
      status: created.status,
    };
  }

  private getOriginalExtension(fileName: string, mimeType: string) {
    const ext = path.extname(fileName).toLowerCase();
    if (ext === ".pdf" || mimeType.includes("pdf")) return ".pdf";
    if (ext === ".docx" || mimeType.includes("wordprocessingml")) return ".docx";
    return ext || ".bin";
  }

  private getSourceObjectKey(templateId: string, fileName: string, extension: string) {
    const originalBase = path.basename(fileName, path.extname(fileName));
    const safeBase = this.safeObjectKeySegment(originalBase || "documento");
    return `assessment-templates/${safeBase}-${templateId}/original${extension}`;
  }

  private safeObjectKeySegment(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "documento";
  }
  private async getTemplateForRead(id: string, user: JwtPayload) {
    const template = await this.prisma.assessmentTemplate.findUnique({
      where: { id },
      include: this.templateInclude(),
    });
    if (!template) throw new NotFoundException("Plantilla de evaluacion no encontrada");

    const scope = await resolveUserScope(this.prisma, user);
    if (template.status === "PUBLISHED" && (template.institutionId === null || template.institutionId === scope.institutionId || scope.isGlobalAdmin)) {
      return template;
    }
    await this.assertCanManageTemplate(template, user);
    return template;
  }

  private async getTemplateForManage(id: string, user: JwtPayload) {
    const template = await this.prisma.assessmentTemplate.findUnique({
      where: { id },
      include: this.templateInclude(),
    });
    if (!template) throw new NotFoundException("Plantilla de evaluacion no encontrada");
    await this.assertCanManageTemplate(template, user);
    return template;
  }

  private async assertCanManageTemplate(template: { institutionId: string | null }, user: JwtPayload) {
    const scope = await assertInstitutionScope(this.prisma, user, template.institutionId);
    this.assertTemplateManager(scope.role);
  }

  private assertTemplateManager(role: string) {
    if (!["SUPER_ADMIN", "ADMIN", "UTP"].includes(role)) {
      throw new ForbiddenException("Solo administracion o UTP puede administrar el banco de pruebas.");
    }
  }

  private async assertSubjectExists(subjectId: string) {
    const subject = await this.prisma.subject.findUnique({ where: { id: subjectId }, select: { id: true } });
    if (!subject) throw new NotFoundException("Asignatura no encontrada");
  }

  private validateQuestionDto(dto: UpsertAssessmentTemplateQuestionDto) {
    if (!dto.statement.trim()) throw new BadRequestException("El enunciado es obligatorio");
    if (dto.points <= 0) throw new BadRequestException("El puntaje debe ser mayor a 0");
    if (dto.type === "MULTIPLE_CHOICE" || dto.type === "TRUE_FALSE") {
      const options = this.cleanOptions(dto.options ?? []);
      if (options.length < 2) throw new BadRequestException("Las preguntas objetivas requieren al menos dos alternativas");
    }
  }

  private validatePublishable(template: TemplateWithQuestions) {
    if (!template.questions.length) throw new BadRequestException("La plantilla debe tener al menos una pregunta");
    const total = template.questions.reduce((sum, question) => sum + question.points, 0);
    if (total <= 0) throw new BadRequestException("El puntaje total debe ser mayor a 0");

    for (const [index, question] of template.questions.entries()) {
      if (!question.statement.trim()) throw new BadRequestException(`La pregunta ${index + 1} no tiene enunciado`);
      if (question.points <= 0) throw new BadRequestException(`La pregunta ${index + 1} debe tener puntaje mayor a 0`);
      if (question.type === "MULTIPLE_CHOICE" || question.type === "TRUE_FALSE") {
        if (question.options.length < 2) throw new BadRequestException(`La pregunta ${index + 1} requiere al menos dos alternativas`);
      }
    }
  }

  private validateAnswerKey(template: TemplateWithQuestions) {
    for (const [index, question] of template.questions.entries()) {
      if (question.type === "MULTIPLE_CHOICE" || question.type === "TRUE_FALSE") {
        const correctCount = question.options.filter((option) => option.isCorrect).length;
        if (correctCount !== 1) {
          throw new BadRequestException(`La pregunta ${index + 1} requiere exactamente una respuesta correcta`);
        }
      }
    }
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

  private cleanOptions(options: { label?: string | null; text: string; isCorrect: boolean; sortOrder?: number }[]) {
    return options
      .map((option) => ({
        label: option.label?.trim() || null,
        text: option.text.trim(),
        isCorrect: Boolean(option.isCorrect),
        sortOrder: option.sortOrder,
      }))
      .filter((option) => option.text)
      .slice(0, 8);
  }

  private async recalculateTotalPoints(templateId: string) {
    const aggregate = await this.prisma.assessmentTemplateQuestion.aggregate({
      where: { templateId },
      _sum: { points: true },
    });
    await this.prisma.assessmentTemplate.update({
      where: { id: templateId },
      data: { totalPoints: aggregate._sum.points ?? 0 },
    });
  }

  private templateInclude() {
    return {
      questions: {
        orderBy: { sortOrder: "asc" as const },
        include: { options: { orderBy: { sortOrder: "asc" as const } } },
      },
    };
  }

  private formatTemplate(template: TemplateWithQuestions) {
    return {
      id: template.id,
      institutionId: template.institutionId,
      subjectId: template.subjectId,
      gradeLevel: template.gradeLevel,
      title: template.title,
      description: template.description,
      status: template.status,
      sourceFileId: template.sourceFileId,
      fileName: template.fileName,
      mimeType: template.mimeType,
      instructions: template.instructions,
      totalPoints: template.totalPoints,
      createdBy: template.createdBy,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      publishedAt: template.publishedAt,
      questions: template.questions.map((question) => ({
        id: question.id,
        type: question.type,
        sortOrder: question.sortOrder,
        statement: question.statement,
        points: question.points,
        explanation: question.explanation,
        confidence: question.confidence,
        options: question.options.map((option) => ({
          id: option.id,
          label: option.label,
          text: option.text,
          isCorrect: option.isCorrect,
          sortOrder: option.sortOrder,
        })),
      })),
    };
  }
}
