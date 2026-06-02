import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { AttendanceService } from "./attendance.service.js";
import { CreateAttendanceDto, BulkAttendanceDto, UpdateAttendanceDto } from "./dto/attendance.dto.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";
import { CurrentUser, JwtPayload } from "../../../common/decorators/current-user.decorator.js";

@ApiTags("Attendance")
@Controller("attendance")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  @Post()
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Registrar asistencia individual" })
  create(@Body() dto: CreateAttendanceDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user);
  }

  @Post("bulk")
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Registrar asistencia masiva para un curso en una fecha" })
  createBulk(@Body() dto: BulkAttendanceDto, @CurrentUser() user: JwtPayload) {
    return this.service.createBulk(dto, user);
  }

  @Get()
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Listar asistencia por curso y fecha" })
  @ApiQuery({ name: "courseId", required: false })
  @ApiQuery({ name: "date", required: false })
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "to", required: false })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query("courseId") courseId?: string,
    @Query("date") date?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.service.findAll({ courseId, date, from, to }, user);
  }

  @Get("student/:studentId")
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "STUDENT")
  @ApiOperation({ summary: "Obtener asistencia de un alumno" })
  @ApiQuery({ name: "courseId", required: false })
  findByStudent(
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @CurrentUser() user: JwtPayload,
    @Query("courseId") courseId?: string,
  ) {
    return this.service.findByStudent(studentId, courseId, user);
  }

  @Get("stats/:studentId")
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "STUDENT")
  @ApiOperation({ summary: "Estadísticas de asistencia de un alumno" })
  getStats(@Param("studentId", ParseUUIDPipe) studentId: string, @CurrentUser() user: JwtPayload) {
    return this.service.getStudentStats(studentId, user);
  }

  @Patch(":id")
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Actualizar estado de asistencia" })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateAttendanceDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user);
  }
}
