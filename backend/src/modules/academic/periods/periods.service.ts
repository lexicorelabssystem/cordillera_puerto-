import {
  Injectable, NotFoundException, ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { CreatePeriodDto, UpdatePeriodDto } from "./dto/create-period.dto.js";

@Injectable()
export class PeriodsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePeriodDto) {
    const ay = await this.prisma.academicYear.findUnique({ where: { id: dto.academicYearId } });
    if (!ay) throw new NotFoundException("Año académico no encontrado");

    if (new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new BadRequestException("La fecha de término debe ser posterior a la de inicio");
    }

    if (dto.startDate < ay.startDate.toISOString() || dto.endDate > ay.endDate.toISOString()) {
      throw new BadRequestException("Las fechas del periodo deben estar dentro del año académico");
    }

    const existing = await this.prisma.period.findUnique({
      where: { academicYearId_name: { academicYearId: dto.academicYearId, name: dto.name } },
    });
    if (existing) throw new ConflictException("Ya existe un periodo con ese nombre");

    return this.prisma.period.create({ data: dto });
  }

  async findByAcademicYear(academicYearId: string) {
    return this.prisma.period.findMany({
      where: { academicYearId },
      orderBy: { startDate: "asc" },
      include: { _count: { select: { assessments: true } } },
    });
  }

  async findById(id: string) {
    const period = await this.prisma.period.findUnique({
      where: { id },
      include: {
        academicYear: { include: { institution: true } },
        _count: { select: { assessments: true } },
      },
    });
    if (!period) throw new NotFoundException("Periodo no encontrado");
    return period;
  }

  async update(id: string, dto: UpdatePeriodDto) {
    await this.findById(id);
    return this.prisma.period.update({ where: { id }, data: dto });
  }

  async close(id: string, userId: string) {
    const period = await this.findById(id);

    if (period.status !== "ACTIVE") {
      throw new BadRequestException(`El periodo ya está ${period.status}`);
    }

    const weights = await this.prisma.period.aggregate({
      where: { academicYearId: period.academicYearId, status: "ACTIVE", id: { not: id } },
      _sum: { weight: true },
    });
    const otherWeight = weights._sum.weight ?? 0;
    const thisWeight = period.weight ?? 0;

    if (otherWeight !== 0 && thisWeight !== 0 && Math.abs(otherWeight + thisWeight - 100) > 0.01) {
      throw new BadRequestException(
        `No se puede cerrar. Las ponderaciones de los periodos activos deben sumar 100%. Actual: ${otherWeight + thisWeight}%`,
      );
    }

    const assessments = await this.prisma.assessment.findMany({
      where: { periodId: id, status: { notIn: ["DRAFT", "ARCHIVED"] }, assessmentType: { not: "DIAGNOSTICA" } },
      select: { weight: true, title: true },
    });
    const nonZeroAssessments = assessments.filter((a: { weight: number | null; title: string }) => (a.weight ?? 0) > 0);
    if (nonZeroAssessments.length > 0) {
      const totalWeight = nonZeroAssessments.reduce((sum, a) => sum + (a.weight ?? 0), 0);
      if (Math.abs(totalWeight - 100) > 0.01) {
        throw new BadRequestException(
          `No se puede cerrar. Las ponderaciones de evaluaciones deben sumar 100%. Actual: ${totalWeight.toFixed(1)}%.`,
        );
      }
    }

    const activeAssessments = await this.prisma.assessment.count({
      where: { periodId: id, status: { in: ["ACTIVE", "PUBLISHED"] } },
    });
    if (activeAssessments > 0) {
      throw new BadRequestException(
        `No se puede cerrar. Hay ${activeAssessments} evaluaciones activas/publicadas en este periodo.`,
      );
    }

    const pendingGrading = await this.prisma.assessment.count({
      where: { periodId: id, status: { in: ["CLOSED", "IN_GRADING"] } },
    });
    if (pendingGrading > 0) {
      throw new BadRequestException(
        `No se puede cerrar. Hay ${pendingGrading} evaluaciones pendientes de corrección.`,
      );
    }

    return this.prisma.period.update({
      where: { id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closedBy: userId,
      },
    });
  }

  async reopen(id: string, userId: string) {
    const period = await this.prisma.period.findUnique({ where: { id } });
    if (!period) throw new NotFoundException("Periodo no encontrado");

    if (period.status !== "CLOSED") {
      throw new BadRequestException("Solo se puede reabrir un periodo cerrado");
    }

    return this.prisma.period.update({
      where: { id },
      data: {
        status: "ACTIVE",
        reopenedAt: new Date(),
        reopenedBy: userId,
      },
    });
  }
}
