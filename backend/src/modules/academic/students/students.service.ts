import { Injectable, NotFoundException, ConflictException, Inject } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { AppConfig } from "../../../config/config.module.js";
import type { CreateStudentDto, UpdateStudentDto } from "./dto/create-student.dto.js";

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject("APP_CONFIG") private readonly config: AppConfig,
  ) {}

  async create(dto: CreateStudentDto) {
    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
    if (!course) throw new NotFoundException("Curso no encontrado");

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

    if (dto.email && dto.temporaryPassword) {
      const existingEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existingEmail) throw new ConflictException("El correo ya está registrado");

      const passwordHash = await bcrypt.hash(dto.temporaryPassword, this.config.bcryptRounds);
      await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase().trim(),
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

    return this.findById(student.id);
  }

  async findAll(search?: string, courseId?: string, page = 1, limit = 20) {
    const where: Record<string, unknown> = { deletedAt: null };
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { rut: { contains: search } },
      ];
    }
    if (courseId) {
      where.enrollments = { some: { courseId, isActive: true } };
    }

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

  async findById(id: string) {
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

  async update(id: string, dto: UpdateStudentDto) {
    await this.findById(id);
    if (dto.rut) {
      const existing = await this.prisma.student.findFirst({ where: { rut: dto.rut, id: { not: id } } });
      if (existing) throw new ConflictException("El RUT ya está registrado");
    }
    return this.prisma.student.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName.trim() }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName.trim() }),
        ...(dto.rut !== undefined && { rut: dto.rut }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.birthDate !== undefined && { birthDate: new Date(dto.birthDate) }),
      },
    });
  }

  async getMyPortal(userId: string) {
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

    const grades = await this.prisma.grade.findMany({
      where: { studentId: student.id },
      include: {
        assessment: {
          select: {
            id: true,
            title: true,
            assessmentType: true,
            semester: true,
            startDate: true,
            subject: { select: { id: true, name: true } },
            period: { select: { id: true, name: true, status: true } },
          },
        },
      },
      orderBy: { assessment: { startDate: "desc" } },
    });

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
      assessment_type: g.assessment.assessmentType,
      semester: g.assessment.semester,
      applied_at: g.assessment.startDate.toISOString().slice(0, 10),
      grade: g.grade,
      grade_id: g.id,
      comments: g.comments,
    }));

    return {
      student: { id: student.id, name: `${student.firstName} ${student.lastName}` },
      overall: { avgGrade, avgPercent, level, totalGrades: allGrades.length, status: avgGrade >= 4.0 ? "Aprobado" : "En riesgo" },
      semesters: [...semesterMap.values()].sort((a, b) => a.semester - b.semester),
      alerts,
      grades: gradeRows,
    };
  }

  async softDelete(id: string) {
    await this.findById(id);
    return this.prisma.student.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
