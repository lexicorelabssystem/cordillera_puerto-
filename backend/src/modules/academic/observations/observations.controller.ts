import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  HttpCode, HttpStatus, UseGuards, ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { ObservationsService } from "./observations.service.js";
import { CreateObservationDto, UpdateObservationDto } from "./dto/observation.dto.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";
import { CurrentUser, JwtPayload } from "../../../common/decorators/current-user.decorator.js";

@ApiTags("Observations")
@Controller("observations")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class ObservationsController {
  constructor(private readonly service: ObservationsService) {}

  @Post()
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Crear observación de un alumno" })
  create(@Body() dto: CreateObservationDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  @Get()
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Listar observaciones con filtros" })
  @ApiQuery({ name: "studentId", required: false })
  @ApiQuery({ name: "courseId", required: false })
  @ApiQuery({ name: "type", required: false })
  findAll(
    @Query("studentId") studentId?: string,
    @Query("courseId") courseId?: string,
    @Query("type") type?: string,
  ) {
    return this.service.findAll({ studentId, courseId, type });
  }

  @Get(":id")
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "STUDENT")
  @ApiOperation({ summary: "Obtener observación por ID" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Patch(":id")
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Actualizar observación" })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateObservationDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles("ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Eliminar observación" })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
