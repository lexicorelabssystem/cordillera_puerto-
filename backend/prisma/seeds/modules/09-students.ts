import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);

const COURSE_LAST_NAMES: Record<string, string> = {
  "1° A": "PrimerBasicoA",
  "1° B": "PrimerBasicoB",
  "2° A": "SegundoBasicoA",
  "2° B": "SegundoBasicoB",
  "3° A": "TercerBasicoA",
  "3° B": "TercerBasicoB",
  "4° A": "CuartoBasicoA",
  "4° B": "CuartoBasicoB",
  "5° A": "QuintoBasicoA",
  "5° B": "QuintoBasicoB",
  "6° A": "SextoBasicoA",
  "6° B": "SextoBasicoB",
  "7° A": "SeptimoBasicoA",
  "7° B": "SeptimoBasicoB",
  "8° A": "OctavoBasicoA",
  "8° B": "OctavoBasicoB",
  "1°M A": "PrimerMedioA",
  "1°M B": "PrimerMedioB",
  "2°M A": "SegundoMedioA",
  "2°M B": "SegundoMedioB",
  "3°M A": "TercerMedioA",
  "3°M B": "TercerMedioB",
  "4°M A": "CuartoMedioA",
  "4°M B": "CuartoMedioB",
};

function emailSlug(courseName: string): string {
  return courseName.toLowerCase().replace("°", "").replace(" ", "").replace("m", "m_");
}

export async function seed(
  prisma: PrismaClient,
  courses: Record<string, { id: string; gradeLevel: number }>,
  institutionId: string,
): Promise<number> {
  console.log("\n─── STUDENTS ───────────────────────────────");

  const studentHash = await bcrypt.hash("Alexis2026*", BCRYPT_ROUNDS);
  let total = 0;

  for (const [courseName, course] of Object.entries(courses)) {
    const lastName = COURSE_LAST_NAMES[courseName] ?? courseName.replace(/[° ]/g, "");
    const email = `alexis.${emailSlug(courseName)}@cordillera.cl`;

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: studentHash,
        firstName: "Alexis",
        lastName,
        role: "STUDENT",
        institutionId,
      },
    });

    let student = await prisma.student.findUnique({ where: { userId: user.id } });
    if (!student) {
      student = await prisma.student.create({
        data: {
          userId: user.id,
          firstName: "Alexis",
          lastName,
        },
      });
    }

    await prisma.enrollment.upsert({
      where: { studentId_courseId: { studentId: student.id, courseId: course.id } },
      update: {},
      create: { studentId: student.id, courseId: course.id },
    });

    total++;
  }

  console.log(`  [✓] Students: ${total} (Alexis x24 cursos)`);
  return total;
}
