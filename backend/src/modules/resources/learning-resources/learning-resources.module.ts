import { Module } from "@nestjs/common";
import { LearningResourcesController } from "./learning-resources.controller.js";
import { LearningResourcesService } from "./learning-resources.service.js";

@Module({
  controllers: [LearningResourcesController],
  providers: [LearningResourcesService],
  exports: [LearningResourcesService],
})
export class LearningResourcesModule {}
