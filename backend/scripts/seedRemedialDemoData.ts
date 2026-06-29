/**
 * Crea rutas remediales demo para que el modulo no quede vacio.
 *
 * Uso:
 *   npx tsx scripts/seedRemedialDemoData.ts
 */

import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient();
const DEMO_MARKER = "DEMO_FULL_DATA";

function dateOnly(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

async function main() {
  console.log("=== RUTAS REMEDIALES DEMO ===");

  const courses = await prisma.course.findMany({
    where: { isActive: true },
    include: {
      enrollments: {
        where: { isActive: true },
        include: { student: true },
        take: 6,
        orderBy: { student: { lastName: "asc" } },
      },
      teacherAssignments: {
        include: { subject: true },
        orderBy: { subject: { name: "asc" } },
      },
    },
    orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
  });

  const recorder = await prisma.user.findFirst({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN", "UTP", "TEACHER"] } },
    orderBy: { createdAt: "asc" },
  });

  await prisma.remedialPlan.deleteMany({
    where: {
      OR: [{ title: { contains: DEMO_MARKER } }, { description: { contains: DEMO_MARKER } }],
    },
  });

  let created = 0;
  const statuses = ["PENDING", "IN_PROGRESS", "COMPLETED", "EFFECTIVE"] as const;

  for (let courseIndex = 0; courseIndex < courses.length; courseIndex++) {
    const course = courses[courseIndex]!;
    const assignment =
      course.teacherAssignments[courseIndex % Math.max(1, course.teacherAssignments.length)];
    const subjectId = assignment?.subjectId;
    if (!subjectId || course.enrollments.length === 0) continue;

    const objectives = await prisma.learningObjective.findMany({
      where: {
        subjectId,
        gradeLevel: course.gradeLevel,
        isActive: true,
      },
      take: 3,
      orderBy: { code: "asc" },
    });

    if (objectives.length === 0) continue;

    for (let i = 0; i < Math.min(3, course.enrollments.length); i++) {
      const student = course.enrollments[i]!.student;
      const objective = objectives[i % objectives.length]!;
      const status = statuses[(courseIndex + i) % statuses.length]!;
      const preScore = Number((2.8 + ((courseIndex + i) % 11) / 10).toFixed(1));
      const postScore =
        status === "COMPLETED" || status === "EFFECTIVE"
          ? Number(Math.min(7, preScore + 1.2).toFixed(1))
          : null;

      await prisma.remedialPlan.create({
        data: {
          studentId: student.id,
          courseId: course.id,
          subjectId,
          learningObjectiveId: objective.id,
          title: `${DEMO_MARKER}: Refuerzo ${objective.code} - ${course.name}`,
          description: `${DEMO_MARKER}: plan breve con practica guiada, ticket de salida y retroalimentacion para mejorar el OA ${objective.code}.`,
          status,
          startDate: dateOnly(2026, 5, 4 + i),
          endDate: dateOnly(2026, 5, 18 + i),
          preScore,
          postScore,
          assignedTo: recorder?.id ?? null,
        },
      });
      created++;
    }
  }

  console.log(`Planes remediales creados: ${created}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
