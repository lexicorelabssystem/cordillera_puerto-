import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus,
  UseGuards, ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { LessonStatus } from "@prisma/client";
import { LessonsService } from "./lessons.service.js";
import { CreateLessonDto, UpdateLessonDto } from "./dto/create-lesson.dto.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";
import { CurrentUser, JwtPayload } from "../../../common/decorators/current-user.decorator.js";

@ApiTags("Lessons")
@Controller("lessons")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class LessonsController {
  constructor(private readonly service: LessonsService) {}

  @Post()
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "Crear clase/sesión planificada" })
  create(@Body() dto: CreateLessonDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  @Get()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER", "STUDENT")
  @ApiOperation({ summary: "Listar clases con filtros (docente ve sus clases, estudiante las de su curso)" })
  @ApiQuery({ name: "courseId", required: false })
  @ApiQuery({ name: "subjectId", required: false })
  @ApiQuery({ name: "status", required: false, enum: LessonStatus })
  @ApiQuery({ name: "dateFrom", required: false })
  @ApiQuery({ name: "dateTo", required: false })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  findAll(
    @Query("courseId") courseId?: string,
    @Query("subjectId") subjectId?: string,
    @Query("status") status?: LessonStatus,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.service.findAll(
      { courseId, subjectId, status, dateFrom, dateTo },
      user!.sub,
      Number(page ?? 1), Number(limit ?? 20),
    );
  }

  @Get(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER", "STUDENT")
  @ApiOperation({ summary: "Obtener clase por ID (incluye recursos vinculados)" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Patch(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "Actualizar planificación de clase" })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateLessonDto) {
    return this.service.update(id, dto);
  }

  @Post(":id/execute")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "Marcar clase como ejecutada (PLANNED/RESCHEDULED → EXECUTED)" })
  execute(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.execute(id);
  }

  @Post(":id/cancel")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "Cancelar clase" })
  cancel(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.cancel(id);
  }

  @Post(":id/reschedule")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "Reprogramar clase" })
  reschedule(@Param("id", ParseUUIDPipe) id: string, @Body() body: { newDate: string }) {
    return this.service.reschedule(id, body.newDate);
  }

  @Post(":id/resources/:resourceId")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "Vincular recurso a clase" })
  addResource(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("resourceId", ParseUUIDPipe) resourceId: string,
  ) {
    return this.service.addResource(id, resourceId);
  }

  @Delete(":id/resources/:resourceId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "Desvincular recurso de clase" })
  removeResource(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("resourceId", ParseUUIDPipe) resourceId: string,
  ) {
    return this.service.removeResource(id, resourceId);
  }
}
