import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus,
  UseGuards, ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { CurriculumUnitsService } from "./curriculum-units.service.js";
import { CreateUnitDto, UpdateUnitDto } from "./dto/create-unit.dto.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";

@ApiTags("Curriculum")
@Controller("curriculum-units")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class CurriculumUnitsController {
  constructor(private readonly service: CurriculumUnitsService) {}

  @Post()
  @Roles("ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Crear unidad curricular" })
  create(@Body() dto: CreateUnitDto) {
    return this.service.create(dto);
  }

  @Get("subject/:subjectId")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Listar unidades curriculares de una asignatura" })
  @ApiQuery({ name: "gradeLevel", required: false, type: Number })
  findBySubject(
    @Param("subjectId", ParseUUIDPipe) subjectId: string,
    @Query("gradeLevel") gradeLevel?: string,
  ) {
    return this.service.findBySubject(subjectId, gradeLevel ? Number(gradeLevel) : undefined);
  }

  @Get(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Obtener unidad curricular por ID" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Patch(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Actualizar unidad curricular" })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateUnitDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles("ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Eliminar unidad curricular" })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
