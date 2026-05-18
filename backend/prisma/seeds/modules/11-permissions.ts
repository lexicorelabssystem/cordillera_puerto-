import { PrismaClient } from "@prisma/client";

export async function seed(prisma: PrismaClient): Promise<void> {
  console.log("\n─── PERMISSIONS ────────────────────────────");

  const permissionCatalog: { action: string; description: string; module: string }[] = [
    { action: "USERS_CREATE", description: "Crear usuarios", module: "users" },
    { action: "USERS_READ", description: "Ver usuarios", module: "users" },
    { action: "USERS_UPDATE", description: "Editar usuarios", module: "users" },
    { action: "USERS_DISABLE", description: "Desactivar usuarios", module: "users" },
    { action: "USERS_EXPORT", description: "Exportar usuarios", module: "users" },
    { action: "ROLES_ASSIGN", description: "Asignar roles", module: "users" },
    { action: "PERMISSIONS_ASSIGN", description: "Asignar permisos", module: "users" },
    { action: "SETTINGS_UPDATE", description: "Actualizar configuración", module: "settings" },
    { action: "INSTITUTIONS_CREATE", description: "Crear institución", module: "institutions" },
    { action: "INSTITUTIONS_UPDATE", description: "Editar institución", module: "institutions" },
    { action: "INSTITUTIONS_DELETE", description: "Eliminar institución", module: "institutions" },
    { action: "ACADEMIC_YEARS_CREATE", description: "Crear año académico", module: "academic" },
    { action: "ACADEMIC_YEARS_UPDATE", description: "Editar año académico", module: "academic" },
    { action: "ACADEMIC_YEARS_CLOSE", description: "Cerrar año académico", module: "academic" },
    { action: "COURSES_CREATE", description: "Crear cursos", module: "academic" },
    { action: "COURSES_UPDATE", description: "Editar cursos", module: "academic" },
    { action: "SUBJECTS_CREATE", description: "Crear asignaturas", module: "academic" },
    { action: "SUBJECTS_UPDATE", description: "Editar asignaturas", module: "academic" },
    { action: "STUDENTS_CREATE", description: "Crear estudiantes", module: "students" },
    { action: "STUDENTS_READ", description: "Ver estudiantes", module: "students" },
    { action: "STUDENTS_UPDATE", description: "Editar estudiantes", module: "students" },
    { action: "STUDENTS_DISABLE", description: "Desactivar estudiantes", module: "students" },
    { action: "STUDENTS_IMPORT", description: "Importar estudiantes", module: "students" },
    { action: "STUDENTS_EXPORT", description: "Exportar estudiantes", module: "students" },
    { action: "STUDENTS_TRANSFER", description: "Transferir estudiantes", module: "students" },
    { action: "CURRICULUM_CREATE", description: "Crear currículum", module: "curriculum" },
    { action: "CURRICULUM_UPDATE", description: "Editar currículum", module: "curriculum" },
    { action: "CURRICULUM_IMPORT", description: "Importar currículum", module: "curriculum" },
    { action: "CURRICULUM_EXPORT", description: "Exportar currículum", module: "curriculum" },
    { action: "QUESTIONS_CREATE", description: "Crear preguntas", module: "questions" },
    { action: "QUESTIONS_READ", description: "Ver preguntas", module: "questions" },
    { action: "QUESTIONS_UPDATE", description: "Editar preguntas", module: "questions" },
    { action: "QUESTIONS_DISABLE", description: "Desactivar preguntas", module: "questions" },
    { action: "QUESTIONS_SHARE", description: "Compartir preguntas", module: "questions" },
    { action: "QUESTIONS_IMPORT", description: "Importar preguntas", module: "questions" },
    { action: "QUESTIONS_EXPORT", description: "Exportar preguntas", module: "questions" },
    { action: "ASSESSMENTS_CREATE", description: "Crear evaluaciones", module: "assessments" },
    { action: "ASSESSMENTS_READ", description: "Ver evaluaciones", module: "assessments" },
    { action: "ASSESSMENTS_UPDATE", description: "Editar evaluaciones", module: "assessments" },
    { action: "ASSESSMENTS_PUBLISH", description: "Publicar evaluaciones", module: "assessments" },
    { action: "ASSESSMENTS_APPLY", description: "Aplicar evaluaciones", module: "assessments" },
    { action: "ASSESSMENTS_CLOSE", description: "Cerrar evaluaciones", module: "assessments" },
    { action: "ASSESSMENTS_EXPORT", description: "Exportar evaluaciones", module: "assessments" },
    { action: "RESULTS_READ", description: "Ver resultados", module: "results" },
    { action: "RESULTS_EXPORT", description: "Exportar resultados", module: "results" },
    { action: "RESULTS_CHANGE_REQUEST", description: "Solicitar cambio de nota", module: "results" },
    { action: "RESULTS_CHANGE_APPROVE", description: "Aprobar cambio de nota", module: "results" },
    { action: "RESULTS_CHANGE_REJECT", description: "Rechazar cambio de nota", module: "results" },
    { action: "REPORTS_READ", description: "Ver reportes", module: "reports" },
    { action: "REPORTS_EXPORT", description: "Exportar reportes", module: "reports" },
    { action: "VOICE_USE", description: "Usar asistente de dictado", module: "voice" },
    { action: "AUDIT_READ", description: "Ver auditoría", module: "audit" },
    { action: "IMPORTS_EXECUTE", description: "Ejecutar importaciones", module: "data-ops" },
    { action: "EXPORTS_EXECUTE", description: "Ejecutar exportaciones", module: "data-ops" },
  ];

  const permissionIds: Record<string, string> = {};
  for (const p of permissionCatalog) {
    const perm = await prisma.permission.upsert({
      where: { action: p.action as any },
      update: { description: p.description, module: p.module },
      create: { action: p.action as any, description: p.description, module: p.module },
    });
    permissionIds[p.action] = perm.id;
  }
  console.log(`  [✓] Permissions catalog: ${permissionCatalog.length}`);

  const adminUsers = await prisma.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, deletedAt: null },
  });
  for (const adminUser of adminUsers) {
    for (const permId of Object.values(permissionIds)) {
      await prisma.userPermission.upsert({
        where: { userId_permissionId: { userId: adminUser.id, permissionId: permId } },
        update: {},
        create: { userId: adminUser.id, permissionId: permId, grantedBy: null },
      });
    }
  }
  console.log(`  [✓] Admin permissions: ${adminUsers.length} users × ${permissionCatalog.length} perms`);

  const utpUser = await prisma.user.findFirst({ where: { role: "UTP", deletedAt: null } });
  if (utpUser) {
    const utpPerms = permissionCatalog.filter(
      (p) => !["PERMISSIONS_ASSIGN", "INSTITUTIONS_DELETE"].includes(p.action)
    );
    for (const p of utpPerms) {
      await prisma.userPermission.upsert({
        where: { userId_permissionId: { userId: utpUser.id, permissionId: permissionIds[p.action]! } },
        update: {},
        create: { userId: utpUser.id, permissionId: permissionIds[p.action]!, grantedBy: null },
      });
    }
    console.log(`  [✓] UTP permissions: ${utpPerms.length}`);
  }

  const teacherPerms = [
    "USERS_READ", "QUESTIONS_CREATE", "QUESTIONS_READ", "QUESTIONS_UPDATE",
    "QUESTIONS_SHARE", "QUESTIONS_IMPORT", "QUESTIONS_EXPORT",
    "ASSESSMENTS_CREATE", "ASSESSMENTS_READ", "ASSESSMENTS_UPDATE",
    "ASSESSMENTS_PUBLISH", "ASSESSMENTS_APPLY", "ASSESSMENTS_CLOSE",
    "RESULTS_READ", "RESULTS_EXPORT", "RESULTS_CHANGE_REQUEST",
    "REPORTS_READ", "REPORTS_EXPORT", "VOICE_USE",
    "STUDENTS_READ", "STUDENTS_EXPORT",
  ];
  const teacherUsers = await prisma.user.findMany({
    where: { role: "TEACHER", deletedAt: null },
  });
  for (const teacher of teacherUsers) {
    for (const action of teacherPerms) {
      await prisma.userPermission.upsert({
        where: { userId_permissionId: { userId: teacher.id, permissionId: permissionIds[action]! } },
        update: {},
        create: { userId: teacher.id, permissionId: permissionIds[action]!, grantedBy: null },
      });
    }
  }
  console.log(`  [✓] Teacher permissions: ${teacherUsers.length} users × ${teacherPerms.length} perms`);

  const studentPerms = ["RESULTS_READ", "VOICE_USE"];
  const allStudents = await prisma.user.findMany({
    where: { role: "STUDENT", deletedAt: null },
    take: 10,
  });
  for (const student of allStudents) {
    for (const action of studentPerms) {
      await prisma.userPermission.upsert({
        where: { userId_permissionId: { userId: student.id, permissionId: permissionIds[action]! } },
        update: {},
        create: { userId: student.id, permissionId: permissionIds[action]!, grantedBy: null },
      });
    }
  }
  console.log(`  [✓] Student permissions: first ${allStudents.length} students`);
}
