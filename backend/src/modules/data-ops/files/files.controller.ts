import {
  Controller, Get, Post, Delete, Param, Query, Req, Res, HttpCode, HttpStatus,
  UseGuards, ParseUUIDPipe, BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from "@nestjs/swagger";
import { FastifyRequest, FastifyReply } from "fastify";
import { FilesService } from "./files.service.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";
import { CurrentUser, JwtPayload } from "../../../common/decorators/current-user.decorator.js";
import * as fs from "node:fs";

@ApiTags("Files")
@Controller("files")
export class FilesController {
  constructor(private readonly service: FilesService) {}

  @Post("upload")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiBearerAuth("access-token")
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Subir archivo vinculado a una entidad" })
  async upload(
    @Req() req: FastifyRequest,
    @Query("entityType") entityType: string,
    @Query("entityId") entityId: string | null,
    @CurrentUser() user: JwtPayload,
  ) {
    const data = await (req as unknown as { file: () => Promise<{ toBuffer: () => Promise<Buffer>; filename: string; mimetype: string }> }).file();
    if (!data) throw new BadRequestException("No se recibió archivo");
    const buffer = await data.toBuffer();
    return this.service.uploadFile(buffer, data.filename, data.mimetype, entityType || "general", entityId, user.sub);
  }

  @Get("download/:fileName")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER", "STUDENT")
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Descargar archivo por nombre" })
  async download(
    @Param("fileName") fileName: string,
    @CurrentUser() user: JwtPayload,
    @Res() reply: FastifyReply,
  ) {
    const info = await this.service.getDownloadInfo(fileName, user);
    reply.header("Content-Type", info.mimeType);
    reply.header("Content-Disposition", `attachment; filename="${info.originalName}"`);
    reply.send(fs.createReadStream(info.filePath));
  }

  @Get("view/:fileName")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER", "STUDENT")
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Visualizar archivo por nombre en el navegador" })
  async view(
    @Param("fileName") fileName: string,
    @CurrentUser() user: JwtPayload,
    @Res() reply: FastifyReply,
  ) {
    const info = await this.service.getDownloadInfo(fileName, user);
    reply.header("Content-Type", info.mimeType);
    reply.header("Content-Disposition", `inline; filename="${info.originalName}"`);
    reply.send(fs.createReadStream(info.filePath));
  }

  @Get("entity/:entityType/:entityId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Listar archivos de una entidad" })
  listByEntity(
    @Param("entityType") entityType: string,
    @Param("entityId") entityId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.listByEntity(entityType, entityId, user);
  }

  @Delete(":fileId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Eliminar archivo" })
  delete(@Param("fileId", ParseUUIDPipe) fileId: string, @CurrentUser() user: JwtPayload) {
    return this.service.deleteFile(fileId, user);
  }

  @Get("templates/:type/download")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Descargar plantilla de importación (students, questions, grades, enrollments)" })
  async downloadTemplate(@Param("type") type: string, @Res() reply: FastifyReply) {
    const filePath = this.service.getTemplatePath(type);
    const fileName = `plantilla_${type}.csv`;
    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename="${fileName}"`);
    reply.send(fs.createReadStream(filePath));
  }
}
