import { Injectable, Inject, BadRequestException } from "@nestjs/common";
import bcrypt from "bcrypt";
import type { AppConfig } from "../../../config/config.module.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { ImportsParserService } from "./imports-parser.service.js";
import type { ImportRow, TeacherImportRecord } from "./imports.types.js";
import { getImportedTeacherTempPassword } from "./imports.types.js";

@Injectable()
export class ImportsTeacherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: ImportsParserService,
    @Inject("APP_CONFIG") private readonly config: AppConfig,
  ) {}

  // ══════════════════════════════════════════════════════
  //  VALIDATION
  // ══════════════════════════════════════════════════════

  async validateTeachers(job: {
    fileName: string;
  }): Promise<{ data: ImportRow[]; errors: string[] }> {
    const rows = await this.parser.parseFile(job.fileName);
    const result: ImportRow[] = [];
    const seenEmails = new Set<string>();
    const seenRuts = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const data = rows[i];
      const errors: string[] = [];
      const fullName = this.getFullName(data);
      const rut = this.normalizeRut(this.getRut(data));
      const title = this.getTitle(data);
      const email = this.getEmail(data);

      if (!fullName) errors.push("Falta nombre del profesor");
      if (!rut) errors.push("Falta RUT");
      else if (!this.isValidRut(rut)) errors.push(`RUT invalido: ${rut}`);
      else if (seenRuts.has(rut)) errors.push(`RUT duplicado en la planilla: ${rut}`);
      else {
        seenRuts.add(rut);
        if (await this.prisma.teacher.findFirst({ where: { rut } })) {
          errors.push(`Ya existe un profesor con el RUT: ${rut}`);
        }
      }
      if (!title) errors.push("Falta asignatura o especialidad");
      if (!email) errors.push("Falta correo electronico");
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push(`Correo invalido: ${email}`);
      else if (seenEmails.has(email)) errors.push(`Correo duplicado en la planilla: ${email}`);
      else {
        seenEmails.add(email);
        if (await this.prisma.user.findUnique({ where: { email } })) {
          errors.push(`Ya existe un usuario con el correo: ${email}`);
        }
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
  ): Promise<{ success: number; failed: number; importedTeacherRecords: TeacherImportRecord[] }> {
    if (!institutionId)
      throw new BadRequestException("La importacion no tiene una institucion asociada");

    const rows = await this.parser.parseFile(job.fileName);
    let success = 0;
    let failed = 0;
    const importedTeacherRecords: TeacherImportRecord[] = [];

    for (const data of rows) {
      try {
        const fullName = this.getFullName(data);
        const rut = this.normalizeRut(this.getRut(data));
        const title = this.getTitle(data).trim();
        const email = this.getEmail(data);
        const { firstName, lastName } = this.splitName(fullName);

        if (!firstName || !rut || !title || !email || !this.isValidRut(rut)) {
          if (!skipErrors) throw new Error("Campos obligatorios faltantes o invalidos");
          failed++;
          continue;
        }

        const record = await this.prisma.$transaction(async (tx) => {
          if (await tx.user.findUnique({ where: { email } })) {
            throw new Error(`Ya existe un usuario con el correo: ${email}`);
          }
          if (await tx.teacher.findFirst({ where: { rut } })) {
            throw new Error(`Ya existe un profesor con el RUT: ${rut}`);
          }
          const passwordHash = await bcrypt.hash(
            getImportedTeacherTempPassword(this.config.isProduction),
            this.config.bcryptRounds,
          );
          const createdUser = await tx.user.create({
            data: {
              email,
              passwordHash,
              firstName,
              lastName,
              role: "TEACHER",
              institutionId,
              mustChangePassword: true,
            },
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

  // ══════════════════════════════════════════════════════
  //  FIELD EXTRACTORS
  // ══════════════════════════════════════════════════════

  private getFullName(data: Record<string, string>): string {
    return (
      data["nombre"] ||
      data["nombre completo"] ||
      data["profesor"] ||
      data["docente"] ||
      data["__col1"] ||
      ""
    );
  }

  private getRut(data: Record<string, string>): string {
    return data["rut"] || data["run"] || data["__col2"] || "";
  }

  private getTitle(data: Record<string, string>): string {
    return (
      data["asignatura"] ||
      data["especialidad"] ||
      data["titulo"] ||
      data["título"] ||
      data["subject"] ||
      data["__col3"] ||
      ""
    );
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
    if (parts.length === 2) return { firstName: parts[0], lastName: parts[1] };
    return { firstName: parts.slice(0, 2).join(" "), lastName: parts.slice(2).join(" ") };
  }

  // ══════════════════════════════════════════════════════
  //  RUT VALIDATION
  // ══════════════════════════════════════════════════════

  normalizeRut(value: string): string {
    const clean = value.replace(/[^0-9kK]/g, "").toUpperCase();
    return clean.length > 1 ? `${clean.slice(0, -1)}-${clean.slice(-1)}` : clean;
  }

  isValidRut(value: string): boolean {
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
}
