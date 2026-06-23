import { Injectable, NotFoundException, ConflictException, Inject } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { BadRequestException } from "@nestjs/common";
import { ResourceStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { AppConfig } from "../../../config/config.module.js";
import type { CreateStudentDto, UpdateStudentDto } from "./dto/create-student.dto.js";
import type { JwtPayload } from "../../../common/decorators/current-user.decorator.js";
import {
  assertAcademicManagementInstitutionScope,
  assertCourseScope,
  assertStudentScope,
  resolveUserScope,
} from "../../../common/authz/access-scope.js";
import { AuditLogsService } from "../../audit-logs/audit-logs.service.js";

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogsService,
    @Inject("APP_CONFIG") private readonly config: AppConfig,
  ) {}

  private async assertManagementCourseScope(courseId: string, user?: JwtPayload) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException("Curso no encontrado");
    if (!user) return course;

    const scope = await resolveUserScope(this.prisma, user);
    if (["DIRECTION", "UTP"].includes(scope.role)) {
      await assertAcademicManagementInstitutionScope(this.prisma, user, course.institutionId);
    } else {
      await assertCourseScope(this.prisma, user, courseId);
    }
    return course;
  }

  async create(dto: CreateStudentDto, user?: JwtPayload) {
    const course = await this.assertManagementCourseScope(dto.courseId, user);
    const email = dto.email?.trim().toLowerCase();
    const temporaryPassword = dto.temporaryPassword?.trim();
    const hasEmail = Boolean(email);
    const hasTemporaryPassword = Boolean(temporaryPassword);

    if (hasEmail !== hasTemporaryPassword) {
      throw new BadRequestException("Para crear acceso del alumno debes enviar email y clave temporal.");
    }

    if (dto.rut) {
      const existingRut = await this.prisma.student.findFirst({ where: { rut: dto.rut } });
      if (existingRut) throw new ConflictException("El RUT ya está registrado");
    }

    const student = await this.prisma.student.create({
      data: {
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        rut: dto.rut ?? null,
        gender: dto.gender ?? null,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
      },
    });

    await this.prisma.enrollment.create({
      data: { studentId: student.id, courseId: dto.courseId },
    });

    if (email && temporaryPassword) {
      const existingEmail = await this.prisma.user.findUnique({ where: { email } });
      if (existingEmail) throw new ConflictException("El correo ya está registrado");

      const passwordHash = await bcrypt.hash(temporaryPassword, this.config.bcryptRounds);
      await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          role: "STUDENT",
          institutionId: course.institutionId,
          mustChangePassword: true,
          student: { connect: { id: student.id } },
        },
      });
    }

    await this.auditLog.log({
      actorId: user?.sub ?? null,
      institutionId: course.institutionId,
      action: "STUDENT_CREATED",
      entityType: "student",
      entityId: student.id,
      metadata: JSON.stringify({
        studentId: student.id,
        courseId: course.id,
        courseName: course.name,
        name: `${dto.firstName.trim()} ${dto.lastName.trim()}`,
        accessCreated: Boolean(email && temporaryPassword),
      }),
    });

    return this.findById(student.id);
  }

  async findAll(search?: string, courseId?: string, page = 1, limit = 20, user?: JwtPayload, includeInactive = false) {
    const where: Record<string, unknown> = {};
    const andFilters: Record<string, unknown>[] = [];
    let canIncludeInactive = !user;

    if (user) {
      const scope = await resolveUserScope(this.prisma, user);
      canIncludeInactive = ["ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP"].includes(scope.role);
      if (scope.role === "TEACHER") {
        const assignedCourseIds = scope.assignments.map((a) => a.courseId);
        where.enrollments = { some: { isActive: true, courseId: { in: assignedCourseIds } } };
      } else if (["ADMIN", "DIRECTION", "UTP"].includes(scope.role) && !scope.isGlobalAdmin) {
        if (!scope.institutionId) where.id = "00000000-0000-0000-0000-000000000000";
        else {
          andFilters.push({ OR: [
            { user: { institutionId: scope.institutionId } },
            { enrollments: { some: { isActive: true, course: { institutionId: scope.institutionId } } } },
          ] });
        }
      }
    }

    if (!includeInactive || !canIncludeInactive) where.deletedAt = null;

    if (search) {
      andFilters.push({ OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { rut: { contains: search } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ] });
    }
    if (courseId) {
      if (user) await this.assertManagementCourseScope(courseId, user);
      where.enrollments = { some: { courseId, isActive: true } };
    }
    if (andFilters.length > 0) where.AND = andFilters;

    const [data, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { lastName: "asc" },
        include: {
          user: { select: { id: true, email: true, isActive: true } },
          enrollments: {
            where: { isActive: true },
            include: { course: { select: { id: true, name: true, gradeLevel: true } } },
          },
          _count: { select: { grades: true, attempts: true } },
        },
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrevious: page > 1 },
    };
  }

  async findById(id: string, user?: JwtPayload) {
    if (user) await assertStudentScope(this.prisma, user, id);
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, isActive: true, role: true } },
        enrollments: {
          where: { isActive: true },
          include: { course: { select: { id: true, name: true, gradeLevel: true } } },
        },
        _count: { select: { grades: true, attempts: true } },
      },
    });
    if (!student || student.deletedAt) throw new NotFoundException("Estudiante no encontrado");
    return student;
  }

  async update(id: string, dto: UpdateStudentDto, user?: JwtPayload) {
    const studentBefore = await this.findById(id, user);
    if (dto.rut) {
      const existingRut = await this.prisma.student.findFirst({ where: { rut: dto.rut, id: { not: id } } });
      if (existingRut) throw new ConflictException("El RUT ya está registrado");
    }
    const updated = await this.prisma.student.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName.trim() }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName.trim() }),
        ...(dto.rut !== undefined && { rut: dto.rut }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.birthDate !== undefined && { birthDate: new Date(dto.birthDate) }),
      },
    });

    const scope = user ? await resolveUserScope(this.prisma, user) : null;
    await this.auditLog.log({
      actorId: user?.sub ?? null,
      institutionId: scope?.institutionId ?? null,
      action: "STUDENT_UPDATED",
      entityType: "student",
      entityId: id,
      metadata: JSON.stringify({
        studentId: id,
        courses: studentBefore.enrollments.map((enrollment) => ({
          courseId: enrollment.course.id,
          courseName: enrollment.course.name,
        })),
        changed: dto,
      }),
    });

    return updated;
  }

  async getMyPortal(userId: string) {
    const visibleAssessmentStatuses = ["PUBLISHED", "ACTIVE", "CLOSED", "IN_GRADING", "GRADED", "REPORTED"];
    const visibleResourceStatuses = [ResourceStatus.PUBLISHED, ResourceStatus.USED_IN_CLASS];

    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, email: true, isActive: true } },
        enrollments: {
          where: { isActive: true },
          include: { course: { select: { id: true, name: true, gradeLevel: true, academicYearId: true } } },
        },
      },
    });
    if (!student || student.deletedAt) throw new NotFoundException("Estudiante no encontrado");

    const courseIds = student.enrollments.map((enrollment) => enrollment.course.id);

    const grades: any[] = courseIds.length
      ? await this.prisma.grade.findMany({
          where: {
            studentId: student.id,
            assessment: {
              courseId: { in: courseIds },
              isActive: true,
              status: { in: visibleAssessmentStatuses as any },
            },
          },
          include: {
            assessment: {
              select: {
                id: true,
                title: true,
                assessmentType: true,
                semester: true,
                startDate: true,
                status: true,
                course: { select: { id: true, name: true } },
                subject: { select: { id: true, name: true } },
                teacher: { select: { user: { select: { firstName: true, lastName: true } } } },
                period: { select: { id: true, name: true, status: true } },
              },
            },
          },
          orderBy: { assessment: { startDate: "desc" } },
        })
      : [];

    const assessments: any[] = courseIds.length
      ? await this.prisma.assessment.findMany({
          where: {
            courseId: { in: courseIds },
            isActive: true,
            status: { in: visibleAssessmentStatuses as any },
          } as any,
          include: {
            course: { select: { id: true, name: true } },
            subject: { select: { id: true, name: true } },
            teacher: { select: { user: { select: { firstName: true, lastName: true } } } },
            period: { select: { id: true, name: true, status: true } },
            grades: {
              where: { studentId: student.id },
              select: { id: true, grade: true, comments: true, updatedAt: true },
            },
          } as any,
          orderBy: [{ startDate: "desc" }, { updatedAt: "desc" }],
        })
      : [];

    const resources = courseIds.length
      ? await this.prisma.learningResource.findMany({
          where: {
            courseId: { in: courseIds },
            status: { in: visibleResourceStatuses },
          },
          include: {
            course: { select: { id: true, name: true } },
            subject: { select: { id: true, name: true } },
            createdByUser: { select: { firstName: true, lastName: true, role: true } },
          },
          orderBy: { updatedAt: "desc" },
        })
      : [];

    const resourceIds = resources.map((resource) => resource.id);
    const files = resourceIds.length
      ? await this.prisma.fileAsset.findMany({
          where: { entityType: "resource", entityId: { in: resourceIds } },
          orderBy: { createdAt: "desc" },
        })
      : [];
    const filesByResource = new Map<string, typeof files>();
    for (const file of files) {
      if (!file.entityId) continue;
      const current = filesByResource.get(file.entityId) ?? [];
      current.push(file);
      filesByResource.set(file.entityId, current);
    }

    const allGrades = grades.map((g) => g.grade);
    const avgGrade = allGrades.length
      ? Number((allGrades.reduce((s, v) => s + v, 0) / allGrades.length).toFixed(2))
      : 0;
    const avgPercent = avgGrade > 0 ? Number((((avgGrade - 1.0) / 6.0) * 100).toFixed(1)) : 0;
    const level = avgGrade >= 6.0 ? "Avanzado" : avgGrade >= 5.0 ? "Adecuado" : avgGrade >= 4.0 ? "Básico" : "Crítico";

    const semesterMap = new Map<number, { semester: number; avgGrade: number; totalGrades: number; closed: boolean; status: string }>();
    for (const g of grades) {
      const sem = g.assessment.semester;
      if (!semesterMap.has(sem)) {
        const periodClosed = g.assessment.period?.status === "CLOSED";
        semesterMap.set(sem, { semester: sem, avgGrade: 0, totalGrades: 0, closed: periodClosed, status: periodClosed ? "Cerrado" : "Activo" });
      }
      const entry = semesterMap.get(sem)!;
      entry.totalGrades++;
      entry.avgGrade = Number(((entry.avgGrade * (entry.totalGrades - 1) + g.grade) / entry.totalGrades).toFixed(2));
    }

    const alerts: { type: string; message: string }[] = [];
    if (avgGrade < 4.0) {
      alerts.push({ type: "Riesgo Crítico", message: "Tu promedio general está bajo 4.0. Solicita apoyo a tu profesor." });
    } else if (avgGrade < 4.5) {
      alerts.push({ type: "Atención", message: "Tu promedio está en nivel básico. Refuerza las asignaturas descendidas." });
    }
    if (grades.length < 3) {
      alerts.push({ type: "Pocas evaluaciones", message: "Aún tienes pocas evaluaciones registradas este año." });
    }

    const gradeRows = grades.map((g) => ({
      assessment_id: g.assessment.id,
      title: g.assessment.title,
      subject: g.assessment.subject.name,
      course: g.assessment.course.name,
      teacher: `${g.assessment.teacher.user.firstName} ${g.assessment.teacher.user.lastName}`,
      assessment_type: g.assessment.assessmentType,
      status: g.assessment.status,
      semester: g.assessment.semester,
      applied_at: g.assessment.startDate.toISOString().slice(0, 10),
      grade: g.grade,
      grade_id: g.id,
      comments: g.comments,
      period: g.assessment.period?.name ?? null,
    }));

    const evaluationRows = assessments.map((assessment) => {
      const grade = assessment.grades[0] ?? null;
      return {
        assessment_id: assessment.id,
        title: assessment.title,
        subject: assessment.subject.name,
        subject_id: assessment.subject.id,
        course: assessment.course.name,
        course_id: assessment.course.id,
        teacher: `${assessment.teacher.user.firstName} ${assessment.teacher.user.lastName}`,
        assessment_type: assessment.assessmentType,
        raw_status: assessment.status,
        status: grade ? "calificada" : "pendiente",
        semester: assessment.semester,
        applied_at: assessment.startDate.toISOString().slice(0, 10),
        grade: grade?.grade ?? null,
        grade_id: grade?.id ?? null,
        comments: grade?.comments ?? null,
        period: assessment.period?.name ?? null,
        updated_at: assessment.updatedAt.toISOString(),
      };
    });

    const materialRows = resources.map((resource) => ({
      id: resource.id,
      title: resource.title,
      description: resource.description,
      type: resource.type,
      status: resource.status,
      subject: resource.subject?.name ?? "General",
      subject_id: resource.subjectId,
      course: resource.course?.name ?? null,
      course_id: resource.courseId,
      teacher: `${resource.createdByUser.firstName} ${resource.createdByUser.lastName}`,
      updated_at: resource.updatedAt.toISOString(),
      files: (filesByResource.get(resource.id) ?? []).map((file) => ({
        id: file.id,
        fileName: file.fileName,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        downloadUrl: `/api/v1/files/download/${file.fileName}`,
        viewUrl: `/api/v1/files/view/${file.fileName}`,
      })),
    }));

    return {
      student: { id: student.id, name: `${student.firstName} ${student.lastName}` },
      overall: { avgGrade, avgPercent, level, totalGrades: allGrades.length, status: avgGrade >= 4.0 ? "Aprobado" : "En riesgo" },
      semesters: [...semesterMap.values()].sort((a, b) => a.semester - b.semester),
      alerts,
      grades: gradeRows,
      evaluations: evaluationRows,
      materials: materialRows,
    };
  }

  async softDelete(id: string, user?: JwtPayload) {
    const studentBefore = await this.findById(id, user);
    const student = await this.prisma.student.update({ where: { id }, data: { deletedAt: new Date() } });
    if (student.userId) {
      await this.prisma.user.update({ where: { id: student.userId }, data: { isActive: false } });
    }
    const scope = user ? await resolveUserScope(this.prisma, user) : null;
    await this.auditLog.log({
      actorId: user?.sub ?? null,
      institutionId: scope?.institutionId ?? null,
      action: "STUDENT_RETIRED",
      entityType: "student",
      entityId: id,
      metadata: JSON.stringify({
        studentId: id,
        userId: student.userId,
        courses: studentBefore.enrollments.map((enrollment) => ({
          courseId: enrollment.course.id,
          courseName: enrollment.course.name,
        })),
      }),
    });
    return student;
  }

  async restore(id: string, user?: JwtPayload) {
    if (user) await assertStudentScope(this.prisma, user, id);
    else {
      const student = await this.prisma.student.findUnique({ where: { id } });
      if (!student) throw new NotFoundException("Estudiante no encontrado");
    }
    const student = await this.prisma.student.update({ where: { id }, data: { deletedAt: null } });
    if (student.userId) {
      await this.prisma.user.update({ where: { id: student.userId }, data: { isActive: true } });
    }
    const scope = user ? await resolveUserScope(this.prisma, user) : null;
    await this.auditLog.log({
      actorId: user?.sub ?? null,
      institutionId: scope?.institutionId ?? null,
      action: "STUDENT_REACTIVATED",
      entityType: "student",
      entityId: id,
      metadata: JSON.stringify({
        studentId: id,
        userId: student.userId,
      }),
    });
    return this.findById(id, user);
  }
}
