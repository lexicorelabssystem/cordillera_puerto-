import {
  Controller, Get, Post, Body, Param, Query, UseGuards, ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { CalculationsService } from "./calculations.service.js";
import { SetWeightsDto } from "./dto/weight.dto.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";

@ApiTags("Calculations")
@Controller("calculations")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class CalculationsController {
  constructor(private readonly service: CalculationsService) {}

  @Post("weights")
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "Asignar ponderaciones a evaluaciones de un periodo (valida suma = 100%)" })
  setWeights(@Body() dto: SetWeightsDto) {
    return this.service.setAssessmentWeights(dto.periodId, dto.weights);
  }

  @Get("period/:periodId")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Promedios ponderados por estudiante/asignatura en un periodo" })
  @ApiQuery({ name: "courseId", required: false })
  getPeriodAverages(
    @Param("periodId", ParseUUIDPipe) periodId: string,
    @Query("courseId") courseId?: string,
  ) {
    return this.service.getPeriodAverages(periodId, courseId);
  }

  @Get("year/:academicYearId")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Promedio anual ponderado por periodos" })
  @ApiQuery({ name: "courseId", required: false })
  getYearAverage(
    @Param("academicYearId", ParseUUIDPipe) academicYearId: string,
    @Query("courseId") courseId?: string,
  ) {
    return this.service.getYearAverage(academicYearId, courseId);
  }

  @Get("validate-period/:periodId")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Validar que las ponderaciones suman 100% antes de cerrar periodo" })
  validatePeriod(@Param("periodId", ParseUUIDPipe) periodId: string) {
    return this.service.validatePeriodWeights(periodId);
  }

  @Get("student/:studentId/year/:academicYearId")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER", "STUDENT")
  @ApiOperation({ summary: "Resumen anual de un estudiante (promedio por asignatura y periodo)" })
  getStudentYearSummary(
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @Param("academicYearId", ParseUUIDPipe) academicYearId: string,
  ) {
    return this.service.getStudentYearSummary(studentId, academicYearId);
  }
}
