import {
  Controller, Get, Post, Patch, Body, Param, Query, HttpCode, HttpStatus, UseGuards, ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsString, IsOptional, Min, Max } from "class-validator";
import { GradingService } from "./grading.service.js";
import { GradeAnswerDto, BulkGradeDto, DirectGradeDto, BulkDirectGradeDto } from "./dto/grade.dto.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";
import { CurrentUser, JwtPayload } from "../../../common/decorators/current-user.decorator.js";
import { QueueService } from "../../queue/queue.service.js";

class UpdateGradeDto {
  @ApiProperty({ description: "Nota entre 1.0 y 7.0" })
  @IsNumber()
  @Min(1.0)
  @Max(7.0)
  grade!: number;

  @ApiPropertyOptional({ description: "Comentario u observacion" })
  @IsOptional()
  @IsString()
  comments?: string;

  @ApiPropertyOptional({ description: "Motivo del cambio de nota" })
  @IsOptional()
  @IsString()
  reason?: string;
}

@ApiTags("Grading")
@Controller("grading")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class GradingController {
  constructor(
    private readonly service: GradingService,
    private readonly queueService: QueueService,
  ) {}

  @Post("answer/:answerId")
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Calificar una respuesta manualmente" })
  gradeAnswer(
    @Param("answerId", ParseUUIDPipe) answerId: string,
    @Body() dto: GradeAnswerDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.gradeAnswer(answerId, user.sub, dto.score, dto.feedback, dto.status);
  }

  @Post("bulk")
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Calificación masiva de respuestas" })
  bulkGrade(@Body() dto: BulkGradeDto, @CurrentUser() user: JwtPayload) {
    return this.service.bulkGradeAnswers(dto.grades, user.sub);
  }

  @Get("pending/:assessmentId")
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Listar respuestas pendientes de corrección manual" })
  getPending(@Param("assessmentId", ParseUUIDPipe) assessmentId: string, @CurrentUser() user: JwtPayload) {
    return this.service.getPendingGrading(assessmentId, user.sub);
  }

  @Post("recalculate/:assessmentId")
  @HttpCode(HttpStatus.OK)
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Encolar recalculo de puntajes y notas de toda la evaluacion (procesado en segundo plano)" })
  async recalculate(
    @Param("assessmentId", ParseUUIDPipe) assessmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.queueService.enqueueRecalculation({
      assessmentId,
      teacherUserId: user.sub,
    });
    return {
      bullJobId: result.bullJobId,
      assessmentId,
      status: "QUEUED",
      message: "El recalculo se esta procesando en segundo plano. Consulta el estado en GET /jobs/background/:id",
    };
  }

  @Post("void-question/:assessmentId/:questionId")
  @HttpCode(HttpStatus.OK)
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Anular pregunta y recalcular evaluación" })
  voidQuestion(
    @Param("assessmentId", ParseUUIDPipe) assessmentId: string,
    @Param("questionId", ParseUUIDPipe) questionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.voidQuestion(assessmentId, questionId, user.sub);
  }

  @Get("summary/:assessmentId")
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Resumen de corrección de una evaluación (estadísticas por estado)" })
  getSummary(@Param("assessmentId", ParseUUIDPipe) assessmentId: string, @CurrentUser() user: JwtPayload) {
    return this.service.getGradingSummary(assessmentId, user.sub);
  }

  @Patch("grades/:gradeId")
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Actualizar nota y comentario de un registro Grade" })
  updateGrade(
    @Param("gradeId", ParseUUIDPipe) gradeId: string,
    @Body() dto: UpdateGradeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateGradeRecord(gradeId, dto.grade, dto.comments, user.sub, dto.reason);
  }

  @Get("course-book/:courseId")
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Libro de evaluaciones: estudiantes, evaluaciones, notas y estadisticas de un curso" })
  @ApiQuery({ name: "subjectId", required: false })
  getCourseGradeBook(
    @Param("courseId", ParseUUIDPipe) courseId: string,
    @CurrentUser() user: JwtPayload,
    @Query("subjectId") subjectId?: string,
  ) {
    return this.service.getCourseGradeBook(courseId, subjectId, user.sub);
  }

  // ══════════════════════════════════════════════════════
  //  DIRECT GRADE — Crear/actualizar nota desde el Libro
  // ══════════════════════════════════════════════════════

  @Post("direct-grade")
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Crear o actualizar una nota directamente (sin intento previo)" })
  directGrade(@Body() dto: DirectGradeDto, @CurrentUser() user: JwtPayload) {
    return this.service.directGradeRecord(dto.assessmentId, dto.studentId, dto.grade, user.sub, dto.comments, dto.reason);
  }

  @Post("direct-grades/bulk")
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Crear o actualizar multiples notas directamente (carga masiva desde el libro)" })
  bulkDirectGrades(@Body() dto: BulkDirectGradeDto, @CurrentUser() user: JwtPayload) {
    return this.service.bulkDirectGrades(dto.grades, user.sub);
  }
}
