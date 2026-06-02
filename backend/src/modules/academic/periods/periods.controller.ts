import {
  Controller, Get, Post, Patch, Body, Param, HttpCode, HttpStatus,
  UseGuards, ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { PeriodsService } from "./periods.service.js";
import { CreatePeriodDto, UpdatePeriodDto } from "./dto/create-period.dto.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";
import { CurrentUser, JwtPayload } from "../../../common/decorators/current-user.decorator.js";

@ApiTags("Periods")
@Controller("periods")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class PeriodsController {
  constructor(private readonly service: PeriodsService) {}

  @Post()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Crear periodo académico" })
  create(@Body() dto: CreatePeriodDto) {
    return this.service.create(dto);
  }

  @Get("academic-year/:academicYearId")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Listar periodos de un año académico" })
  findByAcademicYear(@Param("academicYearId", ParseUUIDPipe) academicYearId: string) {
    return this.service.findByAcademicYear(academicYearId);
  }

  @Get(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Obtener periodo por ID" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Patch(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Actualizar periodo" })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdatePeriodDto) {
    return this.service.update(id, dto);
  }

  @Post(":id/close")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Cerrar periodo con validaciones" })
  @ApiResponse({ status: 400, description: "No se cumplen condiciones de cierre" })
  close(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.close(id, user.sub);
  }

  @Post(":id/reopen")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Reabrir periodo cerrado" })
  reopen(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.reopen(id, user.sub);
  }
}
