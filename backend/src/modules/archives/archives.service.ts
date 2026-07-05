import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { StorageService } from "../storage/storage.service.js";
import { normalizePagination } from "../../common/dto/pagination.dto.js";
import type { CreateArchiveDto } from "./dto/archive.dto.js";
import { resolveUserScope } from "../../common/authz/access-scope.js";

@Injectable()
export class ArchivesService {
  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {}

  async createRequest(dto: CreateArchiveDto, requestedById?: string) {
    if (requestedById) {
      const scope = await resolveUserScope(this.prisma, requestedById);
      if (!scope.isSuperAdmin) {
        if (!scope.institutionId) throw new ForbiddenException("Usuario sin institucion asignada");
        if (dto.institutionId && dto.institutionId !== scope.institutionId) throw new ForbiddenException("No tienes acceso a esta institucion");
        dto = { ...dto, institutionId: scope.institutionId };
      }
    }
    const cutoffDate = new Date(dto.cutoffDate);
    if (cutoffDate >= new Date()) throw new BadRequestException("La fecha de corte debe estar en el pasado");
    const retentionYears = dto.retentionYears ?? 7;
    const retentionUntil = new Date(cutoffDate);
    retentionUntil.setUTCFullYear(retentionUntil.getUTCFullYear() + retentionYears);
    const scopeKey = `${dto.institutionId ?? "global"}:${cutoffDate.toISOString().slice(0, 10)}:${dto.semester ?? "all"}`;
    return this.prisma.archiveRecord.upsert({
      where: { scopeKey },
      create: { scopeKey, institutionId: dto.institutionId, cutoffDate, semester: dto.semester, retentionUntil, requestedById },
      update: { retentionUntil, requestedById, errorMessage: null },
    });
  }

  async list(page = 1, limit = 20, institutionId?: string, userId?: string) {
    if (userId) {
      const scope = await resolveUserScope(this.prisma, userId);
      if (!scope.isSuperAdmin) institutionId = scope.institutionId ?? "00000000-0000-0000-0000-000000000000";
    }
    const pagination = normalizePagination(page, limit);
    const where = institutionId ? { institutionId } : {};
    const [data, total] = await Promise.all([
      this.prisma.archiveRecord.findMany({ where, skip: pagination.skip, take: pagination.limit, orderBy: { createdAt: "desc" } }),
      this.prisma.archiveRecord.count({ where }),
    ]);
    return { data, meta: { page: pagination.page, limit: pagination.limit, total, totalPages: Math.ceil(total / pagination.limit), hasNext: pagination.page * pagination.limit < total, hasPrevious: pagination.page > 1 } };
  }

  async archive(archiveRecordId: string) {
    const record = await this.prisma.archiveRecord.findUnique({ where: { id: archiveRecordId } });
    if (!record) throw new NotFoundException("Solicitud de archivo no encontrada");
    if (record.status === "ARCHIVED" && record.storagePath) return { archiveRecordId, status: record.status, recordCounts: record.recordCounts };
    await this.prisma.archiveRecord.update({ where: { id: record.id }, data: { status: "PROCESSING", errorMessage: null } });

    try {
      const courses = await this.prisma.course.findMany({
        where: record.institutionId ? { institutionId: record.institutionId } : {},
        select: { id: true },
      });
      const courseIds = courses.map((course) => course.id);
      const assessments = await this.prisma.assessment.findMany({
        where: {
          ...(record.institutionId ? { courseId: { in: courseIds } } : {}),
          ...(record.semester ? { semester: record.semester } : {}),
          status: { in: ["CLOSED", "GRADED", "REPORTED"] },
          OR: [{ endDate: { lte: record.cutoffDate } }, { endDate: null, startDate: { lte: record.cutoffDate } }],
        },
        include: { attempts: { include: { answers: true } } },
      });
      const assessmentIds = assessments.map((assessment) => assessment.id);
      const reports = await this.prisma.report.findMany({
        where: {
          createdAt: { lte: record.cutoffDate },
          ...(record.institutionId ? { OR: [{ courseId: { in: courseIds } }, { assessmentId: { in: assessmentIds } }] } : {}),
        },
      });
      const exports = await this.prisma.exportJob.findMany({
        where: {
          createdAt: { lte: record.cutoffDate },
          status: { in: ["COMPLETED", "FAILED"] },
          ...(record.institutionId ? { institutionId: record.institutionId } : {}),
        },
      });

      const snapshot = {
        schemaVersion: 1,
        archiveRecordId: record.id,
        createdAt: new Date().toISOString(),
        cutoffDate: record.cutoffDate.toISOString(),
        institutionId: record.institutionId,
        semester: record.semester,
        assessments,
        reports,
        exports,
      };
      const payload = Buffer.from(JSON.stringify(snapshot));
      const checksum = createHash("sha256").update(payload).digest("hex");
      const storagePath = await this.storage.put(this.storage.archivesBucket, `archives/${record.id}.json`, payload, "application/json");
      const attemptIds = assessments.flatMap((assessment) => assessment.attempts.map((attempt) => attempt.id));
      const reportIds = reports.map((report) => report.id);
      const exportIds = exports.map((item) => item.id);
      const recordCounts = {
        assessments: assessments.length,
        attempts: attemptIds.length,
        answers: assessments.reduce((sum, assessment) => sum + assessment.attempts.reduce((inner, attempt) => inner + attempt.answers.length, 0), 0),
        reports: reports.length,
        exports: exports.length,
      };

      await this.prisma.$transaction(async (tx) => {
        if (assessmentIds.length) await tx.studentAnswer.deleteMany({ where: { attempt: { assessmentId: { in: assessmentIds } } } });
        if (assessmentIds.length) await tx.assessmentAttempt.deleteMany({ where: { assessmentId: { in: assessmentIds } } });
        if (reportIds.length) await tx.report.deleteMany({ where: { id: { in: reportIds } } });
        if (exportIds.length) await tx.exportJob.deleteMany({ where: { id: { in: exportIds } } });
        if (assessmentIds.length) await tx.assessment.updateMany({ where: { id: { in: assessmentIds } }, data: { status: "ARCHIVED", isActive: false, archivedAt: new Date() } });
        await tx.archiveRecord.update({ where: { id: record.id }, data: { status: "ARCHIVED", storagePath, checksum, recordCounts, archivedAt: new Date(), restoredAt: null } });
      }, { maxWait: 10_000, timeout: 120_000 });
      return { archiveRecordId: record.id, status: "ARCHIVED", recordCounts };
    } catch (error) {
      await this.prisma.archiveRecord.update({ where: { id: record.id }, data: { status: "FAILED", errorMessage: (error as Error).message } });
      throw error;
    }
  }

  async restore(archiveRecordId: string) {
    const record = await this.prisma.archiveRecord.findUnique({ where: { id: archiveRecordId } });
    if (!record?.storagePath || !record.checksum) throw new NotFoundException("Snapshot de archivo no disponible");
    if (record.status !== "ARCHIVED") throw new BadRequestException("El archivo no esta disponible para restauracion");
    await this.prisma.archiveRecord.update({ where: { id: record.id }, data: { status: "RESTORING", errorMessage: null } });

    try {
      const payload = await this.storage.getBuffer(record.storagePath);
      const checksum = createHash("sha256").update(payload).digest("hex");
      if (checksum !== record.checksum) throw new BadRequestException("Checksum del snapshot invalido");
      const snapshot = JSON.parse(payload.toString("utf8")) as any;
      await this.prisma.$transaction(async (tx) => {
        for (const assessment of snapshot.assessments) {
          const attempts = assessment.attempts ?? [];
          delete assessment.attempts;
          await tx.assessment.update({ where: { id: assessment.id }, data: { status: assessment.status, isActive: assessment.isActive, archivedAt: assessment.archivedAt ? new Date(assessment.archivedAt) : null } });
          if (attempts.length) {
            await tx.assessmentAttempt.createMany({ data: attempts.map(({ answers, ...attempt }: any) => this.restoreDates(attempt, ["startedAt", "submittedAt"])) as any, skipDuplicates: true });
            const answers = attempts.flatMap((attempt: any) => (attempt.answers ?? []).map((answer: any) => this.restoreDates(answer, ["answeredAt"])));
            if (answers.length) await tx.studentAnswer.createMany({ data: answers as any, skipDuplicates: true });
          }
        }
        if (snapshot.reports?.length) await tx.report.createMany({ data: snapshot.reports.map((item: any) => this.restoreDates(item, ["generatedAt", "createdAt"])) as any, skipDuplicates: true });
        if (snapshot.exports?.length) await tx.exportJob.createMany({ data: snapshot.exports.map((item: any) => this.restoreDates(item, ["createdAt", "completedAt"])) as any, skipDuplicates: true });
        await tx.archiveRecord.update({ where: { id: record.id }, data: { status: "RESTORED", restoredAt: new Date() } });
      }, { maxWait: 10_000, timeout: 120_000 });
      return { archiveRecordId: record.id, status: "RESTORED", recordCounts: record.recordCounts };
    } catch (error) {
      await this.prisma.archiveRecord.update({ where: { id: record.id }, data: { status: "FAILED", errorMessage: (error as Error).message } });
      throw error;
    }
  }

  async assertAccess(id: string, userId: string) {
    const record = await this.getById(id);
    const scope = await resolveUserScope(this.prisma, userId);
    if (!scope.isSuperAdmin && record.institutionId !== scope.institutionId) throw new ForbiddenException("No tienes acceso a este archivo");
    return record;
  }

  async getById(id: string) {
    const record = await this.prisma.archiveRecord.findUnique({ where: { id } });
    if (!record) throw new NotFoundException("Archivo no encontrado");
    return record;
  }

  private restoreDates<T extends Record<string, any>>(value: T, fields: string[]): T {
    const copy: Record<string, any> = { ...value };
    for (const field of fields) if (copy[field]) copy[field] = new Date(copy[field]);
    return copy as T;
  }
}