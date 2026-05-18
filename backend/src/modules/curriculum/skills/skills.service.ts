import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { CreateSkillDto, UpdateSkillDto } from "./dto/create-skill.dto.js";

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSkillDto) {
    const existing = await this.prisma.skill.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException("La habilidad ya existe");
    return this.prisma.skill.create({ data: dto });
  }

  async findAll() {
    return this.prisma.skill.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { learningObjectiveSkills: true, questions: true } },
      },
    });
  }

  async findById(id: string) {
    const skill = await this.prisma.skill.findUnique({
      where: { id },
      include: {
        learningObjectiveSkills: {
          include: { learningObjective: { select: { id: true, code: true, description: true } } },
        },
        _count: { select: { questions: true } },
      },
    });
    if (!skill) throw new NotFoundException("Habilidad no encontrada");
    return skill;
  }

  async update(id: string, dto: UpdateSkillDto) {
    await this.findById(id);
    if (dto.name) {
      const existing = await this.prisma.skill.findUnique({ where: { name: dto.name } });
      if (existing && existing.id !== id) throw new ConflictException("El nombre ya está en uso");
    }
    return this.prisma.skill.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findById(id);
    return this.prisma.skill.delete({ where: { id } });
  }
}
