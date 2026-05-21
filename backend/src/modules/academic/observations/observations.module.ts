import { Module } from "@nestjs/common";
import { ObservationsController } from "./observations.controller.js";
import { ObservationsService } from "./observations.service.js";

@Module({
  controllers: [ObservationsController],
  providers: [ObservationsService],
  exports: [ObservationsService],
})
export class ObservationsModule {}
