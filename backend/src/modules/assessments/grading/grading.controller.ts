import {
  Controller, Get, Post, Patch, Body, Param, HttpCode, HttpStatus, UseGuards, ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { GradingService } from "./grading.service.js";
import { GradeAnswerDto, BulkGradeDto } from "./dto/grade.dto.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";
import { CurrentUser, JwtPayload } from "../../../common/decorators/current-user.decorator.js";

class UpdateGradeDto {
  grade!: number;
  comments?: string;
}

@ApiTags("Grading")
@Controller("grading")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class GradingController {
  constructor(private readonly service: GradingService) {}

  @Post("answer/:answerId")
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Calificar una respuesta manualmente" })
  gradeAnswer(
    @Param("answerId", ParseUUIDPipe) answerId: string,
    @Body() dto: GradeAnswerDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.gradeAnswer(answerId, user.sub, dto.score, dto.feedback, dto.status);
  }

  @Post("bulk")
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Calificación masiva de respuestas" })
  bulkGrade(@Body() dto: BulkGradeDto, @CurrentUser() user: JwtPayload) {
    return this.service.bulkGradeAnswers(dto.grades, user.sub);
  }

  @Get("pending/:assessmentId")
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Listar respuestas pendientes de corrección manual" })
  getPending(@Param("assessmentId", ParseUUIDPipe) assessmentId: string, @CurrentUser() user: JwtPayload) {
    return this.service.getPendingGrading(assessmentId, user.sub);
  }

  @Post("recalculate/:assessmentId")
  @HttpCode(HttpStatus.OK)
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Recalcular puntajes y notas de toda la evaluación" })
  recalculate(
    @Param("assessmentId", ParseUUIDPipe) assessmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.recalculateAssessment(assessmentId, user.sub);
  }

  @Post("void-question/:assessmentId/:questionId")
  @HttpCode(HttpStatus.OK)
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Anular pregunta y recalcular evaluación" })
  voidQuestion(
    @Param("assessmentId", ParseUUIDPipe) assessmentId: string,
    @Param("questionId", ParseUUIDPipe) questionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.voidQuestion(assessmentId, questionId, user.sub);
  }

  @Get("summary/:assessmentId")
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Resumen de corrección de una evaluación (estadísticas por estado)" })
  getSummary(@Param("assessmentId", ParseUUIDPipe) assessmentId: string, @CurrentUser() user: JwtPayload) {
    return this.service.getGradingSummary(assessmentId, user.sub);
  }

  @Patch("grades/:gradeId")
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Actualizar nota y comentario de un registro Grade" })
  updateGrade(
    @Param("gradeId", ParseUUIDPipe) gradeId: string,
    @Body() dto: UpdateGradeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateGradeRecord(gradeId, dto.grade, dto.comments, user.sub);
  }
}
