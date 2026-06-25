import { Module } from "@nestjs/common";
import { JobsController } from "./jobs.controller.js";
import { JobsService } from "./jobs.service.js";
import { PrismaModule } from "../prisma/prisma.module.js";

@Module({
  imports: [PrismaModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
