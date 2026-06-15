import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus,
  UseGuards, ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { AssessmentType } from "@prisma/client";
import { AssessmentsService } from "./assessments.service.js";
import {
  AssessmentItemDto,
  CreateAssessmentDto,
  ReorderItemsDto,
  UpdateAssessmentDto,
  UpdateAssessmentQuestionDto,
} from "./dto/create-assessment.dto.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";
import { CurrentUser, JwtPayload } from "../../../common/decorators/current-user.decorator.js";

@ApiTags("Assessments")
@Controller("assessments")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class AssessmentsController {
  constructor(private readonly service: AssessmentsService) {}

  // ─── CRUD ────────────────────────────────────────────

  @Post()
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "Crear evaluación en estado DRAFT" })
  create(@Body() dto: CreateAssessmentDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub, user.role);
  }

  @Get()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Listar evaluaciones con filtros" })
  @ApiQuery({ name: "courseId", required: false })
  @ApiQuery({ name: "subjectId", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "assessmentType", required: false, enum: AssessmentType })
  @ApiQuery({ name: "teacherId", required: false })
  @ApiQuery({ name: "periodId", required: false })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query("courseId") courseId?: string,
    @Query("subjectId") subjectId?: string,
    @Query("status") status?: string,
    @Query("assessmentType") assessmentType?: string,
    @Query("teacherId") teacherId?: string,
    @Query("periodId") periodId?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.service.findAll(
      { courseId, subjectId, status, assessmentType, teacherId, periodId },
      Number(page ?? 1), Number(limit ?? 20), user,
    );
  }

  @Get(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER", "STUDENT")
  @ApiOperation({ summary: "Obtener evaluación por ID (incluye preguntas sin respuestas correctas para estudiantes)" })
  findOne(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findById(id, user);
  }

  @Patch(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "Actualizar metadatos de evaluación" })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateAssessmentDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles("ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Archivar evaluación (soft delete cuando tiene intentos)" })
  remove(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.softDelete(id, user);
  }

  // ─── STATE MACHINE ───────────────────────────────────

  @Post(":id/publish")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "DRAFT → PUBLISHED (requiere preguntas, fechas y periodo si sumativa)" })
  publish(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.publish(id, user);
  }

  @Post(":id/activate")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "PUBLISHED → ACTIVE (requiere preguntas, puntaje máximo > 0)" })
  activate(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.activate(id, user);
  }

  @Post(":id/close")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "ACTIVE → CLOSED (cierra recepción de respuestas)" })
  close(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.close(id, user);
  }

  @Post(":id/start-grading")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "CLOSED → IN_GRADING" })
  startGrading(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.startGrading(id, user);
  }

  @Post(":id/mark-graded")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "IN_GRADING → GRADED (requiere notas registradas)" })
  markGraded(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.markGraded(id, user);
  }

  @Post(":id/mark-reported")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "GRADED → REPORTED" })
  markReported(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.markReported(id, user);
  }

  @Post(":id/archive")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "REPORTED → ARCHIVED" })
  archive(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.archive(id, user);
  }

  @Post(":id/revert-to-draft")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "PUBLISHED → DRAFT (solo si no tiene intentos)" })
  revertToDraft(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.revertToDraft(id, user);
  }

  // ─── ASSESSMENT ITEMS ─────────────────────────────────

  @Post(":id/items")
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "Agregar preguntas a evaluación (solo en DRAFT)" })
  addItems(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: { items: AssessmentItemDto[] },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.addItems(id, dto.items, user);
  }

  @Delete(":id/items/:questionId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "Quitar pregunta de evaluación (solo en DRAFT)" })
  removeItem(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("questionId", ParseUUIDPipe) questionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.removeItem(id, questionId, user);
  }

  @Post(":id/items/reorder")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "Reordenar preguntas de evaluación" })
  reorderItems(@Param("id", ParseUUIDPipe) id: string, @Body() dto: ReorderItemsDto, @CurrentUser() user: JwtPayload) {
    return this.service.reorderItems(id, dto, user);
  }

  @Patch(":id/questions/:questionId")
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "Editar enunciado, puntaje, alternativas y pauta antes de publicar" })
  updateQuestion(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("questionId", ParseUUIDPipe) questionId: string,
    @Body() dto: UpdateAssessmentQuestionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateQuestion(id, questionId, dto, user);
  }
}
