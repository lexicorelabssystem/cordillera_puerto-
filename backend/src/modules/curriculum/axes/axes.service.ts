import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { CreateAxisDto, UpdateAxisDto } from "./dto/create-axis.dto.js";

@Injectable()
export class AxesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAxisDto) {
    const subject = await this.prisma.subject.findUnique({ where: { id: dto.subjectId } });
    if (!subject) throw new NotFoundException("Asignatura no encontrada");

    const existing = await this.prisma.axis.findUnique({
      where: { subjectId_name: { subjectId: dto.subjectId, name: dto.name } },
    });
    if (existing) throw new ConflictException("Ya existe un eje con ese nombre para esta asignatura");

    return this.prisma.axis.create({ data: dto });
  }

  async findBySubject(subjectId: string) {
    return this.prisma.axis.findMany({
      where: { subjectId },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { learningObjectives: true, questions: true } } },
    });
  }

  async findById(id: string) {
    const axis = await this.prisma.axis.findUnique({
      where: { id },
      include: {
        subject: true,
        learningObjectives: { select: { id: true, code: true, description: true } },
        _count: { select: { questions: true } },
      },
    });
    if (!axis) throw new NotFoundException("Eje no encontrado");
    return axis;
  }

  async update(id: string, dto: UpdateAxisDto) {
    await this.findById(id);
    return this.prisma.axis.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findById(id);
    const usage = await this.prisma.question.count({ where: { axisId: id } });
    if (usage > 0) {
      throw new ConflictException(`No se puede eliminar: ${usage} preguntas referencian este eje`);
    }
    return this.prisma.axis.delete({ where: { id } });
  }
}
