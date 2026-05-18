import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { CreateLessonDto, UpdateLessonDto, LessonFilterDto } from "./dto/create-lesson.dto.js";

@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLessonDto, userId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
    if (!course) throw new NotFoundException("Curso no encontrado");

    const teacher = await this.prisma.teacher.findUnique({ where: { userId } });
    if (!teacher) throw new ForbiddenException("Solo profesores pueden crear clases");

    const lesson = await this.prisma.lesson.create({
      data: {
        institutionId: dto.institutionId,
        academicYearId: dto.academicYearId ?? course.academicYearId,
        courseId: dto.courseId,
        subjectId: dto.subjectId,
        teacherId: teacher.id,
        title: dto.title,
        date: new Date(dto.date),
        objective: dto.objective ?? null,
        startDescription: dto.startDescription ?? null,
        developmentDescription: dto.developmentDescription ?? null,
        closureDescription: dto.closureDescription ?? null,
        notes: dto.notes ?? null,
        status: "PLANNED",
      },
    });

    if (dto.resourceIds?.length) {
      await Promise.all(
        dto.resourceIds.map((resourceId, index) =>
          this.prisma.lessonResource.create({
            data: { lessonId: lesson.id, resourceId, sortOrder: index },
          }),
        ),
      );
    }

    if (dto.assessmentId) {
      const resource = await this.prisma.learningResource.create({
        data: {
          institutionId: dto.institutionId,
          title: `Evaluación: Clase ${dto.title}`,
          type: "CLASS_MATERIAL",
          status: "READY",
          assessmentId: dto.assessmentId,
          courseId: dto.courseId,
          subjectId: dto.subjectId,
          createdBy: userId,
        },
      });
      await this.prisma.lessonResource.create({
        data: { lessonId: lesson.id, resourceId: resource.id, sortOrder: 999 },
      });
    }

    return this.findById(lesson.id);
  }

  async findAll(filters: LessonFilterDto, userId: string, page = 1, limit = 20) {
    const where: Record<string, unknown> = {};

    const teacher = await this.prisma.teacher.findUnique({ where: { userId } });
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (user?.role === "TEACHER" && teacher) {
      where.teacherId = teacher.id;
    } else if (user?.role === "STUDENT") {
      const student = await this.prisma.student.findUnique({ where: { userId } });
      if (student) {
        const enrollments = await this.prisma.enrollment.findMany({
          where: { studentId: student.id, isActive: true },
          select: { courseId: true },
        });
        where.courseId = { in: enrollments.map((e) => e.courseId) };
      }
    }

    if (filters.courseId) where.courseId = filters.courseId;
    if (filters.subjectId) where.subjectId = filters.subjectId;
    if (filters.status) where.status = filters.status;
    if (filters.dateFrom || filters.dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (filters.dateFrom) dateFilter.gte = new Date(filters.dateFrom);
      if (filters.dateTo) dateFilter.lte = new Date(filters.dateTo);
      where.date = dateFilter;
    }

    const [data, total] = await Promise.all([
      this.prisma.lesson.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { date: "desc" },
        include: {
          course: { select: { id: true, name: true, gradeLevel: true } },
          subject: { select: { id: true, name: true } },
          teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
          _count: { select: { resources: true } },
        },
      }),
      this.prisma.lesson.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrevious: page > 1 },
    };
  }

  async findById(id: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: {
        institution: { select: { id: true, name: true } },
        academicYear: { select: { id: true, year: true } },
        course: { select: { id: true, name: true, gradeLevel: true } },
        subject: { select: { id: true, name: true } },
        teacher: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        resources: {
          orderBy: { sortOrder: "asc" },
          include: {
            resource: {
              include: {
                guide: true,
                presentation: true,
                assessment: { select: { id: true, title: true, status: true } },
              },
            },
          },
        },
        fileAsset: true,
      },
    });
    if (!lesson) throw new NotFoundException("Clase no encontrada");
    return lesson;
  }

  async update(id: string, dto: UpdateLessonDto) {
    await this.findById(id);
    return this.prisma.lesson.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.date !== undefined && { date: new Date(dto.date) }),
        ...(dto.objective !== undefined && { objective: dto.objective }),
        ...(dto.startDescription !== undefined && { startDescription: dto.startDescription }),
        ...(dto.developmentDescription !== undefined && { developmentDescription: dto.developmentDescription }),
        ...(dto.closureDescription !== undefined && { closureDescription: dto.closureDescription }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async execute(id: string) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id } });
    if (!lesson) throw new NotFoundException("Clase no encontrada");

    if (lesson.status !== "PLANNED" && lesson.status !== "RESCHEDULED") {
      throw new BadRequestException(`No se puede ejecutar una clase en estado ${lesson.status}`);
    }

    await this.prisma.lesson.update({
      where: { id },
      data: { status: "EXECUTED", executedAt: new Date() },
    });

    // Marcar recursos vinculados como usados
    const lessonResources = await this.prisma.lessonResource.findMany({
      where: { lessonId: id },
      select: { resourceId: true },
    });

    await this.prisma.learningResource.updateMany({
      where: { id: { in: lessonResources.map((lr) => lr.resourceId) }, status: { in: ["PUBLISHED", "READY"] } },
      data: { status: "USED_IN_CLASS", usedAt: new Date() },
    });

    return this.findById(id);
  }

  async cancel(id: string) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id } });
    if (!lesson) throw new NotFoundException("Clase no encontrada");

    return this.prisma.lesson.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
  }

  async reschedule(id: string, newDate: string) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id } });
    if (!lesson) throw new NotFoundException("Clase no encontrada");

    return this.prisma.lesson.update({
      where: { id },
      data: { status: "RESCHEDULED", date: new Date(newDate) },
    });
  }

  async addResource(lessonId: string, resourceId: string) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException("Clase no encontrada");

    const existing = await this.prisma.lessonResource.findUnique({
      where: { lessonId_resourceId: { lessonId, resourceId } },
    });
    if (existing) return existing;

    return this.prisma.lessonResource.create({
      data: { lessonId, resourceId },
    });
  }

  async removeResource(lessonId: string, resourceId: string) {
    const link = await this.prisma.lessonResource.findUnique({
      where: { lessonId_resourceId: { lessonId, resourceId } },
    });
    if (!link) throw new NotFoundException("Recurso no vinculado a esta clase");
    return this.prisma.lessonResource.delete({ where: { id: link.id } });
  }
}
