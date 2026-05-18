import {
  Controller, Get, Post, Body, Param, Query, UseGuards, ParseUUIDPipe, BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { ReportsService } from "./reports.service.js";
import { GenerateReportDto } from "./dto/report.dto.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";
import { CurrentUser, JwtPayload } from "../../../common/decorators/current-user.decorator.js";

@ApiTags("Reports")
@Controller("reports")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Post("generate")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Generar reporte pedagógico" })
  async generate(@Body() dto: GenerateReportDto, @CurrentUser() user: JwtPayload) {
    let data: unknown;

    switch (dto.type) {
      case "STUDENT":
        if (!dto.studentId) throw new BadRequestException("studentId requerido");
        data = await this.service.generateStudentReport(dto.studentId);
        break;
      case "COURSE":
        if (!dto.courseId) throw new BadRequestException("courseId requerido");
        data = await this.service.generateCourseReport(dto.courseId, dto.subjectId);
        break;
      case "INSTITUTIONAL":
        if (!dto.institutionId) throw new BadRequestException("institutionId requerido");
        data = await this.service.generateInstitutionalReport(dto.institutionId);
        break;
      default:
        throw new BadRequestException(`Tipo de reporte no soportado: ${dto.type}`);
    }

    const report = await this.service.saveReport(dto.type, dto.studentId ?? dto.courseId ?? dto.institutionId ?? null, data, user.sub);
    return { reportId: report.id, ...data as object };
  }

  @Get()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Listar reportes generados" })
  @ApiQuery({ name: "type", required: false })
  @ApiQuery({ name: "entityId", required: false })
  list(@Query("type") type?: string, @Query("entityId") entityId?: string) {
    return this.service.listReports(type, entityId);
  }

  @Get(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Obtener reporte por ID" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getReport(id);
  }

  @Post("invalidate")
  @Roles("ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Invalidar reportes de una entidad (ej: curso, estudiante)" })
  invalidate(@Body() body: { entityType: string; entityId: string }) {
    return this.service.invalidateReports(body.entityType, body.entityId);
  }
}
