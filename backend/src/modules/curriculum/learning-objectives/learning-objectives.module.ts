import { Module } from "@nestjs/common";
import { LearningObjectivesController } from "./learning-objectives.controller.js";
import { LearningObjectivesService } from "./learning-objectives.service.js";

@Module({
  controllers: [LearningObjectivesController],
  providers: [LearningObjectivesService],
  exports: [LearningObjectivesService],
})
export class LearningObjectivesModule {}
