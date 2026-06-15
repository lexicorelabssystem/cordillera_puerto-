import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
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
  private readonly filesDir: string;

  constructor(private readonly prisma: PrismaService) {
    this.filesDir = path.resolve("uploads", "files");
    fs.mkdirSync(this.filesDir, { recursive: true });
  }

  async uploadFile(fileBuffer: Buffer, fileName: string, mimeType: string, entityType: string, entityId: string | null, userId: string) {
    if (entityId) {
      await this.assertFileScope({ entityType, entityId, createdBy: null }, userId);
    }

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

  async getDownloadInfo(fileName: string, user?: JwtPayload | string) {
    // Clean the filename for security
    const safeName = path.basename(fileName);
    const filePath = path.join(this.filesDir, safeName);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException("Archivo no encontrado");
    }

    const asset = await this.prisma.fileAsset.findFirst({
      where: { fileName: safeName },
    });
    if (user) {
      if (!asset) {
        const scope = await resolveUserScope(this.prisma, user);
        if (!scope.isSuperAdmin && !scope.isGlobalAdmin) {
          throw new ForbiddenException("No tienes acceso a este archivo");
        }
      } else {
        await this.assertFileScope(asset, user);
      }
    }

    return {
      filePath,
      mimeType: asset?.mimeType ?? "application/octet-stream",
      originalName: asset?.originalName ?? safeName,
      size: asset?.size ?? fs.statSync(filePath).size,
    };
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
