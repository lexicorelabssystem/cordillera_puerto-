import {
  Injectable,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditLogsService } from "../audit-logs/audit-logs.service.js";
import { PermissionAction } from "@prisma/client";
import type { Permission, UserPermission } from "@prisma/client";

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogsService,
  ) {}

  async getCatalog() {
    return this.prisma.permission.findMany({
      orderBy: { module: "asc" },
    });
  }

  async getUserPermissions(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        userPermissions: {
          include: { permission: true },
        },
      },
    });

    if (!user) throw new NotFoundException("Usuario no encontrado");

    return {
      userId: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      role: user.role,
      permissions: user.userPermissions.map((up: UserPermission & { permission: Permission }) => up.permission.action),
    };
  }

  async assignPermissions(
    userId: string,
    permissionActions: string[],
    grantedBy?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("Usuario no encontrado");

    const permissions = await this.prisma.permission.findMany({
      where: { action: { in: permissionActions as PermissionAction[] } },
    });

    if (permissions.length !== permissionActions.length) {
      const found = permissions.map((p: Permission) => p.action);
      const missing = permissionActions.filter((a: string) => !found.includes(a as PermissionAction));
      throw new NotFoundException(`Permisos no encontrados: ${missing.join(", ")}`);
    }

    const results: { action: string; status: string }[] = [];

    for (const permission of permissions) {
      try {
        await this.prisma.userPermission.create({
          data: {
            userId: user.id,
            permissionId: permission.id,
            grantedBy: grantedBy ?? null,
          },
        });
        results.push({ action: permission.action, status: "granted" });
      } catch (err: unknown) {
        const isUniqueError =
          typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002";
        if (isUniqueError) {
          results.push({ action: permission.action, status: "already_granted" });
        } else {
          throw err;
        }
      }
    }

    this.logger.log(`Permisos asignados a ${user.email}: ${permissionActions.join(", ")}`);
    await this.auditLog.log({
      actorId: grantedBy ?? null, action: "PERMISSIONS_ASSIGNED", entityType: "permission", entityId: userId,
      metadata: JSON.stringify({ permissions: permissionActions }),
    });

    return results;
  }

  async revokePermission(userId: string, permissionAction: string) {
    const permission = await this.prisma.permission.findUnique({
      where: { action: permissionAction as PermissionAction },
    });
    if (!permission) throw new NotFoundException(`Permiso no encontrado: ${permissionAction}`);

    const userPermission = await this.prisma.userPermission.findUnique({
      where: { userId_permissionId: { userId, permissionId: permission.id } },
    });

    if (!userPermission) {
      throw new NotFoundException("El usuario no tiene este permiso asignado");
    }

    await this.prisma.userPermission.delete({
      where: { id: userPermission.id },
    });

    this.logger.log(`Permiso revocado: ${permissionAction} de usuario ${userId}`);
    await this.auditLog.log({
      actorId: null, action: "PERMISSION_REVOKED", entityType: "permission", entityId: userId,
      metadata: JSON.stringify({ action: permissionAction }),
    });
    return { ok: true, action: permissionAction };
  }

  async hasPermission(userId: string, action: PermissionAction): Promise<boolean> {
    const permission = await this.prisma.permission.findUnique({
      where: { action },
    });
    if (!permission) return false;

    const userPermission = await this.prisma.userPermission.findUnique({
      where: { userId_permissionId: { userId, permissionId: permission.id } },
    });

    return !!userPermission;
  }

  async getUserPermissionActions(userId: string): Promise<PermissionAction[]> {
    const userPermissions = await this.prisma.userPermission.findMany({
      where: { userId },
      include: { permission: true },
    });
    return userPermissions.map((up: UserPermission & { permission: Permission }) => up.permission.action);
  }

  async seedPermissions() {
    const catalog: { action: PermissionAction; description: string; module: string }[] = [
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

    let created = 0;
    for (const p of catalog) {
      await this.prisma.permission.upsert({
        where: { action: p.action },
        update: { description: p.description, module: p.module },
        create: p,
      });
      created++;
    }

    this.logger.log(`Catálogo de permisos sembrado: ${created} permisos`);
    return { total: created };
  }
}
