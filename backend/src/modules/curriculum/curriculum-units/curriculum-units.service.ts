import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { CreateUnitDto, UpdateUnitDto } from "./dto/create-unit.dto.js";

@Injectable()
export class CurriculumUnitsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUnitDto) {
    const existing = await this.prisma.curriculumUnit.findUnique({
      where: { subjectId_gradeLevel_name: { subjectId: dto.subjectId, gradeLevel: dto.gradeLevel, name: dto.name } },
    });
    if (existing) throw new ConflictException("Ya existe una unidad con ese nombre para ese nivel y asignatura");

    return this.prisma.curriculumUnit.create({ data: dto });
  }

  async findBySubject(subjectId: string, gradeLevel?: number) {
    const where: Record<string, unknown> = { subjectId };
    if (gradeLevel) where.gradeLevel = gradeLevel;
    return this.prisma.curriculumUnit.findMany({
      where,
      orderBy: [{ gradeLevel: "asc" }, { sortOrder: "asc" }],
      include: { _count: { select: { learningObjectives: true } } },
    });
  }

  async findById(id: string) {
    const unit = await this.prisma.curriculumUnit.findUnique({
      where: { id },
      include: {
        subject: true,
        learningObjectives: { select: { id: true, code: true, description: true, gradeLevel: true } },
      },
    });
    if (!unit) throw new NotFoundException("Unidad curricular no encontrada");
    return unit;
  }

  async update(id: string, dto: UpdateUnitDto) {
    await this.findById(id);
    return this.prisma.curriculumUnit.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findById(id);
    return this.prisma.curriculumUnit.delete({ where: { id } });
  }
}
