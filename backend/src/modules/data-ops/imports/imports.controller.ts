import {
  Controller, Delete, Get, Post, Param, Query, Body, Req, HttpCode, HttpStatus,
  UseGuards, ParseUUIDPipe, BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes } from "@nestjs/swagger";
import { FastifyRequest } from "fastify";
import { ImportsService } from "./imports.service.js";
import { ImportConfirmDto } from "./dto/import.dto.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";
import { CurrentUser, JwtPayload } from "../../../common/decorators/current-user.decorator.js";

@ApiTags("Imports")
@Controller("imports")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class ImportsController {
  constructor(private readonly service: ImportsService) {}

  @Post("upload/:entityType")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Subir archivo Excel/CSV para importar (students, questions, grades, enrollments)" })
  async upload(
    @Param("entityType") entityType: string,
    @Req() req: FastifyRequest,
    @CurrentUser() user: JwtPayload,
    @Query("institutionId") institutionId?: string,
  ) {
    const data = await (req as unknown as { file: () => Promise<{ toBuffer: () => Promise<Buffer>; filename: string; mimetype: string }> }).file();
    if (!data) throw new BadRequestException("No se recibió ningún archivo");

    const buffer = await data.toBuffer();
    return this.service.uploadFile(buffer, data.filename, entityType, user.sub, institutionId);
  }

  @Get("validate/:importJobId")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Validar y previsualizar datos de una importación" })
  validate(@Param("importJobId") importJobId: string) {
    return this.service.validateAndPreview(importJobId);
  }

  @Post("confirm")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Confirmar y ejecutar importación" })
  confirm(@Body() dto: ImportConfirmDto) {
    return this.service.executeImport(dto.importJobId, dto.skipErrors ?? false);
  }

  @Post("revert")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Revertir importación completada" })
  revert(@Body() dto: { importJobId: string }) {
    return this.service.revertImport(dto.importJobId);
  }

  @Delete(":importJobId/data")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Eliminar definitivamente los datos creados por una importacion" })
  deleteImportData(
    @Param("importJobId", ParseUUIDPipe) importJobId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.deleteImportData(importJobId, user.sub);
  }

  @Get()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Listar jobs de importación" })
  @ApiQuery({ name: "entityType", required: false })
  list(
    @CurrentUser() user: JwtPayload,
    @Query("entityType") entityType?: string,
    @Query("institutionId") institutionId?: string,
  ) {
    return this.service.listJobs(entityType, user.sub, institutionId);
  }
}
