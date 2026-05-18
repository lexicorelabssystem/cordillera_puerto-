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

@ApiTags("Enrollments")
@Controller("enrollments")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class EnrollmentsController {
  constructor(private readonly service: EnrollmentsService) {}

  @Post()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION")
  @ApiOperation({ summary: "Matricular estudiante en un curso" })
  create(@Body() dto: CreateEnrollmentDto) {
    return this.service.create(dto);
  }

  @Get("student/:studentId")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER", "STUDENT")
  @ApiOperation({ summary: "Listar matrículas activas de un estudiante" })
  findByStudent(@Param("studentId", ParseUUIDPipe) studentId: string) {
    return this.service.findByStudent(studentId);
  }

  @Get("course/:courseId")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Listar matrículas activas de un curso" })
  findByCourse(@Param("courseId", ParseUUIDPipe) courseId: string) {
    return this.service.findByCourse(courseId);
  }

  @Get(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Obtener matrícula por ID" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Patch(":id/withdraw")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION")
  @ApiOperation({ summary: "Retirar estudiante de un curso" })
  withdraw(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.withdraw(id);
  }

  @Post(":id/transfer")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION")
  @ApiOperation({ summary: "Transferir estudiante a otro curso" })
  transfer(@Param("id", ParseUUIDPipe) id: string, @Body() dto: TransferEnrollmentDto) {
    return this.service.transfer(id, dto);
  }
}
