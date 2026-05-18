import {
  Controller, Get, Post, Patch, Put, Delete, Body, Param, Query, HttpCode, HttpStatus,
  UseGuards, ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiBody } from "@nestjs/swagger";
import { QuestionType } from "@prisma/client";
import { QuestionBankService } from "./question-bank.service.js";
import { CreateQuestionDto, UpdateQuestionDto } from "./dto/create-question.dto.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";

@ApiTags("Question Bank")
@Controller("questions")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class QuestionBankController {
  constructor(private readonly service: QuestionBankService) {}

  @Post()
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "Crear pregunta con opciones" })
  create(@Body() dto: CreateQuestionDto) {
    return this.service.create(dto);
  }

  @Get()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Listar preguntas con filtros avanzados" })
  @ApiQuery({ name: "subjectId", required: false })
  @ApiQuery({ name: "learningObjectiveId", required: false })
  @ApiQuery({ name: "axisId", required: false })
  @ApiQuery({ name: "type", required: false, enum: QuestionType })
  @ApiQuery({ name: "difficulty", required: false, type: Number })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  findAll(
    @Query("subjectId") subjectId?: string,
    @Query("learningObjectiveId") learningObjectiveId?: string,
    @Query("axisId") axisId?: string,
    @Query("type") type?: QuestionType,
    @Query("difficulty") difficulty?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.service.findAll(
      { subjectId, learningObjectiveId, axisId, type, difficulty: difficulty ? Number(difficulty) : undefined, search },
      Number(page ?? 1),
      Number(limit ?? 20),
    );
  }

  @Get("oa-coverage")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Verificar cobertura de preguntas por OA" })
  @ApiQuery({ name: "subjectId", required: true })
  @ApiQuery({ name: "gradeLevel", required: true, type: Number })
  checkOaCoverage(
    @Query("subjectId") subjectId: string,
    @Query("gradeLevel") gradeLevel: string,
  ) {
    return this.service.checkOaCoverage(subjectId, Number(gradeLevel));
  }

  @Get(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Obtener pregunta por ID (incluye opciones y evaluaciones donde se usa)" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Patch(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "Actualizar pregunta (bloquea cambios críticos si está en evaluación activa)" })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateQuestionDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles("ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Desactivar pregunta (bloquea si está en evaluación activa)" })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.softDelete(id);
  }

  // ─── OPTIONS ─────────────────────────────────────────

  @Post(":id/options")
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "Agregar una opción a la pregunta" })
  @ApiBody({ schema: { type: "object", properties: { text: { type: "string" }, isCorrect: { type: "boolean" }, sortOrder: { type: "number" } } } })
  addOption(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: { text: string; isCorrect: boolean; sortOrder?: number },
  ) {
    return this.service.addOption(id, body.text, body.isCorrect, body.sortOrder);
  }

  @Put(":id/options")
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "Reemplazar todas las opciones de una pregunta" })
  replaceOptions(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: { options: { text: string; isCorrect: boolean; sortOrder?: number }[] },
  ) {
    return this.service.replaceOptions(id, body.options);
  }

  @Patch("options/:optionId")
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "Actualizar una opción" })
  updateOption(
    @Param("optionId", ParseUUIDPipe) optionId: string,
    @Body() body: { text?: string; isCorrect?: boolean },
  ) {
    return this.service.updateOption(optionId, body.text, body.isCorrect);
  }

  @Delete("options/:optionId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "Eliminar una opción (bloquea si quedarían <2)" })
  deleteOption(@Param("optionId", ParseUUIDPipe) optionId: string) {
    return this.service.deleteOption(optionId);
  }
}
