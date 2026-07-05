import { Injectable, BadRequestException } from "@nestjs/common";
import ExcelJS from "exceljs";
import * as fs from "node:fs";
import * as path from "node:path";

@Injectable()
export class ImportsParserService {
  readonly uploadDir: string;

  constructor() {
    this.uploadDir = path.resolve("uploads", "imports");
    fs.mkdirSync(this.uploadDir, { recursive: true });
  }

  async parseFile(fileName: string): Promise<Record<string, string>[]> {
    const ext = path.extname(fileName).toLowerCase();
    if (ext === ".xls") {
      throw new BadRequestException(
        "Los archivos .xls no son compatibles con este importador. Guarda la planilla como .xlsx o .csv.",
      );
    }

    const possibleFiles = fs.readdirSync(this.uploadDir);
    const actualFile = possibleFiles.includes(fileName)
      ? fileName
      : possibleFiles.find((f) => f.startsWith(path.basename(fileName, ext)));
    if (!actualFile) throw new BadRequestException("Archivo no encontrado");

    const filePath = path.join(this.uploadDir, actualFile);

    if (ext === ".csv") return this.parseCsv(filePath);
    return this.parseXlsx(filePath);
  }

  private parseCsv(filePath: string): Record<string, string>[] {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    if (lines.length === 0) return [];

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const hasHeader = this.hasImportHeader(headers);
    const rows: Record<string, string>[] = [];

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

    return rows;
  }

  private async parseXlsx(filePath: string): Promise<Record<string, string>[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException("El archivo Excel no contiene hojas para importar.");

    const headers: string[] = [];
    sheet.getRow(1).eachCell((cell, colNum) => {
      headers[colNum] = this.cellToString(cell.value).toLowerCase();
    });
    const hasHeader = this.hasImportHeader(headers);
    const rows: Record<string, string>[] = [];

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

    return rows;
  }

  cellToString(value: ExcelJS.CellValue): string {
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

  private hasImportHeader(headers: string[]): boolean {
    const known = [
      "nombre", "apellido", "rut", "run", "curso", "correo", "email", "mail",
      "firstname", "lastname", "course", "coursename", "student", "studentid",
      "estudiante", "asignatura", "subject", "enunciado", "statement", "nota", "grade",
      "evaluacion", "tipo", "fecha",
    ];
    return headers.some((h) => known.some((k) => h === k || h.includes(k)));
  }
}
