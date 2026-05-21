import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
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

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogsService,
    @Inject("APP_CONFIG") private readonly config: AppConfig,
  ) {}

  async create(dto: CreateUserDto) {
    const email = dto.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException("El correo electrónico ya está registrado");
    }

    this.validatePasswordPolicy(dto.temporaryPassword);

    const passwordHash = await bcrypt.hash(dto.temporaryPassword, this.config.bcryptRounds);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        role: dto.role,
        institutionId: dto.institutionId ?? null,
        mustChangePassword: true,
      },
    });

    if (dto.role === "TEACHER") {
      await this.prisma.teacher.create({
        data: { userId: user.id },
      });
    }

    this.logger.log(`Usuario creado: ${email} (${dto.role})`);
    await this.auditLog.log({
      actorId: null, action: "USER_CREATED", entityType: "user", entityId: user.id,
      metadata: JSON.stringify({ email, role: dto.role }),
    });

    return this.findById(user.id);
  }

  async findAll(page = 1, limit = 20, role?: UserRole): Promise<PaginatedResult<unknown>> {
    const skip = (page - 1) * limit;
    const where = role ? { role, deletedAt: null } : { deletedAt: null };

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
          student: { select: { id: true } },
          teacher: { select: { id: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const users = data.map((u) => ({
      ...u,
      studentId: u.student?.id ?? null,
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

  async findById(id: string) {
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
        student: { select: { id: true } },
        teacher: { select: { id: true } },
      },
    });

    if (!user || user.isActive === false) {
      throw new NotFoundException("Usuario no encontrado");
    }

    return {
      ...user,
      studentId: user.student?.id ?? null,
      teacherId: user.teacher?.id ?? null,
      student: undefined,
      teacher: undefined,
    };
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("Usuario no encontrado");

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName.trim() }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName.trim() }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.mustChangePassword !== undefined && { mustChangePassword: dto.mustChangePassword }),
        ...(dto.role !== undefined && { role: dto.role }),
      },
    });

    this.logger.log(`Usuario actualizado: ${updated.email}`);
    await this.auditLog.log({
      actorId: null, action: "USER_UPDATED", entityType: "user", entityId: id,
      metadata: JSON.stringify(dto),
    });

    return this.findById(id);
  }

  async softDelete(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("Usuario no encontrado");

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

  private validatePasswordPolicy(password: string) {
    return validatePasswordPolicy(password);
  }
}
