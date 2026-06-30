import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { StorageService } from "../../storage/storage.service.js";
import * as path from "node:path";
import * as fs from "node:fs";
import * as crypto from "node:crypto";
import type { JwtPayload } from "../../../common/decorators/current-user.decorator.js";
import {
  assertAssessmentScope,
  assertCourseScope,
  assertInstitutionScope,
  assertStudentScope,
  resolveUserScope,
} from "../../../common/authz/access-scope.js";

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly uploadRoot: string;
  private readonly filesDir: string;
  private readonly exportsDir: string;

  get documentsBucket() { return this.storage.documentsBucket; }

  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {
    this.uploadRoot = path.resolve("uploads");
    this.filesDir = path.join(this.uploadRoot, "files");
    this.exportsDir = path.join(this.uploadRoot, "exports");
    fs.mkdirSync(this.filesDir, { recursive: true });
  }

  async uploadFile(fileBuffer: Buffer, fileName: string, mimeType: string, entityType: string, entityId: string | null, userId: string) {
    const fileId = crypto.randomUUID();
    const ext = path.extname(fileName);
    const storageName = `${fileId}${ext}`;
    return this.uploadFileAtKey(fileBuffer, fileName, mimeType, entityType, entityId, userId, {
      fileId,
      storageName,
      bucket: this.storage.documentsBucket,
      objectKey: `files/${storageName}`,
    });
  }

  async uploadFileAtKey(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    entityType: string,
    entityId: string | null,
    userId: string,
    options: { fileId?: string; storageName: string; bucket: string; objectKey: string },
  ) {
    if (entityId) {
      await this.assertFileScope({ entityType, entityId, createdBy: null }, userId);
    }

    const fileId = options.fileId ?? crypto.randomUUID();
    const storagePath = await this.storage.put(options.bucket, options.objectKey, fileBuffer, mimeType);
    const storageProvider = this.storage.driver;

    this.logger.log(
      `Stored file asset driver=${storageProvider} bucket=${options.bucket} objectKey=${options.objectKey} size=${fileBuffer.length}`,
    );

    const asset = await this.prisma.fileAsset.create({
      data: {
        id: fileId,
        entityType,
        entityId,
        fileName: options.storageName,
        originalName: fileName,
        mimeType,
        size: fileBuffer.length,
        storagePath,
        storageProvider,
        bucket: storageProvider === "minio" ? options.bucket : null,
        objectKey: storageProvider === "minio" ? options.objectKey : null,
        url: `/api/v1/files/download/${options.storageName}`,
        createdBy: userId,
      },
    });

    return {
      fileId: asset.id,
      fileName,
      url: asset.url,
      size: asset.size,
      storageProvider: asset.storageProvider,
      bucket: asset.bucket,
      objectKey: asset.objectKey,
      storagePath: asset.storagePath,
    };
  }

  async getDownloadInfo(fileName: string, user?: JwtPayload | string) {
    const safeName = this.resolveSafeFileName(fileName);
    const asset = await this.prisma.fileAsset.findFirst({ where: { fileName: safeName } });

    if (asset) {
      if (user) await this.assertFileScope(asset, user);
      if (!(await this.storage.exists(asset.storagePath))) throw new NotFoundException("Archivo no encontrado");
      return {
        stream: await this.storage.get(asset.storagePath),
        mimeType: asset.mimeType,
        originalName: asset.originalName,
        size: asset.size,
      };
    }

    const exportStoragePath = this.storage.isMinio
      ? this.storage.uri(this.storage.tempBucket, `exports/${safeName}`)
      : path.join(this.exportsDir, safeName);
    if (user && !(await this.canDownloadGeneratedExport(exportStoragePath, user))) {
      throw new ForbiddenException("No tienes acceso a este archivo");
    }
    if (!(await this.storage.exists(exportStoragePath))) throw new NotFoundException("Archivo no encontrado");
    return {
      stream: await this.storage.get(exportStoragePath),
      mimeType: this.getMimeTypeForFile(safeName),
      originalName: safeName,
    };
  }
  private resolveSafeFileName(fileName: string) {
    const safeName = path.basename(fileName);
    if (
      !fileName ||
      fileName !== safeName ||
      path.isAbsolute(fileName) ||
      fileName.includes("/") ||
      fileName.includes("\\") ||
      safeName === "." ||
      safeName === ".."
    ) {
      throw new BadRequestException("Nombre de archivo invalido");
    }
    return safeName;
  }

  private isInsideAllowedUploadDir(filePath: string) {
    const resolvedPath = path.resolve(filePath);
    const allowedDirs = [this.filesDir, this.uploadRoot, this.exportsDir];
    return allowedDirs.some((dir) => this.isPathInsideDir(resolvedPath, dir));
  }

  private async canDownloadGeneratedExport(filePath: string, user: JwtPayload | string) {
    if (!filePath.startsWith("minio://") && !this.isPathInsideDir(filePath, this.exportsDir)) return false;

    const scope = await resolveUserScope(this.prisma, user);
    return ["SUPER_ADMIN", "ADMIN", "DIRECTION", "UTP", "TEACHER"].includes(scope.role);
  }

  private isPathInsideDir(filePath: string, dir: string) {
    const relative = path.relative(dir, path.resolve(filePath));
    return relative === "" || (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative));
  }

  private getMimeTypeForFile(fileName: string) {
    switch (path.extname(fileName).toLowerCase()) {
      case ".csv":
        return "text/csv; charset=utf-8";
      case ".json":
        return "application/json; charset=utf-8";
      case ".xlsx":
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      default:
        return "application/octet-stream";
    }
  }

  private async assertFileScope(
    asset: { entityType: string; entityId: string | null; createdBy: string | null },
    user: JwtPayload | string,
  ) {
    const scope = await resolveUserScope(this.prisma, user);
    if (asset.createdBy && asset.createdBy === scope.userId) return;
    if (scope.isSuperAdmin || scope.isGlobalAdmin) return;
    if (!asset.entityId) throw new ForbiddenException("No tienes acceso a este archivo");

    const entityType = asset.entityType.toLowerCase();
    if (["student", "students", "alumno", "alumnos"].includes(entityType)) {
      await assertStudentScope(this.prisma, user, asset.entityId);
      return;
    }
    if (["course", "courses", "curso", "cursos"].includes(entityType)) {
      await assertCourseScope(this.prisma, user, asset.entityId);
      return;
    }
    if (["assessment", "assessments", "evaluacion", "evaluaciones"].includes(entityType)) {
      await assertAssessmentScope(this.prisma, user, asset.entityId);
      return;
    }
    if (["assessment-template", "assessment_template", "assessmenttemplate"].includes(entityType)) {
      const template = await this.prisma.assessmentTemplate.findUnique({
        where: { id: asset.entityId },
        select: { institutionId: true, status: true },
      });
      if (!template) throw new NotFoundException("Plantilla de evaluacion no encontrada");
      if (template.status === "PUBLISHED" && (scope.isGlobalAdmin || !template.institutionId || template.institutionId === scope.institutionId)) {
        return;
      }
      await assertInstitutionScope(this.prisma, user, template.institutionId);
      if (!["SUPER_ADMIN", "ADMIN", "UTP"].includes(scope.role)) {
        throw new ForbiddenException("No tienes acceso a este archivo");
      }
      return;
    }
    if (["simce", "simce-assessment", "simce_assessment", "simceassessment"].includes(entityType)) {
      const assessment = await this.prisma.simceAssessment.findUnique({
        where: { id: asset.entityId },
        select: { courseId: true, subjectId: true },
      });
      if (!assessment) throw new NotFoundException("Prueba SIMCE no encontrada");
      await assertCourseScope(this.prisma, user, assessment.courseId, assessment.subjectId);
      return;
    }
    if (["lesson", "lessons", "clase", "clases"].includes(entityType)) {
      const lesson = await this.prisma.lesson.findUnique({
        where: { id: asset.entityId },
        select: { courseId: true, subjectId: true },
      });
      if (!lesson) throw new NotFoundException("Clase no encontrada");
      await assertCourseScope(this.prisma, user, lesson.courseId, lesson.subjectId);
      return;
    }
    if (["remedial-plan", "remedial_plan", "remedialplan", "remedial"].includes(entityType)) {
      const plan = await this.prisma.remedialPlan.findUnique({
        where: { id: asset.entityId },
        select: { studentId: true, courseId: true, subjectId: true },
      });
      if (!plan) throw new NotFoundException("Plan remedial no encontrado");
      await assertStudentScope(this.prisma, user, plan.studentId);
      await assertCourseScope(this.prisma, user, plan.courseId, plan.subjectId);
      return;
    }
    if (["resource", "learning-resource", "learning_resource", "learningresource"].includes(entityType)) {
      const resource = await this.prisma.learningResource.findUnique({
        where: { id: asset.entityId },
        select: { institutionId: true, courseId: true, assessmentId: true, status: true },
      });
      if (!resource) throw new NotFoundException("Recurso no encontrado");
      if (scope.role === "STUDENT" && !["PUBLISHED", "USED_IN_CLASS"].includes(resource.status)) {
        throw new ForbiddenException("No tienes acceso a este archivo");
      }
      if (resource.assessmentId) {
        await assertAssessmentScope(this.prisma, user, resource.assessmentId);
        return;
      }
      if (resource.courseId) {
        await assertCourseScope(this.prisma, user, resource.courseId);
        return;
      }
      await assertInstitutionScope(this.prisma, user, resource.institutionId);
      return;
    }

    throw new ForbiddenException("No tienes acceso a este archivo");
  }

  async listByEntity(entityType: string, entityId: string, user?: JwtPayload | string) {
    if (user) await this.assertFileScope({ entityType, entityId, createdBy: null }, user);

    return this.prisma.fileAsset.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: "desc" },
    });
  }

  async deleteFile(fileId: string, user?: JwtPayload | string) {
    const asset = await this.prisma.fileAsset.findUnique({ where: { id: fileId } });
    if (!asset) throw new NotFoundException("Archivo no encontrado");
    if (user) await this.assertFileScope(asset, user);

    await this.storage.remove(asset.storagePath).catch(() => undefined);

    return this.prisma.fileAsset.delete({ where: { id: fileId } });
  }

  getTemplatePath(templateType: string): string {
    const templates: Record<string, { name: string; csvContent: string }> = {
      students: {
        name: "plantilla_estudiantes.csv",
        csvContent: "Nombre,RUT,Curso,Correo\nJuan Perez,12345678-9,4° A,juan.perez@colegio.cl\n",
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
    fs.writeFileSync(filePath, "\uFEFF" + template.csvContent, "utf-8");

    return filePath;
  }
}
