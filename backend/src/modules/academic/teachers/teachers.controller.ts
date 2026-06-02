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
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Crear profesor (crea User + Teacher)" })
  create(@Body() dto: CreateTeacherDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user);
  }

  @Get()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Listar profesores con búsqueda" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "institutionId", required: false })
  @ApiQuery({ name: "includeInactive", required: false, type: Boolean })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query("search") search?: string,
    @Query("institutionId") institutionId?: string,
    @Query("includeInactive") includeInactive?: string,
  ) {
    return this.service.findAll(search, user, { institutionId, includeInactive: includeInactive === "true" });
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
  findOne(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findById(id, user);
  }

  @Patch(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Actualizar profesor" })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateTeacherDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user);
  }

  @Post(":id/retire")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Retirar profesor, opcionalmente quitando asignaciones activas" })
  retire(
    @Param("id", ParseUUIDPipe) id: string,
    @Body("removeAssignments") removeAssignments: boolean | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.retire(id, { removeAssignments: removeAssignments === true }, user);
  }

  @Get(":id/assignments")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Listar asignaciones curso/asignatura del profesor" })
  getAssignments(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.getAssignments(id, user);
  }

  @Post("assignments")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Asignar profesor a curso y asignatura" })
  assignToCourse(@Body() dto: AssignTeacherDto, @CurrentUser() user: JwtPayload) {
    return this.service.assignToCourse(dto, user);
  }

  @Delete("assignments/:assignmentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Eliminar asignación profesor-curso-asignatura" })
  removeAssignment(@Param("assignmentId", ParseUUIDPipe) assignmentId: string, @CurrentUser() user: JwtPayload) {
    return this.service.removeAssignment(assignmentId, user);
  }
}
