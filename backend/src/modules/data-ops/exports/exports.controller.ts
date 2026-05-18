import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { ExportsService } from "./exports.service.js";
import { ExportRequestDto } from "./dto/export.dto.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";
import { CurrentUser, JwtPayload } from "../../../common/decorators/current-user.decorator.js";

@ApiTags("Exports")
@Controller("exports")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class ExportsController {
  constructor(private readonly service: ExportsService) {}

  @Post()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Exportar datos en Excel, CSV o JSON" })
  async export(@Body() dto: ExportRequestDto, @CurrentUser() user: JwtPayload) {
    switch (dto.entityType) {
      case "students":
        return this.service.exportStudents(dto.courseId, dto.institutionId, dto.format, user.sub);
      case "grades":
        return this.service.exportGrades(dto.courseId, dto.subjectId, dto.format, user.sub);
      case "questions":
        return this.service.exportQuestions(dto.subjectId, dto.format, user.sub);
      case "courses":
        return this.service.exportCourses(dto.institutionId, dto.academicYearId, dto.format, user.sub);
      default:
        return this.service.exportStudents(dto.courseId, dto.institutionId, dto.format, user.sub);
    }
  }
}
