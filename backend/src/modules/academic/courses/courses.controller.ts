import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { CoursesService } from "./courses.service.js";
import { CreateCourseDto, UpdateCourseDto } from "./dto/create-course.dto.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";
import { CurrentUser, JwtPayload } from "../../../common/decorators/current-user.decorator.js";

@ApiTags("Courses")
@Controller("courses")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class CoursesController {
  constructor(private readonly service: CoursesService) {}

  @Post()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Crear curso" })
  create(@Body() dto: CreateCourseDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user);
  }

  @Get()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Listar cursos con filtros" })
  @ApiQuery({ name: "institutionId", required: false })
  @ApiQuery({ name: "academicYearId", required: false })
  @ApiQuery({ name: "gradeLevel", required: false, type: Number })
  @ApiQuery({ name: "includeInactive", required: false, type: Boolean })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query("institutionId") institutionId?: string,
    @Query("academicYearId") academicYearId?: string,
    @Query("gradeLevel") gradeLevel?: string,
    @Query("includeInactive") includeInactive?: string,
  ) {
    return this.service.findAll({
      institutionId,
      academicYearId,
      gradeLevel: gradeLevel ? Number(gradeLevel) : undefined,
      includeInactive: includeInactive === "true",
    }, user);
  }

  @Get(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Obtener curso por ID (incluye estudiantes y docentes)" })
  findOne(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findById(id, user);
  }

  @Patch(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Actualizar curso" })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateCourseDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user);
  }

  @Delete(":id/permanent")
  @HttpCode(HttpStatus.OK)
  @Roles("SUPER_ADMIN")
  @ApiOperation({ summary: "Eliminar curso definitivamente si no tiene dependencias" })
  removePermanent(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.deletePermanent(id, user);
  }

  @Get(":id/students")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Listar estudiantes de un curso" })
  getStudents(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.getStudentsByCourse(id, user);
  }
}
