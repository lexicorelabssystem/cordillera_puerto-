import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  HttpCode, HttpStatus, UseGuards, ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { StudentsService } from "./students.service.js";
import { CreateStudentDto, UpdateStudentDto } from "./dto/create-student.dto.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";
import { CurrentUser, JwtPayload } from "../../../common/decorators/current-user.decorator.js";

@ApiTags("Students")
@Controller("students")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class StudentsController {
  constructor(private readonly service: StudentsService) {}

  @Post()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Crear estudiante y matricularlo en un curso" })
  create(@Body() dto: CreateStudentDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user);
  }

  @Get()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Listar estudiantes con búsqueda y filtro por curso" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "courseId", required: false })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "includeInactive", required: false, type: Boolean })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query("search") search?: string,
    @Query("courseId") courseId?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("includeInactive") includeInactive?: string,
  ) {
    return this.service.findAll(search, courseId, Number(page ?? 1), Number(limit ?? 20), user, includeInactive === "true");
  }

  @Get("me/portal")
  @Roles("STUDENT")
  @ApiOperation({ summary: "Portal personal del estudiante autenticado (notas, semestres, alertas)" })
  getMyPortal(@CurrentUser() user: JwtPayload) {
    return this.service.getMyPortal(user.sub);
  }

  @Get("me/kpi")
  @Roles("STUDENT")
  @ApiOperation({ summary: "KPIs del estudiante autenticado" })
  getMyKpi(@CurrentUser() user: JwtPayload) {
    return this.service.getMyPortal(user.sub).then((portal) => ({
      studentId: portal.student.id,
      avgGrade: portal.overall.avgGrade,
      avgPercent: portal.overall.avgPercent,
      performanceLevel: portal.overall.level,
      totalGrades: portal.overall.totalGrades,
    }));
  }

  @Get(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER", "STUDENT")
  @ApiOperation({ summary: "Obtener estudiante por ID" })
  findOne(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findById(id, user);
  }

  @Patch(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Actualizar estudiante" })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateStudentDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Eliminar estudiante (soft delete)" })
  remove(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.softDelete(id, user);
  }

  @Post(":id/restore")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Reactivar estudiante retirado" })
  restore(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.restore(id, user);
  }
}
