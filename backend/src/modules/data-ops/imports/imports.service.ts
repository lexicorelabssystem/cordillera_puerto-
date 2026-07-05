import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from "@nestjs/common";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";
import { ImportsParserService } from "./imports-parser.service.js";
import { ImportsStudentService } from "./imports-student.service.js";
import { ImportsTeacherService } from "./imports-teacher.service.js";
import type {
  ImportRow,
  ImportMetadata,
  StudentImportRecord,
  TeacherImportRecord,
} from "./imports.types.js";

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);
  private readonly uploadDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: ImportsParserService,
    private readonly studentImporter: ImportsStudentService,
    private readonly teacherImporter: ImportsTeacherService,
  ) {
    this.uploadDir = path.resolve("uploads", "imports");
    fs.mkdirSync(this.uploadDir, { recursive: true });
  }

  // ══════════════════════════════════════════════════════
  //  UPLOAD
  // ══════════════════════════════════════════════════════

  async uploadFile(fileBuffer: Buffer, fileName: string, entityType: string, userId: string, institutionId?: string) {
    const fileId = crypto.randomUUID();
    const ext = path.extname(fileName).toLowerCase();
    const metadata: ImportMetadata = {};

    if (["students", "teachers"].includes(entityType)) {
      const actor = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, institutionId: true },
      });
      if (!actor) throw new BadRequestException("Usuario importador no encontrado");
      if (institutionId && actor.institutionId && actor.institutionId !== institutionId && !["SUPER_ADMIN", "ADMIN"].includes(actor.role)) {
        throw new BadRequestException("No tienes acceso a la institucion seleccionada");
      }
      metadata.institutionId = institutionId ?? actor.institutionId ?? undefined;
      if (!metadata.institutionId) {
        throw new BadRequestException(`Selecciona una institucion antes de importar ${entityType === "students" ? "alumnos" : "profesores"}`);
      }
    }

    if (![".xlsx", ".xls", ".csv"].includes(ext)) {
      throw new BadRequestException("Formato no soportado. Use .xlsx, .xls o .csv");
    }

    const storedFileName = `${fileId}${ext}`;
    fs.writeFileSync(path.join(this.uploadDir, storedFileName), fileBuffer);

    const job = await this.prisma.importJob.create({
      data: {
        entityType,
        fileName: storedFileName,
        fileSize: fileBuffer.length,
        status: "VALIDATING",
        actorId: userId,
        errorDetails: this.toMetadataJson(metadata),
      },
    });

    return { importJobId: job.id, fileName, fileSize: fileBuffer.length };
  }

  // ══════════════════════════════════════════════════════
  //  VALIDATE & PREVIEW
  // ══════════════════════════════════════════════════════

  async validateAndPreview(importJobId: string) {
    const job = await this.prisma.importJob.findUnique({ where: { id: importJobId } });
    if (!job) throw new NotFoundException("ImportJob no encontrado");

    const results: Record<string, { data: ImportRow[]; errors: string[] }> = {};
    const meta = this.readMetadata(job.errorDetails);

    try {
      switch (job.entityType) {
        case "students":
          results.students = await this.studentImporter.validateStudents(job, meta.institutionId);
          break;
        case "teachers":
          results.teachers = await this.teacherImporter.validateTeachers(job);
          break;
        case "questions":
          results.questions = await this.validateQuestions(job);
          break;
        case "grades":
          results.grades = await this.validateGrades(job);
          break;
        case "enrollments":
          results.enrollments = await this.validateEnrollments(job);
          break;
        default:
          throw new BadRequestException(`Tipo de entidad no soportado: ${job.entityType}`);
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`Error validando importacion ${importJobId}`, error instanceof Error ? error.stack : String(error));
      throw new BadRequestException(error instanceof Error ? error.message : "No se pudo validar el archivo de importacion");
    }

    const allRows = Object.values(results).flatMap((r) => r.data);
    const totalErrors = allRows.reduce((sum, r) => sum + r.errors.length, 0);

    await this.prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status: totalErrors === 0 ? "READY" : "PARTIAL",
        totalRows: allRows.length,
        errorRows: allRows.filter((r) => r.errors.length > 0).length,
        successRows: allRows.filter((r) => r.errors.length === 0).length,
        errorDetails: this.toMetadataJson({
          ...meta,
          validationErrors: allRows.filter((r) => r.errors.length > 0).map((r) => ({ row: r.rowNumber, errors: r.errors })),
        }),
      },
    });

    return {
      importJobId,
      entityType: job.entityType,
      status: totalErrors === 0 ? "READY" : "PARTIAL",
      preview: allRows.slice(0, 10).map((r) => ({
        rowNumber: r.rowNumber, data: r.data, valid: r.errors.length === 0, errors: r.errors,
      })),
      summary: {
        totalRows: allRows.length,
        validRows: allRows.filter((r) => r.errors.length === 0).length,
        errorRows: allRows.filter((r) => r.errors.length > 0).length,
        errors: allRows.filter((r) => r.errors.length > 0).slice(0, 20).map((r) => ({ row: r.rowNumber, errors: r.errors })),
      },
    };
  }

  // ══════════════════════════════════════════════════════
  //  EXECUTE
  // ══════════════════════════════════════════════════════

  async executeImport(importJobId: string, skipErrors: boolean) {
    const job = await this.prisma.importJob.findUnique({ where: { id: importJobId } });
    if (!job) throw new NotFoundException("ImportJob no encontrado");

    if (job.status !== "READY" && job.status !== "PARTIAL") {
      throw new BadRequestException(`El job no está listo para importar (status: ${job.status})`);
    }

    if (job.status === "PARTIAL" && !skipErrors) {
      throw new BadRequestException("Hay errores en los datos. Use skipErrors=true para importar solo las filas válidas.");
    }

    await this.prisma.importJob.update({ where: { id: importJobId }, data: { status: "IMPORTING" } });

    let success = 0;
    let failed = 0;
    let importedRecords: StudentImportRecord[] = [];
    let importedTeacherRecords: TeacherImportRecord[] = [];
    const meta = this.readMetadata(job.errorDetails);

    try {
      switch (job.entityType) {
        case "students": {
          const r = await this.studentImporter.executeImport(job, skipErrors, meta.institutionId);
          success = r.success; failed = r.failed; importedRecords = r.importedRecords;
          break;
        }
        case "teachers": {
          const r = await this.teacherImporter.executeImport(job, skipErrors, meta.institutionId);
          success = r.success; failed = r.failed; importedTeacherRecords = r.importedTeacherRecords;
          break;
        }
        case "questions": {
          const r = await this.executeQuestionImport(job, skipErrors);
          success = r.success; failed = r.failed;
          break;
        }
        case "grades": {
          const r = await this.executeGradeImport(job, skipErrors);
          success = r.success; failed = r.failed;
          break;
        }
        case "enrollments": {
          const r = await this.executeEnrollmentImport(job, skipErrors);
          success = r.success; failed = r.failed;
          break;
        }
        default:
          throw new BadRequestException(`Ejecución no implementada para: ${job.entityType}`);
      }
    } catch (error) {
      await this.prisma.importJob.update({ where: { id: importJobId }, data: { status: "FAILED" } });
      throw error;
    }

    await this.prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status: "COMPLETED",
        successRows: success,
        errorRows: failed,
        completedAt: new Date(),
        errorDetails: this.toMetadataJson({ ...meta, importedRecords, importedTeacherRecords, validationErrors: undefined }),
      },
    });

    return { importJobId, status: "COMPLETED", success, failed };
  }

  // ══════════════════════════════════════════════════════
  //  REVERT
  // ══════════════════════════════════════════════════════

  async revertImport(importJobId: string) {
    const job = await this.prisma.importJob.findUnique({ where: { id: importJobId } });
    if (!job) throw new NotFoundException("ImportJob no encontrado");
    if (job.status !== "COMPLETED") {
      throw new BadRequestException("Solo se pueden revertir importaciones completadas");
    }
    await this.prisma.importJob.update({ where: { id: importJobId }, data: { status: "FAILED" } });
    return { importJobId, reverted: true, message: "Importación marcada como revertida. Los registros creados requerirán limpieza manual." };
  }

  // ══════════════════════════════════════════════════════
  //  DELETE IMPORT DATA
  // ══════════════════════════════════════════════════════

  async deleteImportData(importJobId: string, actorId?: string) {
    const job = await this.prisma.importJob.findUnique({ where: { id: importJobId } });
    if (!job) throw new NotFoundException("ImportJob no encontrado");
    if (job.status !== "COMPLETED") {
      throw new BadRequestException("Solo se pueden eliminar datos de importaciones completadas");
    }

    const meta = this.readMetadata(job.errorDetails);

    if (["students", "teachers"].includes(job.entityType) && meta.institutionId && actorId) {
      const actor = await this.prisma.user.findUnique({ where: { id: actorId }, select: { role: true, institutionId: true } });
      if (!actor) throw new BadRequestException("Usuario no encontrado");
      if (actor.institutionId && actor.institutionId !== meta.institutionId && !["SUPER_ADMIN", "ADMIN"].includes(actor.role)) {
        throw new BadRequestException("No tienes acceso a esta importacion");
      }
    }

    const records = meta.importedRecords ?? [];
    const teacherRecords = meta.importedTeacherRecords ?? [];

    if (records.length === 0 && teacherRecords.length === 0) {
      throw new BadRequestException("Esta importacion no tiene trazabilidad de registros creados. Solo las importaciones nuevas pueden eliminarse automaticamente.");
    }

    if (job.entityType === "teachers") {
      return this.deleteTeacherData(importJobId, teacherRecords, meta);
    }

    return this.deleteStudentData(importJobId, records, meta);
  }

  private async deleteTeacherData(importJobId: string, teacherRecords: TeacherImportRecord[], meta: ImportMetadata) {
    const teacherIds = teacherRecords.map((r) => r.teacherId);
    const teacherUserIds = teacherRecords.map((r) => r.userId);

    await this.prisma.$transaction(async (tx) => {
      const assessments = await tx.assessment.findMany({ where: { teacherId: { in: teacherIds } }, select: { id: true } });
      const assessmentIds = assessments.map((a) => a.id);

      await tx.learningResource.deleteMany({
        where: { OR: [{ createdBy: { in: teacherUserIds } }, { assessmentId: { in: assessmentIds } }] },
      });
      await tx.assessmentAttempt.deleteMany({ where: { assessmentId: { in: assessmentIds } } });
      await tx.assessment.deleteMany({ where: { id: { in: assessmentIds } } });
      await tx.lesson.deleteMany({ where: { teacherId: { in: teacherIds } } });
      await tx.simceAssessment.deleteMany({
        where: { OR: [{ teacherId: { in: teacherIds } }, { creatorId: { in: teacherUserIds } }] },
      });
      await tx.assessmentAttempt.deleteMany({ where: { userId: { in: teacherUserIds } } });
      await tx.resourceUsageLog.deleteMany({ where: { usedById: { in: teacherUserIds } } });
      await tx.gradeChangeRequest.deleteMany({
        where: { OR: [{ requestedBy: { in: teacherUserIds } }, { reviewedBy: { in: teacherUserIds } }] },
      });
      await tx.grade.deleteMany({ where: { recordedBy: { in: teacherUserIds } } });
      await tx.attendance.deleteMany({ where: { recordedBy: { in: teacherUserIds } } });
      await tx.auditLog.updateMany({ where: { actorId: { in: teacherUserIds } }, data: { actorId: null } });
      await tx.importJob.updateMany({ where: { actorId: { in: teacherUserIds } }, data: { actorId: null } });
      await tx.user.deleteMany({ where: { id: { in: teacherUserIds } } });
      await tx.importJob.update({
        where: { id: importJobId },
        data: { status: "FAILED", successRows: 0, errorRows: teacherRecords.length, errorDetails: this.toMetadataJson({ ...meta, deletedAt: new Date().toISOString() }) },
      });
    });

    return { importJobId, deleted: true, studentsDeleted: 0, teachersDeleted: teacherIds.length, usersDeleted: teacherUserIds.length, enrollmentsDeleted: 0 };
  }

  private async deleteStudentData(importJobId: string, records: StudentImportRecord[], meta: ImportMetadata) {
    const studentIds = records.map((r) => r.studentId).filter(Boolean);
    const enrollmentIds = records.map((r) => r.enrollmentId).filter(Boolean);
    const userIds = records.map((r) => r.userId).filter((id): id is string => Boolean(id));

    await this.prisma.$transaction(async (tx) => {
      await tx.enrollment.deleteMany({ where: { id: { in: enrollmentIds } } });
      await tx.grade.deleteMany({ where: { studentId: { in: studentIds } } });
      await tx.attendance.deleteMany({ where: { studentId: { in: studentIds } } });
      await tx.assessmentAttempt.deleteMany({ where: { studentId: { in: studentIds } } });
      await tx.remedialPlan.deleteMany({ where: { studentId: { in: studentIds } } });
      await tx.observation.deleteMany({ where: { studentId: { in: studentIds } } });
      await tx.simceStudentResponse.deleteMany({ where: { studentId: { in: studentIds } } });
      await tx.student.deleteMany({ where: { id: { in: studentIds } } });

      if (userIds.length > 0) {
        await tx.assessmentAttempt.deleteMany({ where: { userId: { in: userIds } } });
        await tx.resourceUsageLog.deleteMany({ where: { usedById: { in: userIds } } });
        await tx.gradeChangeRequest.deleteMany({
          where: { OR: [{ requestedBy: { in: userIds } }, { reviewedBy: { in: userIds } }] },
        });
        await tx.learningResource.deleteMany({ where: { createdBy: { in: userIds } } });
        await tx.simceAssessment.deleteMany({ where: { creatorId: { in: userIds } } });
        await tx.grade.deleteMany({ where: { recordedBy: { in: userIds } } });
        await tx.auditLog.updateMany({ where: { actorId: { in: userIds } }, data: { actorId: null } });
        await tx.importJob.updateMany({ where: { actorId: { in: userIds } }, data: { actorId: null } });
        await tx.user.deleteMany({ where: { id: { in: userIds } } });
      }

      await tx.importJob.update({
        where: { id: importJobId },
        data: { status: "FAILED", successRows: 0, errorRows: records.length, errorDetails: this.toMetadataJson({ ...meta, deletedAt: new Date().toISOString() }) },
      });
    });

    return { importJobId, deleted: true, studentsDeleted: studentIds.length, teachersDeleted: 0, usersDeleted: userIds.length, enrollmentsDeleted: enrollmentIds.length };
  }

  // ══════════════════════════════════════════════════════
  //  LIST
  // ══════════════════════════════════════════════════════

  async listJobs(entityType?: string, actorId?: string, institutionId?: string) {
    let allowedInstitutionId = institutionId;

    if (["students", "teachers"].includes(entityType ?? "") && actorId) {
      const actor = await this.prisma.user.findUnique({ where: { id: actorId }, select: { role: true, institutionId: true } });
      if (!actor) throw new BadRequestException("Usuario no encontrado");
      if (actor.institutionId && institutionId && actor.institutionId !== institutionId && !["SUPER_ADMIN", "ADMIN"].includes(actor.role)) {
        throw new BadRequestException("No tienes acceso a la institucion seleccionada");
      }
      allowedInstitutionId = institutionId ?? actor.institutionId ?? undefined;
    }

    const jobs = await this.prisma.importJob.findMany({
      where: entityType ? { entityType } : {},
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return jobs
      .map((job) => {
        const m = this.readMetadata(job.errorDetails);
        return { job, meta: m };
      })
      .filter(({ meta }) => !["students", "teachers"].includes(entityType ?? "") || !allowedInstitutionId || meta.institutionId === allowedInstitutionId)
      .map(({ job, meta }) => ({
        ...job,
        trackedRecords: (meta.importedRecords?.length ?? 0) + (meta.importedTeacherRecords?.length ?? 0),
        deletedAt: meta.deletedAt ?? null,
      }));
  }

  // ══════════════════════════════════════════════════════
  //  METADATA HELPERS
  // ══════════════════════════════════════════════════════

  private readMetadata(value: unknown): ImportMetadata {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const m = value as ImportMetadata;
    return {
      importedRecords: Array.isArray(m.importedRecords) ? m.importedRecords : undefined,
      importedTeacherRecords: Array.isArray(m.importedTeacherRecords) ? m.importedTeacherRecords : undefined,
      institutionId: typeof m.institutionId === "string" ? m.institutionId : undefined,
      validationErrors: Array.isArray(m.validationErrors) ? m.validationErrors : undefined,
      deletedAt: typeof m.deletedAt === "string" ? m.deletedAt : undefined,
    };
  }

  private toMetadataJson(metadata: ImportMetadata): Prisma.InputJsonValue {
    return {
      ...(metadata.importedRecords ? { importedRecords: metadata.importedRecords.map((r) => ({ ...r })) } : {}),
      ...(metadata.importedTeacherRecords ? { importedTeacherRecords: metadata.importedTeacherRecords.map((r) => ({ ...r })) } : {}),
      ...(metadata.institutionId ? { institutionId: metadata.institutionId } : {}),
      ...(metadata.validationErrors ? { validationErrors: metadata.validationErrors.map((e) => ({ ...e })) } : {}),
      ...(metadata.deletedAt ? { deletedAt: metadata.deletedAt } : {}),
    };
  }

  // ══════════════════════════════════════════════════════
  //  QUESTIONS / GRADES / ENROLLMENTS (small importers)
  // ══════════════════════════════════════════════════════

  private async validateQuestions(job: { fileName: string }): Promise<{ data: ImportRow[]; errors: string[] }> {
    const rows = await this.parser.parseFile(job.fileName);
    const result: ImportRow[] = [];
    for (let i = 0; i < rows.length; i++) {
      const data = rows[i];
      const errors: string[] = [];
      if (!data["enunciado"] && !data["statement"]) errors.push("Falta enunciado");
      if (!data["asignatura"] && !data["subject"]) errors.push("Falta asignatura");
      result.push({ rowNumber: i + 2, data, errors });
    }
    return { data: result, errors: [] };
  }

  private async validateGrades(job: { fileName: string }): Promise<{ data: ImportRow[]; errors: string[] }> {
    const rows = await this.parser.parseFile(job.fileName);
    const result: ImportRow[] = [];
    for (let i = 0; i < rows.length; i++) {
      const data = rows[i];
      const errors: string[] = [];
      if (!data["estudiante"] && !data["student"]) errors.push("Falta estudiante");
      if (!data["nota"] && !data["grade"]) errors.push("Falta nota");
      else {
        const grade = Number(data["nota"] || data["grade"]);
        if (isNaN(grade) || grade < 0 || grade > 7) errors.push("Nota fuera de rango (0.0-7.0)");
      }
      result.push({ rowNumber: i + 2, data, errors });
    }
    return { data: result, errors: [] };
  }

  private async validateEnrollments(job: { fileName: string }): Promise<{ data: ImportRow[]; errors: string[] }> {
    const rows = await this.parser.parseFile(job.fileName);
    const result: ImportRow[] = [];
    for (let i = 0; i < rows.length; i++) {
      const data = rows[i];
      const errors: string[] = [];
      if (!data["estudiante"] && !data["studentid"]) errors.push("Falta identificador del estudiante");
      if (!data["curso"] && !data["courseid"]) errors.push("Falta identificador del curso");
      result.push({ rowNumber: i + 2, data, errors });
    }
    return { data: result, errors: [] };
  }

  private async executeQuestionImport(job: { fileName: string; actorId: string | null }, skipErrors: boolean): Promise<{ success: number; failed: number }> {
    const rows = await this.parser.parseFile(job.fileName);
    let success = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const data = rows[i];
      try {
        const statement = data["enunciado"] || data["statement"];
        const subjectName = data["asignatura"] || data["subject"];
        const type = (data["tipo"] || data["type"] || "MULTIPLE_CHOICE").toUpperCase();
        const difficulty = Number(data["dificultad"] || data["difficulty"] || 2);
        const points = Number(data["puntos"] || data["points"] || 1);
        const axisName = data["eje"] || data["axis"] || "";
        const correctAnswer = data["respuesta_correcta"] || data["correct"] || "1";

        if (!statement || !subjectName) {
          if (!skipErrors) throw new Error("Enunciado y asignatura son obligatorios");
          failed++; continue;
        }

        const subject = await this.prisma.subject.findFirst({ where: { name: { contains: subjectName, mode: "insensitive" } } });
        if (!subject) {
          if (!skipErrors) throw new Error(`Asignatura no encontrada: ${subjectName}`);
          failed++; continue;
        }

        let axisId: string | null = null;
        if (axisName) {
          const axis = await this.prisma.axis.findFirst({ where: { subjectId: subject.id, name: { contains: axisName, mode: "insensitive" } } });
          axisId = axis?.id ?? null;
        }

        const questionType = ["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER", "ESSAY", "MATCHING"].includes(type)
          ? type as "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER" | "ESSAY" | "MATCHING"
          : "MULTIPLE_CHOICE";

        const options: { text: string; isCorrect: boolean; sortOrder: number }[] = [];
        const optionLabels = ["A", "B", "C", "D", "E"];
        for (let o = 0; o < optionLabels.length; o++) {
          const optText = data[`opcion_${optionLabels[o].toLowerCase()}`] || data[`option_${optionLabels[o].toLowerCase()}`];
          if (optText) {
            const correctIdx = correctAnswer.toUpperCase().charCodeAt(0) - 65;
            options.push({ text: optText, isCorrect: o === correctIdx, sortOrder: o });
          }
        }

        await this.prisma.question.create({
          data: {
            subjectId: subject.id, axisId, type: questionType, statement, difficulty, points, createdBy: job.actorId,
            options: {
              create: options.length > 0 ? options : [
                { text: "Verdadero", isCorrect: true, sortOrder: 0 },
                { text: "Falso", isCorrect: false, sortOrder: 1 },
              ],
            },
          },
        });
        success++;
      } catch (err) {
        if (!skipErrors) throw err;
        failed++;
      }
    }
    return { success, failed };
  }

  private async executeGradeImport(job: { fileName: string; actorId: string | null }, skipErrors: boolean): Promise<{ success: number; failed: number }> {
    const rows = await this.parser.parseFile(job.fileName);
    let success = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const data = rows[i];
      try {
        const studentIdentifier = data["estudiante"] || data["student"] || data["rut"] || data["studentid"];
        const gradeValue = Number(data["nota"] || data["grade"]);
        const assessmentName = data["evaluacion"] || data["assessment"] || data["title"];
        const comments = data["comentario"] || data["comments"] || "";

        if (!studentIdentifier || isNaN(gradeValue) || !assessmentName) {
          if (!skipErrors) throw new Error("Estudiante, nota y evaluación son obligatorios");
          failed++; continue;
        }

        if (gradeValue < 0 || gradeValue > 7) {
          if (!skipErrors) throw new Error("Nota fuera de rango (0.0-7.0)");
          failed++; continue;
        }

        const student = await this.prisma.student.findFirst({
          where: { OR: [{ rut: studentIdentifier }, { firstName: { contains: studentIdentifier, mode: "insensitive" } }, { id: studentIdentifier }] },
        });
        if (!student) {
          if (!skipErrors) throw new Error(`Estudiante no encontrado: ${studentIdentifier}`);
          failed++; continue;
        }

        const assessment = await this.prisma.assessment.findFirst({ where: { title: { contains: assessmentName, mode: "insensitive" } } });
        if (!assessment) {
          if (!skipErrors) throw new Error(`Evaluación no encontrada: ${assessmentName}`);
          failed++; continue;
        }

        await this.prisma.grade.upsert({
          where: { assessmentId_studentId: { assessmentId: assessment.id, studentId: student.id } },
          create: { assessmentId: assessment.id, studentId: student.id, grade: gradeValue, comments: comments || null, recordedBy: job.actorId ?? "system" },
          update: { grade: gradeValue, comments: comments || null },
        });
        success++;
      } catch (err) {
        if (!skipErrors) throw err;
        failed++;
      }
    }
    return { success, failed };
  }

  private async executeEnrollmentImport(job: { fileName: string; actorId: string | null }, skipErrors: boolean): Promise<{ success: number; failed: number }> {
    const rows = await this.parser.parseFile(job.fileName);
    let success = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const data = rows[i];
      try {
        const studentIdentifier = data["estudiante"] || data["studentid"] || data["rut"];
        const courseIdentifier = data["curso"] || data["courseid"] || data["course"];

        if (!studentIdentifier || !courseIdentifier) {
          if (!skipErrors) throw new Error("Estudiante y curso son obligatorios");
          failed++; continue;
        }

        const student = await this.prisma.student.findFirst({
          where: { OR: [{ rut: studentIdentifier }, { firstName: { contains: studentIdentifier, mode: "insensitive" } }, { id: studentIdentifier }] },
        });
        if (!student) {
          if (!skipErrors) throw new Error(`Estudiante no encontrado: ${studentIdentifier}`);
          failed++; continue;
        }

        const course = await this.prisma.course.findFirst({
          where: { OR: [{ name: { contains: courseIdentifier, mode: "insensitive" } }, { id: courseIdentifier }] },
        });
        if (!course) {
          if (!skipErrors) throw new Error(`Curso no encontrado: ${courseIdentifier}`);
          failed++; continue;
        }

        const existing = await this.prisma.enrollment.findUnique({
          where: { studentId_courseId: { studentId: student.id, courseId: course.id } },
        });
        if (!existing) {
          await this.prisma.enrollment.create({ data: { studentId: student.id, courseId: course.id } });
        }
        success++;
      } catch (err) {
        if (!skipErrors) throw err;
        failed++;
      }
    }
    return { success, failed };
  }
}
