import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import type {
  AssessmentItemDto,
  CreateAssessmentDto,
  ReorderItemsDto,
  UpdateAssessmentDto,
  UpdateAssessmentQuestionDto,
} from "./dto/create-assessment.dto.js";
import { isSubjectAllowedForGrade } from "../../../common/utils/curriculum.js";
import type { JwtPayload } from "../../../common/decorators/current-user.decorator.js";
import {
  assertAssessmentScope,
  assertCourseScope,
  resolveUserScope,
} from "../../../common/authz/access-scope.js";

type AssessmentStatus = "DRAFT" | "PUBLISHED" | "ACTIVE" | "CLOSED" | "IN_GRADING" | "GRADED" | "REPORTED" | "ARCHIVED";

const VALID_TRANSITIONS: Record<AssessmentStatus, AssessmentStatus[]> = {
  DRAFT:       ["PUBLISHED"],
  PUBLISHED:   ["ACTIVE", "DRAFT"],
  ACTIVE:      ["CLOSED"],
  CLOSED:      ["IN_GRADING"],
  IN_GRADING:  ["GRADED"],
  GRADED:      ["REPORTED"],
  REPORTED:    ["ARCHIVED", "GRADED"],
  ARCHIVED:    [],
};

@Injectable()
export class AssessmentsService {
  constructor(private readonly prisma: PrismaService) {}

  // ══════════════════════════════════════════════════════
  //  CRUD
  // ══════════════════════════════════════════════════════

  async create(dto: CreateAssessmentDto, userId: string, userRole?: string) {
    await assertCourseScope(this.prisma, userId, dto.courseId, dto.subjectId);

    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
      include: { academicYear: true },
    });
    if (!course) throw new NotFoundException("Curso no encontrado");

    if (!course.academicYear.isActive) {
      throw new BadRequestException("No se pueden crear evaluaciones en un año académico inactivo");
    }

    const subject = await this.prisma.subject.findUnique({ where: { id: dto.subjectId } });
    if (!subject) throw new NotFoundException("Asignatura no encontrada");

    if (!isSubjectAllowedForGrade(course.gradeLevel, subject.name)) {
      throw new BadRequestException(
        `La asignatura ${subject.name} no está permitida para el nivel ${course.gradeLevel}°`,
      );
    }

    let teacherId: string;
    if (userRole === "ADMIN" || userRole === "SUPER_ADMIN" || userRole === "UTP") {
      const teacher = await this.prisma.teacher.findFirst({
        where: {
          courseAssignments: { some: { courseId: dto.courseId, subjectId: dto.subjectId } },
        },
      });
      if (teacher) {
        teacherId = teacher.id;
      } else {
        const anyTeacher = await this.prisma.teacher.findFirst({
          where: {
            courseAssignments: { some: { courseId: dto.courseId } },
          },
        });
        if (!anyTeacher) {
          throw new BadRequestException("No hay profesores asignados a este curso. Asigna un profesor primero.");
        }
        teacherId = anyTeacher.id;
      }
    } else {
      const teacher = await this.prisma.teacher.findFirst({
        where: {
          userId,
          courseAssignments: { some: { courseId: dto.courseId, subjectId: dto.subjectId } },
        },
      });
      if (!teacher) {
        throw new ForbiddenException("No tienes asignado este curso/asignatura");
      }
      teacherId = teacher.id;
    }

    if (dto.endDate && dto.startDate && new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new BadRequestException("La fecha de cierre debe ser posterior a la de inicio");
    }

    const assessment = await this.prisma.assessment.create({
      data: {
        courseId: dto.courseId,
        subjectId: dto.subjectId,
        teacherId,
        periodId: dto.periodId ?? null,
        title: dto.title,
        description: dto.description ?? null,
        assessmentType: dto.assessmentType,
        deliveryMode: dto.deliveryMode ?? "ONLINE",
        status: dto.deliveryMode === "PRINTED" ? "ACTIVE" : "DRAFT",
        semester: dto.semester,
        maxScore: dto.maxScore ?? 100,
        weight: dto.weight ?? 0,
        timeLimitMin: dto.timeLimitMin ?? null,
        startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        allowRetake: dto.allowRetake ?? false,
        shuffleQuestions: dto.shuffleQuestions ?? false,
        createdBy: userId,
      },
    });

    if (dto.items?.length) {
      await this.addItems(assessment.id, dto.items, userId);
    }

    return this.findById(assessment.id, userId);
  }

  async findAll(filters: {
    courseId?: string; subjectId?: string; status?: string;
    assessmentType?: string; teacherId?: string; periodId?: string;
  }, page = 1, limit = 20, user?: JwtPayload | string) {
    const where: Record<string, unknown> = {};
    if (filters.subjectId) where.subjectId = filters.subjectId;
    if (filters.status) where.status = filters.status;
    if (filters.assessmentType) where.assessmentType = filters.assessmentType;
    if (filters.periodId) where.periodId = filters.periodId;

    if (user) {
      const scope = await resolveUserScope(this.prisma, user);
      if (filters.courseId) {
        await assertCourseScope(this.prisma, user, filters.courseId, filters.subjectId);
        where.courseId = filters.courseId;
      } else if (scope.role === "TEACHER") {
        where.courseId = { in: scope.assignments.map((assignment) => assignment.courseId) };
      } else if (!scope.isSuperAdmin && !scope.isGlobalAdmin) {
        where.course = { institutionId: scope.institutionId ?? "00000000-0000-0000-0000-000000000000" };
      }

      if (filters.teacherId && scope.role !== "TEACHER") where.teacherId = filters.teacherId;
    } else {
      if (filters.courseId) where.courseId = filters.courseId;
      if (filters.teacherId) where.teacherId = filters.teacherId;
    }

    const [data, total] = await Promise.all([
      this.prisma.assessment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: {
          course: { select: { id: true, name: true, gradeLevel: true } },
          subject: { select: { id: true, name: true } },
          teacher: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
          period: { select: { id: true, name: true } },
          _count: { select: { questions: true, attempts: true, grades: true } },
        },
      }),
      this.prisma.assessment.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrevious: page > 1 },
    };
  }

  async findById(id: string, user?: JwtPayload | string) {
    if (user) await assertAssessmentScope(this.prisma, user, id);
    const scope = user ? await resolveUserScope(this.prisma, user) : null;
    const canSeeAnswerKey = !scope || scope.role !== "STUDENT";

    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, name: true, gradeLevel: true, academicYear: { select: { year: true } } } },
        subject: { select: { id: true, name: true } },
        teacher: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        period: { select: { id: true, name: true, status: true } },
        questions: {
          orderBy: { sortOrder: "asc" },
          include: {
            question: {
              include: {
                subject: { select: { id: true, name: true } },
                learningObjective: { select: { id: true, code: true, description: true } },
                axis: { select: { id: true, name: true } },
                options: { orderBy: { sortOrder: "asc" }, select: { id: true, text: true, sortOrder: true, isCorrect: true } },
              },
            },
          },
        },
        _count: { select: { attempts: true, grades: true } },
      },
    });
    if (!assessment) throw new NotFoundException("Evaluación no encontrada");
    if (!canSeeAnswerKey) {
      assessment.questions.forEach((item) => {
        delete (item.question as { explanation?: string | null }).explanation;
        item.question.options.forEach((option) => {
          delete (option as { isCorrect?: boolean }).isCorrect;
        });
      });
    }
    return assessment;
  }

  async update(id: string, dto: UpdateAssessmentDto, user?: JwtPayload | string) {
    if (user) await assertAssessmentScope(this.prisma, user, id);

    const assessment = await this.prisma.assessment.findUnique({ where: { id } });
    if (!assessment) throw new NotFoundException("Evaluación no encontrada");

    if (assessment.status === "ACTIVE" && (dto.title || dto.maxScore)) {
      throw new BadRequestException(
        "No se puede modificar título ni puntaje máximo de una evaluación activa",
      );
    }

    if (dto.endDate && dto.startDate && new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new BadRequestException("La fecha de cierre debe ser posterior a la de inicio");
    }

    return this.prisma.assessment.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.deliveryMode !== undefined && { deliveryMode: dto.deliveryMode }),
        ...(dto.maxScore !== undefined && { maxScore: dto.maxScore }),
        ...(dto.weight !== undefined && { weight: dto.weight }),
        ...(dto.timeLimitMin !== undefined && { timeLimitMin: dto.timeLimitMin }),
        ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
        ...(dto.allowRetake !== undefined && { allowRetake: dto.allowRetake }),
        ...(dto.shuffleQuestions !== undefined && { shuffleQuestions: dto.shuffleQuestions }),
      },
    });
  }

  async softDelete(id: string, user?: JwtPayload | string) {
    if (user) await assertAssessmentScope(this.prisma, user, id);

    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
      include: { _count: { select: { attempts: true } } },
    });
    if (!assessment) throw new NotFoundException("Evaluación no encontrada");

    if (assessment._count.attempts > 0 && assessment.status !== "ARCHIVED") {
      throw new BadRequestException(
        "No se puede eliminar una evaluación con intentos. Archive primero o use soft-delete.",
      );
    }

    return this.prisma.assessment.update({
      where: { id },
      data: { isActive: false, status: "ARCHIVED", archivedAt: new Date() },
    });
  }

  // ══════════════════════════════════════════════════════
  //  STATE MACHINE
  // ══════════════════════════════════════════════════════

  async publish(id: string, user?: JwtPayload | string) {
    if (user) await assertAssessmentScope(this.prisma, user, id);

    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
      include: {
        questions: {
          include: {
            question: { include: { options: true } },
          },
        },
        _count: { select: { questions: true } },
      },
    });
    if (!assessment) throw new NotFoundException("Evaluación no encontrada");

    this.validateTransition(assessment.status, "PUBLISHED");

    if (assessment._count.questions === 0) {
      throw new BadRequestException("No se puede publicar una evaluación sin preguntas");
    }

    if (assessment.questions.length > 0) {
      const totalPoints = assessment.questions.reduce((sum, item) => sum + item.points, 0);
      if (totalPoints <= 0) {
        throw new BadRequestException("No se puede publicar una evaluacion sin puntaje total valido");
      }

      for (const item of assessment.questions) {
        if (["MULTIPLE_CHOICE", "TRUE_FALSE"].includes(item.question.type)) {
          const correctCount = item.question.options.filter((option) => option.isCorrect).length;
          if (item.question.options.length < 2 || correctCount !== 1) {
            throw new BadRequestException(
              `La pregunta ${item.sortOrder + 1} requiere alternativas y una respuesta correcta confirmada`,
            );
          }
        }
      }
    }

    if (["CIERRE", "FINAL"].includes(assessment.assessmentType) && !assessment.periodId) {
      throw new BadRequestException("Evaluaciones sumativas requieren un periodo asignado");
    }

    if (!assessment.startDate) {
      throw new BadRequestException("La evaluación debe tener fecha de inicio");
    }

    return this.prisma.assessment.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        teacherValidatedAt: new Date(),
        teacherValidatedBy: typeof user === "string" ? user : user?.sub ?? assessment.createdBy,
      },
    });
  }

  async activate(id: string, user?: JwtPayload | string) {
    if (user) await assertAssessmentScope(this.prisma, user, id);

    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
      include: { _count: { select: { questions: true } } },
    });
    if (!assessment) throw new NotFoundException("Evaluación no encontrada");

    this.validateTransition(assessment.status, "ACTIVE");

    if (assessment._count.questions === 0) {
      throw new BadRequestException("No se puede activar una evaluación sin preguntas");
    }

    if (assessment.maxScore <= 0) {
      throw new BadRequestException("El puntaje máximo debe ser mayor a 0");
    }

    const period = assessment.periodId
      ? await this.prisma.period.findUnique({ where: { id: assessment.periodId } })
      : null;
    if (period && period.status === "CLOSED") {
      throw new BadRequestException("No se puede activar una evaluación en un periodo cerrado");
    }

    return this.prisma.assessment.update({
      where: { id },
      data: { status: "ACTIVE", startDate: new Date() },
    });
  }

  async close(id: string, user?: JwtPayload | string) {
    if (user) await assertAssessmentScope(this.prisma, user, id);

    const assessment = await this.prisma.assessment.findUnique({ where: { id } });
    if (!assessment) throw new NotFoundException("Evaluación no encontrada");

    this.validateTransition(assessment.status, "CLOSED");

    return this.prisma.assessment.update({
      where: { id },
      data: { status: "CLOSED", closedAt: new Date(), endDate: new Date() },
    });
  }

  async startGrading(id: string, user?: JwtPayload | string) {
    if (user) await assertAssessmentScope(this.prisma, user, id);

    const assessment = await this.prisma.assessment.findUnique({ where: { id } });
    if (!assessment) throw new NotFoundException("Evaluación no encontrada");

    this.validateTransition(assessment.status, "IN_GRADING");

    return this.prisma.assessment.update({
      where: { id },
      data: { status: "IN_GRADING", gradingStartedAt: new Date() },
    });
  }

  async markGraded(id: string, user?: JwtPayload | string) {
    if (user) await assertAssessmentScope(this.prisma, user, id);

    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
      include: { _count: { select: { attempts: true, grades: true } } },
    });
    if (!assessment) throw new NotFoundException("Evaluación no encontrada");

    this.validateTransition(assessment.status, "GRADED");

    if (assessment._count.grades === 0) {
      throw new BadRequestException("No se puede marcar como corregida: no hay notas registradas");
    }

    return this.prisma.assessment.update({
      where: { id },
      data: { status: "GRADED", gradedAt: new Date() },
    });
  }

  async markReported(id: string, user?: JwtPayload | string) {
    if (user) await assertAssessmentScope(this.prisma, user, id);

    const assessment = await this.prisma.assessment.findUnique({ where: { id } });
    if (!assessment) throw new NotFoundException("Evaluación no encontrada");

    this.validateTransition(assessment.status, "REPORTED");

    return this.prisma.assessment.update({
      where: { id },
      data: { status: "REPORTED", reportedAt: new Date() },
    });
  }

  async archive(id: string, user?: JwtPayload | string) {
    if (user) await assertAssessmentScope(this.prisma, user, id);

    const assessment = await this.prisma.assessment.findUnique({ where: { id } });
    if (!assessment) throw new NotFoundException("Evaluación no encontrada");

    this.validateTransition(assessment.status, "ARCHIVED");

    return this.prisma.assessment.update({
      where: { id },
      data: { status: "ARCHIVED", archivedAt: new Date(), isActive: false },
    });
  }

  async revertToDraft(id: string, user?: JwtPayload | string) {
    if (user) await assertAssessmentScope(this.prisma, user, id);

    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
      include: { _count: { select: { attempts: true } } },
    });
    if (!assessment) throw new NotFoundException("Evaluación no encontrada");

    if (assessment.status !== "PUBLISHED") {
      throw new BadRequestException("Solo se puede revertir a borrador desde estado PUBLICADO");
    }

    if (assessment._count.attempts > 0) {
      throw new BadRequestException("No se puede revertir: ya hay intentos registrados");
    }

    return this.prisma.assessment.update({
      where: { id },
      data: { status: "DRAFT", publishedAt: null },
    });
  }

  // ══════════════════════════════════════════════════════
  //  ASSESSMENT ITEMS (questions in assessment)
  // ══════════════════════════════════════════════════════

  async addItems(assessmentId: string, items: AssessmentItemDto[], user?: JwtPayload | string) {
    if (user) await assertAssessmentScope(this.prisma, user, assessmentId);

    const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment) throw new NotFoundException("Evaluación no encontrada");

    if (assessment.status !== "DRAFT") {
      throw new BadRequestException("Solo se pueden modificar preguntas en estado BORRADOR");
    }

    const results = [];
    for (const item of items) {
      const question = await this.prisma.question.findUnique({
        where: { id: item.questionId },
      });
      if (!question) throw new NotFoundException(`Pregunta ${item.questionId} no encontrada`);

      if (!question.isActive) throw new BadRequestException(`La pregunta ${item.questionId} está inactiva`);

      const existing = await this.prisma.assessmentQuestion.findUnique({
        where: { assessmentId_questionId: { assessmentId, questionId: item.questionId } },
      });
      if (existing) continue;

      const created = await this.prisma.assessmentQuestion.create({
        data: {
          assessmentId,
          questionId: item.questionId,
          sortOrder: item.sortOrder ?? 0,
          points: item.points ?? question.points,
        },
        include: { question: { select: { id: true, statement: true, type: true } } },
      });
      results.push(created);
    }

    return results;
  }

  async removeItem(assessmentId: string, questionId: string, user?: JwtPayload | string) {
    if (user) await assertAssessmentScope(this.prisma, user, assessmentId);

    const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment) throw new NotFoundException("Evaluación no encontrada");

    if (assessment.status !== "DRAFT") {
      throw new BadRequestException("Solo se pueden modificar preguntas en estado BORRADOR");
    }

    const item = await this.prisma.assessmentQuestion.findUnique({
      where: { assessmentId_questionId: { assessmentId, questionId } },
    });
    if (!item) throw new NotFoundException("La pregunta no está en esta evaluación");

    return this.prisma.assessmentQuestion.delete({ where: { id: item.id } });
  }

  async reorderItems(assessmentId: string, dto: ReorderItemsDto, user?: JwtPayload | string) {
    if (user) await assertAssessmentScope(this.prisma, user, assessmentId);

    const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment) throw new NotFoundException("Evaluación no encontrada");

    await Promise.all(
      dto.itemIds.map((itemId, index) =>
        this.prisma.assessmentQuestion.update({
          where: { id: itemId },
          data: { sortOrder: index },
        }),
      ),
    );

    return this.prisma.assessmentQuestion.findMany({
      where: { assessmentId },
      orderBy: { sortOrder: "asc" },
    });
  }

  // ══════════════════════════════════════════════════════
  //  PRIVATE
  // ══════════════════════════════════════════════════════

  async updateQuestion(assessmentId: string, questionId: string, dto: UpdateAssessmentQuestionDto, user?: JwtPayload | string) {
    if (user) await assertAssessmentScope(this.prisma, user, assessmentId);

    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { questions: { include: { question: { include: { options: true } } } } },
    });
    if (!assessment) throw new NotFoundException("Evaluacion no encontrada");
    if (assessment.status !== "DRAFT") {
      throw new BadRequestException("Solo se puede editar la pauta antes de publicar la evaluacion");
    }

    const item = assessment.questions.find((row) => row.questionId === questionId);
    if (!item) throw new NotFoundException("La pregunta no pertenece a esta evaluacion");

    const options = this.cleanQuestionOptions(dto.options ?? []);
    if (["MULTIPLE_CHOICE", "TRUE_FALSE"].includes(dto.type)) {
      if (options.length < 2) throw new BadRequestException("Las preguntas objetivas requieren al menos dos alternativas");
      if (options.filter((option) => option.isCorrect).length !== 1) {
        throw new BadRequestException("Marca exactamente una alternativa correcta");
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.question.update({
        where: { id: questionId },
        data: {
          type: dto.type,
          statement: dto.statement.trim(),
          explanation: dto.explanation?.trim() || null,
          points: dto.points,
        },
      });
      await tx.assessmentQuestion.update({
        where: { id: item.id },
        data: {
          points: dto.points,
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        },
      });
      await tx.questionOption.deleteMany({ where: { questionId } });
      if (options.length) {
        await tx.questionOption.createMany({
          data: options.map((option, index) => ({
            questionId,
            text: option.text,
            isCorrect: option.isCorrect,
            sortOrder: option.sortOrder ?? index,
          })),
        });
      }
      const totalPoints = await tx.assessmentQuestion.aggregate({
        where: { assessmentId },
        _sum: { points: true },
      });
      await tx.assessment.update({
        where: { id: assessmentId },
        data: { maxScore: totalPoints._sum.points ?? dto.points },
      });
    });

    return this.findById(assessmentId, user);
  }

  private validateTransition(current: string, target: AssessmentStatus) {
    const allowed = VALID_TRANSITIONS[current as AssessmentStatus];
    if (!allowed || !allowed.includes(target)) {
      throw new BadRequestException(
        `Transición inválida: ${current} → ${target}. Transiciones permitidas desde ${current}: ${allowed?.join(", ") ?? "ninguna"}`,
      );
    }
  }

  private cleanQuestionOptions(options: { text: string; isCorrect: boolean; sortOrder?: number }[]) {
    return options
      .map((option) => ({
        text: option.text.trim(),
        isCorrect: Boolean(option.isCorrect),
        sortOrder: option.sortOrder,
      }))
      .filter((option) => option.text)
      .slice(0, 8);
  }
}
