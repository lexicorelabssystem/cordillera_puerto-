/**
 * resetStudentsForTesting.ts
 *
 * Elimina TODOS los alumnos de prueba excepto "Alexis".
 * Luego asegura que Alexis esté matriculado en todos los cursos.
 *
 * Uso:
 *   npx tsx scripts/resetStudentsForTesting.ts          # ejecución real
 *   DRY_RUN=true npx tsx scripts/resetStudentsForTesting.ts  # simulación
 *
 * NO elimina: institución, cursos, profesores, admins, UTP, dirección, asignaturas, etc.
 */

import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const DRY_RUN = process.env.DRY_RUN === "true";
if (DRY_RUN) {
  console.log("🔍 MODO SIMULACIÓN (DRY_RUN=true) — No se eliminará nada.\n");
}

const prisma = new PrismaClient();

// ─── Tipos auxiliares ─────────────────────────────────
interface DeleteCandidate {
  userId: string;
  userEmail: string;
  userName: string;
  studentId: string | null;
  studentName: string;
}

// ─── MAIN ─────────────────────────────────────────────
async function main() {
  console.log("=== RESET DE ALUMNOS PARA TESTING ===\n");

  // ──────────────── PASO 1: Obtener institución ────────────────
  const institution = await prisma.institution.findFirst();
  if (!institution) {
    console.error("❌ No se encontró ninguna institución. Abortando.");
    process.exit(1);
  }
  console.log(`📌 Institución: ${institution.name} (${institution.id})`);

  // ──────────────── PASO 2: Obtener todos los cursos ────────────
  const courses = await prisma.course.findMany({
    where: { institutionId: institution.id, isActive: true },
    orderBy: { gradeLevel: "asc" },
  });
  console.log(`📌 Cursos activos encontrados: ${courses.length}`);

  // ──────────────── PASO 3: Identificar usuarios STUDENT ─────────
  const allStudentUsers = await prisma.user.findMany({
    where: { role: "STUDENT", institutionId: institution.id },
    include: { student: true },
    orderBy: { firstName: "asc" },
  });
  console.log(`📌 Total usuarios con rol STUDENT: ${allStudentUsers.length}`);

  // Separar Alexis del resto
  const alexisUsers = allStudentUsers.filter(
    (u) => u.firstName.toLowerCase() === "alexis"
  );
  const toDelete = allStudentUsers.filter(
    (u) => u.firstName.toLowerCase() !== "alexis"
  );

  console.log(`   ✅ Alexis (conservar): ${alexisUsers.length}`);
  console.log(`   ❌ A eliminar: ${toDelete.length}`);

  if (toDelete.length === 0) {
    console.log("\n✅ No hay alumnos para eliminar. Solo se verificará/creará Alexis.\n");
  }

  // ──────────────── PASO 4: Construir lista de candidatos ────────
  const candidates: DeleteCandidate[] = toDelete.map((u) => ({
    userId: u.id,
    userEmail: u.email,
    userName: `${u.firstName} ${u.lastName}`,
    studentId: u.student?.id ?? null,
    studentName: u.student ? `${u.student.firstName} ${u.student.lastName}` : "(sin registro Student)",
  }));

  // ──────────────── PASO 5: Buscar Students sin User ─────────────
  const orphanStudents = await prisma.student.findMany({
    where: {
      OR: [
        { userId: null },
        { userId: { notIn: allStudentUsers.map((u) => u.id) } },
      ],
    },
  });

  const orphanToDelete = orphanStudents.filter(
    (s) => s.firstName.toLowerCase() !== "alexis"
  );
  const orphanAlexis = orphanStudents.filter(
    (s) => s.firstName.toLowerCase() === "alexis"
  );

  console.log(`📌 Students sin User asociado: ${orphanStudents.length}`);
  console.log(`   Alexis huérfanos (conservar): ${orphanAlexis.length}`);
  console.log(`   A eliminar (huérfanos): ${orphanToDelete.length}`);

  // ──────────────── PASO 6: Resumen previo ─────────────────────
  console.log("\n──────────────────────────────────────────────────");
  console.log("📋 RESUMEN PREVIO A LA EJECUCIÓN");
  console.log("──────────────────────────────────────────────────");
  console.log(`   Usuarios STUDENT a eliminar: ${candidates.length}`);
  for (const c of candidates) {
    console.log(`     - ${c.userEmail} | ${c.userName} | studentId=${c.studentId ?? "N/A"}`);
  }
  console.log(`   Students huérfanos a eliminar: ${orphanToDelete.length}`);
  for (const s of orphanToDelete) {
    console.log(`     - ${s.firstName} ${s.lastName} | id=${s.id}`);
  }
  console.log("──────────────────────────────────────────────────");

  if (DRY_RUN) {
    console.log("\n🔍 DRY RUN: Simulación completada. No se realizaron cambios.");
    console.log("   Para ejecutar realmente: quita DRY_RUN=true o usa DRY_RUN=false\n");

    // Mostrar qué pasaría con Alexis
    await verifyAlexis(institution.id, courses, alexisUsers, orphanAlexis);
    await prisma.$disconnect();
    return;
  }

  // ──────────────── PASO 7: ELIMINAR ──────────────────────────
  console.log("\n🗑️  INICIANDO ELIMINACIÓN...\n");

  // Buscar un admin para reasignar referencias (Grade.recordedBy, LearningResource.createdBy)
  const fallbackAdmin = await prisma.user.findFirst({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, institutionId: institution.id },
  });

  let deletedUsers = 0;
  let deletedStudents = 0;
  let deletedOrphanStudents = 0;
  const errors: string[] = [];

  // 7a. Eliminar usuarios STUDENT
  for (const c of candidates) {
    try {
      // 1. Eliminar AssessmentAttempts (NO tienen cascade — bloquean el delete de User y Student)
      const attemptWhere: any[] = [{ userId: c.userId }];
      if (c.studentId) attemptWhere.push({ studentId: c.studentId });
      await prisma.assessmentAttempt.deleteMany({ where: { OR: attemptWhere } });

      // 2. Limpiar Reports que referencian al student
      if (c.studentId) {
        await prisma.report.updateMany({
          where: { studentId: c.studentId },
          data: { studentId: null },
        });
      }

      // 3. Reasignar Grade.recordedBy (bloquea delete de User)
      if (fallbackAdmin) {
        await prisma.grade.updateMany({
          where: { recordedBy: c.userId },
          data: { recordedBy: fallbackAdmin.id },
        });
      }

      // 4. Limpiar GradeChangeRequest
      await prisma.gradeChangeRequest.deleteMany({ where: { requestedBy: c.userId } });
      await prisma.gradeChangeRequest.updateMany({
        where: { reviewedBy: c.userId },
        data: { reviewedBy: null },
      });

      // 5. Reasignar LearningResource.createdBy
      if (fallbackAdmin) {
        await prisma.learningResource.updateMany({
          where: { createdBy: c.userId },
          data: { createdBy: fallbackAdmin.id },
        });
      }

      // 6. Limpiar ImportJob actorId (nullable, no bloquea)
      await prisma.importJob.updateMany({
        where: { actorId: c.userId },
        data: { actorId: null },
      });

      // 7. Limpiar AuditLog actorId (nullable, no bloquea)
      await prisma.auditLog.updateMany({
        where: { actorId: c.userId },
        data: { actorId: null },
      });

      // 8. Eliminar User (cascade: RefreshToken, UserPermission, Notification)
      //    Student.userId tiene onDelete: SetNull → no bloquea
      await prisma.user.delete({ where: { id: c.userId } });
      deletedUsers++;

      // 9. Eliminar Student si existía (se desvinculó del User por SetNull)
      if (c.studentId) {
        const remaining = await prisma.student.findUnique({ where: { id: c.studentId } });
        if (remaining) {
          await prisma.student.delete({ where: { id: c.studentId } });
          deletedStudents++;
        }
      }

      console.log(`   ✓ Eliminado: ${c.userEmail}`);
    } catch (err: any) {
      const msg = `Error eliminando ${c.userEmail}: ${err.message}`;
      errors.push(msg);
      console.error(`   ✗ ${msg}`);
    }
  }

  // 7b. Eliminar Students huérfanos
  for (const s of orphanToDelete) {
    try {
      // Limpiar AssessmentAttempts
      await prisma.assessmentAttempt.deleteMany({
        where: { studentId: s.id },
      });
      // Limpiar Reports
      await prisma.report.updateMany({
        where: { studentId: s.id },
        data: { studentId: null },
      });
      // Eliminar Student (cascade: Enrollment, Grade, RemedialPlan)
      await prisma.student.delete({ where: { id: s.id } });
      deletedOrphanStudents++;
      console.log(`   ✓ Eliminado huérfano: ${s.firstName} ${s.lastName}`);
    } catch (err: any) {
      const msg = `Error eliminando student huérfano ${s.id}: ${err.message}`;
      errors.push(msg);
      console.error(`   ✗ ${msg}`);
    }
  }

  // ──────────────── PASO 8: Verificar/Crear Alexis ────────────
  console.log("\n👤 ASEGURANDO ALEXIS EN TODOS LOS CURSOS...\n");
  await ensureAlexis(institution.id, courses, alexisUsers, orphanAlexis);

  // ──────────────── PASO 9: Resumen final ─────────────────────
  console.log("\n══════════════════════════════════════════════════");
  console.log("📊 RESUMEN FINAL");
  console.log("══════════════════════════════════════════════════");
  console.log(`   Usuarios STUDENT eliminados:  ${deletedUsers}`);
  console.log(`   Students asociados eliminados: ${deletedStudents}`);
  console.log(`   Students huérfanos eliminados: ${deletedOrphanStudents}`);
  console.log(`   Errores: ${errors.length}`);
  if (errors.length > 0) {
    console.log("   Detalle de errores:");
    errors.forEach((e) => console.log(`     - ${e}`));
  }

  const remainingAlexis = await prisma.user.findMany({
    where: { role: "STUDENT", firstName: "Alexis", institutionId: institution.id },
  });
  console.log(`   Alexis conservados (usuarios): ${remainingAlexis.length}`);

  const alexisEnrollments = await prisma.enrollment.count({
    where: { student: { firstName: "Alexis" } },
  });
  console.log(`   Matrículas de Alexis: ${alexisEnrollments}`);
  console.log("══════════════════════════════════════════════════\n");
}

// ─── VERIFICAR ALEXIS (dry-run) ─────────────────────
async function verifyAlexis(
  institutionId: string,
  courses: { id: string; name: string }[],
  alexisUsers: any[],
  orphanAlexis: any[],
) {
  console.log("\n👤 VERIFICACIÓN DE ALEXIS (simulación):");
  console.log(`   Usuarios Alexis existentes: ${alexisUsers.length}`);
  console.log(`   Students Alexis huérfanos: ${orphanAlexis.length}`);

  // Contar matrículas actuales
  const enrolledCourses = await prisma.enrollment.findMany({
    where: { student: { firstName: "Alexis" } },
    select: { courseId: true },
  });
  const enrolledSet = new Set(enrolledCourses.map((e) => e.courseId));
  const missing = courses.filter((c) => !enrolledSet.has(c.id));

  console.log(`   Cursos con Alexis ya matriculado: ${enrolledSet.size}`);
  console.log(`   Cursos donde FALTARÍA matricular: ${missing.length}`);
  if (missing.length > 0) {
    console.log("   Cursos faltantes:");
    for (const c of missing) console.log(`     - ${c.name}`);
  }

  if (alexisUsers.length === 0 && orphanAlexis.length === 0) {
    console.log("   ⚠️  No existe ningún Alexis. Se CREARÍA uno nuevo con 24 matrículas.");
  }
}

// ─── CREAR/ASEGURAR ALEXIS ──────────────────────────
async function ensureAlexis(
  institutionId: string,
  courses: { id: string; name: string }[],
  alexisUsers: any[],
  orphanAlexis: any[],
) {
  // Determinar el Student de Alexis (puede venir de User o ser huérfano)
  let alexisStudentId: string | null = null;

  // Primero buscar si ya hay un Student Alexis con userId
  for (const u of alexisUsers) {
    if (u.student) {
      alexisStudentId = u.student.id;
      break;
    }
  }

  // Si no, buscar entre huérfanos
  if (!alexisStudentId && orphanAlexis.length > 0) {
    alexisStudentId = orphanAlexis[0]!.id;
  }

  // Si aún no existe, crear el Student (sin User)
  if (!alexisStudentId) {
    console.log("   Creando nuevo Student Alexis (sin User)...");
    const newStudent = await prisma.student.create({
      data: {
        firstName: "Alexis",
        lastName: "Demo",
      },
    });
    alexisStudentId = newStudent.id;
  }

  console.log(`   Alexis Student ID: ${alexisStudentId}`);

  // Matricular en todos los cursos donde falte
  let created = 0;
  let existing = 0;

  for (const course of courses) {
    const exists = await prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: alexisStudentId!, courseId: course.id } },
    });

    if (!exists) {
      if (!DRY_RUN) {
        await prisma.enrollment.create({
          data: { studentId: alexisStudentId!, courseId: course.id },
        });
      }
      created++;
      console.log(`   ✓ Matriculado en: ${course.name}`);
    } else {
      existing++;
    }
  }

  console.log(`   Matrículas nuevas: ${created}`);
  console.log(`   Matrículas existentes: ${existing}`);
  console.log(`   Total cursos: ${courses.length}`);
}

// ─── EJECUTAR ────────────────────────────────────────
main()
  .catch((e) => {
    console.error("\n❌ Error fatal:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
