import { Injectable, Inject } from "@nestjs/common";
import bcrypt from "bcrypt";
import type { AppConfig } from "../../../config/config.module.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { ImportsParserService } from "./imports-parser.service.js";
import type { ImportRow, ImportCourseMatch, StudentImportRecord } from "./imports.types.js";
import { getImportedStudentTempPassword } from "./imports.types.js";

@Injectable()
export class ImportsStudentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: ImportsParserService,
    @Inject("APP_CONFIG") private readonly config: AppConfig,
  ) {}

  // ══════════════════════════════════════════════════════
  //  VALIDATION
  // ══════════════════════════════════════════════════════

  async validateStudents(
    job: { fileName: string },
    institutionId?: string,
  ): Promise<{ data: ImportRow[]; errors: string[] }> {
    const rows = await this.parser.parseFile(job.fileName);
    const result: ImportRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const data = rows[i];
      const errors: string[] = [];
      const courseName = this.getCourseName(data);
      const rut = this.getRut(data);
      const email = this.getEmail(data).toLowerCase().trim();

      if (!this.getFullName(data) && !this.getFirstName(data))
        errors.push("Falta nombre del estudiante");
      if (!rut) errors.push("Falta RUT");
      if (!courseName) {
        errors.push("Falta curso");
      } else {
        const match = await this.findCourseByName(courseName, institutionId);
        if (!match.course && !match.pendingCourse) {
          errors.push(match.error ?? `Curso no encontrado en la base de datos: ${courseName}`);
        }
      }
      if (!email) {
        errors.push("Falta correo electronico");
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push(`Correo invalido: ${email}`);
      } else {
        const existing = await this.prisma.user.findUnique({ where: { email } });
        if (existing) errors.push(`Ya existe un usuario con el correo: ${email}`);
      }

      result.push({ rowNumber: i + 2, data, errors });
    }

    return { data: result, errors: [] };
  }

  // ══════════════════════════════════════════════════════
  //  EXECUTION
  // ══════════════════════════════════════════════════════

  async executeImport(
    job: { fileName: string; actorId: string | null },
    skipErrors: boolean,
    institutionId?: string,
  ): Promise<{ success: number; failed: number; importedRecords: StudentImportRecord[] }> {
    const rows = await this.parser.parseFile(job.fileName);
    let success = 0;
    let failed = 0;
    const importedRecords: StudentImportRecord[] = [];

    for (let i = 0; i < rows.length; i++) {
      const data = rows[i];
      try {
        let firstName = this.getFirstName(data);
        let lastName = this.getLastName(data);
        const courseName = this.getCourseName(data);
        const rut = this.getRut(data);
        const email = this.getEmail(data).toLowerCase().trim();

        if (!firstName && !lastName) {
          const split = this.splitName(this.getFullName(data));
          firstName = split.firstName;
          lastName = split.lastName;
        }
        if (!lastName) lastName = "";

        if (!firstName || !courseName) {
          if (!skipErrors) throw new Error("Campos obligatorios faltantes");
          failed++;
          continue;
        }

        const courseMatch = await this.findCourseByName(courseName, institutionId);
        let course = courseMatch.course;

        if (!course && courseMatch.pendingCourse) {
          const target = courseMatch.pendingCourse;
          course = await this.prisma.course.upsert({
            where: {
              academicYearId_name: {
                academicYearId: target.academicYearId,
                name: target.name,
              },
            },
            update: {},
            create: { ...target, section: null },
          });
        }

        if (!course) {
          if (!skipErrors)
            throw new Error(courseMatch.error ?? `Curso no encontrado: ${courseName}`);
          failed++;
          continue;
        }

        const record = await this.prisma.$transaction(async (tx) => {
          const student = await tx.student.create({
            data: { firstName, lastName, rut: rut || null },
          });
          const enrollment = await tx.enrollment.create({
            data: { studentId: student.id, courseId: course!.id },
          });
          let userId: string | undefined;
          const existingUser = await tx.user.findUnique({ where: { email } });
          if (!existingUser) {
            const hash = await bcrypt.hash(
              getImportedStudentTempPassword(this.config.isProduction),
              this.config.bcryptRounds,
            );
            const user = await tx.user.create({
              data: {
                email,
                passwordHash: hash,
                firstName,
                lastName,
                role: "STUDENT",
                institutionId: course!.institutionId,
                mustChangePassword: true,
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

  // ══════════════════════════════════════════════════════
  //  FIELD EXTRACTORS
  // ══════════════════════════════════════════════════════

  private getFullName(data: Record<string, string>): string {
    return (
      data["nombre completo"] ||
      data["nombre_completo"] ||
      data["nombre y apellido"] ||
      data["nombres y apellidos"] ||
      data["estudiante"] ||
      data["alumno"] ||
      data["fullname"] ||
      data["fullName"] ||
      data["nombre"] ||
      data["__col1"] ||
      ""
    );
  }

  private getFirstName(data: Record<string, string>): string {
    return data["firstname"] || data["firstName"] || "";
  }

  private getLastName(data: Record<string, string>): string {
    return data["apellido"] || data["lastname"] || data["lastName"] || "";
  }

  private getCourseName(data: Record<string, string>): string {
    return (
      data["curso"] ||
      data["course"] ||
      data["coursename"] ||
      data["courseName"] ||
      data["__col3"] ||
      ""
    );
  }

  private getRut(data: Record<string, string>): string {
    return data["rut"] || data["run"] || data["__col2"] || "";
  }

  private getEmail(data: Record<string, string>): string {
    return (
      data["correo"] ||
      data["email"] ||
      data["mail"] ||
      data["correo electronico"] ||
      data["correo electrónico"] ||
      data["__col4"] ||
      ""
    )
      .toLowerCase()
      .trim();
  }

  private splitName(fullName: string): { firstName: string; lastName: string } {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return { firstName: parts[0] || "", lastName: "" };
    if (parts.length <= 3) return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
    return { firstName: parts.slice(0, 2).join(" "), lastName: parts.slice(2, 4).join(" ") };
  }

  // ══════════════════════════════════════════════════════
  //  COURSE MATCHING
  // ══════════════════════════════════════════════════════

  async findCourseByName(courseName: string, institutionId?: string): Promise<ImportCourseMatch> {
    if (!institutionId) {
      return { course: null, error: "No se pudo determinar la institucion de la importacion" };
    }

    const normalized = courseName.trim();
    const normalizedLabel = this.normalizeCourseLabel(courseName);
    const gradeLevel = this.getCourseGradeLevel(courseName);

    if (!gradeLevel || gradeLevel < 1 || gradeLevel > 12) {
      return { course: null, error: `No se pudo reconocer el nivel del curso: ${courseName}` };
    }

    const academicYear = await this.prisma.academicYear.findFirst({
      where: { institutionId, isActive: true },
      select: { id: true },
      orderBy: { year: "desc" },
    });
    if (!academicYear) {
      return { course: null, error: "La institucion no tiene un año academico activo" };
    }

    const courses = await this.prisma.course.findMany({
      where: { institutionId, academicYearId: academicYear.id, isActive: true, gradeLevel },
      orderBy: { name: "asc" },
    });

    const requestedSection = this.getCourseSection(courseName);

    if (!requestedSection) {
      const unsectioned =
        courses.find(
          (c) => !c.section?.trim() && this.normalizeCourseLabel(c.name) === normalizedLabel,
        ) ?? courses.find((c) => !c.section?.trim());

      if (unsectioned) return { course: unsectioned };

      return {
        course: null,
        pendingCourse: {
          institutionId,
          academicYearId: academicYear.id,
          name: normalized,
          gradeLevel,
        },
      };
    }

    const sectioned =
      courses.find((c) => c.section?.trim().toUpperCase() === requestedSection) ??
      courses.find((c) => this.getCourseSection(c.name) === requestedSection);

    if (sectioned) return { course: sectioned };

    return { course: null, error: `Curso no encontrado: ${courseName}` };
  }

  private normalizeCourseLabel(value: string): string {
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

  private getCourseGradeLevel(courseName: string): number | null {
    const normalized = this.normalizeCourseLabel(courseName);
    const direct = normalized.match(/^(\d{1,2})\s*°?/);
    if (direct) {
      const level = Number(direct[1]);
      return /\bmedio\b/.test(normalized) && level <= 4 ? level + 8 : level;
    }
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
    return Object.entries(words).find(([w]) => normalized.includes(w))?.[1] ?? null;
  }

  private getCourseSection(courseName: string): string | null {
    const normalized = this.normalizeCourseLabel(courseName);
    const withoutLevel = normalized
      .replace(/^\d{1,2}\s*°?\s*/, "")
      .replace(/\b(basico|medio)\b/g, "")
      .trim();
    const section = withoutLevel.match(/^(?:seccion\s*)?([a-z])$/);
    return section?.[1]?.toUpperCase() ?? null;
  }
}
