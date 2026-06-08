import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  HttpCode, HttpStatus, UseGuards, ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { InstitutionsService } from "./institutions.service.js";
import { CreateInstitutionDto, UpdateInstitutionDto, CreateInstitutionConfigDto, UpdateInstitutionConfigDto } from "./dto/create-institution.dto.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";

@ApiTags("Institutions")
@Controller("institutions")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class InstitutionsController {
  constructor(private readonly service: InstitutionsService) {}

  @Post()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Crear institución" })
  @ApiResponse({ status: 201, description: "Institución creada" })
  @ApiResponse({ status: 409, description: "RBD duplicado" })
  create(@Body() dto: CreateInstitutionDto) {
    return this.service.create(dto);
  }

  @Get()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Listar instituciones" })
  @ApiQuery({ name: "includeInactive", required: false, type: Boolean })
  findAll(@Query("includeInactive") includeInactive?: string) {
    return this.service.findAll(includeInactive === "true");
  }

  @Get(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Obtener institución por ID" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Patch(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Actualizar institución" })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateInstitutionDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id/permanent")
  @HttpCode(HttpStatus.OK)
  @Roles("SUPER_ADMIN")
  @ApiOperation({ summary: "Eliminar institución definitivamente si no tiene dependencias" })
  removePermanent(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.deletePermanent(id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles("ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Eliminar institución (soft delete)" })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.softDelete(id);
  }

  @Get(":id/config")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Obtener configuración de institución (escala de notas, exigencia)" })
  getConfig(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getConfig(id);
  }

  @Patch(":id/config")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Actualizar configuración de institución" })
  updateConfig(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateInstitutionConfigDto) {
    return this.service.upsertConfig(id, dto);
  }
}
