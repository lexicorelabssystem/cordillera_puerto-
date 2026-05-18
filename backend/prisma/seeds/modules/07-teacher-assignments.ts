import { PrismaClient } from "@prisma/client";

export async function seed(
  prisma: PrismaClient,
  teacherIds: Record<string, string>,
  courses: Record<string, { id: string; gradeLevel: number }>,
  subjects: Record<string, string>,
): Promise<void> {
  console.log("\n─── TEACHER ASSIGNMENTS ────────────────────");

  for (const [, course] of Object.entries(courses)) {
    await prisma.teacherCourseAssignment.upsert({
      where: { teacherId_courseId_subjectId: { teacherId: teacherIds["profesor@cordillera.cl"]!, courseId: course.id, subjectId: subjects["Lenguaje"]! } },
      update: {},
      create: { teacherId: teacherIds["profesor@cordillera.cl"]!, courseId: course.id, subjectId: subjects["Lenguaje"]! },
    });
    await prisma.teacherCourseAssignment.upsert({
      where: { teacherId_courseId_subjectId: { teacherId: teacherIds["profe.mate@cordillera.cl"]!, courseId: course.id, subjectId: subjects["Matemática"]! } },
      update: {},
      create: { teacherId: teacherIds["profe.mate@cordillera.cl"]!, courseId: course.id, subjectId: subjects["Matemática"]! },
    });
    if (course.gradeLevel === 6) {
      await prisma.teacherCourseAssignment.upsert({
        where: { teacherId_courseId_subjectId: { teacherId: teacherIds["profe.ciencias@cordillera.cl"]!, courseId: course.id, subjectId: subjects["Ciencias"]! } },
        update: {},
        create: { teacherId: teacherIds["profe.ciencias@cordillera.cl"]!, courseId: course.id, subjectId: subjects["Ciencias"]! },
      });
    }
    if (course.gradeLevel === 8) {
      await prisma.teacherCourseAssignment.upsert({
        where: { teacherId_courseId_subjectId: { teacherId: teacherIds["profe.historia@cordillera.cl"]!, courseId: course.id, subjectId: subjects["Historia y Geografía"]! } },
        update: {},
        create: { teacherId: teacherIds["profe.historia@cordillera.cl"]!, courseId: course.id, subjectId: subjects["Historia y Geografía"]! },
      });
    }
  }
  console.log("  [✓] Teacher Assignments configured");
}
