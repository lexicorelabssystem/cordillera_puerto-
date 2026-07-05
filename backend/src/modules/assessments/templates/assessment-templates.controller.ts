import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { FastifyReply, FastifyRequest } from "fastify";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";
import { CurrentUser, JwtPayload } from "../../../common/decorators/current-user.decorator.js";
import { AssessmentTemplatesService } from "./assessment-templates.service.js";
import {
  CreateAssessmentFromTemplateDto,
  UpdateAssessmentTemplateDto,
  UpsertAssessmentTemplateQuestionDto,
} from "./assessment-templates.dto.js";

type UploadedFile = {
  toBuffer: () => Promise<Buffer>;
  filename: string;
  mimetype: string;
};

@ApiTags("Assessment Templates")
@Controller("assessment-templates")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class AssessmentTemplatesController {
  constructor(private readonly service: AssessmentTemplatesService) {}

  @Post("upload")
  @Roles("ADMIN", "SUPER_ADMIN", "UTP")
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Subir PDF o Word .docx al banco institucional de pruebas" })
  async upload(
    @Req() req: FastifyRequest,
    @CurrentUser() user: JwtPayload,
    @Query("title") title?: string,
    @Query("description") description?: string,
    @Query("institutionId") institutionId?: string,
    @Query("subjectId") subjectId?: string,
    @Query("gradeLevel") gradeLevel?: string,
  ) {
    const data = await (req as unknown as { file: () => Promise<UploadedFile | undefined> }).file();
    if (!data) throw new BadRequestException("No se recibio archivo");
    const buffer = await data.toBuffer();

    return this.service.upload({
      buffer,
      fileName: data.filename,
      mimeType: data.mimetype,
      title,
      description,
      institutionId,
      subjectId,
      gradeLevel: gradeLevel ? Number(gradeLevel) : undefined,
      user,
    });
  }

  @Get()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Listar banco de pruebas compartido" })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query("institutionId") institutionId?: string,
    @Query("subjectId") subjectId?: string,
    @Query("gradeLevel") gradeLevel?: string,
    @Query("status") status?: string,
    @Query("search") search?: string,
  ) {
    return this.service.findAll({
      institutionId,
      subjectId,
      gradeLevel: gradeLevel ? Number(gradeLevel) : undefined,
      status,
      search,
    }, user);
  }

  @Get(":id/source/download")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Descargar archivo fuente de la plantilla" })
  async downloadSource(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Res() reply: FastifyReply,
  ) {
    const info = await this.service.downloadSource(id, user);
    reply.header("Content-Type", info.mimeType);
    reply.header("Content-Length", String(info.size));
    reply.header("Content-Disposition", `attachment; filename="${info.originalName}"`);
    reply.send(info.stream);
  }
  @Get(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Ver detalle de plantilla con preguntas y alternativas" })
  findOne(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findById(id, user);
  }

  @Patch(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Actualizar metadatos de plantilla en borrador" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssessmentTemplateDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user);
  }

  @Post(":id/questions")
  @Roles("ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Agregar pregunta manual a plantilla" })
  addQuestion(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpsertAssessmentTemplateQuestionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.addQuestion(id, dto, user);
  }

  @Put(":id/questions/:questionId")
  @Roles("ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Editar pregunta detectada de plantilla" })
  updateQuestion(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("questionId", ParseUUIDPipe) questionId: string,
    @Body() dto: UpsertAssessmentTemplateQuestionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateQuestion(id, questionId, dto, user);
  }

  @Delete(":id/questions/:questionId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles("ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Eliminar pregunta mal detectada de plantilla" })
  deleteQuestion(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("questionId", ParseUUIDPipe) questionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.deleteQuestion(id, questionId, user);
  }

  @Post(":id/publish")
  @Roles("ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Publicar plantilla validada para todos los profesores" })
  publish(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.publish(id, user);
  }

  @Post(":id/archive")
  @Roles("ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Archivar plantilla compartida" })
  archive(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.archive(id, user);
  }

  @Delete(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Eliminar plantilla definitivamente del banco" })
  delete(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.delete(id, user);
  }

  @Post(":id/create-assessment")
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "Crear evaluacion de curso desde una plantilla publicada" })
  createAssessment(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateAssessmentFromTemplateDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createAssessment(id, dto, user);
  }
}
