import {
  Injectable, NotFoundException, BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { AuditLogsService } from "../../audit-logs/audit-logs.service.js";

type GradeChangeStatus = "PENDING" | "APPROVED" | "REJECTED";

@Injectable()
export class GradeChangeRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogsService,
  ) {}

  async create(dto: { gradeId: string; newGrade: number; reason: string }, requesterId: string) {
    const grade = await this.prisma.grade.findUnique({
      where: { id: dto.gradeId },
      include: { assessment: { select: { status: true } } },
    });

    if (!grade) throw new NotFoundException("Registro de nota no encontrado");

    if (grade.assessment.status === "ACTIVE") {
      throw new BadRequestException("No se puede solicitar cambio mientras la evaluación está activa");
    }

    if (dto.newGrade === grade.grade) {
      throw new BadRequestException("La nueva nota es igual a la nota actual");
    }

    const existing = await this.prisma.gradeChangeRequest.findFirst({
      where: { gradeId: dto.gradeId, status: "PENDING" },
    });
    if (existing) {
      throw new BadRequestException("Ya existe una solicitud de cambio pendiente para esta nota");
    }

    const request = await this.prisma.gradeChangeRequest.create({
      data: {
        gradeId: dto.gradeId,
        requestedBy: requesterId,
        oldGrade: grade.grade,
        newGrade: dto.newGrade,
        reason: dto.reason,
        status: "PENDING",
      },
      include: {
        grade: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
            assessment: { select: { id: true, title: true, courseId: true } },
          },
        },
        requester: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return request;
  }

  async findAll(filters: { status?: GradeChangeStatus; studentId?: string; courseId?: string }) {
    const where: Record<string, unknown> = {};

    if (filters.status) where.status = filters.status;
    if (filters.studentId) where.grade = { studentId: filters.studentId };
    if (filters.courseId) where.grade = { ...((where.grade as Record<string, unknown>) || {}), assessment: { courseId: filters.courseId } };

    return this.prisma.gradeChangeRequest.findMany({
      where,
      include: {
        grade: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
            assessment: { select: { id: true, title: true, courseId: true, subjectId: true } },
          },
        },
        requester: { select: { id: true, firstName: true, lastName: true, email: true } },
        reviewer: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const request = await this.prisma.gradeChangeRequest.findUnique({
      where: { id },
      include: {
        grade: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
            assessment: {
              include: {
                course: { select: { id: true, name: true } },
                subject: { select: { id: true, name: true } },
              },
            },
          },
        },
        requester: { select: { id: true, firstName: true, lastName: true, email: true } },
        reviewer: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!request) throw new NotFoundException("Solicitud de cambio no encontrada");
    return request;
  }

  async approve(id: string, reviewerId: string, reviewNotes?: string) {
    const request = await this.prisma.gradeChangeRequest.findUnique({
      where: { id },
      include: { grade: true },
    });

    if (!request) throw new NotFoundException("Solicitud no encontrada");
    if (request.status !== "PENDING") {
      throw new BadRequestException(`La solicitud ya fue ${request.status === "APPROVED" ? "aprobada" : "rechazada"}`);
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.gradeChangeRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewedBy: reviewerId,
          reviewNotes: reviewNotes || null,
          reviewedAt: new Date(),
        },
      }),
      this.prisma.grade.update({
        where: { id: request.gradeId },
        data: { grade: request.newGrade, recordedBy: reviewerId },
      }),
    ]);

    await this.auditLog.log({
      actorId: reviewerId, action: "GRADE_CHANGE_APPROVED", entityType: "grade_change_request", entityId: id,
      metadata: JSON.stringify({ gradeId: request.gradeId, oldGrade: request.oldGrade, newGrade: request.newGrade }),
    });

    return updated;
  }

  async reject(id: string, reviewerId: string, reviewNotes?: string) {
    const request = await this.prisma.gradeChangeRequest.findUnique({
      where: { id },
    });

    if (!request) throw new NotFoundException("Solicitud no encontrada");
    if (request.status !== "PENDING") {
      throw new BadRequestException(`La solicitud ya fue ${request.status === "APPROVED" ? "aprobada" : "rechazada"}`);
    }

    const rejected = await this.prisma.gradeChangeRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedBy: reviewerId,
        reviewNotes: reviewNotes || null,
        reviewedAt: new Date(),
      },
    });

    await this.auditLog.log({
      actorId: reviewerId, action: "GRADE_CHANGE_REJECTED", entityType: "grade_change_request", entityId: id,
      metadata: JSON.stringify({ gradeId: request.gradeId, reason: reviewNotes }),
    });

    return rejected;
  }

  async findPendingByGrade(gradeId: string) {
    return this.prisma.gradeChangeRequest.findMany({
      where: { gradeId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
  }
}
