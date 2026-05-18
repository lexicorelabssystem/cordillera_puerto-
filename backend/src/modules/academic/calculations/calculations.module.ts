import { Module } from "@nestjs/common";
import { CalculationsController } from "./calculations.controller.js";
import { CalculationsService } from "./calculations.service.js";

@Module({
  controllers: [CalculationsController],
  providers: [CalculationsService],
  exports: [CalculationsService],
})
export class CalculationsModule {}
