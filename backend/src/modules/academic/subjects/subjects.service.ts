import { Injectable, NotFoundException, ConflictException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { CreateSubjectDto, UpdateSubjectDto } from "./dto/create-subject.dto.js";

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSubjectDto) {
    const existing = await this.prisma.subject.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException("La asignatura ya existe");
    return this.prisma.subject.create({ data: dto });
  }

  async findAll(includeInactive = false) {
    return this.prisma.subject.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { questions: true, assessments: true, learningObjectives: true } },
      },
    });
  }

  async findById(id: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id },
      include: {
        _count: { select: { questions: true, assessments: true, learningObjectives: true } },
      },
    });
    if (!subject) throw new NotFoundException("Asignatura no encontrada");
    return subject;
  }

  async update(id: string, dto: UpdateSubjectDto) {
    await this.findById(id);
    if (dto.name) {
      const existing = await this.prisma.subject.findUnique({ where: { name: dto.name } });
      if (existing && existing.id !== id) throw new ConflictException("El nombre ya está en uso");
    }
    return this.prisma.subject.update({ where: { id }, data: dto });
  }

  async softDelete(id: string) {
    const subject = await this.prisma.subject.findUnique({ where: { id } });
    if (!subject) throw new NotFoundException("Asignatura no encontrada");
    await this.prisma.subject.update({
      where: { id },
      data: { isActive: false },
    });
    return { ok: true, id };
  }

  async deletePermanent(id: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id },
      select: {
        isActive: true,
        _count: {
          select: {
            axes: true,
            units: true,
            learningObjectives: true,
            questions: true,
            assessments: true,
            teacherAssignments: true,
            curriculumRules: true,
            learningResources: true,
            lessons: true,
            classBookEntries: true,
            simceAssessments: true,
          },
        },
      },
    });
    if (!subject) throw new NotFoundException("Asignatura no encontrada");

    if (subject.isActive) {
      throw new BadRequestException("Primero debes desactivar la asignatura antes de eliminarla definitivamente.");
    }

    const totalDependencies = Object.values(subject._count).reduce((total, count) => total + count, 0);
    if (totalDependencies > 0) {
      throw new BadRequestException(
        "No se puede eliminar definitivamente una asignatura con curriculum, preguntas, evaluaciones, material, docentes asignados, libro de clases o SIMCE asociados. Desactivala para conservar el historial.",
      );
    }

    await this.prisma.subject.delete({ where: { id } });
    return { ok: true, id };
  }
}
