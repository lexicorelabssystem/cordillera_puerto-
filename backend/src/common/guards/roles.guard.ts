import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Optional } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../../common/decorators/roles.decorator.js";
import { PERMISSIONS_KEY } from "../../common/decorators/permissions.decorator.js";
import { UserRole, PermissionAction } from "@prisma/client";
import type { JwtPayload } from "../../common/decorators/current-user.decorator.js";
import type { PermissionsService } from "../../modules/permissions/permissions.service.js";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Optional() private readonly permissionsService?: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermissions = this.reflector.getAllAndOverride<PermissionAction[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length && !requiredPermissions?.length) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    if (!user) throw new ForbiddenException("Usuario no autenticado");

    const hasRole = requiredRoles?.length
      ? requiredRoles.some((role) => user.role === role)
      : false;

    if (hasRole) return true;

    if (requiredPermissions?.length && this.permissionsService) {
      const userPermissions = await this.permissionsService.getUserPermissionActions(user.sub);
      const hasPermission = requiredPermissions.some((p) => userPermissions.includes(p));
      if (hasPermission) return true;
    }

    throw new ForbiddenException(
      `No autorizado. Roles requeridos: ${requiredRoles?.join(", ") ?? "ninguno"}. Tu rol: ${user.role}`,
    );
  }
}
