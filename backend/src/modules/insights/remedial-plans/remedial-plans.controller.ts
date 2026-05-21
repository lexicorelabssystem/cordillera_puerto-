import {
  Controller, Get, Post, Patch, Body, Param, Query, HttpCode, HttpStatus,
  UseGuards, ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { RemedialPlansService } from "./remedial-plans.service.js";
import { CreateRemedialPlanDto, UpdateRemedialPlanDto, DetectAndSuggestDto } from "./dto/remedial-plan.dto.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";

@ApiTags("Remedial Plans")
@Controller("remedial-plans")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class RemedialPlansController {
  constructor(private readonly service: RemedialPlansService) {}

  @Post()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Crear plan remedial manual" })
  create(@Body() dto: CreateRemedialPlanDto) {
    return this.service.create(dto);
  }

  @Get()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Listar todos los planes remediales" })
  @ApiQuery({ name: "courseId", required: false })
  @ApiQuery({ name: "status", required: false })
  findAll(@Query("courseId") courseId?: string, @Query("status") status?: string) {
    return this.service.findAll(courseId, status);
  }

  @Get("course/:courseId")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Listar planes remediales de un curso" })
  @ApiQuery({ name: "status", required: false })
  findByCourse(@Param("courseId", ParseUUIDPipe) courseId: string, @Query("status") status?: string) {
    return this.service.findByCourse(courseId, status);
  }

  @Get("student/:studentId")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER", "STUDENT")
  @ApiOperation({ summary: "Listar planes remediales de un estudiante" })
  findByStudent(@Param("studentId", ParseUUIDPipe) studentId: string) {
    return this.service.findByStudent(studentId);
  }

  @Get(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Obtener plan remedial por ID" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Patch(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "Actualizar plan remedial" })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateRemedialPlanDto) {
    return this.service.update(id, dto);
  }

  // ─── STATUS ACTIONS ──────────────────────────────────

  @Post(":id/assign")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Asignar plan (PENDING → IN_PROGRESS)" })
  assign(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.assign(id);
  }

  @Post(":id/complete")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "Completar plan (IN_PROGRESS → COMPLETED)" })
  complete(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.complete(id);
  }

  @Post(":id/evaluate")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN", "SUPER_ADMIN", "UTP", "TEACHER")
  @ApiOperation({ summary: "Evaluar efectividad del plan (COMPLETED → EFFECTIVE/NOT_EFFECTIVE)" })
  evaluate(@Param("id", ParseUUIDPipe) id: string, @Body() body: { postScore: number }) {
    return this.service.evaluate(id, body.postScore);
  }

  // ─── DETECTION & BATCH ───────────────────────────────

  @Post("detect")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Detectar brechas de OA y sugerir planes remediales" })
  detect(@Body() dto: DetectAndSuggestDto) {
    return this.service.detectAndSuggest(dto.courseId, dto.subjectId, dto.threshold ?? 60);
  }

  @Post("batch-create")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION")
  @ApiOperation({ summary: "Crear planes remediales automáticamente desde detección de brechas" })
  batchCreate(@Body() dto: DetectAndSuggestDto) {
    return this.service.batchCreateFromDetection(dto.courseId, dto.threshold ?? 60);
  }

  @Get("summary/:courseId")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Resumen de planes remediales de un curso (efectividad, OA más intervenidos)" })
  getSummary(@Param("courseId", ParseUUIDPipe) courseId: string) {
    return this.service.getCourseRemedialSummary(courseId);
  }
}
