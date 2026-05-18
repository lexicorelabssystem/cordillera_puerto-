import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus,
  UseGuards, ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { TeachersService } from "./teachers.service.js";
import { CreateTeacherDto, UpdateTeacherDto, AssignTeacherDto } from "./dto/create-teacher.dto.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";
import { CurrentUser, JwtPayload } from "../../../common/decorators/current-user.decorator.js";

@ApiTags("Teachers")
@Controller("teachers")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class TeachersController {
  constructor(private readonly service: TeachersService) {}

  @Post()
  @Roles("ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Crear profesor (crea User + Teacher)" })
  create(@Body() dto: CreateTeacherDto) {
    return this.service.create(dto);
  }

  @Get()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Listar profesores con búsqueda" })
  @ApiQuery({ name: "search", required: false })
  findAll(@Query("search") search?: string) {
    return this.service.findAll(search);
  }

  @Get("my/assignments")
  @Roles("TEACHER")
  @ApiOperation({ summary: "Obtener asignaciones del profesor autenticado" })
  getMyAssignments(@CurrentUser() user: JwtPayload) {
    return this.service.getMyAssignments(user.sub);
  }

  @Get(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Obtener profesor por ID (incluye asignaciones)" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Patch(":id")
  @Roles("ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Actualizar profesor" })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateTeacherDto) {
    return this.service.update(id, dto);
  }

  @Get(":id/assignments")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Listar asignaciones curso/asignatura del profesor" })
  getAssignments(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getAssignments(id);
  }

  @Post("assignments")
  @Roles("ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Asignar profesor a curso y asignatura" })
  assignToCourse(@Body() dto: AssignTeacherDto) {
    return this.service.assignToCourse(dto);
  }

  @Delete("assignments/:assignmentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles("ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Eliminar asignación profesor-curso-asignatura" })
  removeAssignment(@Param("assignmentId", ParseUUIDPipe) assignmentId: string) {
    return this.service.removeAssignment(assignmentId);
  }
}
