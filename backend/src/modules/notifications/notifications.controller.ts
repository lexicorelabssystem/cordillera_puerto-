import {
  Controller, Get, Patch, Param, Query, HttpCode, HttpStatus,
  UseGuards, ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../common/guards/roles.guard.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { CurrentUser, JwtPayload } from "../../common/decorators/current-user.decorator.js";

@ApiTags("Notifications")
@Controller("notifications")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @Roles("SUPER_ADMIN", "ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Listar notificaciones del usuario" })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "offset", required: false })
  findMyNotifications(
    @CurrentUser() user: JwtPayload,
    @Query("status") status?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.service.findByUser(user.sub, {
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get("unread-count")
  @Roles("SUPER_ADMIN", "ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Obtener conteo de notificaciones no leidas" })
  getUnreadCount(@CurrentUser() user: JwtPayload) {
    return this.service.getUnreadCount(user.sub);
  }

  @Patch("read-all")
  @HttpCode(HttpStatus.OK)
  @Roles("SUPER_ADMIN", "ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Marcar todas las notificaciones como leidas" })
  markAllAsRead(@CurrentUser() user: JwtPayload) {
    return this.service.markAllAsRead(user.sub);
  }

  @Patch(":id/read")
  @HttpCode(HttpStatus.OK)
  @Roles("SUPER_ADMIN", "ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Marcar una notificacion como leida" })
  markAsRead(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.markAsRead(id, user.sub);
  }
}
