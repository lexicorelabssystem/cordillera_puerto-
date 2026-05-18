import { PrismaClient } from "@prisma/client";

export async function seed(
  prisma: PrismaClient,
  teacherIds: Record<string, string>,
  courses: Record<string, { id: string; gradeLevel: number }>,
  subjects: Record<string, string>,
  periodS1Id: string,
  adminUserId: string,
): Promise<void> {
  console.log("\n─── DEMO ASSESSMENTS ───────────────────────");

  const course4A = courses["4° A"]!;

  const langQuestions = await prisma.question.findMany({
    where: { subjectId: subjects["Lenguaje"]! },
    take: 2,
    include: { options: true },
  });
  const mathQuestions = await prisma.question.findMany({
    where: { subjectId: subjects["Matemática"]! },
    take: 2,
    include: { options: true },
  });

  if (langQuestions.length >= 2) {
    const diagLang = await prisma.assessment.create({
      data: {
        courseId: course4A.id,
        subjectId: subjects["Lenguaje"]!,
        teacherId: teacherIds["profesor@cordillera.cl"]!,
        periodId: periodS1Id,
        title: "Diagnóstico Lenguaje 4° A",
        description: "Evaluación inicial de comprensión lectora y producción escrita",
        assessmentType: "DIAGNOSTICA",
        deliveryMode: "ONLINE",
        status: "PUBLISHED",
        semester: 1,
        maxScore: 2,
        timeLimitMin: 45,
        startDate: new Date("2026-04-01T08:00:00Z"),
        endDate: new Date("2026-04-05T18:00:00Z"),
        publishedAt: new Date("2026-03-28"),
        createdBy: adminUserId,
      },
    });
    for (let i = 0; i < langQuestions.length; i++) {
      await prisma.assessmentQuestion.create({
        data: { assessmentId: diagLang.id, questionId: langQuestions[i]!.id, sortOrder: i, points: 1 },
      });
    }
  }

  if (mathQuestions.length >= 2) {
    const procMat = await prisma.assessment.create({
      data: {
        courseId: course4A.id,
        subjectId: subjects["Matemática"]!,
        teacherId: teacherIds["profe.mate@cordillera.cl"]!,
        periodId: periodS1Id,
        title: "Proceso Matemática 4° A - Unidad 1",
        description: "Evaluación de proceso: números y operaciones",
        assessmentType: "PROCESO",
        deliveryMode: "ONLINE",
        status: "ACTIVE",
        semester: 1,
        maxScore: 2,
        timeLimitMin: 60,
        startDate: new Date("2026-05-01T08:00:00Z"),
        endDate: new Date("2026-06-15T18:00:00Z"),
        publishedAt: new Date("2026-04-25"),
        createdBy: adminUserId,
      },
    });
    for (let i = 0; i < mathQuestions.length; i++) {
      await prisma.assessmentQuestion.create({
        data: { assessmentId: procMat.id, questionId: mathQuestions[i]!.id, sortOrder: i, points: 1 },
      });
    }
  }

  console.log("  [✓] Demo Assessments: 2 (1 PUBLISHED + 1 ACTIVE)");
}
