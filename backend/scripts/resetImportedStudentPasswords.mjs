import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const password = process.env.STUDENT_TEMP_PASSWORD || "Temp2026*";
const rounds = Number(process.env.BCRYPT_ROUNDS || 10);
const shouldApply = process.argv.includes("--apply");
const includeAllStudents = process.argv.includes("--all-students");
const emailDomain = readArgValue("--email-domain");

async function main() {
  const importedUserIds = await findImportedStudentUserIds();

  if (importedUserIds.length === 0 && !includeAllStudents) {
    console.log("No encontre usuarios de alumnos rastreados en importaciones completadas.");
    console.log("Si necesitas resetear todos los alumnos activos, ejecuta con --all-students.");
    return;
  }

  const users = await prisma.user.findMany({
    where: {
      role: "STUDENT",
      isActive: true,
      deletedAt: null,
      student: { isNot: null },
      ...(emailDomain ? { email: { endsWith: `@${emailDomain}`, mode: "insensitive" } } : {}),
      ...(includeAllStudents ? {} : { id: { in: importedUserIds } }),
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      mustChangePassword: true,
    },
    orderBy: { email: "asc" },
  });

  console.log(`Usuarios STUDENT encontrados: ${users.length}`);
  if (emailDomain) console.log(`Filtro dominio: @${emailDomain}`);
  for (const user of users.slice(0, 20)) {
    console.log(`- ${user.email} (${user.firstName} ${user.lastName})`);
  }
  if (users.length > 20) console.log(`... y ${users.length - 20} mas`);

  if (!shouldApply) {
    console.log("");
    console.log("Dry run: no se hicieron cambios.");
    console.log("Ejecuta con --apply para resetearlos a la clave temporal.");
    console.log("Agrega --all-students si quieres incluir todos los alumnos activos.");
    console.log("Usa --email-domain=educacore.cl para limitar por dominio.");
    return;
  }

  const passwordHash = await bcrypt.hash(password, rounds);
  const result = await prisma.user.updateMany({
    where: { id: { in: users.map((user) => user.id) } },
    data: {
      passwordHash,
      mustChangePassword: true,
      refreshTokenHash: null,
    },
  });

  console.log("");
  console.log(`Claves reseteadas: ${result.count}`);
  console.log(`Clave temporal: ${password}`);
}

async function findImportedStudentUserIds() {
  const jobs = await prisma.importJob.findMany({
    where: {
      entityType: "students",
      status: "COMPLETED",
    },
    select: { errorDetails: true },
  });

  const ids = new Set();
  for (const job of jobs) {
    const details = job.errorDetails;
    if (!details || typeof details !== "object" || Array.isArray(details)) continue;
    const records = Array.isArray(details.importedRecords) ? details.importedRecords : [];
    for (const record of records) {
      if (record && typeof record === "object" && typeof record.userId === "string") {
        ids.add(record.userId);
      }
    }
  }
  return [...ids];
}

function readArgValue(name) {
  const prefix = `${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  if (!arg) return "";
  return arg.slice(prefix.length).replace(/^@/, "").trim().toLowerCase();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
