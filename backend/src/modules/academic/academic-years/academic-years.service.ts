import {
  Injectable, NotFoundException, ConflictException,
  BadRequestException, ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { CreateAcademicYearDto, UpdateAcademicYearDto } from "./dto/create-academic-year.dto.js";

@Injectable()
export class AcademicYearsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAcademicYearDto) {
    const inst = await this.prisma.institution.findUnique({ where: { id: dto.institutionId } });
    if (!inst) throw new NotFoundException("Institución no encontrada");

    if (new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new BadRequestException("La fecha de término debe ser posterior a la de inicio");
    }

    const existing = await this.prisma.academicYear.findUnique({
      where: { institutionId_year: { institutionId: dto.institutionId, year: dto.year } },
    });
    if (existing) throw new ConflictException("Ya existe un año académico con ese número para esta institución");

    return this.prisma.academicYear.create({
      data: {
        institutionId: dto.institutionId,
        year: dto.year,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        isActive: true,
      },
    });
  }

  async findByInstitution(institutionId: string) {
    return this.prisma.academicYear.findMany({
      where: { institutionId },
      orderBy: { year: "desc" },
      include: {
        _count: { select: { courses: true, periods: true } },
      },
    });
  }

  async findById(id: string) {
    const year = await this.prisma.academicYear.findUnique({
      where: { id },
      include: {
        institution: true,
        courses: { orderBy: { gradeLevel: "asc" } },
        periods: { orderBy: { startDate: "asc" } },
        _count: { select: { courses: true, periods: true } },
      },
    });
    if (!year) throw new NotFoundException("Año académico no encontrado");
    return year;
  }

  async update(id: string, dto: UpdateAcademicYearDto) {
    const year = await this.findById(id);
    if (dto.year && dto.year !== year.year) {
      const existing = await this.prisma.academicYear.findUnique({
        where: { institutionId_year: { institutionId: year.institutionId, year: dto.year } },
      });
      if (existing) throw new ConflictException("Ya existe un año con ese número");
    }
    return this.prisma.academicYear.update({
      where: { id },
      data: {
        ...(dto.startDate && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate && { endDate: new Date(dto.endDate) }),
        ...(dto.year && { year: dto.year }),
      },
    });
  }

  async close(id: string) {
    const year = await this.findById(id);

    const openPeriods = year.periods.filter((p: { status: string; name: string }) => p.status === "ACTIVE");
    if (openPeriods.length > 0) {
      throw new BadRequestException(
        `No se puede cerrar el año. Hay ${openPeriods.length} periodo(s) activo(s): ${openPeriods.map((p: { name: string }) => p.name).join(", ")}`,
      );
    }

    return this.prisma.academicYear.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async reopen(id: string) {
    const year = await this.prisma.academicYear.findUnique({ where: { id } });
    if (!year) throw new NotFoundException("Año académico no encontrado");

    const activeYear = await this.prisma.academicYear.findFirst({
      where: { institutionId: year.institutionId, isActive: true, id: { not: id } },
    });
    if (activeYear) {
      throw new BadRequestException(
        `Ya existe un año académico activo (${activeYear.year}). Solo puede haber uno activo a la vez.`,
      );
    }

    return this.prisma.academicYear.update({
      where: { id },
      data: { isActive: true },
    });
  }
}
