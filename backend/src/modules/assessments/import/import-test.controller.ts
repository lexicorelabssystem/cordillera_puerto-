import {
  BadRequestException,
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";
import { CurrentUser, JwtPayload } from "../../../common/decorators/current-user.decorator.js";
import { ImportTestService } from "./import-test.service.js";
import { CommitImportedTestDto, CreateAssessmentFromImportedTestDto } from "./import-test.dto.js";

type UploadedFile = {
  toBuffer: () => Promise<Buffer>;
  filename: string;
  mimetype: string;
};

@ApiTags("Assessments")
@Controller("evaluations/import")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class ImportTestController {
  constructor(private readonly service: ImportTestService) {}

  @Post()
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "UTP")
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Importar PDF o Word .docx de prueba y guardar preguntas detectadas como borrador" })
  async importDocument(
    @Req() req: FastifyRequest,
    @Query("subjectId", ParseUUIDPipe) subjectId: string,
    @Query("courseId") courseId: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    const data = await (req as unknown as { file: () => Promise<UploadedFile | undefined> }).file();
    if (!data) throw new BadRequestException("No se recibio archivo");
    const buffer = await data.toBuffer();

    return this.service.importDocument({
      buffer,
      fileName: data.filename,
      mimeType: data.mimetype,
      fileSize: buffer.byteLength,
      subjectId,
      courseId,
      user,
    });
  }

  @Post(":draftId/commit")
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Guardar preguntas aprobadas del borrador en el banco de preguntas" })
  commitDraft(
    @Param("draftId", ParseUUIDPipe) draftId: string,
    @Body() dto: CommitImportedTestDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.commitDraft(draftId, dto, user);
  }

  @Post(":draftId/create-assessment")
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Crear una evaluacion digital desde un borrador importado validado por el profesor" })
  createAssessment(
    @Param("draftId", ParseUUIDPipe) draftId: string,
    @Body() dto: CreateAssessmentFromImportedTestDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createAssessmentFromDraft(draftId, dto, user);
  }
}

@ApiTags("Assessments")
@Controller("assessments")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class AssessmentUploadController {
  constructor(private readonly service: ImportTestService) {}

  @Post("upload")
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "UTP")
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Subir PDF o Word .docx y analizarlo como borrador de evaluacion" })
  async upload(
    @Req() req: FastifyRequest,
    @Query("subjectId", ParseUUIDPipe) subjectId: string,
    @Query("courseId") courseId: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    const data = await (req as unknown as { file: () => Promise<UploadedFile | undefined> }).file();
    if (!data) throw new BadRequestException("No se recibio archivo");
    const buffer = await data.toBuffer();

    return this.service.importDocument({
      buffer,
      fileName: data.filename,
      mimeType: data.mimetype,
      fileSize: buffer.byteLength,
      subjectId,
      courseId,
      user,
    });
  }
}
