import { PrismaClient } from "@prisma/client";

export async function seed(
  prisma: PrismaClient,
  institutionId: string,
  academicYearId: string,
  subjects: Record<string, string>,
  courses: Record<string, { id: string; gradeLevel: number }>,
  axes: Record<string, string>,
  teacherIds: Record<string, string>,
  adminUserId: string,
): Promise<void> {
  console.log("\n─── RESOURCES & LESSONS ────────────────────");

  if (Object.keys(teacherIds).length === 0) {
    console.log("  [✓] Resources & Lessons: skipped (no teachers)");
    return;
  }

  const oaLen1 = await prisma.learningObjective.findUnique({ where: { code: "OA1-LEN-4" } });
  if (oaLen1) {
    const guide = await prisma.learningResource.create({
      data: {
        institutionId,
        title: "Guía Remedial: Comprensión de Textos Narrativos",
        description: "Guía de ejercicios para reforzar la comprensión lectora de textos narrativos en 4° básico",
        type: "GUIDE",
        status: "PUBLISHED",
        subjectId: subjects["Lenguaje"]!,
        courseId: courses["4° A"]!.id,
        gradeLevel: 4,
        axisId: axes["Lenguaje|Comprensión Lectora"],
        learningObjectiveId: oaLen1.id,
        createdBy: adminUserId,
      },
    });
    await prisma.guide.create({
      data: {
        resourceId: guide.id,
        guideType: "REMEDIAL",
        instructions: "Lee cada texto y responde las preguntas. Marca solo una alternativa.",
        isPrintable: true,
      },
    });
  }

  const oaMat1 = await prisma.learningObjective.findUnique({ where: { code: "OA1-MAT-4" } });
  if (oaMat1) {
    const worksheet = await prisma.learningResource.create({
      data: {
        institutionId,
        title: "Guía de Ejercicios: Adición y Sustracción",
        description: "Ejercicios graduados de adición y sustracción para 4° básico",
        type: "WORKSHEET",
        status: "PUBLISHED",
        subjectId: subjects["Matemática"]!,
        courseId: courses["4° A"]!.id,
        gradeLevel: 4,
        axisId: axes["Matemática|Números y Operaciones"],
        learningObjectiveId: oaMat1.id,
        createdBy: adminUserId,
      },
    });
    await prisma.guide.create({
      data: {
        resourceId: worksheet.id,
        guideType: "EXERCISES",
        instructions: "Resuelve los siguientes ejercicios en tu cuaderno. Muestra el desarrollo.",
        isPrintable: true,
      },
    });
  }

  const lesson = await prisma.lesson.create({
    data: {
      institutionId,
      academicYearId,
      courseId: courses["4° A"]!.id,
      subjectId: subjects["Lenguaje"]!,
      teacherId: teacherIds["profesor@cordillera.cl"]!,
      title: "Clase: Introducción a Textos Narrativos",
      date: new Date("2026-05-20"),
      objective: "Identificar la estructura de un texto narrativo: inicio, desarrollo y desenlace",
      startDescription: "Activación de conocimientos previos: ¿Qué cuentos recuerdan? Lluvia de ideas.",
      developmentDescription: "Lectura guiada del cuento 'El zorro y la liebre'. Identificación de estructura en grupos.",
      closureDescription: "Ticket de salida: escribe el inicio, desarrollo y desenlace del cuento leído.",
      status: "PLANNED",
    },
  });

  const remedialGuide = await prisma.learningResource.findFirst({
    where: { title: "Guía Remedial: Comprensión de Textos Narrativos" },
  });
  if (remedialGuide) {
    await prisma.lessonResource.create({
      data: { lessonId: lesson.id, resourceId: remedialGuide.id, sortOrder: 0 },
    });
  }

  console.log("  [✓] Resources: 2 guides + 1 lesson planned");
}
