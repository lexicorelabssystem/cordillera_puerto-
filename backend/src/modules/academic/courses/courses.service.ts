import { Injectable, NotFoundException, ConflictException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { CreateCourseDto, UpdateCourseDto } from "./dto/create-course.dto.js";
import type { JwtPayload } from "../../../common/decorators/current-user.decorator.js";
import {
  assertAcademicManagementInstitutionScope,
  assertCourseScope,
  resolveUserScope,
} from "../../../common/authz/access-scope.js";

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCourseDto, user?: JwtPayload) {
    if (user) await assertAcademicManagementInstitutionScope(this.prisma, user, dto.institutionId);

    const ay = await this.prisma.academicYear.findUnique({ where: { id: dto.academicYearId } });
    if (!ay) throw new NotFoundException("Año académico no encontrado");

    const existing = await this.prisma.course.findUnique({
      where: { academicYearId_name: { academicYearId: dto.academicYearId, name: dto.name } },
    });
    if (existing) throw new ConflictException("El curso ya existe en este año académico");

    const course = await this.prisma.course.create({
      data: {
        institutionId: dto.institutionId,
        academicYearId: dto.academicYearId,
        name: dto.name,
        gradeLevel: dto.gradeLevel,
        section: dto.section ?? null,
        maxStudents: dto.maxStudents ?? 45,
      },
    });

    return {
      course_id: course.id,
      course_name: course.name,
      grade_level: course.gradeLevel,
      section: course.section,
      max_students: course.maxStudents,
      is_active: course.isActive,
      students_count: 0,
    };
  }

  async findAll(filters: { institutionId?: string; academicYearId?: string; gradeLevel?: number; includeInactive?: boolean }, user?: JwtPayload) {
    const where: Record<string, unknown> = {};
    let canIncludeInactive = !user;

    if (user) {
      const scope = await resolveUserScope(this.prisma, user);
      canIncludeInactive = ["ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP"].includes(scope.role);
      if (filters.institutionId) {
        await assertAcademicManagementInstitutionScope(this.prisma, user, filters.institutionId);
        where.institutionId = filters.institutionId;
      } else if (scope.role === "TEACHER") {
        where.id = { in: scope.assignments.map((assignment) => assignment.courseId) };
      } else if (!scope.isSuperAdmin && !scope.isGlobalAdmin) {
        where.institutionId = scope.institutionId ?? "00000000-0000-0000-0000-000000000000";
      }
    } else if (filters.institutionId) {
      where.institutionId = filters.institutionId;
    }

    if (!filters.includeInactive || !canIncludeInactive) where.isActive = true;
    if (filters.academicYearId) where.academicYearId = filters.academicYearId;
    if (filters.gradeLevel) where.gradeLevel = filters.gradeLevel;

    const courses = await this.prisma.course.findMany({
      where,
      orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
      include: {
        academicYear: { select: { year: true } },
        _count: { select: { enrollments: true, assessments: true } },
      },
    });

    return courses.map((c) => ({
      course_id: c.id,
      course_name: c.name,
      grade_level: c.gradeLevel,
      section: c.section,
      max_students: c.maxStudents,
      is_active: c.isActive,
      students_count: c._count.enrollments,
    }));
  }

  async findById(id: string, user?: JwtPayload) {
    if (user) {
      const courseScope = await this.prisma.course.findUnique({
        where: { id },
        select: { institutionId: true },
      });
      if (!courseScope) throw new NotFoundException("Curso no encontrado");

      const scope = await resolveUserScope(this.prisma, user);
      if (["DIRECTION", "UTP"].includes(scope.role)) {
        await assertAcademicManagementInstitutionScope(this.prisma, user, courseScope.institutionId);
      } else {
        await assertCourseScope(this.prisma, user, id);
      }
    }

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

  async update(id: string, dto: UpdateCourseDto, user?: JwtPayload) {
    await this.findById(id, user);
    const course = await this.prisma.course.update({ where: { id }, data: dto });

    const count = await this.prisma.enrollment.count({ where: { courseId: id, isActive: true } });

    return {
      course_id: course.id,
      course_name: course.name,
      grade_level: course.gradeLevel,
      section: course.section,
      max_students: course.maxStudents,
      is_active: course.isActive,
      students_count: count,
    };
  }

  async deletePermanent(id: string, user?: JwtPayload) {
    await this.findById(id, user);

    const dependencies = await this.prisma.course.findUnique({
      where: { id },
      select: {
        isActive: true,
        _count: {
          select: {
            enrollments: true,
            teacherAssignments: true,
            assessments: true,
            learningResources: true,
            lessons: true,
            attendances: true,
            observations: true,
            classBookEntries: true,
            simceAssessments: true,
          },
        },
      },
    });
    if (!dependencies) throw new NotFoundException("Curso no encontrado");

    if (dependencies.isActive) {
      throw new BadRequestException("Primero debes desactivar el curso antes de eliminarlo definitivamente.");
    }

    const totalDependencies = Object.values(dependencies._count).reduce((total, count) => total + count, 0);
    if (totalDependencies > 0) {
      throw new BadRequestException(
        "No se puede eliminar definitivamente un curso con estudiantes, docentes, evaluaciones, material, asistencia, libro de clases, observaciones o SIMCE asociados. Desactívalo para conservar el historial.",
      );
    }

    await this.prisma.course.delete({ where: { id } });
    return { ok: true, id };
  }

  async getStudentsByCourse(courseId: string, user?: JwtPayload) {
    if (user) {
      const courseScope = await this.prisma.course.findUnique({
        where: { id: courseId },
        select: { institutionId: true },
      });
      if (!courseScope) throw new NotFoundException("Curso no encontrado");

      const scope = await resolveUserScope(this.prisma, user);
      if (["DIRECTION", "UTP"].includes(scope.role)) {
        await assertAcademicManagementInstitutionScope(this.prisma, user, courseScope.institutionId);
      } else {
        await assertCourseScope(this.prisma, user, courseId);
      }
    }

    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException("Curso no encontrado");

    return this.prisma.enrollment.findMany({
      where: { courseId, isActive: true },
      include: { student: true },
      orderBy: { student: { lastName: "asc" } },
    });
  }
}
