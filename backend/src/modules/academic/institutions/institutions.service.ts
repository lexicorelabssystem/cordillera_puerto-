import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { BadRequestException } from "@nestjs/common";
import type { CreateInstitutionDto, UpdateInstitutionDto, CreateInstitutionConfigDto, UpdateInstitutionConfigDto } from "./dto/create-institution.dto.js";

@Injectable()
export class InstitutionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateInstitutionDto) {
    if (dto.rbd) {
      const existing = await this.prisma.institution.findUnique({ where: { rbd: dto.rbd } });
      if (existing) throw new ConflictException("Ya existe una institución con ese RBD");
    }

    const institution = await this.prisma.institution.create({ data: dto });

    await this.prisma.institutionConfig.create({
      data: { institutionId: institution.id },
    });

    return this.findById(institution.id);
  }

  async findAll(includeInactive = false) {
    return this.prisma.institution.findMany({
      where: includeInactive ? {} : { isActive: true, deletedAt: null },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { users: true, courses: true, academicYears: true } },
        config: true,
      },
    });
  }

  async findById(id: string) {
    const institution = await this.prisma.institution.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true, courses: true, academicYears: true } },
        config: true,
      },
    });
    if (!institution) throw new NotFoundException("Institución no encontrada");
    return institution;
  }

  async update(id: string, dto: UpdateInstitutionDto) {
    await this.findById(id);
    if (dto.rbd) {
      const existing = await this.prisma.institution.findUnique({ where: { rbd: dto.rbd } });
      if (existing && existing.id !== id) throw new ConflictException("El RBD ya está en uso");
    }
    return this.prisma.institution.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.isActive === true ? { deletedAt: null } : {}),
      },
    });
  }

  async softDelete(id: string) {
    await this.findById(id);
    return this.prisma.institution.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async deletePermanent(id: string) {
    const institution = await this.prisma.institution.findUnique({
      where: { id },
      select: {
        id: true,
        isActive: true,
        _count: {
          select: {
            users: true,
            courses: true,
            academicYears: true,
            learningResources: true,
            lessons: true,
          },
        },
      },
    });
    if (!institution) throw new NotFoundException("Institución no encontrada");

    if (institution.isActive) {
      throw new BadRequestException("Primero debes desactivar la institución antes de eliminarla definitivamente.");
    }

    const totalDependencies = Object.values(institution._count).reduce((total, count) => total + count, 0);
    if (totalDependencies > 0) {
      throw new BadRequestException(
        "No se puede eliminar definitivamente una institución con usuarios, cursos, años académicos, material o clases asociados. Desactívala para conservar el historial.",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.updateMany({
        where: { institutionId: id },
        data: { institutionId: null },
      });
      await tx.institution.delete({ where: { id } });
    });

    return { ok: true, id };
  }

  async getConfig(institutionId: string) {
    const config = await this.prisma.institutionConfig.findUnique({
      where: { institutionId },
    });
    if (!config) throw new NotFoundException("Configuración de institución no encontrada");
    return config;
  }

  async upsertConfig(institutionId: string, dto: UpdateInstitutionConfigDto) {
    await this.findById(institutionId);
    return this.prisma.institutionConfig.upsert({
      where: { institutionId },
      update: {
        ...(dto.gradingScaleMin !== undefined && { gradingScaleMin: dto.gradingScaleMin }),
        ...(dto.gradingScaleMax !== undefined && { gradingScaleMax: dto.gradingScaleMax }),
        ...(dto.exigencia !== undefined && { exigencia: dto.exigencia }),
        ...(dto.allowGradeEdit !== undefined && { allowGradeEdit: dto.allowGradeEdit }),
        ...(dto.allowSelfRegistration !== undefined && { allowSelfRegistration: dto.allowSelfRegistration }),
        ...(dto.defaultLanguage !== undefined && { defaultLanguage: dto.defaultLanguage }),
      },
      create: {
        institutionId,
        gradingScaleMin: dto.gradingScaleMin ?? 1.0,
        gradingScaleMax: dto.gradingScaleMax ?? 7.0,
        exigencia: dto.exigencia ?? 60.0,
        allowGradeEdit: dto.allowGradeEdit ?? true,
        allowSelfRegistration: dto.allowSelfRegistration ?? false,
        defaultLanguage: dto.defaultLanguage ?? "es-CL",
      },
    });
  }
}
