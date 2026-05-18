import {
  Controller, Get, Post, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { PermissionsService } from "./permissions.service.js";
import { AssignPermissionsDto } from "./dto/permission.dto.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../common/guards/roles.guard.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { CurrentUser, JwtPayload } from "../../common/decorators/current-user.decorator.js";

@ApiTags("Permissions")
@Controller("permissions")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class PermissionsController {
  constructor(private readonly service: PermissionsService) {}

  @Get("catalog")
  @Roles("ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Listar catálogo completo de permisos disponibles" })
  getCatalog() {
    return this.service.getCatalog();
  }

  @Get("user/:userId")
  @Roles("ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Obtener permisos de un usuario" })
  getUserPermissions(@Param("userId", ParseUUIDPipe) userId: string) {
    return this.service.getUserPermissions(userId);
  }

  @Get("me")
  @ApiOperation({ summary: "Obtener permisos del usuario autenticado" })
  getMyPermissions(@CurrentUser() user: JwtPayload) {
    return this.service.getUserPermissions(user.sub);
  }

  @Post("assign")
  @Roles("ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Asignar permisos a un usuario" })
  assignPermissions(@Body() dto: AssignPermissionsDto, @CurrentUser() user: JwtPayload) {
    return this.service.assignPermissions(dto.userId, dto.permissionActions, user.sub);
  }

  @Delete("revoke")
  @Roles("ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Revocar un permiso específico de un usuario" })
  revokePermission(@Body("userId") userId: string, @Body("permissionAction") permissionAction: string) {
    return this.service.revokePermission(userId, permissionAction);
  }

  @Post("seed")
  @Roles("ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Sembrar catálogo de permisos en la base de datos" })
  seedPermissions() {
    return this.service.seedPermissions();
  }
}
