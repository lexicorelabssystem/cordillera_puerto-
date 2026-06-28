import {
  Injectable, NotFoundException, ConflictException,
  BadRequestException, Inject,
} from "@nestjs/common";
import bcrypt from "bcrypt";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { AppConfig } from "../../../config/config.module.js";
import type { CreateTeacherDto, UpdateTeacherDto, AssignTeacherDto } from "./dto/create-teacher.dto.js";
import { isSubjectAllowedForGrade } from "../../../common/utils/curriculum.js";
import type { JwtPayload } from "../../../common/decorators/current-user.decorator.js";
import {
  assertAcademicManagementInstitutionScope,
  resolveUserScope,
} from "../../../common/authz/access-scope.js";
import { AuditLogsService } from "../../audit-logs/audit-logs.service.js";

@Injectable()
export class TeachersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogsService,
    @Inject("APP_CONFIG") private readonly config: AppConfig,
  ) {}

  async create(dto: CreateTeacherDto, user?: JwtPayload) {
    const scope = user ? await resolveUserScope(this.prisma, user) : null;
    const institutionId = dto.institutionId ?? scope?.institutionId ?? null;

    if (user && institutionId) {
      await assertAcademicManagementInstitutionScope(this.prisma, user, institutionId);
    }
    if (user && !institutionId && scope && !scope.isSuperAdmin && !scope.isGlobalAdmin) {
      throw new BadRequestException("Debe seleccionar una institución para crear el profesor");
    }

    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException("El correo ya está registrado");

    const passwordHash = await bcrypt.hash(dto.temporaryPassword, this.config.bcryptRounds);

    const createdUser = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        role: "TEACHER",
        institutionId,
        mustChangePassword: true,
      },
    });

    const teacher = await this.prisma.teacher.create({
      data: {
        userId: createdUser.id,
        rut: dto.rut ?? null,
        title: dto.title ?? null,
      },
    });

    await this.auditLog.log({
      actorId: user?.sub ?? null,
      institutionId,
      action: "TEACHER_CREATED",
      entityType: "teacher",
      entityId: teacher.id,
      metadata: JSON.stringify({
        email,
        teacherId: teacher.id,
        userId: createdUser.id,
        name: `${dto.firstName.trim()} ${dto.lastName.trim()}`,
      }),
    });

    return this.findByIdByUserId(createdUser.id);
  }

  async findAll(search?: string, user?: JwtPayload, filters: { institutionId?: string; includeInactive?: boolean } = {}) {
    const where: Record<string, unknown> = {};
    const userWhere: Record<string, unknown> = {};

    if (user) {
      const scope = await resolveUserScope(this.prisma, user);
      if (filters.institutionId) {
        await assertAcademicManagementInstitutionScope(this.prisma, user, filters.institutionId);
        userWhere.institutionId = filters.institutionId;
      } else if (!scope.isSuperAdmin && !scope.isGlobalAdmin) {
        userWhere.institutionId = scope.institutionId ?? "00000000-0000-0000-0000-000000000000";
      }
    } else if (filters.institutionId) {
      userWhere.institutionId = filters.institutionId;
    }

    if (!filters.includeInactive) userWhere.isActive = true;

    if (search) {
      userWhere.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (Object.keys(userWhere).length > 0) where.user = userWhere;

    return this.prisma.teacher.findMany({
      where,
      orderBy: { user: { lastName: "asc" } },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, isActive: true, role: true, institutionId: true } },
        courseAssignments: {
          include: {
            course: { select: { id: true, name: true, gradeLevel: true } },
            subject: { select: { id: true, name: true } },
          },
        },
        _count: { select: { courseAssignments: true, assessments: true } },
      },
    });
  }

  async findById(id: string, user?: JwtPayload) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, isActive: true, role: true, institutionId: true } },
        courseAssignments: {
          include: {
            course: { select: { id: true, name: true, gradeLevel: true } },
            subject: { select: { id: true, name: true } },
          },
        },
        _count: { select: { assessments: true, courseAssignments: true } },
      },
    });
    if (!teacher) throw new NotFoundException("Profesor no encontrado");
    if (user && teacher.user.institutionId) {
      await assertAcademicManagementInstitutionScope(this.prisma, user, teacher.user.institutionId);
    }
    return teacher;
  }

  private async findByIdByUserId(userId: string) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, isActive: true, role: true, institutionId: true } },
      },
    });
    if (!teacher) throw new NotFoundException("Profesor no encontrado");
    return teacher;
  }

  async update(id: string, dto: UpdateTeacherDto, user?: JwtPayload) {
    const teacher = await this.findById(id, user);
    if (dto.firstName || dto.lastName || dto.isActive !== undefined) {
      await this.prisma.user.update({
        where: { id: teacher.userId! },
        data: {
          ...(dto.firstName && { firstName: dto.firstName.trim() }),
          ...(dto.lastName && { lastName: dto.lastName.trim() }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });
    }

    await this.prisma.teacher.update({
      where: { id },
      data: {
        ...(dto.rut !== undefined && { rut: dto.rut }),
        ...(dto.title !== undefined && { title: dto.title }),
      },
    });

    await this.auditLog.log({
      actorId: user?.sub ?? null,
      institutionId: teacher.user.institutionId,
      action: dto.isActive === false ? "TEACHER_RETIRED" : dto.isActive === true ? "TEACHER_REACTIVATED" : "TEACHER_UPDATED",
      entityType: "teacher",
      entityId: id,
      metadata: JSON.stringify({
        teacherId: id,
        userId: teacher.userId,
        changed: dto,
      }),
    });

    return this.findById(id, user);
  }

  async retire(id: string, options: { removeAssignments?: boolean } = {}, user?: JwtPayload) {
    const teacher = await this.findById(id, user);
    const assignments = await this.prisma.teacherCourseAssignment.findMany({
      where: { teacherId: id },
      include: {
        course: { select: { id: true, name: true, institutionId: true } },
        subject: { select: { id: true, name: true } },
      },
    });

    await this.prisma.user.update({
      where: { id: teacher.userId! },
      data: { isActive: false },
    });

    let removedAssignments = 0;
    if (options.removeAssignments) {
      const result = await this.prisma.teacherCourseAssignment.deleteMany({ where: { teacherId: id } });
      removedAssignments = result.count;
    }

    await this.auditLog.log({
      actorId: user?.sub ?? null,
      institutionId: teacher.user.institutionId,
      action: options.removeAssignments ? "TEACHER_RETIRED_ASSIGNMENTS_REMOVED" : "TEACHER_RETIRED",
      entityType: "teacher",
      entityId: id,
      metadata: JSON.stringify({
        teacherId: id,
        userId: teacher.userId,
        removedAssignments,
        previousAssignments: assignments.map((assignment) => ({
          assignmentId: assignment.id,
          courseId: assignment.courseId,
          courseName: assignment.course.name,
          subjectId: assignment.subjectId,
          subjectName: assignment.subject.name,
        })),
      }),
    });

    return this.findById(id, user);
  }

  async getMyAssignments(userId: string) {
    const teacher = await this.prisma.teacher.findUnique({ where: { userId } });
    if (!teacher) throw new NotFoundException("Perfil de profesor no encontrado para este usuario");

    return this.prisma.teacherCourseAssignment.findMany({
      where: { teacherId: teacher.id },
      include: {
        course: {
          select: { id: true, name: true, gradeLevel: true, section: true, _count: { select: { enrollments: true } } },
        },
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ course: { gradeLevel: "asc" } }, { course: { name: "asc" } }],
    }).then((assignments) =>
      assignments.map((assignment) => ({
        assignment_id: assignment.id,
        course_id: assignment.courseId,
        course_name: assignment.course.name,
        grade_level: assignment.course.gradeLevel,
        section: assignment.course.section,
        students_count: assignment.course._count.enrollments,
        subject_id: assignment.subjectId,
        subject_name: assignment.subject.name,
        subject_code: assignment.subject.code,
      })),
    );
  }

  async getAssignments(teacherId: string, user?: JwtPayload) {
    await this.findById(teacherId, user);
    return this.prisma.teacherCourseAssignment.findMany({
      where: { teacherId },
      include: {
        course: { select: { id: true, name: true, gradeLevel: true } },
        subject: { select: { id: true, name: true } },
      },
      orderBy: [{ course: { gradeLevel: "asc" } }, { course: { name: "asc" } }],
    });
  }

  async assignToCourse(dto: AssignTeacherDto, user?: JwtPayload) {
    let teacherId = dto.teacherId;

    if (!teacherId && dto.userId) {
      const teacher = await this.prisma.teacher.findUnique({ where: { userId: dto.userId } });
      if (!teacher) throw new NotFoundException("Profesor no encontrado para el usuario indicado");
      teacherId = teacher.id;
    }

    if (!teacherId) throw new BadRequestException("Debe proporcionar teacherId o userId");

    const teacher = await this.prisma.teacher.findUnique({
      where: { id: teacherId },
      include: { user: { select: { isActive: true, institutionId: true } } },
    });
    if (!teacher) throw new NotFoundException("Profesor no encontrado");
    if (!teacher.user.isActive) {
      throw new BadRequestException("No se puede asignar un profesor retirado. Reactívalo o crea un reemplazo.");
    }

    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
    if (!course) throw new NotFoundException("Curso no encontrado");
    if (user) await assertAcademicManagementInstitutionScope(this.prisma, user, course.institutionId);
    if (teacher.user.institutionId && teacher.user.institutionId !== course.institutionId) {
      throw new BadRequestException("El profesor pertenece a otra institución");
    }

    const subject = await this.prisma.subject.findUnique({ where: { id: dto.subjectId } });
    if (!subject) throw new NotFoundException("Asignatura no encontrada");

    if (!isSubjectAllowedForGrade(course.gradeLevel, subject.name)) {
      throw new BadRequestException(
        `La asignatura ${subject.name} no está permitida para el nivel ${course.gradeLevel}°`,
      );
    }

    const existing = await this.prisma.teacherCourseAssignment.findUnique({
      where: {
        teacherId_courseId_subjectId: {
          teacherId,
          courseId: dto.courseId,
          subjectId: dto.subjectId,
        },
      },
    });
    if (existing) throw new ConflictException("La asignación ya existe");

    const assignment = await this.prisma.teacherCourseAssignment.create({
      data: {
        teacherId,
        courseId: dto.courseId,
        subjectId: dto.subjectId,
      },
      include: {
        course: { select: { name: true, gradeLevel: true } },
        subject: { select: { name: true } },
      },
    });

    await this.auditLog.log({
      actorId: user?.sub ?? null,
      institutionId: course.institutionId,
      action: "TEACHER_ASSIGNMENT_CREATED",
      entityType: "teacher_course_assignment",
      entityId: assignment.id,
      metadata: JSON.stringify({
        teacherId,
        courseId: dto.courseId,
        courseName: assignment.course.name,
        subjectId: dto.subjectId,
        subjectName: assignment.subject.name,
      }),
    });

    return assignment;
  }

  async removeAssignment(assignmentId: string, user?: JwtPayload) {
    const assignment = await this.prisma.teacherCourseAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        course: { select: { id: true, name: true, institutionId: true } },
        subject: { select: { id: true, name: true } },
      },
    });
    if (!assignment) throw new NotFoundException("Asignación no encontrada");
    if (user) await assertAcademicManagementInstitutionScope(this.prisma, user, assignment.course.institutionId);
    const removed = await this.prisma.teacherCourseAssignment.delete({ where: { id: assignmentId } });

    await this.auditLog.log({
      actorId: user?.sub ?? null,
      institutionId: assignment.course.institutionId,
      action: "TEACHER_ASSIGNMENT_REMOVED",
      entityType: "teacher_course_assignment",
      entityId: assignmentId,
      metadata: JSON.stringify({
        teacherId: assignment.teacherId,
        courseId: assignment.courseId,
        courseName: assignment.course.name,
        subjectId: assignment.subjectId,
        subjectName: assignment.subject.name,
      }),
    });

    return removed;
  }
}
