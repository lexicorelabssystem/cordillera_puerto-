import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { ReportsService } from "./reports.service.js";
import { GenerateReportDto } from "./dto/report.dto.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";
import { CurrentUser, JwtPayload } from "../../../common/decorators/current-user.decorator.js";
import { assertCourseScope, assertInstitutionScope, assertStudentScope, resolveUserScope } from "../../../common/authz/access-scope.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { QueueService } from "../../queue/queue.service.js";

@ApiTags("Reports")
@Controller("reports")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class ReportsController {
  constructor(
    private readonly service: ReportsService,
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  @Post("generate")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Encolar generacion de reporte pedagogico" })
  async generate(@Body() dto: GenerateReportDto, @CurrentUser() user: JwtPayload) {
    const type = dto.type.toUpperCase();
    const format = dto.format?.toUpperCase() || "JSON";
    let entityId: string | null = null;

    switch (type) {
      case "STUDENT":
        if (!dto.studentId) throw new BadRequestException("studentId requerido");
        await assertStudentScope(this.prisma, user, dto.studentId);
        entityId = dto.studentId;
        break;
      case "COURSE":
        if (!dto.courseId) throw new BadRequestException("courseId requerido");
        await assertCourseScope(this.prisma, user, dto.courseId, dto.subjectId);
        entityId = dto.courseId;
        break;
      case "OA":
      case "RISK":
        await this.assertScopedAggregate(dto, user);
        entityId = type === "OA"
          ? dto.learningObjectiveId ?? dto.courseId ?? dto.institutionId ?? null
          : dto.courseId ?? dto.institutionId ?? null;
        break;
      case "INSTITUTIONAL": {
        if (!dto.institutionId) throw new BadRequestException("institutionId requerido");
        const scope = await assertInstitutionScope(this.prisma, user, dto.institutionId);
        if (scope.role === "TEACHER") throw new BadRequestException("Reporte institucional no disponible para docentes");
        entityId = dto.institutionId;
        break;
      }
      default:
        throw new BadRequestException(`Tipo de reporte no soportado: ${dto.type}`);
    }

    const filters = {
      institutionId: dto.institutionId,
      academicYearId: dto.academicYearId,
      courseId: dto.courseId,
      subjectId: dto.subjectId,
      studentId: dto.studentId,
      learningObjectiveId: dto.learningObjectiveId,
      threshold: dto.threshold,
    };
    const report = await this.service.createPendingReport(type, entityId, user.sub, {
      courseId: dto.courseId,
      subjectId: dto.subjectId,
      studentId: dto.studentId,
      format,
      filters,
    });

    try {
      const job = await this.queueService.enqueueReport({
        reportId: report.id,
        type,
        format,
        userId: user.sub,
        ...filters,
      });
      return { ...job, status: "QUEUED" };
    } catch (error) {
      await this.prisma.report.update({ where: { id: report.id }, data: { status: "FAILED" } });
      throw error;
    }
  }

  private async assertScopedAggregate(dto: GenerateReportDto, user: JwtPayload) {
    if (dto.courseId) {
      await assertCourseScope(this.prisma, user, dto.courseId, dto.subjectId);
      return;
    }
    if (dto.institutionId) {
      const scope = await assertInstitutionScope(this.prisma, user, dto.institutionId);
      if (scope.role === "TEACHER") throw new BadRequestException("Docentes deben filtrar por un curso asignado");
      return;
    }
    const scope = await resolveUserScope(this.prisma, user);
    if (scope.isGlobalAdmin) return;
    if (!scope.institutionId) throw new BadRequestException("institutionId o courseId requerido");
    dto.institutionId = scope.institutionId;
  }

  @Get()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Listar reportes generados" })
  @ApiQuery({ name: "type", required: false })
  @ApiQuery({ name: "entityId", required: false })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  list(@Query("type") type?: string, @Query("entityId") entityId?: string, @Query("page") page?: string, @Query("limit") limit?: string) {
    return this.service.listReports(type, entityId, Number(page ?? 1), Number(limit ?? 20));
  }

  @Get(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Obtener reporte por ID" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getReport(id);
  }

  @Post("invalidate")
  @Roles("ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Invalidar reportes de una entidad" })
  invalidate(@Body() body: { entityType: string; entityId: string }) {
    return this.service.invalidateReports(body.entityType, body.entityId);
  }
}