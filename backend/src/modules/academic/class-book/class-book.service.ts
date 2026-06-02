import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { CreateClassBookEntryDto, UpdateClassBookEntryDto } from "./dto/class-book.dto.js";
import type { JwtPayload } from "../../../common/decorators/current-user.decorator.js";
import {
  assertCourseScope,
  resolveUserScope,
} from "../../../common/authz/access-scope.js";

@Injectable()
export class ClassBookService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateClassBookEntryDto, userId: string) {
    await assertCourseScope(this.prisma, userId, dto.courseId, dto.subjectId);

    const [course, subject, teacher] = await Promise.all([
      this.prisma.course.findUnique({ where: { id: dto.courseId } }),
      this.prisma.subject.findUnique({ where: { id: dto.subjectId } }),
      this.prisma.teacher.findUnique({ where: { userId } }),
    ]);
    if (!course) throw new NotFoundException("Curso no encontrado");
    if (!subject) throw new NotFoundException("Asignatura no encontrada");
    if (!teacher) throw new NotFoundException("Profesor no encontrado para este usuario");

    return this.prisma.classBookEntry.create({
      data: {
        courseId: dto.courseId,
        subjectId: dto.subjectId,
        teacherId: teacher.id,
        date: new Date(dto.date),
        semester: dto.semester ?? 1,
        classNumber: dto.classNumber ?? null,
        unitName: dto.unitName?.trim() ?? null,
        topic: dto.topic?.trim() ?? null,
        content: dto.content?.trim() ?? null,
        activities: dto.activities?.trim() ?? null,
        resources: dto.resources?.trim() ?? null,
        notes: dto.notes?.trim() ?? null,
      },
      include: {
        course: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        teacher: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
      },
    });
  }

  async findAll(filters: {
    courseId?: string;
    subjectId?: string;
    date?: string;
    from?: string;
    to?: string;
  }, user?: JwtPayload | string) {
    const where: Record<string, unknown> = {};

    if (user) {
      const scope = await resolveUserScope(this.prisma, user);
      if (filters.courseId) {
        await assertCourseScope(this.prisma, user, filters.courseId, filters.subjectId);
        where.courseId = filters.courseId;
      } else if (scope.role === "TEACHER") {
        where.courseId = { in: scope.assignments.map((assignment) => assignment.courseId) };
      } else if (!scope.isSuperAdmin && !scope.isGlobalAdmin) {
        where.course = { institutionId: scope.institutionId ?? "00000000-0000-0000-0000-000000000000" };
      }
    } else if (filters.courseId) {
      where.courseId = filters.courseId;
    }

    if (filters.subjectId) where.subjectId = filters.subjectId;

    if (filters.date) {
      where.date = new Date(filters.date);
    } else if (filters.from && filters.to) {
      where.date = { gte: new Date(filters.from), lte: new Date(filters.to) };
    }

    return this.prisma.classBookEntry.findMany({
      where,
      include: {
        course: { select: { id: true, name: true, gradeLevel: true } },
        subject: { select: { id: true, name: true } },
        teacher: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { date: "desc" },
    });
  }

  async findById(id: string, user?: JwtPayload | string) {
    const entry = await this.prisma.classBookEntry.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, name: true, gradeLevel: true } },
        subject: { select: { id: true, name: true } },
        teacher: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!entry) throw new NotFoundException("Entrada del libro de clases no encontrada");
    if (user) await assertCourseScope(this.prisma, user, entry.courseId, entry.subjectId);
    return entry;
  }

  async update(id: string, dto: UpdateClassBookEntryDto, user?: JwtPayload | string) {
    await this.findById(id, user);

    const data: Record<string, unknown> = {};
    if (dto.semester !== undefined) data.semester = dto.semester;
    if (dto.classNumber !== undefined) data.classNumber = dto.classNumber;
    if (dto.unitName !== undefined) data.unitName = dto.unitName.trim();
    if (dto.topic !== undefined) data.topic = dto.topic.trim();
    if (dto.content !== undefined) data.content = dto.content.trim();
    if (dto.activities !== undefined) data.activities = dto.activities.trim();
    if (dto.resources !== undefined) data.resources = dto.resources.trim();
    if (dto.notes !== undefined) data.notes = dto.notes.trim();

    return this.prisma.classBookEntry.update({
      where: { id },
      data,
      include: {
        course: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        teacher: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
      },
    });
  }

  async remove(id: string, user?: JwtPayload | string) {
    await this.findById(id, user);
    return this.prisma.classBookEntry.delete({ where: { id } });
  }
}
