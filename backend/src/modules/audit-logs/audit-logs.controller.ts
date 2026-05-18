import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { AuditLogsService } from "./audit-logs.service.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../common/guards/roles.guard.js";
import { Roles } from "../../common/decorators/roles.decorator.js";

@ApiTags("Audit Logs")
@Controller("audit-logs")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class AuditLogsController {
  constructor(private readonly service: AuditLogsService) {}

  @Get()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION")
  @ApiOperation({ summary: "Consultar logs de auditoría con filtros avanzados" })
  @ApiQuery({ name: "action", required: false })
  @ApiQuery({ name: "entityType", required: false })
  @ApiQuery({ name: "entityId", required: false })
  @ApiQuery({ name: "actorId", required: false })
  @ApiQuery({ name: "dateFrom", required: false })
  @ApiQuery({ name: "dateTo", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  findAll(
    @Query("action") action?: string,
    @Query("entityType") entityType?: string,
    @Query("entityId") entityId?: string,
    @Query("actorId") actorId?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.service.findAll(
      { action, entityType, entityId, actorId, dateFrom, dateTo, search },
      Number(page ?? 1), Number(limit ?? 50),
    );
  }

  @Get("summary")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION")
  @ApiOperation({ summary: "Resumen de actividad de auditoría (últimos N días)" })
  @ApiQuery({ name: "days", required: false })
  getSummary(@Query("days") days?: string) {
    return this.service.getActionsSummary(Number(days ?? 7));
  }
}
