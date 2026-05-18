import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { SubjectsService } from "./subjects.service.js";
import { CreateSubjectDto, UpdateSubjectDto } from "./dto/create-subject.dto.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";

@ApiTags("Subjects")
@Controller("subjects")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class SubjectsController {
  constructor(private readonly service: SubjectsService) {}

  @Post()
  @Roles("ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Crear asignatura" })
  create(@Body() dto: CreateSubjectDto) {
    return this.service.create(dto);
  }

  @Get()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Listar asignaturas" })
  @ApiQuery({ name: "includeInactive", required: false })
  findAll(@Query("includeInactive") includeInactive?: string) {
    return this.service.findAll(includeInactive === "true");
  }

  @Get(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Obtener asignatura por ID" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Patch(":id")
  @Roles("ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Actualizar asignatura" })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateSubjectDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Desactivar asignatura (soft delete)" })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.softDelete(id);
  }
}
