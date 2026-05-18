import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards, ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { CoursesService } from "./courses.service.js";
import { CreateCourseDto, UpdateCourseDto } from "./dto/create-course.dto.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";

@ApiTags("Courses")
@Controller("courses")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class CoursesController {
  constructor(private readonly service: CoursesService) {}

  @Post()
  @Roles("ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Crear curso" })
  create(@Body() dto: CreateCourseDto) {
    return this.service.create(dto);
  }

  @Get()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Listar cursos con filtros" })
  @ApiQuery({ name: "institutionId", required: false })
  @ApiQuery({ name: "academicYearId", required: false })
  @ApiQuery({ name: "gradeLevel", required: false, type: Number })
  findAll(
    @Query("institutionId") institutionId?: string,
    @Query("academicYearId") academicYearId?: string,
    @Query("gradeLevel") gradeLevel?: string,
  ) {
    return this.service.findAll({
      institutionId,
      academicYearId,
      gradeLevel: gradeLevel ? Number(gradeLevel) : undefined,
    });
  }

  @Get(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Obtener curso por ID (incluye estudiantes y docentes)" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Patch(":id")
  @Roles("ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Actualizar curso" })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateCourseDto) {
    return this.service.update(id, dto);
  }

  @Get(":id/students")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Listar estudiantes de un curso" })
  getStudents(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getStudentsByCourse(id);
  }
}
