import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { CreateQuestionDto, UpdateQuestionDto, QuestionFilterDto } from "./dto/create-question.dto.js";
import { QuestionType } from "@prisma/client";

@Injectable()
export class QuestionBankService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── CREATE ──────────────────────────────────────────

  async create(dto: CreateQuestionDto) {
    this.validateQuestionRules(dto);

    const question = await this.prisma.question.create({
      data: {
        subjectId: dto.subjectId,
        axisId: dto.axisId ?? null,
        learningObjectiveId: dto.learningObjectiveId ?? null,
        skillId: dto.skillId ?? null,
        type: dto.type,
        statement: dto.statement,
        explanation: dto.explanation ?? null,
        difficulty: dto.difficulty ?? 2,
        points: dto.points ?? 1.0,
      },
    });

    if (dto.options?.length) {
      await this.createOptions(question.id, dto.options);
    }

    return this.findById(question.id);
  }

  // ─── READ ────────────────────────────────────────────

  async findAll(filters: QuestionFilterDto, page = 1, limit = 20) {
    const where: Record<string, unknown> = {};
    if (filters.subjectId) where.subjectId = filters.subjectId;
    if (filters.learningObjectiveId) where.learningObjectiveId = filters.learningObjectiveId;
    if (filters.axisId) where.axisId = filters.axisId;
    if (filters.type) where.type = filters.type;
    if (filters.difficulty) where.difficulty = filters.difficulty;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.search) {
      where.statement = { contains: filters.search, mode: "insensitive" };
    } else {
      where.isActive = true;
    }

    const [data, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: {
          subject: { select: { id: true, name: true } },
          axis: { select: { id: true, name: true } },
          learningObjective: { select: { id: true, code: true, description: true } },
          skill: { select: { id: true, name: true } },
          options: { orderBy: { sortOrder: "asc" } },
          _count: { select: { assessmentQuestions: true, studentAnswers: true } },
        },
      }),
      this.prisma.question.count({ where }),
    ]);

    return {
      data: data.map((q: typeof data[number]) => ({
        ...q,
        warnings: this.checkQuestionWarnings(q as Record<string, unknown>),
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrevious: page > 1 },
    };
  }

  async findById(id: string) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: {
        subject: { select: { id: true, name: true } },
        axis: { select: { id: true, name: true } },
        learningObjective: { select: { id: true, code: true, description: true } },
        skill: { select: { id: true, name: true } },
        options: { orderBy: { sortOrder: "asc" } },
        assessmentQuestions: {
          include: { assessment: { select: { id: true, title: true, status: true } } },
        },
      },
    });
    if (!question) throw new NotFoundException("Pregunta no encontrada");
    return {
      ...question,
      warnings: this.checkQuestionWarnings(question),
    };
  }

  // ─── UPDATE ──────────────────────────────────────────

  async update(id: string, dto: UpdateQuestionDto) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: { assessmentQuestions: { where: { assessment: { status: { in: ["ACTIVE", "PUBLISHED"] as any } } } } },
    });
    if (!question) throw new NotFoundException("Pregunta no encontrada");

    const usedInActive = question.assessmentQuestions.length > 0;
    if (usedInActive && (dto.statement || dto.type || dto.points)) {
      throw new BadRequestException(
        `No se puede modificar el enunciado, tipo o puntaje de una pregunta usada en ${question.assessmentQuestions.length} evaluación(es) activa(s). Cree una nueva versión.`,
      );
    }

    return this.prisma.question.update({
      where: { id },
      data: {
        ...(dto.statement !== undefined && { statement: dto.statement }),
        ...(dto.explanation !== undefined && { explanation: dto.explanation }),
        ...(dto.axisId !== undefined && { axisId: dto.axisId }),
        ...(dto.learningObjectiveId !== undefined && { learningObjectiveId: dto.learningObjectiveId }),
        ...(dto.skillId !== undefined && { skillId: dto.skillId }),
        ...(dto.difficulty !== undefined && { difficulty: dto.difficulty }),
        ...(dto.points !== undefined && { points: dto.points }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  // ─── DELETE ──────────────────────────────────────────

  async softDelete(id: string) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: { assessmentQuestions: { where: { assessment: { status: "ACTIVE" } } } },
    });
    if (!question) throw new NotFoundException("Pregunta no encontrada");

    if (question.assessmentQuestions.length > 0) {
      throw new BadRequestException(
        `No se puede eliminar: la pregunta está en ${question.assessmentQuestions.length} evaluación(es) activa(s).`,
      );
    }

    return this.prisma.question.update({ where: { id }, data: { isActive: false } });
  }

  // ─── OPTIONS MANAGEMENT ──────────────────────────────

  async addOption(questionId: string, text: string, isCorrect: boolean, sortOrder?: number) {
    const q = await this.prisma.question.findUnique({ where: { id: questionId } });
    if (!q) throw new NotFoundException("Pregunta no encontrada");

    return this.prisma.questionOption.create({
      data: { questionId, text, isCorrect, sortOrder: sortOrder ?? 0 },
    });
  }

  async updateOption(optionId: string, text?: string, isCorrect?: boolean) {
    const option = await this.prisma.questionOption.findUnique({ where: { id: optionId } });
    if (!option) throw new NotFoundException("Opción no encontrada");

    return this.prisma.questionOption.update({
      where: { id: optionId },
      data: {
        ...(text !== undefined && { text }),
        ...(isCorrect !== undefined && { isCorrect }),
      },
    });
  }

  async deleteOption(optionId: string) {
    const option = await this.prisma.questionOption.findUnique({ where: { id: optionId } });
    if (!option) throw new NotFoundException("Opción no encontrada");

    const remaining = await this.prisma.questionOption.count({ where: { questionId: option.questionId } });
    if (remaining <= 2) {
      throw new BadRequestException("La pregunta debe tener al menos 2 opciones. Agregue otra antes de eliminar esta.");
    }

    return this.prisma.questionOption.delete({ where: { id: optionId } });
  }

  // ─── BULK OPTIONS ────────────────────────────────────

  async replaceOptions(questionId: string, options: { text: string; isCorrect: boolean; sortOrder?: number }[]) {
    const question = await this.prisma.question.findUnique({ where: { id: questionId } });
    if (!question) throw new NotFoundException("Pregunta no encontrada");

    const requiresOptions: QuestionType[] = ["MULTIPLE_CHOICE", "TRUE_FALSE"];
    if (requiresOptions.includes(question.type) && options.length < 2) {
      throw new BadRequestException(`Preguntas tipo ${question.type} requieren al menos 2 opciones`);
    }

    await this.prisma.questionOption.deleteMany({ where: { questionId } });

    const created = await Promise.all(
      options.map((opt, index) =>
        this.prisma.questionOption.create({
          data: {
            questionId,
            text: opt.text,
            isCorrect: opt.isCorrect,
            sortOrder: opt.sortOrder ?? index,
          },
        }),
      ),
    );

    return created;
  }

  // ─── OA COVERAGE CHECK ───────────────────────────────

  async checkOaCoverage(subjectId: string, gradeLevel: number) {
    const oas = await this.prisma.learningObjective.findMany({
      where: { subjectId, gradeLevel, isActive: true },
      include: { _count: { select: { questions: true } } },
    });

    return oas.map((oa: { id: string; code: string; description: string; _count: { questions: number } }) => ({
      oaId: oa.id,
      code: oa.code,
      description: oa.description,
      questionCount: oa._count.questions,
      status: oa._count.questions === 0 ? "SIN_PREGUNTAS"
        : oa._count.questions < 3 ? "BAJA_COBERTURA"
        : "ADECUADO",
    }));
  }

  // ─── PRIVATE HELPERS ─────────────────────────────────

  private async createOptions(questionId: string, options: CreateQuestionDto["options"]) {
    if (!options?.length) return;
    await Promise.all(
      options.map((opt, index) =>
        this.prisma.questionOption.create({
          data: {
            questionId,
            text: opt.text,
            isCorrect: opt.isCorrect,
            sortOrder: opt.sortOrder ?? index,
          },
        }),
      ),
    );
  }

  private validateQuestionRules(dto: CreateQuestionDto) {
    const needsOptions: QuestionType[] = ["MULTIPLE_CHOICE", "TRUE_FALSE"];

    if (needsOptions.includes(dto.type)) {
      if (!dto.options || dto.options.length < 2) {
        throw new BadRequestException(`Preguntas tipo ${dto.type} requieren al menos 2 opciones`);
      }

      const correctCount = dto.options.filter((o) => o.isCorrect).length;
      if (correctCount === 0) {
        throw new BadRequestException("Debe haber al menos una opción correcta");
      }

      if (dto.type === "TRUE_FALSE") {
        const uniqueTexts = new Set(dto.options.map((o) => o.text.toLowerCase().trim()));
        const expected = new Set(["verdadero", "falso", "true", "false", "v", "f"]);
        if (dto.options.length !== 2) {
          throw new BadRequestException("Verdadero/Falso debe tener exactamente 2 opciones");
        }
      }
    }
  }

  private checkQuestionWarnings(question: Record<string, unknown>): string[] {
    const warnings: string[] = [];
    if (!question.learningObjectiveId) warnings.push("Sin OA asociado");
    if (!question.axisId) warnings.push("Sin eje asociado");
    if (!question.skillId) warnings.push("Sin habilidad asociada");
    if (question.type === "ESSAY" && !question.explanation) {
      warnings.push("Pregunta de desarrollo sin criterio de corrección (explanation)");
    }
    return warnings;
  }
}
