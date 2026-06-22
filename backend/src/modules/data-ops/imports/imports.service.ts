import {
  Injectable, NotFoundException, BadRequestException, Logger, Inject,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import ExcelJS from "exceljs";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import type { AppConfig } from "../../../config/config.module.js";

interface ImportRow { rowNumber: number; data: Record<string, string>; errors: string[] }
interface ValidationResult { valid: boolean; rows: ImportRow[]; totalRows: number; validRows: number; errorRows: number }
interface StudentImportRecord { studentId: string; enrollmentId: string; userId?: string }
interface TeacherImportRecord { teacherId: string; userId: string }
interface ImportMetadata {
  importedRecords?: StudentImportRecord[];
  importedTeacherRecords?: TeacherImportRecord[];
  institutionId?: string;
  validationErrors?: { row: number; errors: string[] }[];
  deletedAt?: string;
}

const IMPORTED_STUDENT_TEMP_PASSWORD = "Temp2026**";
const IMPORTED_TEACHER_TEMP_PASSWORD = "Temp2026**";

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);
  private readonly uploadDir: string;

  constructor(
    private readonly prisma: PrismaService,
    @Inject("APP_CONFIG") private readonly config: AppConfig,
  ) {
    this.uploadDir = path.resolve("uploads", "imports");
    fs.mkdirSync(this.uploadDir, { recursive: true });
  }

  // ══════════════════════════════════════════════════════
  //  UPLOAD & PARSE
  // ══════════════════════════════════════════════════════

  async uploadFile(fileBuffer: Buffer, fileName: string, entityType: string, userId: string, institutionId?: string) {
    const fileId = crypto.randomUUID();
    const ext = path.extname(fileName).toLowerCase();
    const metadata: ImportMetadata = {};

    if (entityType === "teachers") {
      const actor = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, institutionId: true },
      });
      if (!actor) throw new BadRequestException("Usuario importador no encontrado");
      if (institutionId && actor.institutionId && actor.institutionId !== institutionId && !["SUPER_ADMIN", "ADMIN"].includes(actor.role)) {
        throw new BadRequestException("No tienes acceso a la institucion seleccionada");
      }
      metadata.institutionId = institutionId ?? actor.institutionId ?? undefined;
      if (!metadata.institutionId) throw new BadRequestException("Selecciona una institucion antes de importar profesores");
    }

    if (![".xlsx", ".xls", ".csv"].includes(ext)) {
      throw new BadRequestException("Formato no soportado. Use .xlsx, .xls o .csv");
    }

    const storedFileName = `${fileId}${ext}`;
    const filePath = path.join(this.uploadDir, storedFileName);
    fs.writeFileSync(filePath, fileBuffer);

    const job = await this.prisma.importJob.create({
      data: {
        entityType,
        fileName: storedFileName,
        fileSize: fileBuffer.length,
        status: "VALIDATING",
        actorId: userId,
        errorDetails: this.toImportMetadataJson(metadata),
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

    try {
      switch (job.entityType) {
        case "students":
          results.students = await this.validateStudents(job);
          break;
        case "teachers":
          results.teachers = await this.validateTeachers(job);
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

    // Update job
    const allRows = Object.values(results).flatMap((r) => r.data);
    const totalErrors = allRows.reduce((sum, r) => sum + r.errors.length, 0);

    await this.prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status: totalErrors === 0 ? "READY" : "PARTIAL",
        totalRows: allRows.length,
        errorRows: allRows.filter((r) => r.errors.length > 0).length,
        successRows: allRows.filter((r) => r.errors.length === 0).length,
        errorDetails: this.toImportMetadataJson({
          ...this.readImportMetadata(job.errorDetails),
          validationErrors: allRows.filter((r) => r.errors.length > 0).map((r) => ({ row: r.rowNumber, errors: r.errors })),
        }),
      },
    });

    return {
      importJobId,
      entityType: job.entityType,
      status: totalErrors === 0 ? "READY" : "PARTIAL",
      preview: allRows.slice(0, 10).map((r) => ({
        rowNumber: r.rowNumber,
        data: r.data,
        valid: r.errors.length === 0,
        errors: r.errors,
      })),
      summary: {
        totalRows: allRows.length,
        validRows: allRows.filter((r) => r.errors.length === 0).length,
        errorRows: allRows.filter((r) => r.errors.length > 0).length,
        errors: allRows
          .filter((r) => r.errors.length > 0)
          .slice(0, 20)
          .map((r) => ({ row: r.rowNumber, errors: r.errors })),
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
    const metadata = this.readImportMetadata(job.errorDetails);

    try {
      switch (job.entityType) {
        case "students":
          const studentResult = await this.executeStudentImport(job, skipErrors);
          success = studentResult.success; failed = studentResult.failed; importedRecords = studentResult.importedRecords;
          break;
        case "teachers":
          const teacherResult = await this.executeTeacherImport(job, skipErrors, metadata.institutionId);
          success = teacherResult.success; failed = teacherResult.failed; importedTeacherRecords = teacherResult.importedTeacherRecords;
          break;
        case "questions":
          const questionResult = await this.executeQuestionImport(job, skipErrors);
          success = questionResult.success; failed = questionResult.failed;
          break;
        case "grades":
          const gradeResult = await this.executeGradeImport(job, skipErrors);
          success = gradeResult.success; failed = gradeResult.failed;
          break;
        case "enrollments":
          const enrollmentResult = await this.executeEnrollmentImport(job, skipErrors);
          success = enrollmentResult.success; failed = enrollmentResult.failed;
          break;
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
        errorDetails: this.toImportMetadataJson({ ...metadata, importedRecords, importedTeacherRecords, validationErrors: undefined }),
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

    // Soft revert — mark job as reverted
    await this.prisma.importJob.update({ where: { id: importJobId }, data: { status: "FAILED" } });

    return { importJobId, reverted: true, message: "Importación marcada como revertida. Los registros creados requerirán limpieza manual." };
  }

  // ══════════════════════════════════════════════════════
  //  LIST JOBS
  // ══════════════════════════════════════════════════════

  async deleteImportData(importJobId: string, actorId?: string) {
    const job = await this.prisma.importJob.findUnique({ where: { id: importJobId } });
    if (!job) throw new NotFoundException("ImportJob no encontrado");
    if (job.status !== "COMPLETED") {
      throw new BadRequestException("Solo se pueden eliminar datos de importaciones completadas");
    }

    const metadata = this.readImportMetadata(job.errorDetails);
    if (job.entityType === "teachers" && metadata.institutionId && actorId) {
      const actor = await this.prisma.user.findUnique({ where: { id: actorId }, select: { role: true, institutionId: true } });
      if (!actor) throw new BadRequestException("Usuario no encontrado");
      if (actor.institutionId && actor.institutionId !== metadata.institutionId && !["SUPER_ADMIN", "ADMIN"].includes(actor.role)) {
        throw new BadRequestException("No tienes acceso a esta importacion");
      }
    }
    const records = metadata.importedRecords ?? [];
    const teacherRecords = metadata.importedTeacherRecords ?? [];
    if (records.length === 0 && teacherRecords.length === 0) {
      throw new BadRequestException("Esta importacion no tiene trazabilidad de registros creados. Solo las importaciones nuevas pueden eliminarse automaticamente.");
    }

    if (job.entityType === "teachers") {
      const teacherIds = teacherRecords.map((record) => record.teacherId);
      const teacherUserIds = teacherRecords.map((record) => record.userId);
      await this.prisma.$transaction(async (tx) => {
        const assessments = await tx.assessment.findMany({
          where: { teacherId: { in: teacherIds } },
          select: { id: true },
        });
        const assessmentIds = assessments.map((assessment) => assessment.id);

        await tx.learningResource.deleteMany({
          where: {
            OR: [
              { createdBy: { in: teacherUserIds } },
              { assessmentId: { in: assessmentIds } },
            ],
          },
        });
        await tx.assessmentAttempt.deleteMany({ where: { assessmentId: { in: assessmentIds } } });
        await tx.assessment.deleteMany({ where: { id: { in: assessmentIds } } });
        await tx.lesson.deleteMany({ where: { teacherId: { in: teacherIds } } });
        await tx.simceAssessment.deleteMany({
          where: {
            OR: [
              { teacherId: { in: teacherIds } },
              { creatorId: { in: teacherUserIds } },
            ],
          },
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
          data: { status: "FAILED", successRows: 0, errorRows: teacherRecords.length, errorDetails: this.toImportMetadataJson({ ...metadata, deletedAt: new Date().toISOString() }) },
        });
      });
      return { importJobId, deleted: true, studentsDeleted: 0, teachersDeleted: teacherIds.length, usersDeleted: teacherUserIds.length, enrollmentsDeleted: 0 };
    }

    const studentIds = records.map((record) => record.studentId).filter(Boolean);
    const enrollmentIds = records.map((record) => record.enrollmentId).filter(Boolean);
    const userIds = records.map((record) => record.userId).filter((id): id is string => Boolean(id));

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
        data: {
          status: "FAILED",
          successRows: 0,
          errorRows: records.length,
          errorDetails: this.toImportMetadataJson({ ...metadata, deletedAt: new Date().toISOString() }),
        },
      });
    });

    return {
      importJobId,
      deleted: true,
      studentsDeleted: studentIds.length,
      teachersDeleted: 0,
      usersDeleted: userIds.length,
      enrollmentsDeleted: enrollmentIds.length,
    };
  }

  async listJobs(entityType?: string, actorId?: string, institutionId?: string) {
    let allowedInstitutionId = institutionId;
    if (entityType === "teachers" && actorId) {
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
    return jobs.map((job) => {
      const metadata = this.readImportMetadata(job.errorDetails);
      return { job, metadata };
    }).filter(({ metadata }) => entityType !== "teachers" || !allowedInstitutionId || metadata.institutionId === allowedInstitutionId)
      .map(({ job, metadata }) => ({
        ...job,
        trackedRecords: (metadata.importedRecords?.length ?? 0) + (metadata.importedTeacherRecords?.length ?? 0),
        deletedAt: metadata.deletedAt ?? null,
      }));
  }

  private readImportMetadata(value: unknown): ImportMetadata {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const metadata = value as ImportMetadata;
    return {
      importedRecords: Array.isArray(metadata.importedRecords) ? metadata.importedRecords : undefined,
      importedTeacherRecords: Array.isArray(metadata.importedTeacherRecords) ? metadata.importedTeacherRecords : undefined,
      institutionId: typeof metadata.institutionId === "string" ? metadata.institutionId : undefined,
      validationErrors: Array.isArray(metadata.validationErrors) ? metadata.validationErrors : undefined,
      deletedAt: typeof metadata.deletedAt === "string" ? metadata.deletedAt : undefined,
    };
  }

  private toImportMetadataJson(metadata: ImportMetadata): Prisma.InputJsonValue {
    return {
      ...(metadata.importedRecords ? { importedRecords: metadata.importedRecords.map((record) => ({ ...record })) } : {}),
      ...(metadata.importedTeacherRecords ? { importedTeacherRecords: metadata.importedTeacherRecords.map((record) => ({ ...record })) } : {}),
      ...(metadata.institutionId ? { institutionId: metadata.institutionId } : {}),
      ...(metadata.validationErrors ? { validationErrors: metadata.validationErrors.map((error) => ({ ...error })) } : {}),
      ...(metadata.deletedAt ? { deletedAt: metadata.deletedAt } : {}),
    };
  }

  // ══════════════════════════════════════════════════════
  //  VALIDATORS
  // ══════════════════════════════════════════════════════

  private async parseFile(fileName: string): Promise<Record<string, string>[]> {
    const ext = path.extname(fileName).toLowerCase();
    if (ext === ".xls") {
      throw new BadRequestException("Los archivos .xls no son compatibles con este importador. Guarda la planilla como .xlsx o .csv.");
    }

    const possibleFiles = fs.readdirSync(this.uploadDir);
    const actualFile = possibleFiles.includes(fileName)
      ? fileName
      : possibleFiles.find((f) => f.startsWith(path.basename(fileName, ext)));
    if (!actualFile) throw new BadRequestException("Archivo no encontrado");

    const filePath = path.join(this.uploadDir, actualFile);
    const rows: Record<string, string>[] = [];

    if (ext === ".csv") {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n").filter((l) => l.trim());
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const hasHeader = this.hasImportHeader(headers);
      for (let i = hasHeader ? 1 : 0; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim());
        const row: Record<string, string> = {};
        values.forEach((value, idx) => {
          const header = hasHeader ? headers[idx] : "";
          if (header) row[header] = value || "";
          row[`__col${idx + 1}`] = value || "";
        });
        if (Object.values(row).some((v) => v)) rows.push(row);
      }
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new BadRequestException("El archivo Excel no contiene hojas para importar.");
      const headers: string[] = [];
      sheet.getRow(1).eachCell((cell, colNum) => { headers[colNum] = this.cellToString(cell.value).toLowerCase(); });
      const hasHeader = this.hasImportHeader(headers);

      sheet.eachRow((row, rowNum) => {
        if (rowNum === 1 && hasHeader) return;
        const data: Record<string, string> = {};
        row.eachCell((cell, colNum) => {
          const value = this.cellToString(cell.value);
          if (hasHeader && headers[colNum]) data[headers[colNum]] = value;
          data[`__col${colNum}`] = value;
        });
        if (Object.values(data).some((v) => v)) rows.push(data);
      });
    }

    return rows;
  }

  private cellToString(value: ExcelJS.CellValue): string {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value !== "object") return String(value).trim();
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("result" in value) return this.cellToString(value.result as ExcelJS.CellValue);
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim();
    }
    if ("hyperlink" in value && "text" in value && typeof value.text === "string") return value.text.trim();
    return String(value).trim();
  }

  private hasImportHeader(headers: string[]) {
    const knownHeaders = [
      "nombre", "apellido", "rut", "run", "curso", "correo", "email", "mail",
      "firstname", "lastname", "course", "coursename", "student", "studentid",
      "estudiante", "asignatura", "subject", "enunciado", "statement", "nota", "grade",
      "evaluacion", "tipo", "fecha",
    ];
    return headers.some((header) => knownHeaders.some((known) => header === known || header.includes(known)));
  }

  private async validateStudents(job: { fileName: string }): Promise<{ data: ImportRow[]; errors: string[] }> {
    const rows = await this.parseFile(job.fileName);
    const result: ImportRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const data = rows[i];
      const errors: string[] = [];
      const courseName = this.getStudentCourseName(data);
      const rut = this.getStudentRut(data);
      const email = this.getStudentEmail(data).toLowerCase().trim();
      if (!this.getStudentFullName(data) && !this.getStudentFirstName(data)) errors.push("Falta nombre del estudiante");
      if (!rut) errors.push("Falta RUT");
      if (!courseName) {
        errors.push("Falta curso");
      } else {
        const courseMatch = await this.findCourseByName(courseName);
        if (!courseMatch.course) errors.push(courseMatch.error ?? `Curso no encontrado en la base de datos: ${courseName}`);
      }
      if (!email) {
        errors.push("Falta correo electronico");
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push(`Correo invalido: ${email}`);
      } else {
        const existingUser = await this.prisma.user.findUnique({ where: { email } });
        if (existingUser) errors.push(`Ya existe un usuario con el correo: ${email}`);
      }
      result.push({ rowNumber: i + 2, data, errors });
    }

    return { data: result, errors: [] };
  }

  private getStudentFullName(data: Record<string, string>) {
    return data["nombre completo"] || data["nombre_completo"] || data["nombre y apellido"] || data["nombres y apellidos"] || data["estudiante"] || data["alumno"] || data["fullname"] || data["fullName"] || data["nombre"] || data["__col1"] || "";
  }

  private getStudentFirstName(data: Record<string, string>) {
    return data["firstname"] || data["firstName"] || "";
  }

  private getStudentLastName(data: Record<string, string>) {
    return data["apellido"] || data["lastname"] || data["lastName"] || "";
  }

  private getStudentCourseName(data: Record<string, string>) {
    return data["curso"] || data["course"] || data["coursename"] || data["courseName"] || data["__col3"] || "";
  }

  private getStudentRut(data: Record<string, string>) {
    return data["rut"] || data["run"] || data["__col2"] || "";
  }

  private getStudentEmail(data: Record<string, string>) {
    return (data["correo"] || data["email"] || data["mail"] || data["correo electronico"] || data["correo electrónico"] || data["__col4"] || "").toLowerCase().trim();
  }

  private splitStudentName(fullName: string) {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return { firstName: parts[0] || "", lastName: "" };
    if (parts.length <= 3) return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
    return {
      firstName: parts.slice(0, 2).join(" "),
      lastName: parts.slice(2, 4).join(" "),
    };
  }

  private normalizeCourseLabel(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/º/g, "°")
      .toLowerCase()
      .replace(/\bbasica\b/g, "basico")
      .replace(/\bbasicos\b/g, "basico")
      .replace(/\bbasicas\b/g, "basico")
      .replace(/\bcurso\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private getCourseGradeLevel(courseName: string) {
    const normalized = this.normalizeCourseLabel(courseName);
    const direct = normalized.match(/^(\d{1,2})\s*°?/);
    if (direct) return Number(direct[1]);

    const words: Record<string, number> = {
      primero: 1,
      segundo: 2,
      tercero: 3,
      cuarto: 4,
      quinto: 5,
      sexto: 6,
      septimo: 7,
      octavo: 8,
    };
    return Object.entries(words).find(([word]) => normalized.includes(word))?.[1] ?? null;
  }

  private async findCourseByName(courseName: string) {
    const normalized = courseName.trim();
    const normalizedLabel = this.normalizeCourseLabel(courseName);
    const gradeLevel = this.getCourseGradeLevel(courseName);
    const courses = await this.prisma.course.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { equals: normalized, mode: "insensitive" } },
          { name: { contains: normalized, mode: "insensitive" } },
          ...(gradeLevel ? [{ gradeLevel }] : []),
        ],
      },
      orderBy: { name: "asc" },
    });

    const exact = courses.find((course) => {
      const courseLabel = this.normalizeCourseLabel(course.name);
      return courseLabel === normalizedLabel || courseLabel.includes(normalizedLabel) || normalizedLabel.includes(courseLabel);
    });
    if (exact) return { course: exact };

    const sameGrade = gradeLevel ? courses.filter((course) => course.gradeLevel === gradeLevel) : [];
    if (sameGrade.length === 1) return { course: sameGrade[0] };
    if (sameGrade.length > 1) {
      return {
        course: null,
        error: `Curso ambiguo: ${courseName}. Hay ${sameGrade.length} cursos activos para ${gradeLevel}°. Agrega la seccion/letra en la columna Curso.`,
      };
    }

    return { course: null, error: `Curso no encontrado en la base de datos: ${courseName}` };
  }

  private async validateTeachers(job: { fileName: string }): Promise<{ data: ImportRow[]; errors: string[] }> {
    const rows = await this.parseFile(job.fileName);
    const result: ImportRow[] = [];
    const seenEmails = new Set<string>();
    const seenRuts = new Set<string>();
    for (let i = 0; i < rows.length; i++) {
      const data = rows[i];
      const errors: string[] = [];
      const fullName = this.getTeacherFullName(data);
      const rut = this.normalizeRut(this.getTeacherRut(data));
      const title = this.getTeacherTitle(data);
      const email = this.getTeacherEmail(data);
      if (!fullName) errors.push("Falta nombre del profesor");
      if (!rut) errors.push("Falta RUT");
      else if (!this.isValidRut(rut)) errors.push(`RUT invalido: ${rut}`);
      else if (seenRuts.has(rut)) errors.push(`RUT duplicado en la planilla: ${rut}`);
      else {
        seenRuts.add(rut);
        if (await this.prisma.teacher.findFirst({ where: { rut } })) errors.push(`Ya existe un profesor con el RUT: ${rut}`);
      }
      if (!title) errors.push("Falta asignatura o especialidad");
      if (!email) errors.push("Falta correo electronico");
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push(`Correo invalido: ${email}`);
      else if (seenEmails.has(email)) errors.push(`Correo duplicado en la planilla: ${email}`);
      else {
        seenEmails.add(email);
        if (await this.prisma.user.findUnique({ where: { email } })) errors.push(`Ya existe un usuario con el correo: ${email}`);
      }
      result.push({ rowNumber: i + 2, data, errors });
    }
    return { data: result, errors: [] };
  }

  private getTeacherFullName(data: Record<string, string>) {
    return data["nombre"] || data["nombre completo"] || data["profesor"] || data["docente"] || data["__col1"] || "";
  }
  private getTeacherRut(data: Record<string, string>) { return data["rut"] || data["run"] || data["__col2"] || ""; }
  private getTeacherTitle(data: Record<string, string>) {
    return data["asignatura"] || data["especialidad"] || data["titulo"] || data["título"] || data["subject"] || data["__col3"] || "";
  }
  private getTeacherEmail(data: Record<string, string>) {
    return (data["correo"] || data["email"] || data["mail"] || data["correo electronico"] || data["correo electrónico"] || data["__col4"] || "").toLowerCase().trim();
  }
  private normalizeRut(value: string) {
    const clean = value.replace(/[^0-9kK]/g, "").toUpperCase();
    return clean.length > 1 ? `${clean.slice(0, -1)}-${clean.slice(-1)}` : clean;
  }
  private isValidRut(value: string) {
    const clean = value.replace(/[^0-9kK]/g, "").toUpperCase();
    if (clean.length < 2) return false;
    const body = clean.slice(0, -1);
    const verifier = clean.slice(-1);
    let sum = 0;
    let multiplier = 2;
    for (let i = body.length - 1; i >= 0; i--) {
      sum += Number(body[i]) * multiplier;
      multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }
    const result = 11 - (sum % 11);
    const expected = result === 11 ? "0" : result === 10 ? "K" : String(result);
    return verifier === expected;
  }
  private splitTeacherName(fullName: string) {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return { firstName: parts[0] || "", lastName: "" };
    if (parts.length === 2) return { firstName: parts[0], lastName: parts[1] };
    return { firstName: parts.slice(0, 2).join(" "), lastName: parts.slice(2).join(" ") };
  }

  private async validateQuestions(job: { fileName: string }): Promise<{ data: ImportRow[]; errors: string[] }> {
    const rows = await this.parseFile(job.fileName);
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
    const rows = await this.parseFile(job.fileName);
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
    const rows = await this.parseFile(job.fileName);
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

  // ══════════════════════════════════════════════════════
  //  EXECUTORS
  // ══════════════════════════════════════════════════════

  private async executeStudentImport(job: { fileName: string; actorId: string | null }, skipErrors: boolean): Promise<{ success: number; failed: number; importedRecords: StudentImportRecord[] }> {
    const rows = await this.parseFile(job.fileName);
    let success = 0;
    let failed = 0;
    const importedRecords: StudentImportRecord[] = [];

    for (let i = 0; i < rows.length; i++) {
      const data = rows[i];
      try {
        let firstName = this.getStudentFirstName(data);
        let lastName = this.getStudentLastName(data);
        const courseName = this.getStudentCourseName(data);
        const rut = this.getStudentRut(data);
        const email = this.getStudentEmail(data).toLowerCase().trim();

        if (!firstName && !lastName) {
          const splitName = this.splitStudentName(this.getStudentFullName(data));
          firstName = splitName.firstName;
          lastName = splitName.lastName;
        }

        if (!lastName) lastName = "";

        if (!firstName || !courseName) {
          if (!skipErrors) throw new Error("Campos obligatorios faltantes");
          failed++; continue;
        }

        const courseMatch = await this.findCourseByName(courseName);
        const course = courseMatch.course;

        if (!course) {
          if (!skipErrors) throw new Error(courseMatch.error ?? `Curso no encontrado: ${courseName}`);
          failed++; continue;
        }

        const record = await this.prisma.$transaction(async (tx) => {
          const student = await tx.student.create({
            data: { firstName, lastName, rut: rut || null },
          });
          const enrollment = await tx.enrollment.create({
            data: { studentId: student.id, courseId: course.id },
          });
          let userId: string | undefined;
          const existingUser = await tx.user.findUnique({ where: { email } });
          if (!existingUser) {
            const hash = await bcrypt.hash(IMPORTED_STUDENT_TEMP_PASSWORD, this.config.bcryptRounds);
            const user = await tx.user.create({
              data: {
                email, passwordHash: hash, firstName, lastName,
                role: "STUDENT", institutionId: course.institutionId, mustChangePassword: true,
              },
            });
            await tx.student.update({ where: { id: student.id }, data: { userId: user.id } });
            userId = user.id;
          }
          return { studentId: student.id, enrollmentId: enrollment.id, userId };
        });

        importedRecords.push(record);
        success++;
      } catch (err) {
        if (!skipErrors) throw err;
        failed++;
      }
    }

    return { success, failed, importedRecords };
  }

  private async executeTeacherImport(
    job: { fileName: string; actorId: string | null },
    skipErrors: boolean,
    institutionId?: string,
  ): Promise<{ success: number; failed: number; importedTeacherRecords: TeacherImportRecord[] }> {
    if (!institutionId) throw new BadRequestException("La importacion no tiene una institucion asociada");
    const rows = await this.parseFile(job.fileName);
    let success = 0;
    let failed = 0;
    const importedTeacherRecords: TeacherImportRecord[] = [];
    for (const data of rows) {
      try {
        const fullName = this.getTeacherFullName(data);
        const rut = this.normalizeRut(this.getTeacherRut(data));
        const title = this.getTeacherTitle(data).trim();
        const email = this.getTeacherEmail(data);
        const { firstName, lastName } = this.splitTeacherName(fullName);
        if (!firstName || !rut || !title || !email || !this.isValidRut(rut)) {
          if (!skipErrors) throw new Error("Campos obligatorios faltantes o invalidos");
          failed++; continue;
        }
        const record = await this.prisma.$transaction(async (tx) => {
          if (await tx.user.findUnique({ where: { email } })) throw new Error(`Ya existe un usuario con el correo: ${email}`);
          if (await tx.teacher.findFirst({ where: { rut } })) throw new Error(`Ya existe un profesor con el RUT: ${rut}`);
          const passwordHash = await bcrypt.hash(IMPORTED_TEACHER_TEMP_PASSWORD, this.config.bcryptRounds);
          const createdUser = await tx.user.create({
            data: { email, passwordHash, firstName, lastName, role: "TEACHER", institutionId, mustChangePassword: true },
          });
          const teacher = await tx.teacher.create({ data: { userId: createdUser.id, rut, title } });
          return { teacherId: teacher.id, userId: createdUser.id };
        });
        importedTeacherRecords.push(record);
        success++;
      } catch (error) {
        if (!skipErrors) throw error;
        failed++;
      }
    }
    return { success, failed, importedTeacherRecords };
  }

  private async executeQuestionImport(job: { fileName: string; actorId: string | null }, skipErrors: boolean): Promise<{ success: number; failed: number }> {
    const rows = await this.parseFile(job.fileName);
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

        const subject = await this.prisma.subject.findFirst({
          where: { name: { contains: subjectName, mode: "insensitive" } },
        });
        if (!subject) {
          if (!skipErrors) throw new Error(`Asignatura no encontrada: ${subjectName}`);
          failed++; continue;
        }

        let axisId: string | null = null;
        if (axisName) {
          const axis = await this.prisma.axis.findFirst({
            where: { subjectId: subject.id, name: { contains: axisName, mode: "insensitive" } },
          });
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
            subjectId: subject.id,
            axisId,
            type: questionType,
            statement,
            difficulty,
            points,
            createdBy: job.actorId,
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
    const rows = await this.parseFile(job.fileName);
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
          where: {
            OR: [
              { rut: studentIdentifier },
              { firstName: { contains: studentIdentifier, mode: "insensitive" } },
              { id: studentIdentifier },
            ],
          },
        });
        if (!student) {
          if (!skipErrors) throw new Error(`Estudiante no encontrado: ${studentIdentifier}`);
          failed++; continue;
        }

        const assessment = await this.prisma.assessment.findFirst({
          where: { title: { contains: assessmentName, mode: "insensitive" } },
        });
        if (!assessment) {
          if (!skipErrors) throw new Error(`Evaluación no encontrada: ${assessmentName}`);
          failed++; continue;
        }

        await this.prisma.grade.upsert({
          where: { assessmentId_studentId: { assessmentId: assessment.id, studentId: student.id } },
          create: {
            assessmentId: assessment.id,
            studentId: student.id,
            grade: gradeValue,
            comments: comments || null,
            recordedBy: job.actorId ?? "system",
          },
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
    const rows = await this.parseFile(job.fileName);
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
          where: {
            OR: [
              { rut: studentIdentifier },
              { firstName: { contains: studentIdentifier, mode: "insensitive" } },
              { id: studentIdentifier },
            ],
          },
        });
        if (!student) {
          if (!skipErrors) throw new Error(`Estudiante no encontrado: ${studentIdentifier}`);
          failed++; continue;
        }

        const course = await this.prisma.course.findFirst({
          where: {
            OR: [
              { name: { contains: courseIdentifier, mode: "insensitive" } },
              { id: courseIdentifier },
            ],
          },
        });
        if (!course) {
          if (!skipErrors) throw new Error(`Curso no encontrado: ${courseIdentifier}`);
          failed++; continue;
        }

        const existing = await this.prisma.enrollment.findUnique({
          where: { studentId_courseId: { studentId: student.id, courseId: course.id } },
        });

        if (!existing) {
          await this.prisma.enrollment.create({
            data: { studentId: student.id, courseId: course.id },
          });
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
