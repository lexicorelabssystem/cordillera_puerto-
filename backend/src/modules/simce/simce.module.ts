import { Module } from "@nestjs/common";
import { SimceController } from "./simce.controller.js";
import { SimceService } from "./simce.service.js";

@Module({
  controllers: [SimceController],
  providers: [SimceService],
  exports: [SimceService],
})
export class SimceModule {}
