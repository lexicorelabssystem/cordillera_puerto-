import { PrismaClient } from "@prisma/client";

export interface CourseSeedResult {
  courses: Record<string, { id: string; gradeLevel: number }>;
}

export async function seed(prisma: PrismaClient, institutionId: string, academicYearId: string): Promise<CourseSeedResult> {
  console.log("\n─── COURSES ────────────────────────────────");

  const courseConfig: { name: string; gradeLevel: number; section: string }[] = [
    { name: "1° A",  gradeLevel: 1,  section: "A" },
    { name: "1° B",  gradeLevel: 1,  section: "B" },
    { name: "2° A",  gradeLevel: 2,  section: "A" },
    { name: "2° B",  gradeLevel: 2,  section: "B" },
    { name: "3° A",  gradeLevel: 3,  section: "A" },
    { name: "3° B",  gradeLevel: 3,  section: "B" },
    { name: "4° A",  gradeLevel: 4,  section: "A" },
    { name: "4° B",  gradeLevel: 4,  section: "B" },
    { name: "5° A",  gradeLevel: 5,  section: "A" },
    { name: "5° B",  gradeLevel: 5,  section: "B" },
    { name: "6° A",  gradeLevel: 6,  section: "A" },
    { name: "6° B",  gradeLevel: 6,  section: "B" },
    { name: "7° A",  gradeLevel: 7,  section: "A" },
    { name: "7° B",  gradeLevel: 7,  section: "B" },
    { name: "8° A",  gradeLevel: 8,  section: "A" },
    { name: "8° B",  gradeLevel: 8,  section: "B" },
    { name: "1°M A", gradeLevel: 9,  section: "A" },
    { name: "1°M B", gradeLevel: 9,  section: "B" },
    { name: "2°M A", gradeLevel: 10, section: "A" },
    { name: "2°M B", gradeLevel: 10, section: "B" },
    { name: "3°M A", gradeLevel: 11, section: "A" },
    { name: "3°M B", gradeLevel: 11, section: "B" },
    { name: "4°M A", gradeLevel: 12, section: "A" },
    { name: "4°M B", gradeLevel: 12, section: "B" },
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
        section: c.section,
        maxStudents: 45,
      },
    });
    courses[c.name] = { id: course.id, gradeLevel: c.gradeLevel };
  }
  console.log(`  [✓] Courses: ${courseConfig.length} (1° básico a 4° medio, A/B)`);

  return { courses };
}
