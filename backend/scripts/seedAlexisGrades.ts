/**
 * Crea notas inventadas solo para estudiantes llamados Alexis.
 *
 * Uso:
 *   npx tsx scripts/seedAlexisGrades.ts
 *   DRY_RUN=true npx tsx scripts/seedAlexisGrades.ts
 */

import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === "true";

const gradeSets = [
  [6.5, 6.7, 5.9, 6.2],
  [5.8, 6.1, 5.5, 6.4],
  [4.8, 5.2, 5.9, 6.0],
  [6.9, 6.3, 6.6, 5.7],
  [5.1, 4.6, 5.4, 5.8],
  [6.2, 5.6, 6.0, 6.8],
];

function scoreFromGrade(grade: number) {
  const percentage = Math.round(((grade - 1) / 6) * 100);
  return {
    score: percentage,
    percentage,
  };
}

async function main() {
  console.log("=== NOTAS INVENTADAS PARA ALEXIS ===");
  if (DRY_RUN) console.log("Modo simulacion: no se escribira en la base de datos.");

  const recorder = await prisma.user.findFirst({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN", "UTP", "TEACHER"] } },
    orderBy: { createdAt: "asc" },
  });

  if (!recorder) {
    throw new Error("No encontre un usuario para registrar las notas.");
  }

  const period = await prisma.period.findFirst({
    where: { status: "OPEN" },
    orderBy: { startDate: "asc" },
  });

  const enrollments = await prisma.enrollment.findMany({
    where: {
      isActive: true,
      student: {
        firstName: { equals: "Alexis", mode: "insensitive" },
      },
      course: { isActive: true },
    },
    include: {
      student: true,
      course: {
        include: {
          teacherAssignments: {
            include: { teacher: true, subject: true },
            orderBy: { subject: { name: "asc" } },
          },
        },
      },
    },
    orderBy: { course: { name: "asc" } },
  });

  if (enrollments.length === 0) {
    throw new Error("No encontre matriculas activas para Alexis.");
  }

  let createdAssessments = 0;
  let createdGrades = 0;
  let updatedGrades = 0;
  let skippedCourses = 0;

  for (let courseIndex = 0; courseIndex < enrollments.length; courseIndex++) {
    const enrollment = enrollments[courseIndex]!;
    const assignments = enrollment.course.teacherAssignments.slice(0, 4);

    if (assignments.length === 0) {
      skippedCourses++;
      console.log(`- ${enrollment.course.name}: sin asignaturas/profesores asignados, omitido.`);
      continue;
    }

    const grades = gradeSets[courseIndex % gradeSets.length]!;
    console.log(
      `- ${enrollment.course.name}: ${enrollment.student.firstName} ${enrollment.student.lastName}`,
    );

    for (let i = 0; i < assignments.length; i++) {
      const assignment = assignments[i]!;
      const grade = grades[i % grades.length]!;
      const title = `N${i + 1} ${assignment.subject.name} ${enrollment.course.name}`;

      if (DRY_RUN) {
        console.log(`  ${title}: ${grade.toFixed(1)}`);
        continue;
      }

      const assessment =
        (await prisma.assessment.findFirst({
          where: {
            courseId: enrollment.courseId,
            subjectId: assignment.subjectId,
            title,
          },
        })) ??
        (await prisma.assessment.create({
          data: {
            courseId: enrollment.courseId,
            subjectId: assignment.subjectId,
            teacherId: assignment.teacherId,
            periodId: period?.id ?? null,
            title,
            description: "Evaluacion de demostracion para completar notas de Alexis.",
            assessmentType: i === 0 ? "DIAGNOSTICA" : "PROCESO",
            deliveryMode: "PRINTED",
            status: "GRADED",
            semester: i < 2 ? 1 : 2,
            maxScore: 100,
            weight: 25,
            startDate: new Date(`2026-${String(4 + i).padStart(2, "0")}-10T12:00:00Z`),
            createdBy: recorder.id,
            publishedAt: new Date(`2026-${String(4 + i).padStart(2, "0")}-01T12:00:00Z`),
            closedAt: new Date(`2026-${String(4 + i).padStart(2, "0")}-12T12:00:00Z`),
            gradedAt: new Date(`2026-${String(4 + i).padStart(2, "0")}-14T12:00:00Z`),
          },
        }));

      if (assessment.createdAt.getTime() > Date.now() - 10_000) {
        createdAssessments++;
      }

      const score = scoreFromGrade(grade);
      const existing = await prisma.grade.findUnique({
        where: {
          assessmentId_studentId: {
            assessmentId: assessment.id,
            studentId: enrollment.studentId,
          },
        },
      });

      await prisma.grade.upsert({
        where: {
          assessmentId_studentId: {
            assessmentId: assessment.id,
            studentId: enrollment.studentId,
          },
        },
        create: {
          assessmentId: assessment.id,
          studentId: enrollment.studentId,
          grade,
          score: score.score,
          percentage: score.percentage,
          comments: "Nota inventada para datos de prueba.",
          recordedBy: recorder.id,
        },
        update: {
          grade,
          score: score.score,
          percentage: score.percentage,
          comments: "Nota inventada para datos de prueba.",
        },
      });

      if (existing) updatedGrades++;
      else createdGrades++;

      console.log(`  ${title}: ${grade.toFixed(1)}`);
    }
  }

  console.log("\nResumen:");
  console.log(`  Cursos con Alexis procesados: ${enrollments.length - skippedCourses}`);
  console.log(`  Cursos omitidos: ${skippedCourses}`);
  console.log(`  Evaluaciones creadas: ${createdAssessments}`);
  console.log(`  Notas creadas: ${createdGrades}`);
  console.log(`  Notas actualizadas: ${updatedGrades}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
