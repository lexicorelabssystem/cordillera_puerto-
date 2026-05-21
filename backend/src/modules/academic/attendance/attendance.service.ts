import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { CreateAttendanceDto, BulkAttendanceDto, UpdateAttendanceDto } from "./dto/attendance.dto.js";

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAttendanceDto, recordedBy: string) {
    const [student, course] = await Promise.all([
      this.prisma.student.findUnique({ where: { id: dto.studentId } }),
      this.prisma.course.findUnique({ where: { id: dto.courseId } }),
    ]);
    if (!student) throw new NotFoundException("Estudiante no encontrado");
    if (!course) throw new NotFoundException("Curso no encontrado");

    const existing = await this.prisma.attendance.findUnique({
      where: {
        studentId_courseId_date: {
          studentId: dto.studentId,
          courseId: dto.courseId,
          date: new Date(dto.date),
        },
      },
    });
    if (existing) {
      return this.prisma.attendance.update({
        where: { id: existing.id },
        data: { status: dto.status ?? "PRESENT", recordedBy },
      });
    }

    return this.prisma.attendance.create({
      data: {
        studentId: dto.studentId,
        courseId: dto.courseId,
        date: new Date(dto.date),
        status: dto.status ?? "PRESENT",
        recordedBy,
      },
      include: { student: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async createBulk(dto: BulkAttendanceDto, recordedBy: string) {
    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
    if (!course) throw new NotFoundException("Curso no encontrado");

    const date = new Date(dto.date);
    const results = await Promise.allSettled(
      dto.items.map((item) =>
        this.prisma.attendance.upsert({
          where: {
            studentId_courseId_date: {
              studentId: item.studentId,
              courseId: dto.courseId,
              date,
            },
          },
          update: { status: item.status, recordedBy },
          create: {
            studentId: item.studentId,
            courseId: dto.courseId,
            date,
            status: item.status,
            recordedBy,
          },
        }),
      ),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;
    return { total: dto.items.length, succeeded, failed };
  }

  async findAll(filters: { courseId?: string; date?: string; from?: string; to?: string }) {
    const where: Record<string, unknown> = {};

    if (filters.courseId) {
      where.courseId = filters.courseId;
    }

    if (filters.date) {
      where.date = new Date(filters.date);
    } else if (filters.from && filters.to) {
      where.date = { gte: new Date(filters.from), lte: new Date(filters.to) };
    }

    return this.prisma.attendance.findMany({
      where,
      include: {
        student: { select: { id: true, firstName: true, lastName: true, rut: true } },
        course: { select: { id: true, name: true, gradeLevel: true } },
      },
      orderBy: [{ date: "desc" }, { student: { lastName: "asc" } }],
    });
  }

  async findByStudent(studentId: string, courseId?: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException("Estudiante no encontrado");

    const where: Record<string, unknown> = { studentId };
    if (courseId) where.courseId = courseId;

    return this.prisma.attendance.findMany({
      where,
      include: {
        course: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
    });
  }

  async getStudentStats(studentId: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException("Estudiante no encontrado");

    const [total, present, absent, late, justified, excused] = await Promise.all([
      this.prisma.attendance.count({ where: { studentId } }),
      this.prisma.attendance.count({ where: { studentId, status: "PRESENT" } }),
      this.prisma.attendance.count({ where: { studentId, status: "ABSENT" } }),
      this.prisma.attendance.count({ where: { studentId, status: "LATE" } }),
      this.prisma.attendance.count({ where: { studentId, status: "JUSTIFIED" } }),
      this.prisma.attendance.count({ where: { studentId, status: "EXCUSED" } }),
    ]);

    const attendanceRate = total > 0 ? Number((((present + late) / total) * 100).toFixed(1)) : 0;
    const absenceRate = total > 0 ? Number((((absent) / total) * 100).toFixed(1)) : 0;

    return {
      studentId,
      total,
      present,
      absent,
      late,
      justified,
      excused,
      attendanceRate,
      absenceRate,
      atRisk: absenceRate > 15,
    };
  }

  async update(id: string, dto: UpdateAttendanceDto) {
    const attendance = await this.prisma.attendance.findUnique({ where: { id } });
    if (!attendance) throw new NotFoundException("Registro de asistencia no encontrado");

    return this.prisma.attendance.update({
      where: { id },
      data: { status: dto.status },
      include: { student: { select: { id: true, firstName: true, lastName: true } } },
    });
  }
}
