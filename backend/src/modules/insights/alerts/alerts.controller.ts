import { Controller, Get, Param, Query, UseGuards, ParseUUIDPipe } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { AlertsService } from "./alerts.service.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";
import { CurrentUser, JwtPayload } from "../../../common/decorators/current-user.decorator.js";

@ApiTags("Alerts")
@Controller("alerts")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class AlertsController {
  constructor(private readonly service: AlertsService) {}

  @Get("teacher")
  @Roles("TEACHER")
  @ApiOperation({ summary: "Alertas de estudiantes en riesgo para el profesor autenticado" })
  getTeacherAlerts(@CurrentUser() user: JwtPayload) {
    return this.service.getTeacherAlerts(user.sub);
  }

  @Get("oa-breaches/:courseId")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "OA con bajo logro (<60%) en un curso" })
  @ApiQuery({ name: "subjectId", required: false })
  getOaBreaches(
    @Param("courseId", ParseUUIDPipe) courseId: string,
    @Query("subjectId") subjectId?: string,
  ) {
    return this.service.getOaBreaches(courseId, subjectId);
  }

  @Get("institutional/:institutionId")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Alertas institucionales (cursos sin evaluaciones, estudiantes críticos, pendientes de corrección)" })
  getInstitutionalAlerts(@Param("institutionId", ParseUUIDPipe) institutionId: string) {
    return this.service.getInstitutionalAlerts(institutionId);
  }
}
