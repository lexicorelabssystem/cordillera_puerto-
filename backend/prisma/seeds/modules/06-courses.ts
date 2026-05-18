import { PrismaClient } from "@prisma/client";

export interface CourseSeedResult {
  courses: Record<string, { id: string; gradeLevel: number }>;
}

export async function seed(prisma: PrismaClient, institutionId: string, academicYearId: string): Promise<CourseSeedResult> {
  console.log("\n─── COURSES ────────────────────────────────");

  const courseConfig = [
    { name: "1° A", gradeLevel: 1, count: 23 },
    { name: "2° A", gradeLevel: 2, count: 24 },
    { name: "3° A", gradeLevel: 3, count: 24 },
    { name: "4° A", gradeLevel: 4, count: 24 },
    { name: "5° A", gradeLevel: 5, count: 24 },
    { name: "6° A", gradeLevel: 6, count: 30 },
    { name: "7° A", gradeLevel: 7, count: 37 },
    { name: "8° A", gradeLevel: 8, count: 29 },
  ];
  const courses: Record<string, { id: string; gradeLevel: number }> = {};

  for (const c of courseConfig) {
    const course = await prisma.course.upsert({
      where: { academicYearId_name: { academicYearId, name: c.name } },
      update: {},
      create: {
        institutionId,
        academicYearId,
        name: c.name,
        gradeLevel: c.gradeLevel,
        section: "A",
        maxStudents: 45,
      },
    });
    courses[c.name] = { id: course.id, gradeLevel: c.gradeLevel };
  }
  console.log(`  [✓] Courses: ${courseConfig.length} (1° to 8°)`);

  return { courses };
}
