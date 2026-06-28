import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { CreateObservationDto, UpdateObservationDto } from "./dto/observation.dto.js";
import type { JwtPayload } from "../../../common/decorators/current-user.decorator.js";
import {
  assertCourseScope,
  assertStudentScope,
  resolveUserScope,
} from "../../../common/authz/access-scope.js";
import { normalizePagination } from "../../../common/dto/pagination.dto.js";

@Injectable()
export class ObservationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateObservationDto, userId: string) {
    await assertCourseScope(this.prisma, userId, dto.courseId);
    await assertStudentScope(this.prisma, userId, dto.studentId);

    const [student, course, teacher] = await Promise.all([
      this.prisma.student.findUnique({ where: { id: dto.studentId } }),
      this.prisma.course.findUnique({ where: { id: dto.courseId } }),
      this.prisma.teacher.findUnique({ where: { userId } }),
    ]);
    if (!student) throw new NotFoundException("Estudiante no encontrado");
    if (!course) throw new NotFoundException("Curso no encontrado");
    if (!teacher) throw new NotFoundException("Profesor no encontrado para este usuario");

    return this.prisma.observation.create({
      data: {
        studentId: dto.studentId,
        courseId: dto.courseId,
        teacherId: teacher.id,
        type: dto.type ?? "GENERAL",
        title: dto.title.trim(),
        content: dto.content.trim(),
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
        course: { select: { id: true, name: true } },
        teacher: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
      },
    });
  }

  async findAll(
    filters: { studentId?: string; courseId?: string; type?: string },
    user?: JwtPayload | string,
    page = 1,
    limit = 20,
  ) {
    const where: Record<string, unknown> = {};

    if (user) {
      const scope = await resolveUserScope(this.prisma, user);
      if (filters.studentId) {
        await assertStudentScope(this.prisma, user, filters.studentId);
        where.studentId = filters.studentId;
      }
      if (filters.courseId) {
        await assertCourseScope(this.prisma, user, filters.courseId);
        where.courseId = filters.courseId;
      } else if (!filters.studentId && scope.role === "TEACHER") {
        where.courseId = { in: scope.assignments.map((assignment) => assignment.courseId) };
      } else if (!filters.studentId && !scope.isSuperAdmin && !scope.isGlobalAdmin) {
        where.course = { institutionId: scope.institutionId ?? "00000000-0000-0000-0000-000000000000" };
      }
    } else {
      if (filters.studentId) where.studentId = filters.studentId;
      if (filters.courseId) where.courseId = filters.courseId;
    }

    if (filters.type) where.type = filters.type;

    const pagination = normalizePagination(page, limit);
    const [data, total] = await Promise.all([
      this.prisma.observation.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          student: { select: { id: true, firstName: true, lastName: true, rut: true } },
          course: { select: { id: true, name: true, gradeLevel: true } },
          teacher: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.observation.count({ where }),
    ]);
    return {
      data,
      meta: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
        hasNext: pagination.page * pagination.limit < total,
        hasPrevious: pagination.page > 1,
      },
    };
  }

  async findById(id: string, user?: JwtPayload | string) {
    const observation = await this.prisma.observation.findUnique({
      where: { id },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, rut: true } },
        course: { select: { id: true, name: true } },
        teacher: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!observation) throw new NotFoundException("Observación no encontrada");
    if (user) {
      await assertStudentScope(this.prisma, user, observation.studentId);
      await assertCourseScope(this.prisma, user, observation.courseId);
    }
    return observation;
  }

  async update(id: string, dto: UpdateObservationDto, user?: JwtPayload | string) {
    await this.findById(id, user);
    return this.prisma.observation.update({
      where: { id },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.content !== undefined && { content: dto.content.trim() }),
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
        teacher: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
      },
    });
  }

  async remove(id: string, user?: JwtPayload | string) {
    await this.findById(id, user);
    return this.prisma.observation.delete({ where: { id } });
  }
}
