import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import * as ExcelJS from "exceljs";
import * as path from "node:path";
import * as fs from "node:fs";
import * as crypto from "node:crypto";
import {
  assertCourseScope,
  assertInstitutionScope,
  resolveUserScope,
  type UserScope,
} from "../../../common/authz/access-scope.js";

@Injectable()
export class ExportsService {
  private readonly exportDir: string;

  constructor(private readonly prisma: PrismaService) {
    this.exportDir = path.resolve("uploads", "exports");
    fs.mkdirSync(this.exportDir, { recursive: true });
  }

  async exportStudents(courseId?: string, institutionId?: string, format = "xlsx", userId?: string) {
    const scope = userId ? await this.resolveExportScope(userId) : null;
    const where: Record<string, unknown> = { deletedAt: null };

    if (courseId) {
      if (userId) await assertCourseScope(this.prisma, userId, courseId);
      where.enrollments = { some: { courseId, isActive: true } };
    } else if (scope?.role === "TEACHER") {
      const courseIds = this.assignedCourseIds(scope);
      if (!courseIds.length) return this.generateFile([], format, "estudiantes");
      where.enrollments = { some: { courseId: { in: courseIds }, isActive: true } };
    } else {
      const scopedInstitutionId = userId
        ? await this.resolveInstitutionFilter(userId, scope, institutionId)
        : institutionId;
      if (scopedInstitutionId) {
        where.enrollments = { some: { course: { institutionId: scopedInstitutionId }, isActive: true } };
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

    return this.generateFile(rows, format, "estudiantes");
  }

  async exportGrades(courseId?: string, subjectId?: string, format = "xlsx", userId?: string) {
    const scope = userId ? await this.resolveExportScope(userId) : null;
    const where: Record<string, unknown> = {};
    const assessmentWhere: Record<string, unknown> = {};

    if (courseId) {
      if (userId) await assertCourseScope(this.prisma, userId, courseId, subjectId);
      assessmentWhere.courseId = courseId;
    } else if (scope?.role === "TEACHER") {
      const assignments = subjectId
        ? scope.assignments.filter((assignment) => assignment.subjectId === subjectId)
        : scope.assignments;
      const courseIds = [...new Set(assignments.map((assignment) => assignment.courseId))];
      if (!courseIds.length) return this.generateFile([], format, "notas");
      assessmentWhere.courseId = { in: courseIds };
    } else if (scope && !scope.isGlobalAdmin) {
      if (!scope.institutionId) throw new ForbiddenException("Usuario sin institucion asignada");
      assessmentWhere.course = { institutionId: scope.institutionId };
    }

    if (subjectId) assessmentWhere.subjectId = subjectId;
    if (Object.keys(assessmentWhere).length > 0) where.assessment = assessmentWhere;

    const grades = await this.prisma.grade.findMany({
      where,
      include: {
        student: { select: { firstName: true, lastName: true } },
        assessment: {
          select: {
            title: true,
            assessmentType: true,
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

    return this.generateFile(rows, format, "notas");
  }

  async exportQuestions(subjectId?: string, format = "xlsx", userId?: string) {
    const scope = userId ? await this.resolveExportScope(userId) : null;
    const where: Record<string, unknown> = { isActive: true };

    if (scope?.role === "TEACHER") {
      const subjectIds = this.assignedSubjectIds(scope);
      if (subjectId && !subjectIds.includes(subjectId)) {
        throw new ForbiddenException("No tienes asignada esta asignatura");
      }
      if (!subjectId) {
        if (!subjectIds.length) return this.generateFile([], format, "banco_preguntas");
        where.subjectId = { in: subjectIds };
      }
    }

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

    return this.generateFile(rows, format, "banco_preguntas");
  }

  async exportCourses(institutionId?: string, academicYearId?: string, format = "xlsx", userId?: string) {
    const scope = userId ? await this.resolveExportScope(userId) : null;
    const where: Record<string, unknown> = { isActive: true };

    if (scope?.role === "TEACHER") {
      const courseIds = this.assignedCourseIds(scope);
      if (!courseIds.length) return this.generateFile([], format, "cursos");
      where.id = { in: courseIds };
    } else {
      const scopedInstitutionId = userId
        ? await this.resolveInstitutionFilter(userId, scope, institutionId)
        : institutionId;
      if (scopedInstitutionId) where.institutionId = scopedInstitutionId;
    }

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
      Ano: c.academicYear.year,
      Alumnos: c._count.enrollments,
      Evaluaciones: c._count.assessments,
    }));

    return this.generateFile(rows, format, "cursos");
  }

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

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Datos");

    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      sheet.addRow(headers);

      for (const row of rows) {
        sheet.addRow(headers.map((h) => row[h] ?? ""));
      }

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
    fs.writeFileSync(filePath, "\uFEFF" + lines.join("\n"), "utf-8");

    return { fileName, format: "csv", rowCount: rows.length, downloadUrl: `/api/v1/files/download/${fileName}` };
  }

  private async resolveExportScope(userId: string) {
    const scope = await resolveUserScope(this.prisma, userId);
    if (!["SUPER_ADMIN", "ADMIN", "DIRECTION", "UTP", "TEACHER"].includes(scope.role)) {
      throw new ForbiddenException("No tienes permisos para exportar datos");
    }
    return scope;
  }

  private async resolveInstitutionFilter(userId: string, scope: UserScope | null, requestedInstitutionId?: string) {
    if (!scope) return requestedInstitutionId;

    if (requestedInstitutionId) {
      await assertInstitutionScope(this.prisma, userId, requestedInstitutionId);
      return requestedInstitutionId;
    }

    if (scope.isGlobalAdmin) return undefined;
    if (!scope.institutionId) throw new ForbiddenException("Usuario sin institucion asignada");
    return scope.institutionId;
  }

  private assignedCourseIds(scope: UserScope) {
    return [...new Set(scope.assignments.map((assignment) => assignment.courseId))];
  }

  private assignedSubjectIds(scope: UserScope) {
    return [...new Set(scope.assignments.map((assignment) => assignment.subjectId))];
  }
}
