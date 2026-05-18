import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 10;

export async function seed(
  prisma: PrismaClient,
  courses: Record<string, { id: string; gradeLevel: number }>,
  institutionId: string,
): Promise<number> {
  console.log("\n─── STUDENTS ───────────────────────────────");

  const courseConfig: { name: string; gradeLevel: number; count: number }[] = [
    { name: "1° A", gradeLevel: 1, count: 23 },
    { name: "2° A", gradeLevel: 2, count: 24 },
    { name: "3° A", gradeLevel: 3, count: 24 },
    { name: "4° A", gradeLevel: 4, count: 24 },
    { name: "5° A", gradeLevel: 5, count: 24 },
    { name: "6° A", gradeLevel: 6, count: 30 },
    { name: "7° A", gradeLevel: 7, count: 37 },
    { name: "8° A", gradeLevel: 8, count: 29 },
  ];

  let studentSerial = 1;
  const studentHash = await bcrypt.hash("Alumno2026*", BCRYPT_ROUNDS);

  for (const c of courseConfig) {
    const courseId = courses[c.name]!.id;
    for (let i = 0; i < c.count; i++) {
      const studentEmail = `alumno${String(studentSerial).padStart(3, "0")}@cordillera.cl`;

      const user = await prisma.user.upsert({
        where: { email: studentEmail },
        update: {},
        create: {
          email: studentEmail,
          passwordHash: studentHash,
          firstName: `Alumno${String(studentSerial).padStart(3, "0")}`,
          lastName: c.name.replace("° ", "").replace(" ", ""),
          role: "STUDENT",
          institutionId,
        },
      });

      let student = await prisma.student.findUnique({ where: { userId: user.id } });
      if (!student) {
        student = await prisma.student.create({
          data: {
            userId: user.id,
            firstName: `Alumno${String(studentSerial).padStart(3, "0")}`,
            lastName: c.name.replace("° ", "").replace(" ", ""),
          },
        });
      }

      await prisma.enrollment.upsert({
        where: { studentId_courseId: { studentId: student.id, courseId } },
        update: {},
        create: { studentId: student.id, courseId },
      });

      studentSerial++;
    }
  }
  const totalStudents = studentSerial - 1;
  console.log(`  [✓] Students: ${totalStudents} enrolled`);

  return totalStudents;
}
