import { Controller, Post, Body, UseGuards, Logger, InternalServerErrorException } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { ExportsService } from "./exports.service.js";
import { ExportRequestDto } from "./dto/export.dto.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";
import { CurrentUser, JwtPayload } from "../../../common/decorators/current-user.decorator.js";
import { QueueService } from "../../queue/queue.service.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { resolveUserScope } from "../../../common/authz/access-scope.js";

@ApiTags("Exports")
@Controller("exports")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class ExportsController {
  private readonly logger = new Logger(ExportsController.name);

  constructor(
    private readonly service: ExportsService,
    private readonly queueService: QueueService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Exportar datos en Excel, CSV o JSON (sincrono, para exportaciones pequenas)" })
  async export(@Body() dto: ExportRequestDto, @CurrentUser() user: JwtPayload) {
    switch (dto.entityType) {
      case "students":
        return this.service.exportStudents(dto.courseId, dto.institutionId, dto.format, user.sub);
      case "grades":
        return this.service.exportGrades(dto.courseId, dto.subjectId, dto.format, user.sub);
      case "questions":
        return this.service.exportQuestions(dto.subjectId, dto.format, user.sub);
      case "courses":
        return this.service.exportCourses(dto.institutionId, dto.academicYearId, dto.format, user.sub);
      default:
        return this.service.exportStudents(dto.courseId, dto.institutionId, dto.format, user.sub);
    }
  }

  @Post("async")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Encolar exportacion en segundo plano (recomendado para grandes volumenes)" })
  async exportAsync(@Body() dto: ExportRequestDto, @CurrentUser() user: JwtPayload) {
    try {
      const scope = await resolveUserScope(this.prisma, user.sub);
      const institutionId = scope.institutionId ?? dto.institutionId ?? null;

      const filters = {
        courseId: dto.courseId ?? null,
        subjectId: dto.subjectId ?? null,
        institutionId: dto.institutionId ?? null,
        academicYearId: dto.academicYearId ?? null,
      };

      this.logger.log(
        `Async export requested by user=${user.sub} entityType=${dto.entityType} format=${dto.format}`,
      );

      const exportJob = await this.prisma.exportJob.create({
        data: {
          entityType: dto.entityType,
          format: dto.format,
          filters,
          status: "PENDING",
          actorId: user.sub,
          institutionId: institutionId ?? null,
        },
      });

      this.logger.log(`ExportJob created id=${exportJob.id}`);

      const result = await this.queueService.enqueueExport({
        entityType: dto.entityType,
        format: dto.format,
        courseId: dto.courseId,
        subjectId: dto.subjectId,
        institutionId: dto.institutionId,
        academicYearId: dto.academicYearId,
        userId: user.sub,
        exportJobId: exportJob.id,
      });

      this.logger.log(`Export job enqueued exportJobId=${result.exportJobId} bullJobId=${result.bullJobId}`);

      return {
        exportJobId: result.exportJobId,
        bullJobId: result.bullJobId,
        status: "QUEUED",
        message: "La exportacion se esta procesando. Consulta el estado en GET /jobs/exports/:id",
      };
    } catch (error) {
      this.logger.error(
        `Export async failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException("Error al encolar la exportacion asincrona");
    }
  }
}
