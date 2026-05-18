import { Module } from "@nestjs/common";
import { AxesController } from "./axes.controller.js";
import { AxesService } from "./axes.service.js";

@Module({
  controllers: [AxesController],
  providers: [AxesService],
  exports: [AxesService],
})
export class AxesModule {}
