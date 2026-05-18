import {
  Injectable, NotFoundException, ConflictException,
  BadRequestException, Inject,
} from "@nestjs/common";
import bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { AppConfig } from "../../../config/config.module.js";
import type { CreateTeacherDto, UpdateTeacherDto, AssignTeacherDto } from "./dto/create-teacher.dto.js";
import { isSubjectAllowedForGrade } from "../../../common/utils/curriculum.js";

@Injectable()
export class TeachersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject("APP_CONFIG") private readonly config: AppConfig,
  ) {}

  async create(dto: CreateTeacherDto) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException("El correo ya está registrado");

    const passwordHash = await bcrypt.hash(dto.temporaryPassword, this.config.bcryptRounds);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        role: "TEACHER",
        institutionId: dto.institutionId ?? null,
        mustChangePassword: true,
      },
    });

    await this.prisma.teacher.create({
      data: {
        userId: user.id,
        rut: dto.rut ?? null,
        title: dto.title ?? null,
      },
    });

    return this.findByIdByUserId(user.id);
  }

  async findAll(search?: string) {
    const where: Record<string, unknown> = {};
    if (search) {
      where.user = {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    return this.prisma.teacher.findMany({
      where,
      orderBy: { user: { lastName: "asc" } },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, isActive: true, role: true } },
        _count: { select: { courseAssignments: true, assessments: true } },
      },
    });
  }

  async findById(id: string) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, isActive: true, role: true } },
        courseAssignments: {
          include: {
            course: { select: { id: true, name: true, gradeLevel: true } },
            subject: { select: { id: true, name: true } },
          },
        },
        _count: { select: { assessments: true } },
      },
    });
    if (!teacher) throw new NotFoundException("Profesor no encontrado");
    return teacher;
  }

  private async findByIdByUserId(userId: string) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, isActive: true, role: true } },
      },
    });
    if (!teacher) throw new NotFoundException("Profesor no encontrado");
    return teacher;
  }

  async update(id: string, dto: UpdateTeacherDto) {
    const teacher = await this.findById(id);
    if (dto.firstName || dto.lastName) {
      await this.prisma.user.update({
        where: { id: teacher.userId! },
        data: {
          ...(dto.firstName && { firstName: dto.firstName.trim() }),
          ...(dto.lastName && { lastName: dto.lastName.trim() }),
        },
      });
    }
    return this.prisma.teacher.update({
      where: { id },
      data: {
        ...(dto.rut !== undefined && { rut: dto.rut }),
        ...(dto.title !== undefined && { title: dto.title }),
      },
    });
  }

  async getMyAssignments(userId: string) {
    const teacher = await this.prisma.teacher.findUnique({ where: { userId } });
    if (!teacher) throw new NotFoundException("Perfil de profesor no encontrado para este usuario");

    return this.prisma.teacherCourseAssignment.findMany({
      where: { teacherId: teacher.id },
      include: {
        course: {
          select: { id: true, name: true, gradeLevel: true, section: true },
        },
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ course: { gradeLevel: "asc" } }, { course: { name: "asc" } }],
    });
  }

  async getAssignments(teacherId: string) {
    await this.findById(teacherId);
    return this.prisma.teacherCourseAssignment.findMany({
      where: { teacherId },
      include: {
        course: { select: { id: true, name: true, gradeLevel: true } },
        subject: { select: { id: true, name: true } },
      },
      orderBy: [{ course: { gradeLevel: "asc" } }, { course: { name: "asc" } }],
    });
  }

  async assignToCourse(dto: AssignTeacherDto) {
    let teacherId = dto.teacherId;

    if (!teacherId && dto.userId) {
      const teacher = await this.prisma.teacher.findUnique({ where: { userId: dto.userId } });
      if (!teacher) throw new NotFoundException("Profesor no encontrado para el usuario indicado");
      teacherId = teacher.id;
    }

    if (!teacherId) {
      throw new BadRequestException("Debe proporcionar teacherId o userId");
    }

    const teacher = await this.prisma.teacher.findUnique({ where: { id: teacherId } });
    if (!teacher) throw new NotFoundException("Profesor no encontrado");

    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
    if (!course) throw new NotFoundException("Curso no encontrado");

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

    return this.prisma.teacherCourseAssignment.create({
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
  }

  async removeAssignment(assignmentId: string) {
    const assignment = await this.prisma.teacherCourseAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException("Asignación no encontrada");
    return this.prisma.teacherCourseAssignment.delete({ where: { id: assignmentId } });
  }
}
