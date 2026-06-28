import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../common/guards/roles.guard.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { CurrentUser, JwtPayload } from "../../common/decorators/current-user.decorator.js";
import { QueueService } from "../queue/queue.service.js";
import { ArchivesService } from "./archives.service.js";
import { CreateArchiveDto } from "./dto/archive.dto.js";

@ApiTags("Archives")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN", "SUPER_ADMIN")
@Controller("archives")
export class ArchivesController {
  constructor(private readonly archives: ArchivesService, private readonly queue: QueueService) {}

  @Post()
  @ApiOperation({ summary: "Programar archivado historico" })
  async create(@Body() dto: CreateArchiveDto, @CurrentUser() user: JwtPayload) {
    const record = await this.archives.createRequest(dto, user.sub);
    const job = await this.queue.enqueueArchive({ action: "ARCHIVE", archiveRecordId: record.id, userId: user.sub });
    return { archive: record, job };
  }

  @Post(":id/restore")
  @ApiOperation({ summary: "Restaurar un archivo historico" })
  async restore(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    const job = await this.queue.enqueueArchive({ action: "RESTORE", archiveRecordId: id, userId: user.sub });
    return { archiveRecordId: id, job };
  }

  @Get()
  list(@Query("page") page?: string, @Query("limit") limit?: string, @Query("institutionId") institutionId?: string) {
    return this.archives.list(Number(page ?? 1), Number(limit ?? 20), institutionId);
  }

  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.archives.getById(id);
  }
}