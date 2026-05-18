import { Module } from "@nestjs/common";
import { RemedialPlansController } from "./remedial-plans.controller.js";
import { RemedialPlansService } from "./remedial-plans.service.js";

@Module({
  controllers: [RemedialPlansController],
  providers: [RemedialPlansService],
  exports: [RemedialPlansService],
})
export class RemedialPlansModule {}
