import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import * as ExcelJS from "exceljs";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import bcrypt from "bcryptjs";

interface ImportRow { rowNumber: number; data: Record<string, string>; errors: string[] }
interface ValidationResult { valid: boolean; rows: ImportRow[]; totalRows: number; validRows: number; errorRows: number }

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);
  private readonly uploadDir: string;

  constructor(private readonly prisma: PrismaService) {
    this.uploadDir = path.resolve("uploads", "imports");
    fs.mkdirSync(this.uploadDir, { recursive: true });
  }

  // ══════════════════════════════════════════════════════
  //  UPLOAD & PARSE
  // ══════════════════════════════════════════════════════

  async uploadFile(fileBuffer: Buffer, fileName: string, entityType: string, userId: string) {
    const fileId = crypto.randomUUID();
    const ext = path.extname(fileName).toLowerCase();

    if (![".xlsx", ".xls", ".csv"].includes(ext)) {
      throw new BadRequestException("Formato no soportado. Use .xlsx, .xls o .csv");
    }

    const filePath = path.join(this.uploadDir, `${fileId}${ext}`);
    fs.writeFileSync(filePath, fileBuffer);

    const job = await this.prisma.importJob.create({
      data: {
        entityType,
        fileName,
        fileSize: fileBuffer.length,
        status: "VALIDATING",
        actorId: userId,
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

    switch (job.entityType) {
      case "students":
        results.students = await this.validateStudents(job);
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
        errorDetails: allRows.filter((r) => r.errors.length > 0).map((r) => ({
          row: r.rowNumber,
          errors: r.errors,
        })),
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

    try {
      switch (job.entityType) {
        case "students":
          const studentResult = await this.executeStudentImport(job, skipErrors);
          success = studentResult.success; failed = studentResult.failed;
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
      data: { status: "COMPLETED", successRows: success, errorRows: failed, completedAt: new Date() },
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

  async listJobs(entityType?: string) {
    return this.prisma.importJob.findMany({
      where: entityType ? { entityType } : {},
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  // ══════════════════════════════════════════════════════
  //  VALIDATORS
  // ══════════════════════════════════════════════════════

  private async parseFile(fileName: string): Promise<Record<string, string>[]> {
    const ext = path.extname(fileName).toLowerCase();
    const possibleFiles = fs.readdirSync(this.uploadDir);
    const actualFile = possibleFiles.find((f) => f.startsWith(path.basename(fileName, ext)));
    if (!actualFile) throw new BadRequestException("Archivo no encontrado");

    const filePath = path.join(this.uploadDir, actualFile);
    const rows: Record<string, string>[] = [];

    if (ext === ".csv") {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n").filter((l) => l.trim());
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim());
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = values[idx] || ""; });
        if (Object.values(row).some((v) => v)) rows.push(row);
      }
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      const sheet = workbook.worksheets[0];
      const headers: string[] = [];
      sheet.getRow(1).eachCell((cell, colNum) => { headers[colNum] = String(cell.value ?? "").trim().toLowerCase(); });

      sheet.eachRow((row, rowNum) => {
        if (rowNum === 1) return;
        const data: Record<string, string> = {};
        row.eachCell((cell, colNum) => { data[headers[colNum]] = String(cell.value ?? "").trim(); });
        if (Object.values(data).some((v) => v)) rows.push(data);
      });
    }

    return rows;
  }

  private async validateStudents(job: { fileName: string }): Promise<{ data: ImportRow[]; errors: string[] }> {
    const rows = await this.parseFile(job.fileName);
    const result: ImportRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const data = rows[i];
      const errors: string[] = [];
      if (!data["nombre"] && !data["firstname"] && !data["firstName"]) errors.push("Falta nombre del estudiante");
      if (!data["curso"] && !data["course"] && !data["coursename"] && !data["courseName"]) errors.push("Falta curso");
      result.push({ rowNumber: i + 2, data, errors });
    }

    return { data: result, errors: [] };
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

  private async executeStudentImport(job: { fileName: string; actorId: string | null }, skipErrors: boolean): Promise<{ success: number; failed: number }> {
    const rows = await this.parseFile(job.fileName);
    let success = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const data = rows[i];
      try {
        let firstName = data["nombre"] || data["firstname"] || data["firstName"];
        let lastName = data["apellido"] || data["lastname"] || data["lastName"];
        const courseName = data["curso"] || data["course"] || data["coursename"] || data["courseName"];
        const rut = data["rut"] || "";
        const email = data["correo"] || data["email"] || "";

        if (!firstName && !lastName) {
          if (!skipErrors) throw new Error("Falta nombre del estudiante");
          failed++; continue;
        }

        if (firstName && !lastName && firstName.includes(" ")) {
          const parts = firstName.split(" ");
          firstName = parts[0];
          lastName = parts.slice(1).join(" ");
        }

        if (!lastName) lastName = "";

        if (!firstName || !courseName) {
          if (!skipErrors) throw new Error("Campos obligatorios faltantes");
          failed++; continue;
        }

        const course = await this.prisma.course.findFirst({
          where: { name: courseName },
        });

        if (!course) {
          if (!skipErrors) throw new Error(`Curso no encontrado: ${courseName}`);
          failed++; continue;
        }

        const student = await this.prisma.student.create({
          data: { firstName, lastName, rut: rut || null },
        });

        await this.prisma.enrollment.create({
          data: { studentId: student.id, courseId: course.id },
        });

        if (email) {
          const existingUser = await this.prisma.user.findUnique({ where: { email } });
          if (!existingUser) {
            const hash = await bcrypt.hash("Temp2026*", 10);
            const user = await this.prisma.user.create({
              data: {
                email, passwordHash: hash, firstName, lastName,
                role: "STUDENT", institutionId: course.institutionId, mustChangePassword: true,
              },
            });
            await this.prisma.student.update({ where: { id: student.id }, data: { userId: user.id } });
          }
        }

        success++;
      } catch (err) {
        if (!skipErrors) throw err;
        failed++;
      }
    }

    return { success, failed };
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
