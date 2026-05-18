import {
  Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, HttpStatus,
  UseGuards, ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { AxesService } from "./axes.service.js";
import { CreateAxisDto, UpdateAxisDto } from "./dto/create-axis.dto.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";

@ApiTags("Curriculum")
@Controller("axes")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class AxesController {
  constructor(private readonly service: AxesService) {}

  @Post()
  @Roles("ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Crear eje curricular" })
  create(@Body() dto: CreateAxisDto) {
    return this.service.create(dto);
  }

  @Get("subject/:subjectId")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Listar ejes de una asignatura" })
  findBySubject(@Param("subjectId", ParseUUIDPipe) subjectId: string) {
    return this.service.findBySubject(subjectId);
  }

  @Get(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Obtener eje por ID" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Patch(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Actualizar eje" })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateAxisDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles("ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Eliminar eje (solo si no tiene preguntas asociadas)" })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
