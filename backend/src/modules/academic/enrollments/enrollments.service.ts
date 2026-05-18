import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { CreateEnrollmentDto, TransferEnrollmentDto } from "./dto/create-enrollment.dto.js";

@Injectable()
export class EnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEnrollmentDto) {
    const student = await this.prisma.student.findUnique({ where: { id: dto.studentId } });
    if (!student) throw new NotFoundException("Estudiante no encontrado");

    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
    if (!course) throw new NotFoundException("Curso no encontrado");

    const existing = await this.prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: dto.studentId, courseId: dto.courseId } },
    });
    if (existing) {
      if (existing.isActive) throw new ConflictException("El estudiante ya está matriculado en este curso");
      return this.prisma.enrollment.update({
        where: { id: existing.id },
        data: { isActive: true, enrolledAt: new Date() },
        include: { student: true, course: true },
      });
    }

    return this.prisma.enrollment.create({
      data: { studentId: dto.studentId, courseId: dto.courseId },
      include: { student: true, course: true },
    });
  }

  async findByStudent(studentId: string) {
    return this.prisma.enrollment.findMany({
      where: { studentId, isActive: true },
      include: { course: { select: { id: true, name: true, gradeLevel: true, academicYear: { select: { year: true } } } } },
      orderBy: { course: { gradeLevel: "asc" } },
    });
  }

  async findByCourse(courseId: string) {
    return this.prisma.enrollment.findMany({
      where: { courseId, isActive: true },
      include: { student: true },
      orderBy: { student: { lastName: "asc" } },
    });
  }

  async findById(id: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id },
      include: { student: true, course: true },
    });
    if (!enrollment) throw new NotFoundException("Matrícula no encontrada");
    return enrollment;
  }

  async withdraw(id: string) {
    const enrollment = await this.findById(id);
    if (!enrollment.isActive) throw new BadRequestException("La matrícula ya está retirada");

    return this.prisma.enrollment.update({
      where: { id },
      data: { isActive: false },
      include: { student: true, course: true },
    });
  }

  async transfer(id: string, dto: TransferEnrollmentDto) {
    const enrollment = await this.findById(id);

    const newCourse = await this.prisma.course.findUnique({ where: { id: dto.newCourseId } });
    if (!newCourse) throw new NotFoundException("Curso destino no encontrado");

    if (newCourse.id === enrollment.courseId) {
      throw new BadRequestException("El curso destino es igual al actual");
    }

    await this.prisma.enrollment.update({
      where: { id },
      data: { isActive: false },
    });

    return this.prisma.enrollment.create({
      data: { studentId: enrollment.studentId, courseId: dto.newCourseId },
      include: { student: true, course: { include: { academicYear: { select: { year: true } } } } },
    });
  }
}
