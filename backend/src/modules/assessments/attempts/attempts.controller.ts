import {
  Controller, Get, Post, Body, Param, Query, HttpCode, HttpStatus, UseGuards, ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { AttemptsService } from "./attempts.service.js";
import { SaveAnswersDto, SubmitAttemptDto } from "./dto/answer.dto.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";
import { CurrentUser, JwtPayload } from "../../../common/decorators/current-user.decorator.js";

@ApiTags("Assessment Attempts")
@Controller("attempts")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class AttemptsController {
  constructor(private readonly service: AttemptsService) {}

  // ─── STUDENT ─────────────────────────────────────────

  @Post("start/:assessmentId")
  @Roles("STUDENT")
  @ApiOperation({ summary: "Iniciar intento de evaluación (o continuar uno existente)" })
  startAttempt(@Param("assessmentId", ParseUUIDPipe) assessmentId: string, @CurrentUser() user: JwtPayload) {
    return this.service.startAttempt(assessmentId, user.sub);
  }

  @Post(":id/answers")
  @Roles("STUDENT")
  @ApiOperation({ summary: "Guardar respuestas (auto-save / guardado manual)" })
  saveAnswers(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SaveAnswersDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.saveAnswers(id, user.sub, dto.answers, dto.timeSpentSec);
  }

  @Post(":id/submit")
  @Roles("STUDENT")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Enviar intento (cierre + cálculo automático de puntaje)" })
  submit(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SubmitAttemptDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.submitAttempt(id, user.sub, dto.timeSpentSec, dto.confirmEmpty);
  }

  @Get(":id")
  @Roles("STUDENT", "TEACHER", "ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Obtener estado del intento (incluye respuestas, tiempo restante)" })
  getAttempt(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.getAttempt(id, user.sub);
  }

  // ─── STUDENT HISTORY ─────────────────────────────────

  @Get("student/:studentId")
  @Roles("STUDENT", "TEACHER", "ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Listar intentos de un estudiante" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number, schema: { minimum: 1, maximum: 100 } })
  listByStudent(
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @CurrentUser() user: JwtPayload,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.service.listByStudent(studentId, user.sub, Number(page ?? 1), Number(limit ?? 20));
  }

  // ─── TEACHER ─────────────────────────────────────────

  @Get("assessment/:assessmentId")
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Listar intentos de una evaluacion (profesor)" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number, schema: { minimum: 1, maximum: 100 } })
  listByAssessment(
    @Param("assessmentId", ParseUUIDPipe) assessmentId: string,
    @CurrentUser() user: JwtPayload,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.service.listByAssessment(assessmentId, user.sub, Number(page ?? 1), Number(limit ?? 100));
  }

  @Post("assessment/:assessmentId/force-close")
  @HttpCode(HttpStatus.OK)
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Forzar cierre de todos los intentos abiertos de una evaluación" })
  teacherForceClose(
    @Param("assessmentId", ParseUUIDPipe) assessmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.teacherForceClose(assessmentId, user.sub);
  }

  @Post(":id/cancel")
  @HttpCode(HttpStatus.OK)
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Cancelar un intento específico (profesor)" })
  teacherCancelAttempt(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.teacherCancelAttempt(id, user.sub);
  }
}
