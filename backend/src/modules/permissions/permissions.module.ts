import { Global, Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module.js";
import { PermissionsController } from "./permissions.controller.js";
import { PermissionsService } from "./permissions.service.js";
import { AuditLogsModule } from "../audit-logs/audit-logs.module.js";

@Global()
@Module({
  imports: [PrismaModule, AuditLogsModule],
  controllers: [PermissionsController],
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
