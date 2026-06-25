import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus, Req, Res,
  UseGuards, ParseUUIDPipe, ParseIntPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { FastifyRequest, FastifyReply } from "fastify";
import { SimceService } from "./simce.service.js";
import {
  CreateSimceAssessmentDto, UpdateSimceAssessmentDto,
  SaveAnswerKeyDto, SaveStudentResponsesDto, BatchStudentResponsesDto,
} from "./dto/simce.dto.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../common/guards/roles.guard.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { CurrentUser, JwtPayload } from "../../common/decorators/current-user.decorator.js";
import { QueueService } from "../queue/queue.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

@ApiTags("SIMCE")
@Controller("simce")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class SimceController {
  constructor(
    private readonly service: SimceService,
    private readonly queueService: QueueService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── CRUD SimceAssessment ────────────────────────────

  @Post()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Crear una prueba SIMCE" })
  create(@Body() dto: CreateSimceAssessmentDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  @Get()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Listar pruebas SIMCE" })
  @ApiQuery({ name: "courseId", required: false })
  @ApiQuery({ name: "subjectId", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "teacherId", required: false })
  @ApiQuery({ name: "academicYearId", required: false })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query("courseId") courseId?: string,
    @Query("subjectId") subjectId?: string,
    @Query("status") status?: string,
    @Query("teacherId") teacherId?: string,
    @Query("academicYearId") academicYearId?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.service.findAll(
      { courseId, subjectId, status, teacherId, academicYearId },
      Number(page ?? 1), Number(limit ?? 20), user,
    );
  }

  @Get("student/essays")
  @Roles("STUDENT")
  @ApiOperation({ summary: "Obtener ensayos SIMCE disponibles para el estudiante autenticado" })
  getStudentEssays(@CurrentUser() user: JwtPayload) {
    return this.service.getStudentSimceEssays(user);
  }

  @Get("student/essays/:assessmentId")
  @Roles("STUDENT")
  @ApiOperation({ summary: "Abrir ensayo SIMCE interactivo para responder" })
  getStudentEssay(
    @Param("assessmentId", ParseUUIDPipe) assessmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.getStudentSimceEssay(assessmentId, user);
  }

  @Post("student/essays/:assessmentId/submit")
  @Roles("STUDENT")
  @ApiOperation({ summary: "Enviar respuestas del ensayo SIMCE y obtener resultado automatico" })
  submitStudentEssay(
    @Param("assessmentId", ParseUUIDPipe) assessmentId: string,
    @Body() dto: SaveStudentResponsesDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.submitStudentSimceEssay(assessmentId, dto, user);
  }

  @Get("student/results")
  @Roles("STUDENT")
  @ApiOperation({ summary: "Obtener resultados SIMCE del estudiante autenticado" })
  getStudentResults(@CurrentUser() user: JwtPayload) {
    return this.service.getStudentSimceResults(user);
  }

  @Get("student/results/:assessmentId")
  @Roles("STUDENT")
  @ApiOperation({ summary: "Obtener detalle de resultado SIMCE del estudiante" })
  getStudentResultDetail(
    @Param("assessmentId", ParseUUIDPipe) assessmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.getStudentSimceDetail(assessmentId, user);
  }

  @Get(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER", "STUDENT")
  @ApiOperation({ summary: "Obtener prueba SIMCE por ID" })
  findOne(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findById(id, user);
  }

  @Patch(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Actualizar metadatos de prueba SIMCE" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateSimceAssessmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Eliminar prueba SIMCE" })
  remove(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.delete(id, user);
  }

  // ─── Pauta de corrección ─────────────────────────────

  @Post(":id/answer-key")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Guardar o actualizar pauta de corrección" })
  saveAnswerKey(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SaveAnswerKeyDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.saveAnswerKey(id, dto, user);
  }

  @Get(":id/answer-key")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Obtener pauta de corrección" })
  getAnswerKey(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.getAnswerKey(id, user);
  }

  @Post(":id/answer-key/confirm")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Confirmar pauta y pasar a READY_TO_CORRECT. Pre-procesa el PDF en segundo plano." })
  async confirmAnswerKey(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    const result = await this.service.confirmAnswerKey(id, user);

    const assessment = await this.prisma.simceAssessment.findUnique({
      where: { id },
      select: { pdfFile: { select: { id: true, originalName: true, storagePath: true, mimeType: true } } },
    });

    if (assessment?.pdfFile) {
      this.queueService.enqueueSimcePdfProcessing({
        assessmentId: id,
        pdfFileId: assessment.pdfFile.id,
        userId: user.sub,
      }).catch(() => {});
    }

    return result;
  }

  // ─── Respuestas de estudiantes ───────────────────────

  @Post(":id/responses/:studentId")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Guardar respuestas de un estudiante" })
  saveStudentResponses(
    @Param("id", ParseUUIDPipe) assessmentId: string,
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @Body() dto: SaveStudentResponsesDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.saveStudentResponses(assessmentId, studentId, dto, user);
  }

  @Post(":id/responses/batch")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Guardar respuestas de múltiples estudiantes" })
  batchSaveResponses(
    @Param("id", ParseUUIDPipe) assessmentId: string,
    @Body() dto: BatchStudentResponsesDto[],
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.batchSaveResponses(assessmentId, dto, user);
  }

  // ─── Corrección y resultados ─────────────────────────

  @Post(":id/auto-correct")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Ejecutar auto-corrección para todos los estudiantes" })
  autoCorrect(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.autoCorrectAll(id, user);
  }

  @Get(":id/results")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Resumen de resultados por curso" })
  getResults(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.getResultsSummary(id, user);
  }

  @Get(":id/results/:studentId")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER", "STUDENT")
  @ApiOperation({ summary: "Resultado individual de un estudiante" })
  getStudentResult(
    @Param("id", ParseUUIDPipe) assessmentId: string,
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.getStudentResult(assessmentId, studentId, user);
  }

  // ─── Revisión grupal ─────────────────────────────────

  @Get(":id/review")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Datos para revisión grupal en clases" })
  getGroupReview(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.getGroupReview(id, user);
  }

  @Get(":id/review/:questionNumber")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Estadísticas de una pregunta específica" })
  getQuestionStats(
    @Param("id", ParseUUIDPipe) assessmentId: string,
    @Param("questionNumber", ParseIntPipe) questionNumber: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.getQuestionStats(assessmentId, questionNumber, user);
  }

  // ─── Vista del estudiante ────────────────────────────

  // ─── Exportación ─────────────────────────────────────

  @Get(":id/export/excel")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Exportar resultados SIMCE a Excel" })
  @ApiQuery({ name: "type", required: false, description: "course | student" })
  @ApiQuery({ name: "studentId", required: false, description: "ID del estudiante (requerido si type=student)" })
  async exportExcel(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("type") type: string,
    @Query("studentId") studentId: string | undefined,
    @CurrentUser() user: JwtPayload,
    @Res() reply: FastifyReply,
  ) {
    const exportType = (type === "student" ? "student" : "course") as "course" | "student";
    const result = await this.service.exportResultsExcel(id, exportType, studentId, user);

    const filePath = `uploads/exports/${result.fileName}`;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = await import("node:fs");

    reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    reply.header("Content-Disposition", `attachment; filename="resultados_simce.xlsx"`);
    reply.send(fs.createReadStream(filePath));
  }
}
