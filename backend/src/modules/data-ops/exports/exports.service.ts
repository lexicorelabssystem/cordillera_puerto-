import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import * as ExcelJS from "exceljs";
import * as path from "node:path";
import * as fs from "node:fs";
import * as crypto from "node:crypto";

@Injectable()
export class ExportsService {
  private readonly exportDir: string;

  constructor(private readonly prisma: PrismaService) {
    this.exportDir = path.resolve("uploads", "exports");
    fs.mkdirSync(this.exportDir, { recursive: true });
  }

  // ══════════════════════════════════════════════════════
  //  EXPORT STUDENTS
  // ══════════════════════════════════════════════════════

  async exportStudents(courseId?: string, institutionId?: string, format = "xlsx", userId?: string) {
    const where: Record<string, unknown> = { deletedAt: null };
    if (courseId) {
      where.enrollments = { some: { courseId, isActive: true } };
    }
    if (institutionId) {
      if (!courseId) {
        where.enrollments = { some: { course: { institutionId } } };
      }
    }

    const students = await this.prisma.student.findMany({
      where,
      include: {
        user: { select: { email: true } },
        enrollments: {
          where: { isActive: true },
          include: { course: { select: { name: true, gradeLevel: true } } },
        },
      },
      orderBy: { lastName: "asc" },
    });

    const rows = students.map((s) => ({
      Nombre: s.firstName,
      Apellido: s.lastName,
      RUT: s.rut ?? "",
      Correo: s.user?.email ?? "",
      Curso: s.enrollments[0]?.course.name ?? "",
      Nivel: s.enrollments[0]?.course.gradeLevel ?? "",
    }));

    return this.generateFile(rows, format, `estudiantes`);
  }

  // ══════════════════════════════════════════════════════
  //  EXPORT GRADES
  // ══════════════════════════════════════════════════════

  async exportGrades(courseId?: string, subjectId?: string, format = "xlsx", userId?: string) {
    const where: Record<string, unknown> = {};
    if (courseId) where.assessment = { courseId };
    if (subjectId) where.assessment = { ...(where.assessment as object || {}), subjectId };

    const grades = await this.prisma.grade.findMany({
      where,
      include: {
        student: { select: { firstName: true, lastName: true } },
        assessment: {
          select: {
            title: true, assessmentType: true,
            subject: { select: { name: true } },
            course: { select: { name: true, gradeLevel: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    const rows = grades.map((g) => ({
      Estudiante: `${g.student.firstName} ${g.student.lastName}`,
      Curso: g.assessment.course.name,
      Asignatura: g.assessment.subject.name,
      Evaluacion: g.assessment.title,
      Tipo: g.assessment.assessmentType,
      Nota: g.grade,
      Puntaje: g.score ?? "",
      Porcentaje: g.percentage ? `${g.percentage}%` : "",
      Comentario: g.comments ?? "",
    }));

    return this.generateFile(rows, format, `notas`);
  }

  // ══════════════════════════════════════════════════════
  //  EXPORT QUESTIONS
  // ══════════════════════════════════════════════════════

  async exportQuestions(subjectId?: string, format = "xlsx", userId?: string) {
    const where: Record<string, unknown> = { isActive: true };
    if (subjectId) where.subjectId = subjectId;

    const questions = await this.prisma.question.findMany({
      where,
      include: {
        subject: { select: { name: true } },
        learningObjective: { select: { code: true, description: true } },
        axis: { select: { name: true } },
        skill: { select: { name: true } },
        options: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { updatedAt: "desc" },
      take: 2000,
    });

    const rows = questions.map((q) => ({
      Asignatura: q.subject?.name ?? "",
      Eje: q.axis?.name ?? "",
      OA: q.learningObjective?.code ?? "",
      Habilidad: q.skill?.name ?? "",
      Tipo: q.type,
      Enunciado: q.statement,
      Dificultad: q.difficulty,
      Puntaje: q.points,
      Opciones: q.options.map((o) => `${o.text}${o.isCorrect ? " [CORRECTA]" : ""}`).join(" | "),
    }));

    return this.generateFile(rows, format, `banco_preguntas`);
  }

  // ══════════════════════════════════════════════════════
  //  EXPORT COURSES
  // ══════════════════════════════════════════════════════

  async exportCourses(institutionId?: string, academicYearId?: string, format = "xlsx", userId?: string) {
    const where: Record<string, unknown> = { isActive: true };
    if (institutionId) where.institutionId = institutionId;
    if (academicYearId) where.academicYearId = academicYearId;

    const courses = await this.prisma.course.findMany({
      where,
      include: {
        academicYear: { select: { year: true } },
        _count: { select: { enrollments: true, assessments: true } },
      },
      orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
    });

    const rows = courses.map((c) => ({
      Curso: c.name,
      Nivel: c.gradeLevel,
      Año: c.academicYear.year,
      Alumnos: c._count.enrollments,
      Evaluaciones: c._count.assessments,
    }));

    return this.generateFile(rows, format, `cursos`);
  }

  // ══════════════════════════════════════════════════════
  //  FILE GENERATION
  // ══════════════════════════════════════════════════════

  private async generateFile(rows: Record<string, unknown>[], format: string, prefix: string) {
    const fileId = crypto.randomUUID();

    if (format === "csv") {
      return this.generateCsv(rows, `${prefix}_${fileId}.csv`);
    }

    if (format === "json") {
      const fileName = `${prefix}_${fileId}.json`;
      const filePath = path.join(this.exportDir, fileName);
      fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), "utf-8");
      return { fileName, format: "json", rowCount: rows.length, downloadUrl: `/api/v1/files/download/${fileName}` };
    }

    // Default: xlsx
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Datos");

    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      sheet.addRow(headers);

      for (const row of rows) {
        sheet.addRow(headers.map((h) => row[h] ?? ""));
      }

      // Style header
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
      });

      sheet.columns.forEach((col) => {
        col.width = Math.min(40, Math.max(12, (col.values as string[] | undefined)?.reduce((max, v) => Math.max(max, String(v ?? "").length), 10) ?? 12));
      });
    }

    const fileName = `${prefix}_${fileId}.xlsx`;
    const filePath = path.join(this.exportDir, fileName);
    await workbook.xlsx.writeFile(filePath);

    return { fileName, format: "xlsx", rowCount: rows.length, downloadUrl: `/api/v1/files/download/${fileName}` };
  }

  private generateCsv(rows: Record<string, unknown>[], fileName: string) {
    if (rows.length === 0) {
      const filePath = path.join(this.exportDir, fileName);
      fs.writeFileSync(filePath, "", "utf-8");
      return { fileName, format: "csv", rowCount: 0, downloadUrl: `/api/v1/files/download/${fileName}` };
    }

    const headers = Object.keys(rows[0]);
    const lines = [headers.join(",")];

    for (const row of rows) {
      const values = headers.map((h) => {
        const val = String(row[h] ?? "");
        return val.includes(",") || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
      });
      lines.push(values.join(","));
    }

    const filePath = path.join(this.exportDir, fileName);
    fs.writeFileSync(filePath, "\uFEFF" + lines.join("\n"), "utf-8"); // BOM for Excel UTF-8

    return { fileName, format: "csv", rowCount: rows.length, downloadUrl: `/api/v1/files/download/${fileName}` };
  }
}
