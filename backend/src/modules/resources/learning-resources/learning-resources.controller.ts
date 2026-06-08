import {
  Controller, Get, Post, Patch, Body, Param, Query, HttpCode, HttpStatus,
  UseGuards, ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { ResourceType } from "@prisma/client";
import { LearningResourcesService } from "./learning-resources.service.js";
import { CreateResourceDto, ResourceUsageDto, UpdateResourceDto } from "./dto/create-resource.dto.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";
import { CurrentUser, JwtPayload } from "../../../common/decorators/current-user.decorator.js";

@ApiTags("Learning Resources")
@Controller("resources")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class LearningResourcesController {
  constructor(private readonly service: LearningResourcesService) {}

  @Post()
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "Crear recurso pedagógico (guía, presentación, prueba imprimible, etc.)" })
  create(@Body() dto: CreateResourceDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  @Get()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Listar recursos con filtros" })
  @ApiQuery({ name: "institutionId", required: false })
  @ApiQuery({ name: "type", required: false, enum: ResourceType })
  @ApiQuery({ name: "subjectId", required: false })
  @ApiQuery({ name: "courseId", required: false })
  @ApiQuery({ name: "learningObjectiveId", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  findAll(
    @Query("institutionId") institutionId?: string,
    @Query("type") type?: ResourceType,
    @Query("subjectId") subjectId?: string,
    @Query("courseId") courseId?: string,
    @Query("learningObjectiveId") learningObjectiveId?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.service.findAll(
      { institutionId, type, subjectId, courseId, learningObjectiveId, search },
      Number(page ?? 1), Number(limit ?? 20),
    );
  }

  @Get("suggest-remedial/:oaId")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Sugerir recursos remediales para un OA" })
  suggestForRemedial(@Param("oaId", ParseUUIDPipe) oaId: string) {
    return this.service.suggestForRemedial(oaId);
  }

  @Get(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Obtener recurso por ID (incluye guía/presentación y clases vinculadas)" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Get(":id/usage")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Historial de uso de un recurso por curso, fecha y profesor" })
  usageHistory(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.usageHistory(id);
  }

  @Patch(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "Actualizar recurso (incrementa versión)" })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateResourceDto) {
    return this.service.update(id, dto);
  }

  @Post(":id/publish")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "Publicar recurso (DRAFT/READY → PUBLISHED)" })
  publish(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.publish(id);
  }

  @Post(":id/mark-used")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "Registrar uso de recurso sin impedir reutilizarlo" })
  markUsed(@Param("id", ParseUUIDPipe) id: string, @Body() dto: ResourceUsageDto, @CurrentUser() user: JwtPayload) {
    return this.service.markUsed(id, dto, user.sub);
  }

  @Post(":id/archive")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "Archivar recurso" })
  archive(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.archive(id, user.sub);
  }
}
