import { Injectable, NotFoundException, ConflictException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { CreateCourseDto, UpdateCourseDto } from "./dto/create-course.dto.js";

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCourseDto) {
    const ay = await this.prisma.academicYear.findUnique({ where: { id: dto.academicYearId } });
    if (!ay) throw new NotFoundException("Año académico no encontrado");

    const existing = await this.prisma.course.findUnique({
      where: { academicYearId_name: { academicYearId: dto.academicYearId, name: dto.name } },
    });
    if (existing) throw new ConflictException("El curso ya existe en este año académico");

    return this.prisma.course.create({
      data: {
        institutionId: dto.institutionId,
        academicYearId: dto.academicYearId,
        name: dto.name,
        gradeLevel: dto.gradeLevel,
        section: dto.section ?? null,
        maxStudents: dto.maxStudents ?? 45,
      },
    });
  }

  async findAll(filters: { institutionId?: string; academicYearId?: string; gradeLevel?: number }) {
    const where: Record<string, unknown> = { isActive: true };
    if (filters.institutionId) where.institutionId = filters.institutionId;
    if (filters.academicYearId) where.academicYearId = filters.academicYearId;
    if (filters.gradeLevel) where.gradeLevel = filters.gradeLevel;

    return this.prisma.course.findMany({
      where,
      orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
      include: {
        academicYear: { select: { year: true } },
        _count: { select: { enrollments: true, assessments: true } },
      },
    });
  }

  async findById(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        institution: { select: { id: true, name: true } },
        academicYear: { select: { id: true, year: true } },
        enrollments: {
          where: { isActive: true },
          include: { student: { select: { id: true, firstName: true, lastName: true } } },
        },
        teacherAssignments: {
          include: {
            teacher: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
            subject: { select: { id: true, name: true } },
          },
        },
        _count: { select: { enrollments: true, assessments: true } },
      },
    });
    if (!course) throw new NotFoundException("Curso no encontrado");
    return course;
  }

  async update(id: string, dto: UpdateCourseDto) {
    await this.findById(id);
    return this.prisma.course.update({ where: { id }, data: dto });
  }

  async getStudentsByCourse(courseId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException("Curso no encontrado");

    return this.prisma.enrollment.findMany({
      where: { courseId, isActive: true },
      include: { student: true },
      orderBy: { student: { lastName: "asc" } },
    });
  }
}
