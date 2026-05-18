import {
  Controller, Get, Post, Patch, Body, Param, Query, HttpCode, HttpStatus,
  UseGuards, ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { GradeChangeRequestsService } from "./grade-change-requests.service.js";
import {
  CreateGradeChangeRequestDto,
  ReviewGradeChangeRequestDto,
  GradeChangeRequestFilterDto,
} from "./dto/grade-change-request.dto.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";
import { CurrentUser, JwtPayload } from "../../../common/decorators/current-user.decorator.js";

@ApiTags("Grade Change Requests")
@Controller("grade-change-requests")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class GradeChangeRequestsController {
  constructor(private readonly service: GradeChangeRequestsService) {}

  @Post()
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Solicitar cambio de nota" })
  create(
    @Body() dto: CreateGradeChangeRequestDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.create(dto, user.sub);
  }

  @Get()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Listar solicitudes de cambio de nota" })
  findAll(@Query() filters: GradeChangeRequestFilterDto) {
    return this.service.findAll(filters);
  }

  @Get("pending")
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Listar solicitudes pendientes del profesor autenticado" })
  findMyPending(@CurrentUser() user: JwtPayload) {
    return this.service.findAll({ status: "PENDING" });
  }

  @Get(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Obtener detalle de solicitud" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(":id/approve")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Aprobar solicitud de cambio de nota" })
  approve(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReviewGradeChangeRequestDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.approve(id, user.sub, dto.reviewNotes);
  }

  @Patch(":id/reject")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Rechazar solicitud de cambio de nota" })
  reject(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReviewGradeChangeRequestDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.reject(id, user.sub, dto.reviewNotes);
  }
}
