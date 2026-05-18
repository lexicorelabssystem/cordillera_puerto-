import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import * as path from "node:path";
import * as fs from "node:fs";
import * as crypto from "node:crypto";

@Injectable()
export class FilesService {
  private readonly filesDir: string;

  constructor(private readonly prisma: PrismaService) {
    this.filesDir = path.resolve("uploads", "files");
    fs.mkdirSync(this.filesDir, { recursive: true });
  }

  async uploadFile(fileBuffer: Buffer, fileName: string, mimeType: string, entityType: string, entityId: string | null, userId: string) {
    const fileId = crypto.randomUUID();
    const ext = path.extname(fileName);
    const storageName = `${fileId}${ext}`;
    const filePath = path.join(this.filesDir, storageName);

    fs.writeFileSync(filePath, fileBuffer);

    const asset = await this.prisma.fileAsset.create({
      data: {
        entityType,
        entityId,
        fileName: storageName,
        originalName: fileName,
        mimeType,
        size: fileBuffer.length,
        storagePath: filePath,
        url: `/api/v1/files/download/${storageName}`,
        createdBy: userId,
      },
    });

    return { fileId: asset.id, fileName, url: asset.url, size: asset.size };
  }

  async getDownloadInfo(fileName: string) {
    // Clean the filename for security
    const safeName = path.basename(fileName);
    const filePath = path.join(this.filesDir, safeName);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException("Archivo no encontrado");
    }

    const asset = await this.prisma.fileAsset.findFirst({
      where: { fileName: safeName },
    });

    return {
      filePath,
      mimeType: asset?.mimeType ?? "application/octet-stream",
      originalName: asset?.originalName ?? safeName,
      size: asset?.size ?? fs.statSync(filePath).size,
    };
  }

  async listByEntity(entityType: string, entityId: string) {
    return this.prisma.fileAsset.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: "desc" },
    });
  }

  async deleteFile(fileId: string) {
    const asset = await this.prisma.fileAsset.findUnique({ where: { id: fileId } });
    if (!asset) throw new NotFoundException("Archivo no encontrado");

    try {
      fs.unlinkSync(asset.storagePath);
    } catch { /* file may already be deleted */ }

    return this.prisma.fileAsset.delete({ where: { id: fileId } });
  }

  getTemplatePath(templateType: string): string {
    const templates: Record<string, { name: string; csvContent: string }> = {
      students: {
        name: "plantilla_estudiantes.csv",
        csvContent: "Nombre,Apellido,RUT,Correo,Curso\nJuan,Perez,12345678-9,juan.perez@colegio.cl,4° A\n",
      },
      questions: {
        name: "plantilla_preguntas.csv",
        csvContent: "Asignatura,Eje,OA,Enunciado,Tipo,Dificultad,Alternativa1,Correcta1,Alternativa2,Alternativa3\nLenguaje,Comprensión Lectora,OA1-LEN-4,¿Cuál es la idea principal del texto?,MULTIPLE_CHOICE,2,El personaje principal busca refugio,SI,Los animales viven en el bosque,El cuento tiene tres páginas\n",
      },
      grades: {
        name: "plantilla_notas.csv",
        csvContent: "Estudiante,Curso,Asignatura,Evaluacion,Tipo,Nota,Fecha\nJuan Perez,4° A,Lenguaje,Diagnóstico Inicial,DIAGNOSTICA,5.5,2026-04-01\n",
      },
      enrollments: {
        name: "plantilla_matriculas.csv",
        csvContent: "RUT_Estudiante,Nombre,Apellido,Curso\n12345678-9,Juan,Perez,4° A\n",
      },
    };

    const template = templates[templateType];
    if (!template) throw new NotFoundException(`Plantilla no encontrada: ${templateType}`);

    const filePath = path.join(this.filesDir, template.name);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, "\uFEFF" + template.csvContent, "utf-8");
    }

    return filePath;
  }
}
