import { Module } from "@nestjs/common";
import { GradeChangeRequestsController } from "./grade-change-requests.controller.js";
import { GradeChangeRequestsService } from "./grade-change-requests.service.js";
import { AuditLogsModule } from "../../audit-logs/audit-logs.module.js";

@Module({
  imports: [AuditLogsModule],
  controllers: [GradeChangeRequestsController],
  providers: [GradeChangeRequestsService],
  exports: [GradeChangeRequestsService],
})
export class GradeChangeRequestsModule {}
