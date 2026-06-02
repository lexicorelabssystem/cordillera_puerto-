import {
  Controller, Get, Post, Patch, Body, Param, HttpCode, HttpStatus,
  UseGuards, ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { EnrollmentsService } from "./enrollments.service.js";
import { CreateEnrollmentDto, TransferEnrollmentDto } from "./dto/create-enrollment.dto.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";
import { CurrentUser, JwtPayload } from "../../../common/decorators/current-user.decorator.js";

@ApiTags("Enrollments")
@Controller("enrollments")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class EnrollmentsController {
  constructor(private readonly service: EnrollmentsService) {}

  @Post()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION")
  @ApiOperation({ summary: "Matricular estudiante en un curso" })
  create(@Body() dto: CreateEnrollmentDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user);
  }

  @Get("student/:studentId")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER", "STUDENT")
  @ApiOperation({ summary: "Listar matrículas activas de un estudiante" })
  findByStudent(@Param("studentId", ParseUUIDPipe) studentId: string, @CurrentUser() user: JwtPayload) {
    return this.service.findByStudent(studentId, user);
  }

  @Get("course/:courseId")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Listar matrículas activas de un curso" })
  findByCourse(@Param("courseId", ParseUUIDPipe) courseId: string, @CurrentUser() user: JwtPayload) {
    return this.service.findByCourse(courseId, user);
  }

  @Get(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Obtener matrícula por ID" })
  findOne(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findById(id, user);
  }

  @Patch(":id/withdraw")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION")
  @ApiOperation({ summary: "Retirar estudiante de un curso" })
  withdraw(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.withdraw(id, user);
  }

  @Post(":id/transfer")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION")
  @ApiOperation({ summary: "Transferir estudiante a otro curso" })
  transfer(@Param("id", ParseUUIDPipe) id: string, @Body() dto: TransferEnrollmentDto, @CurrentUser() user: JwtPayload) {
    return this.service.transfer(id, dto, user);
  }
}
