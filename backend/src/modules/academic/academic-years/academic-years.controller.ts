import {
  Controller, Get, Post, Patch, Body, Param, HttpCode, HttpStatus,
  UseGuards, ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { AcademicYearsService } from "./academic-years.service.js";
import { CreateAcademicYearDto, UpdateAcademicYearDto } from "./dto/create-academic-year.dto.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";

@ApiTags("Academic Years")
@Controller("academic-years")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class AcademicYearsController {
  constructor(private readonly service: AcademicYearsService) {}

  @Post()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Crear año académico" })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 409, description: "Ya existe ese año para la institución" })
  create(@Body() dto: CreateAcademicYearDto) {
    return this.service.create(dto);
  }

  @Get("institution/:institutionId")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Listar años académicos de una institución" })
  findByInstitution(@Param("institutionId", ParseUUIDPipe) institutionId: string) {
    return this.service.findByInstitution(institutionId);
  }

  @Get(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Obtener año académico por ID" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Patch(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Actualizar año académico" })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateAcademicYearDto) {
    return this.service.update(id, dto);
  }

  @Post(":id/close")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Cerrar año académico (requiere que todos los periodos estén cerrados)" })
  @ApiResponse({ status: 400, description: "Hay periodos activos" })
  close(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.close(id);
  }

  @Post(":id/reopen")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Reabrir año académico" })
  reopen(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.reopen(id);
  }
}
