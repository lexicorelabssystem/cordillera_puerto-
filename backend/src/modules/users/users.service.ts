import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Logger,
} from "@nestjs/common";
import bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditLogsService } from "../audit-logs/audit-logs.service.js";
import type { AppConfig } from "../../config/config.module.js";
import type { CreateUserDto, UpdateUserDto } from "./dto/create-user.dto.js";
import type { PaginatedResult } from "../../common/dto/pagination.dto.js";
import type { UserRole } from "@prisma/client";
import { validatePasswordPolicy } from "../../common/utils/password-policy.js";
import { resolveUserScope } from "../../common/authz/access-scope.js";
import type { JwtPayload } from "../../common/decorators/current-user.decorator.js";

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogsService,
    @Inject("APP_CONFIG") private readonly config: AppConfig,
  ) {}

  async create(dto: CreateUserDto, actor?: JwtPayload) {
    const scope = actor ? await resolveUserScope(this.prisma, actor) : null;
    this.assertWritableRole(dto.role, scope);
    const email = dto.email.toLowerCase().trim();
    const course = dto.role === "STUDENT" ? await this.resolveStudentCourse(dto.courseId, scope) : null;
    const institutionId = course?.institutionId ?? this.resolveWritableInstitutionId(dto.institutionId, scope);

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException("El correo electrónico ya está registrado");
    }

    this.validatePasswordPolicy(dto.temporaryPassword);

    const passwordHash = await bcrypt.hash(dto.temporaryPassword, this.config.bcryptRounds);

    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          role: dto.role,
          institutionId,
          mustChangePassword: true,
        },
      });

      if (dto.role === "TEACHER") {
        await tx.teacher.create({
          data: { userId: createdUser.id },
        });
      }

      if (dto.role === "STUDENT") {
        if (!course) throw new BadRequestException("El curso es obligatorio para crear un estudiante");
        const student = await tx.student.create({
          data: {
            userId: createdUser.id,
            firstName,
            lastName,
          },
        });
        await tx.enrollment.create({
          data: { studentId: student.id, courseId: course.id },
        });
      }

      return createdUser;
    });

    this.logger.log(`Usuario creado: ${email} (${dto.role})`);
    await this.auditLog.log({
      actorId: actor?.sub ?? null,
      institutionId,
      action: "USER_CREATED",
      entityType: "user",
      entityId: user.id,
      metadata: JSON.stringify({ email, role: dto.role, courseId: course?.id ?? null }),
    });

    return this.findById(user.id);
  }

  async findAll(
    page = 1,
    limit = 20,
    role?: UserRole,
    institutionId?: string,
    actor?: JwtPayload,
  ): Promise<PaginatedResult<unknown>> {
    const scope = actor ? await resolveUserScope(this.prisma, actor) : null;
    const scopedInstitutionId = this.resolveReadableInstitutionId(institutionId, scope);
    if (role) this.assertReadableRole(role, scope);
    const skip = (page - 1) * limit;
    const where = {
      deletedAt: null,
      ...(role ? { role } : this.defaultRoleScope(scope)),
      ...(scopedInstitutionId ? { institutionId: scopedInstitutionId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
          institutionId: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          student: {
            select: {
              id: true,
              enrollments: {
                where: { isActive: true },
                orderBy: { enrolledAt: "desc" },
                take: 1,
                select: { id: true, courseId: true, course: { select: { name: true } } },
              },
            },
          },
          teacher: { select: { id: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const users = data.map((u) => ({
      ...u,
      studentId: u.student?.id ?? null,
      enrollmentId: u.student?.enrollments?.[0]?.id ?? null,
      courseId: u.student?.enrollments?.[0]?.courseId ?? null,
      courseName: u.student?.enrollments?.[0]?.course.name ?? null,
      teacherId: u.teacher?.id ?? null,
      student: undefined,
      teacher: undefined,
    }));

    return {
      data: users,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrevious: page > 1,
      },
    };
  }

  async findById(id: string, actor?: JwtPayload) {
    const scope = actor ? await resolveUserScope(this.prisma, actor) : null;
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        institutionId: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        student: {
          select: {
            id: true,
            enrollments: {
              where: { isActive: true },
              orderBy: { enrolledAt: "desc" },
              take: 1,
              select: { id: true, courseId: true, course: { select: { name: true } } },
            },
          },
        },
        teacher: { select: { id: true } },
      },
    });

    if (!user || user.isActive === false) {
      throw new NotFoundException("Usuario no encontrado");
    }
    this.assertCanAccessUser(user.institutionId, scope);
    this.assertReadableRole(user.role, scope);

    return {
      ...user,
      studentId: user.student?.id ?? null,
      enrollmentId: user.student?.enrollments?.[0]?.id ?? null,
      courseId: user.student?.enrollments?.[0]?.courseId ?? null,
      courseName: user.student?.enrollments?.[0]?.course.name ?? null,
      teacherId: user.teacher?.id ?? null,
      student: undefined,
      teacher: undefined,
    };
  }

  async update(id: string, dto: UpdateUserDto, actor?: JwtPayload) {
    const scope = actor ? await resolveUserScope(this.prisma, actor) : null;
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            enrollments: {
              where: { isActive: true },
              orderBy: { enrolledAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });
    if (!user) throw new NotFoundException("Usuario no encontrado");
    this.assertCanAccessUser(user.institutionId, scope);
    this.assertReadableRole(user.role, scope);
    if (dto.role !== undefined) this.assertWritableRole(dto.role, scope);
    const targetRole = dto.role ?? user.role;
    const targetCourse = dto.courseId !== undefined ? await this.resolveStudentCourse(dto.courseId, scope) : null;
    if (dto.courseId !== undefined && targetRole !== "STUDENT") {
      throw new BadRequestException("Solo los estudiantes pueden tener curso asignado");
    }

    const firstName = dto.firstName?.trim();
    const lastName = dto.lastName?.trim();
    const email = dto.email?.trim().toLowerCase();
    const passwordHash = dto.temporaryPassword
      ? await bcrypt.hash(dto.temporaryPassword, this.config.bcryptRounds)
      : undefined;

    if (dto.temporaryPassword) {
      this.validatePasswordPolicy(dto.temporaryPassword);
    }

    if (email && email !== user.email) {
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== id) {
        throw new ConflictException("El correo electrÃ³nico ya estÃ¡ registrado");
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id },
        data: {
          ...(firstName !== undefined && { firstName }),
          ...(lastName !== undefined && { lastName }),
          ...(email !== undefined && { email }),
          ...(passwordHash !== undefined && { passwordHash, mustChangePassword: true }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.mustChangePassword !== undefined && { mustChangePassword: dto.mustChangePassword }),
          ...(dto.role !== undefined && { role: dto.role }),
        },
      });

      if (user.student && (firstName !== undefined || lastName !== undefined)) {
        await tx.student.update({
          where: { id: user.student.id },
          data: {
            ...(firstName !== undefined && { firstName }),
            ...(lastName !== undefined && { lastName }),
          },
        });
      }

      if (targetCourse) {
        const student = user.student ?? await tx.student.create({
          data: {
            userId: id,
            firstName: firstName ?? user.firstName,
            lastName: lastName ?? user.lastName,
          },
        });
        const activeEnrollment = user.student?.enrollments[0] ?? null;

        if (activeEnrollment?.courseId !== targetCourse.id) {
          await tx.enrollment.updateMany({
            where: { studentId: student.id, isActive: true },
            data: { isActive: false },
          });

          const existingEnrollment = await tx.enrollment.findUnique({
            where: { studentId_courseId: { studentId: student.id, courseId: targetCourse.id } },
          });

          if (existingEnrollment) {
            await tx.enrollment.update({
              where: { id: existingEnrollment.id },
              data: { isActive: true, enrolledAt: new Date() },
            });
          } else {
            await tx.enrollment.create({
              data: { studentId: student.id, courseId: targetCourse.id },
            });
          }
        }
      }

      return updatedUser;
    });

    this.logger.log(`Usuario actualizado: ${updated.email}`);
    await this.auditLog.log({
      actorId: actor?.sub ?? null,
      institutionId: updated.institutionId,
      action: "USER_UPDATED",
      entityType: "user",
      entityId: id,
      metadata: JSON.stringify(dto),
    });

    return this.findById(id, actor);
  }

  async softDelete(id: string, actor?: JwtPayload) {
    const scope = actor ? await resolveUserScope(this.prisma, actor) : null;
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("Usuario no encontrado");
    this.assertCanAccessUser(user.institutionId, scope);
    this.assertReadableRole(user.role, scope);

    await this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
        email: `${user.email}__deleted_${Date.now()}`,
      },
    });

    await this.auditLog.log({
      actorId: null, action: "USER_DELETED", entityType: "user", entityId: id,
      metadata: JSON.stringify({ email: user.email }),
    });
  }

  async permanentDelete(id: string, actor?: JwtPayload) {
    const scope = actor ? await resolveUserScope(this.prisma, actor) : null;
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { student: true, teacher: true },
    });
    if (!user) throw new NotFoundException("Usuario no encontrado");
    this.assertCanAccessUser(user.institutionId, scope);
    this.assertReadableRole(user.role, scope);

    const email = user.email;

    await this.prisma.$transaction(async (tx) => {
      if (user.student) {
        await tx.enrollment.deleteMany({ where: { studentId: user.student.id } });
        await tx.grade.deleteMany({ where: { studentId: user.student.id } });
        await tx.attendance.deleteMany({ where: { studentId: user.student.id } });
        await tx.assessmentAttempt.deleteMany({ where: { studentId: user.student.id } });
        await tx.remedialPlan.deleteMany({ where: { studentId: user.student.id } });
        await tx.observation.deleteMany({ where: { studentId: user.student.id } });
        await tx.simceStudentResponse.deleteMany({ where: { studentId: user.student.id } });
        await tx.student.delete({ where: { id: user.student.id } });
      }

      await tx.assessmentAttempt.deleteMany({ where: { userId: id } });
      await tx.resourceUsageLog.deleteMany({ where: { usedById: id } });
      await tx.gradeChangeRequest.deleteMany({
        where: { OR: [{ requestedBy: id }, { reviewedBy: id }] },
      });
      await tx.learningResource.deleteMany({ where: { createdBy: id } });
      await tx.simceAssessment.deleteMany({ where: { creatorId: id } });
      await tx.grade.deleteMany({ where: { recordedBy: id } });

      await tx.auditLog.updateMany({ where: { actorId: id }, data: { actorId: null } });
      await tx.importJob.updateMany({ where: { actorId: id }, data: { actorId: null } });

      await tx.user.delete({ where: { id } });
    });

    this.logger.log(`Usuario eliminado definitivamente: ${email}`);
  }

  async bulkPermanentDelete(ids: string[], actor?: JwtPayload) {
    const results: { id: string; ok: boolean; error?: string }[] = [];

    for (const id of ids) {
      try {
        await this.permanentDelete(id, actor);
        results.push({ id, ok: true });
      } catch (err) {
        this.logger.warn(`No se pudo eliminar usuario ${id}: ${err instanceof Error ? err.message : err}`);
        results.push({ id, ok: false, error: err instanceof Error ? err.message : "Error desconocido" });
      }
    }

    const succeeded = results.filter((r) => r.ok).length;
    this.logger.log(`Eliminacion masiva: ${succeeded}/${ids.length} usuarios eliminados`);
    return { total: ids.length, succeeded, failed: ids.length - succeeded, results };
  }

  private validatePasswordPolicy(password: string) {
    return validatePasswordPolicy(password);
  }

  private resolveReadableInstitutionId(institutionId?: string, scope?: { isGlobalAdmin: boolean; institutionId: string | null } | null) {
    if (!scope || scope.isGlobalAdmin) return institutionId;
    if (!scope.institutionId) throw new ForbiddenException("Usuario sin institucion asignada");
    if (institutionId && institutionId !== scope.institutionId) {
      throw new ForbiddenException("No tienes acceso a esta institucion");
    }
    return scope.institutionId;
  }

  private resolveWritableInstitutionId(institutionId?: string, scope?: { isGlobalAdmin: boolean; institutionId: string | null } | null) {
    if (!scope || scope.isGlobalAdmin) return institutionId ?? null;
    if (!scope.institutionId) throw new ForbiddenException("Usuario sin institucion asignada");
    if (institutionId && institutionId !== scope.institutionId) {
      throw new ForbiddenException("No tienes acceso a esta institucion");
    }
    return scope.institutionId;
  }

  private async resolveStudentCourse(
    courseId?: string,
    scope?: { isGlobalAdmin: boolean; institutionId: string | null } | null,
  ) {
    if (!courseId) throw new BadRequestException("El curso es obligatorio para crear un estudiante");

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, institutionId: true, isActive: true },
    });

    if (!course) throw new NotFoundException("Curso no encontrado");
    if (!course.isActive) throw new BadRequestException("No se puede matricular en un curso inactivo");
    if (!scope || scope.isGlobalAdmin) return course;
    if (!scope.institutionId || course.institutionId !== scope.institutionId) {
      throw new ForbiddenException("No tienes acceso a este curso");
    }
    return course;
  }

  private assertCanAccessUser(userInstitutionId: string | null, scope?: { isGlobalAdmin: boolean; institutionId: string | null } | null) {
    if (!scope || scope.isGlobalAdmin) return;
    if (!scope.institutionId || userInstitutionId !== scope.institutionId) {
      throw new ForbiddenException("No tienes acceso a este usuario");
    }
  }

  private assertWritableRole(role: UserRole, scope?: { isGlobalAdmin: boolean } | null) {
    if (!scope || scope.isGlobalAdmin) return;
    if (["SUPER_ADMIN", "ADMIN", "DIRECTION"].includes(role)) {
      throw new ForbiddenException("No puedes asignar este rol");
    }
  }

  private assertReadableRole(role: UserRole, scope?: { role?: UserRole; isGlobalAdmin: boolean } | null) {
    if (!scope || scope.isGlobalAdmin || scope.role !== "UTP") return;
    if (!["UTP", "TEACHER", "STUDENT"].includes(role)) {
      throw new ForbiddenException("No tienes acceso a usuarios con este rol");
    }
  }

  private defaultRoleScope(scope?: { role?: UserRole; isGlobalAdmin: boolean } | null) {
    if (!scope || scope.isGlobalAdmin || scope.role !== "UTP") return {};
    return { role: { in: ["UTP", "TEACHER", "STUDENT"] as UserRole[] } };
  }
}
