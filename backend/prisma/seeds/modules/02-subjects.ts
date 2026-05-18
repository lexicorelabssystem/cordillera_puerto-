import { PrismaClient } from "@prisma/client";

export interface SubjectSeedResult {
  subjects: Record<string, string>;
}

export async function seed(prisma: PrismaClient): Promise<SubjectSeedResult> {
  console.log("\n─── SUBJECTS ───────────────────────────────");

  const subjectsData = [
    { name: "Lenguaje", code: "LEN" },
    { name: "Matemática", code: "MAT" },
    { name: "Ciencias", code: "CIE" },
    { name: "Historia y Geografía", code: "HIS" },
  ];
  const subjects: Record<string, string> = {};
  for (const s of subjectsData) {
    const subject = await prisma.subject.upsert({
      where: { name: s.name },
      update: {},
      create: s,
    });
    subjects[s.name] = subject.id;
  }
  console.log(`  [✓] Subjects: ${subjectsData.length}`);

  for (let grade = 1; grade <= 8; grade++) {
    await prisma.curriculumRule.upsert({
      where: { subjectId_gradeLevel: { subjectId: subjects["Lenguaje"]!, gradeLevel: grade } },
      update: {},
      create: { subjectId: subjects["Lenguaje"]!, gradeLevel: grade },
    });
    await prisma.curriculumRule.upsert({
      where: { subjectId_gradeLevel: { subjectId: subjects["Matemática"]!, gradeLevel: grade } },
      update: {},
      create: { subjectId: subjects["Matemática"]!, gradeLevel: grade },
    });
  }
  await prisma.curriculumRule.upsert({
    where: { subjectId_gradeLevel: { subjectId: subjects["Ciencias"]!, gradeLevel: 6 } },
    update: {},
    create: { subjectId: subjects["Ciencias"]!, gradeLevel: 6 },
  });
  await prisma.curriculumRule.upsert({
    where: { subjectId_gradeLevel: { subjectId: subjects["Historia y Geografía"]!, gradeLevel: 8 } },
    update: {},
    create: { subjectId: subjects["Historia y Geografía"]!, gradeLevel: 8 },
  });
  console.log("  [✓] Curriculum Rules: 19 rules");

  return { subjects };
}
