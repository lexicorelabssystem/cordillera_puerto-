import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();
const PASSWORD = process.env.LOAD_TEST_PASSWORD || "LoadTest2026!";
const TITLE = "LOAD TEST - 50 alumnos x 30 preguntas";
const STUDENTS = 50;
const QUESTIONS = 30;

async function main() {
  const institution = await prisma.institution.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!institution) throw new Error("Ejecuta primero npm --workspace backend run prisma:seed");
  const assignment = await prisma.teacherCourseAssignment.findFirst({
    where: { course: { institutionId: institution.id, isActive: true } },
    include: { course: true, subject: true, teacher: true },
  });
  if (!assignment) throw new Error("No existe una asignacion docente para preparar la prueba");
  const admin = await prisma.user.findFirst({
    where: { institutionId: institution.id, role: { in: ["ADMIN", "SUPER_ADMIN"] } },
  });
  if (!admin) throw new Error("No existe usuario administrador para createdBy");
  const period = await prisma.period.findFirst({
    where: { academicYear: { institutionId: institution.id }, status: "ACTIVE" },
  });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const csv = ["email,password"];

  for (let index = 1; index <= STUDENTS; index++) {
    const suffix = String(index).padStart(2, "0");
    const email = `load.student${suffix}@cordillera.test`;
    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash, isActive: true, deletedAt: null, institutionId: institution.id },
      create: {
        email,
        passwordHash,
        firstName: "Carga",
        lastName: `Alumno ${suffix}`,
        role: "STUDENT",
        institutionId: institution.id,
      },
    });
    const student = await prisma.student.upsert({
      where: { userId: user.id },
      update: { firstName: "Carga", lastName: `Alumno ${suffix}`, deletedAt: null },
      create: { userId: user.id, firstName: "Carga", lastName: `Alumno ${suffix}` },
    });
    await prisma.enrollment.upsert({
      where: { studentId_courseId: { studentId: student.id, courseId: assignment.courseId } },
      update: { isActive: true },
      create: { studentId: student.id, courseId: assignment.courseId, isActive: true },
    });
    csv.push(`${email},${PASSWORD}`);
  }

  let assessment = await prisma.assessment.findFirst({
    where: { title: TITLE, courseId: assignment.courseId },
  });
  if (assessment) {
    await prisma.assessmentAttempt.deleteMany({ where: { assessmentId: assessment.id } });
    await prisma.assessmentQuestion.deleteMany({ where: { assessmentId: assessment.id } });
    assessment = await prisma.assessment.update({
      where: { id: assessment.id },
      data: {
        status: "ACTIVE",
        isActive: true,
        startDate: new Date(Date.now() - 60_000),
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        allowRetake: false,
        archivedAt: null,
      },
    });
  } else {
    assessment = await prisma.assessment.create({
      data: {
        courseId: assignment.courseId,
        subjectId: assignment.subjectId,
        teacherId: assignment.teacherId,
        periodId: period?.id,
        title: TITLE,
        description: "Escenario local k6",
        assessmentType: "PROCESO",
        deliveryMode: "ONLINE",
        status: "ACTIVE",
        semester: 1,
        maxScore: QUESTIONS,
        timeLimitMin: 60,
        startDate: new Date(Date.now() - 60_000),
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isActive: true,
        allowRetake: false,
        publishedAt: new Date(),
        createdBy: admin.id,
      },
    });
  }

  for (let index = 1; index <= QUESTIONS; index++) {
    const statement = `[LOAD-TEST] Pregunta ${index}`;
    let question = await prisma.question.findFirst({
      where: { subjectId: assignment.subjectId, statement },
      include: { options: true },
    });
    if (!question) {
      question = await prisma.question.create({
        data: {
          subjectId: assignment.subjectId,
          type: "MULTIPLE_CHOICE",
          statement,
          difficulty: 2,
          points: 1,
          createdBy: admin.id,
          options: {
            create: [
              { text: "Alternativa A", isCorrect: true, sortOrder: 1 },
              { text: "Alternativa B", isCorrect: false, sortOrder: 2 },
              { text: "Alternativa C", isCorrect: false, sortOrder: 3 },
              { text: "Alternativa D", isCorrect: false, sortOrder: 4 },
            ],
          },
        },
        include: { options: true },
      });
    }
    await prisma.assessmentQuestion.upsert({
      where: { assessmentId_questionId: { assessmentId: assessment.id, questionId: question.id } },
      update: { sortOrder: index, points: 1 },
      create: { assessmentId: assessment.id, questionId: question.id, sortOrder: index, points: 1 },
    });
  }

  const outputDir = path.resolve(process.cwd(), "..", ".tmp");
  await mkdir(outputDir, { recursive: true });
  const csvPath = path.join(outputDir, "load-test-students.csv");
  await writeFile(csvPath, `${csv.join("\n")}\n`, "utf8");
  console.log(
    JSON.stringify(
      { assessmentId: assessment.id, students: STUDENTS, questions: QUESTIONS, csvPath },
      null,
      2,
    ),
  );
}

main().finally(() => prisma.$disconnect());
