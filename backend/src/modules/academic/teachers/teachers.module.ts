import { Module } from "@nestjs/common";
import { TeachersController } from "./teachers.controller.js";
import { TeachersService } from "./teachers.service.js";
import { AuditLogsModule } from "../../audit-logs/audit-logs.module.js";

@Module({
  imports: [AuditLogsModule],
  controllers: [TeachersController],
  providers: [TeachersService],
  exports: [TeachersService],
})
export class TeachersModule {}
