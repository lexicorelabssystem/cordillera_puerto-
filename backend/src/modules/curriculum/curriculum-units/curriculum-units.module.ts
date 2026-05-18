import { Module } from "@nestjs/common";
import { CurriculumUnitsController } from "./curriculum-units.controller.js";
import { CurriculumUnitsService } from "./curriculum-units.service.js";

@Module({
  controllers: [CurriculumUnitsController],
  providers: [CurriculumUnitsService],
  exports: [CurriculumUnitsService],
})
export class CurriculumUnitsModule {}
