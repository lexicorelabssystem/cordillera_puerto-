import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus,
  UseGuards, ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { LearningObjectivesService } from "./learning-objectives.service.js";
import { CreateLearningObjectiveDto, UpdateLearningObjectiveDto } from "./dto/create-learning-objective.dto.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";

@ApiTags("Curriculum")
@Controller("learning-objectives")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class LearningObjectivesController {
  constructor(private readonly service: LearningObjectivesService) {}

  @Post()
  @Roles("ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Crear objetivo de aprendizaje con habilidades e indicadores" })
  create(@Body() dto: CreateLearningObjectiveDto) {
    return this.service.create(dto);
  }

  @Get()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Listar OA con filtros por asignatura, nivel y eje" })
  @ApiQuery({ name: "subjectId", required: false })
  @ApiQuery({ name: "gradeLevel", required: false, type: Number })
  @ApiQuery({ name: "axisId", required: false })
  findAll(
    @Query("subjectId") subjectId?: string,
    @Query("gradeLevel") gradeLevel?: string,
    @Query("axisId") axisId?: string,
  ) {
    return this.service.findAll({
      subjectId,
      gradeLevel: gradeLevel ? Number(gradeLevel) : undefined,
      axisId,
    });
  }

  @Get(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Obtener OA por ID (incluye habilidades e indicadores)" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Patch(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Actualizar OA (habilidades se reemplazan completamente)" })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateLearningObjectiveDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles("ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Desactivar OA (soft delete)" })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.softDelete(id);
  }
}
