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
import * as simceBankSeed from "./modules/12-simce-bank.js";

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
  const { total: simceTotal } = await simceBankSeed.seed(prisma, teacherIds, courses, subjects, periodS2Id, adminUserId);

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Seed completed successfully!`);
  console.log(`  Institution: Colegio Cordillera Demo`);
  console.log(`  Academic Year: 2026`);
  console.log(`  Periods: Semestre 1 (50%), Semestre 2 (50%)`);
  console.log(`  Courses: 24 (1° básico a 4° medio, A/B)`);
  console.log(`  Students: ${totalStudents} (Alexis x24)`);
  console.log(`  SIMCE Essays: ${simceTotal} (48 target: 10+10 Mat/Len 4°, 10+10 Mat/Len 6°, 8 Cie 6°)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Demo credentials:`);
  console.log(`    superadmin@cordillera.cl / Demo2026*`);
  console.log(`    admin@cordillera.cl / Admin2026*`);
  console.log(`    utp@cordillera.cl / Profesor2026*`);
  console.log(`    director@cordillera.cl / Profesor2026*`);
  console.log(`    profesor@cordillera.cl / Profesor2026*`);
  console.log(`    profe.mate@cordillera.cl / Profesor2026*`);
  console.log(`    profe.ciencias@cordillera.cl / Profesor2026*`);
  console.log(`    alexis.1a@cordillera.cl / Alexis2026*`);
  console.log(`    alexis.2a@cordillera.cl / Alexis2026*`);
  console.log(`    ... (24 cursos, misma clave)`);
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
