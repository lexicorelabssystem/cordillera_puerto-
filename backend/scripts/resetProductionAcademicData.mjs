import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const backupConfirmed = process.argv.includes("--backup-confirmed");
const confirmation = readArgValue("--confirm");
const expectedConfirmation = "RESET-ACADEMIC-DATA";
const rounds = Number(process.env.BCRYPT_ROUNDS || 10);
const studentPassword = process.env.STUDENT_TEMP_PASSWORD || "";
const teacherPassword = process.env.TEACHER_TEMP_PASSWORD || "";

async function main() {
  const counts = await readCounts();
  printCounts(counts);

  if (!apply) {
    console.log("");
    console.log("Dry run: no se hicieron cambios.");
    console.log("Para aplicar se requiere respaldo, claves temporales y confirmacion explicita.");
    return;
  }

  if (!backupConfirmed) {
    throw new Error("Falta --backup-confirmed. Confirma primero que existe un respaldo reciente de PostgreSQL.");
  }
  if (confirmation !== expectedConfirmation) {
    throw new Error(`Usa --confirm=${expectedConfirmation} para autorizar la operacion irreversible.`);
  }
  validateTemporaryPassword("STUDENT_TEMP_PASSWORD", studentPassword);
  validateTemporaryPassword("TEACHER_TEMP_PASSWORD", teacherPassword);
  if (!Number.isInteger(rounds) || rounds < 10 || rounds > 14) {
    throw new Error("BCRYPT_ROUNDS debe ser un entero entre 10 y 14.");
  }

  const [studentHash, teacherHash] = await Promise.all([
    bcrypt.hash(studentPassword, rounds),
    bcrypt.hash(teacherPassword, rounds),
  ]);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const reports = await tx.report.deleteMany({ where: { assessmentId: { not: null } } });
    const detachedResources = await tx.learningResource.updateMany({
      where: { assessmentId: { not: null } },
      data: { assessmentId: null },
    });

    const gradeChangeRequests = await tx.gradeChangeRequest.deleteMany({});
    const grades = await tx.grade.deleteMany({});
    const studentAnswers = await tx.studentAnswer.deleteMany({});
    const attempts = await tx.assessmentAttempt.deleteMany({});
    const assessments = await tx.assessment.deleteMany({});

    const simceResponses = await tx.simceStudentResponse.deleteMany({});
    const simceAnswerKeys = await tx.simceAnswerKey.deleteMany({});
    const simceAssessments = await tx.simceAssessment.deleteMany({});

    const students = await tx.user.updateMany({
      where: { role: "STUDENT", isActive: true, deletedAt: null },
      data: {
        passwordHash: studentHash,
        mustChangePassword: true,
        refreshTokenHash: null,
      },
    });
    const teachers = await tx.user.updateMany({
      where: { role: "TEACHER", isActive: true, deletedAt: null },
      data: {
        passwordHash: teacherHash,
        mustChangePassword: true,
        refreshTokenHash: null,
      },
    });
    const revokedSessions = await tx.refreshToken.updateMany({
      where: {
        revokedAt: null,
        user: { role: { in: ["STUDENT", "TEACHER"] } },
      },
      data: { revokedAt: now },
    });

    return {
      reports: reports.count,
      detachedResources: detachedResources.count,
      gradeChangeRequests: gradeChangeRequests.count,
      grades: grades.count,
      studentAnswers: studentAnswers.count,
      attempts: attempts.count,
      assessments: assessments.count,
      simceResponses: simceResponses.count,
      simceAnswerKeys: simceAnswerKeys.count,
      simceAssessments: simceAssessments.count,
      studentPasswordsReset: students.count,
      teacherPasswordsReset: teachers.count,
      revokedSessions: revokedSessions.count,
    };
  }, { timeout: 120_000 });

  console.log("");
  console.log("Operacion completada:");
  for (const [name, value] of Object.entries(result)) console.log(`- ${name}: ${value}`);
  console.log("Las claves temporales no fueron impresas ni almacenadas en el repositorio.");
}

async function readCounts() {
  const [
    gradeChangeRequests,
    grades,
    studentAnswers,
    attempts,
    assessments,
    simceResponses,
    simceAnswerKeys,
    simceAssessments,
    reports,
    linkedResources,
    students,
    teachers,
  ] = await Promise.all([
    prisma.gradeChangeRequest.count(),
    prisma.grade.count(),
    prisma.studentAnswer.count(),
    prisma.assessmentAttempt.count(),
    prisma.assessment.count(),
    prisma.simceStudentResponse.count(),
    prisma.simceAnswerKey.count(),
    prisma.simceAssessment.count(),
    prisma.report.count({ where: { assessmentId: { not: null } } }),
    prisma.learningResource.count({ where: { assessmentId: { not: null } } }),
    prisma.user.count({ where: { role: "STUDENT", isActive: true, deletedAt: null } }),
    prisma.user.count({ where: { role: "TEACHER", isActive: true, deletedAt: null } }),
  ]);
  return {
    gradeChangeRequests,
    grades,
    studentAnswers,
    attempts,
    assessments,
    simceResponses,
    simceAnswerKeys,
    simceAssessments,
    reports,
    linkedResources,
    studentPasswordsToReset: students,
    teacherPasswordsToReset: teachers,
  };
}

function printCounts(counts) {
  console.log("Resumen de datos que seran afectados:");
  for (const [name, value] of Object.entries(counts)) console.log(`- ${name}: ${value}`);
}

function validateTemporaryPassword(name, value) {
  if (value.length < 12) throw new Error(`${name} debe tener al menos 12 caracteres.`);
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value) || !/[^A-Za-z0-9]/.test(value)) {
    throw new Error(`${name} debe incluir mayuscula, minuscula, numero y simbolo.`);
  }
}

function readArgValue(name) {
  const prefix = `${name}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length).trim() : "";
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });