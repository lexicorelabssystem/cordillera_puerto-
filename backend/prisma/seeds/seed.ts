import { PrismaClient } from "@prisma/client";
import * as institutionSeed from "./modules/00-institution.js";
import * as academicSeed from "./modules/01-academic.js";
import * as subjectsSeed from "./modules/02-subjects.js";
import * as curriculumSeed from "./modules/03-curriculum.js";
import * as questionsSeed from "./modules/04-questions.js";
import * as usersSeed from "./modules/05-users.js";
import * as coursesSeed from "./modules/06-courses.js";
import * as teacherAssignmentsSeed from "./modules/07-teacher-assignments.js";
import * as assessmentsSeed from "./modules/08-assessments.js";
import * as studentsSeed from "./modules/09-students.js";
import * as resourcesSeed from "./modules/10-resources.js";
import * as permissionsSeed from "./modules/11-permissions.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Cordillera database v3.0...");

  const { institutionId } = await institutionSeed.seed(prisma);
  const { academicYearId, periodS1Id, periodS2Id } = await academicSeed.seed(prisma, institutionId);
  const { subjects } = await subjectsSeed.seed(prisma);
  const { axes, skills } = await curriculumSeed.seed(prisma, subjects);
  await questionsSeed.seed(prisma, subjects, axes, skills);
  const { teacherIds, adminUserId } = await usersSeed.seed(prisma, institutionId);
  const { courses } = await coursesSeed.seed(prisma, institutionId, academicYearId);
  await teacherAssignmentsSeed.seed(prisma, teacherIds, courses, subjects);
  await assessmentsSeed.seed(prisma, teacherIds, courses, subjects, periodS1Id, adminUserId);
  const totalStudents = await studentsSeed.seed(prisma, courses, institutionId);
  await resourcesSeed.seed(prisma, institutionId, academicYearId, subjects, courses, axes, teacherIds, adminUserId);
  await permissionsSeed.seed(prisma);

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Seed completed successfully!`);
  console.log(`  Institution: Colegio Cordillera Demo`);
  console.log(`  Academic Year: 2026`);
  console.log(`  Periods: Semestre 1 (50%), Semestre 2 (50%)`);
  console.log(`  Courses: 8`);
  console.log(`  Teachers: 4`);
  console.log(`  Students: ${totalStudents}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Demo credentials:`);
  console.log(`    admin@cordillera.cl / Demo2026*`);
  console.log(`    profesor@cordillera.cl / Demo2026*`);
  console.log(`    alumno001@cordillera.cl / Alumno2026*`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
