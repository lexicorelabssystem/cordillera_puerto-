import { PrismaClient } from "@prisma/client";

export interface AcademicSeedResult {
  academicYearId: string;
  periodS1Id: string;
  periodS2Id: string;
}

export async function seed(prisma: PrismaClient, institutionId: string): Promise<AcademicSeedResult> {
  console.log("\n─── ACADEMIC YEAR & PERIODS ────────────────");

  const academicYear = await prisma.academicYear.upsert({
    where: { institutionId_year: { institutionId, year: 2026 } },
    update: {},
    create: {
      institutionId,
      year: 2026,
      isActive: true,
      startDate: new Date("2026-03-01"),
      endDate: new Date("2026-12-20"),
    },
  });
  console.log(`  [✓] Academic Year: ${academicYear.year}`);

  const periodS1 = await prisma.period.upsert({
    where: { academicYearId_name: { academicYearId: academicYear.id, name: "Semestre 1" } },
    update: {},
    create: {
      academicYearId: academicYear.id,
      name: "Semestre 1",
      type: "SEMESTER",
      startDate: new Date("2026-03-01"),
      endDate: new Date("2026-07-10"),
      weight: 50,
      status: "ACTIVE",
    },
  });

  const periodS2 = await prisma.period.upsert({
    where: { academicYearId_name: { academicYearId: academicYear.id, name: "Semestre 2" } },
    update: {},
    create: {
      academicYearId: academicYear.id,
      name: "Semestre 2",
      type: "SEMESTER",
      startDate: new Date("2026-07-20"),
      endDate: new Date("2026-12-20"),
      weight: 50,
      status: "ACTIVE",
    },
  });
  console.log(`  [✓] Periods: ${periodS1.name}, ${periodS2.name}`);

  return { academicYearId: academicYear.id, periodS1Id: periodS1.id, periodS2Id: periodS2.id };
}
