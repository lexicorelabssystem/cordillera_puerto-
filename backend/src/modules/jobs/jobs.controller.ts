import { Controller, Get, Param, UseGuards, Query, ForbiddenException, NotFoundException } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JobsService } from "./jobs.service.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../common/guards/roles.guard.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { CurrentUser, JwtPayload } from "../../common/decorators/current-user.decorator.js";

@ApiTags("Jobs")
@Controller("jobs")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Listar mis exportaciones recientes" })
  async listMyExports(@CurrentUser() user: JwtPayload, @Query("limit") limit?: number) {
    return this.jobsService.listMyExportJobs(user.sub, limit ?? 20);
  }

  @Get("background")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Listar mis jobs en segundo plano recientes" })
  async listMyBackgroundJobs(@CurrentUser() user: JwtPayload, @Query("limit") limit?: number) {
    return this.jobsService.listMyBackgroundJobs(user.sub, limit ?? 20);
  }

  @Get("exports/:id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Consultar estado de una exportacion" })
  async getExportJob(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    const job = await this.jobsService.getExportJobForUser(id, user);
    if (!job) throw new NotFoundException("Exportacion no encontrada");
    return job;
  }

  @Get("background/:id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Consultar estado de un job en segundo plano" })
  async getBackgroundJob(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    const job = await this.jobsService.getBackgroundJobForUser(id, user);
    if (!job) throw new NotFoundException("Job no encontrado");
    return job;
  }
}
