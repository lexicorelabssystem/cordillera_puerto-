import { Module } from "@nestjs/common";
import { ImportTestController } from "./import-test.controller.js";
import { ImportTestService } from "./import-test.service.js";

@Module({
  controllers: [ImportTestController],
  providers: [ImportTestService],
})
export class ImportTestModule {}
