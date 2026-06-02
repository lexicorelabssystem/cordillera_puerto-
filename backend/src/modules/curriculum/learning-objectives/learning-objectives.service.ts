import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { CreateLearningObjectiveDto, UpdateLearningObjectiveDto } from "./dto/create-learning-objective.dto.js";

@Injectable()
export class LearningObjectivesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLearningObjectiveDto) {
    const existing = await this.prisma.learningObjective.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException("El código de OA ya existe");

    const oa = await this.prisma.learningObjective.create({
      data: {
        subjectId: dto.subjectId,
        axisId: dto.axisId ?? null,
        unitId: dto.unitId ?? null,
        code: dto.code,
        description: dto.description,
        gradeLevel: dto.gradeLevel,
      },
    });

    if (dto.skillIds?.length) {
      await Promise.all(
        dto.skillIds.map((skillId) =>
          this.prisma.learningObjectiveSkill.create({
            data: { learningObjectiveId: oa.id, skillId },
          }),
        ),
      );
    }

    if (dto.indicators?.length) {
      await Promise.all(
        dto.indicators.map((desc, index) =>
          this.prisma.evaluationIndicator.create({
            data: { learningObjectiveId: oa.id, description: desc, sortOrder: index },
          }),
        ),
      );
    }

    return this.findById(oa.id);
  }

  async findAll(filters: { subjectId?: string; gradeLevel?: number; axisId?: string }) {
    const where: Record<string, unknown> = { isActive: true };
    if (filters.subjectId) where.subjectId = filters.subjectId;
    if (filters.gradeLevel) where.gradeLevel = filters.gradeLevel;
    if (filters.axisId) where.axisId = filters.axisId;

    return this.prisma.learningObjective.findMany({
      where,
      orderBy: [{ gradeLevel: "asc" }, { code: "asc" }],
      include: {
        subject: { select: { id: true, name: true } },
        axis: { select: { id: true, name: true } },
        skills: { include: { skill: { select: { id: true, name: true } } } },
        _count: { select: { questions: true, indicators: true } },
      },
    });
  }

  async findById(id: string) {
    const oa = await this.prisma.learningObjective.findUnique({
      where: { id },
      include: {
        subject: { select: { id: true, name: true } },
        axis: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
        skills: { include: { skill: { select: { id: true, name: true } } } },
        indicators: { orderBy: { sortOrder: "asc" } },
        _count: { select: { questions: true, remedialPlans: true } },
      },
    });
    if (!oa) throw new NotFoundException("Objetivo de aprendizaje no encontrado");
    return oa;
  }

  async update(id: string, dto: UpdateLearningObjectiveDto) {
    await this.findById(id);

    if (dto.code) {
      const existing = await this.prisma.learningObjective.findUnique({ where: { code: dto.code } });
      if (existing && existing.id !== id) throw new ConflictException("El código ya está en uso");
    }

    const oa = await this.prisma.learningObjective.update({
      where: { id },
      data: {
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.gradeLevel !== undefined && { gradeLevel: dto.gradeLevel }),
        ...(dto.axisId !== undefined && { axisId: dto.axisId }),
        ...(dto.unitId !== undefined && { unitId: dto.unitId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    if (dto.skillIds !== undefined) {
      await this.prisma.learningObjectiveSkill.deleteMany({ where: { learningObjectiveId: id } });
      if (dto.skillIds.length) {
        await Promise.all(
          dto.skillIds.map((skillId) =>
            this.prisma.learningObjectiveSkill.create({
              data: { learningObjectiveId: id, skillId },
            }),
          ),
        );
      }
    }

    return this.findById(id);
  }

  async softDelete(id: string) {
    await this.findById(id);
    return this.prisma.learningObjective.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
