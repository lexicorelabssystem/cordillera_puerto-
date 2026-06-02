import { Module } from "@nestjs/common";
import { StudentsController } from "./students.controller.js";
import { StudentsService } from "./students.service.js";
import { AuditLogsModule } from "../../audit-logs/audit-logs.module.js";

@Module({
  imports: [AuditLogsModule],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
