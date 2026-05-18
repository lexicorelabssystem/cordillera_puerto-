import { Module } from "@nestjs/common";
import { LearningResourcesModule } from "./learning-resources/learning-resources.module.js";
import { LessonsModule } from "./lessons/lessons.module.js";

@Module({
  imports: [LearningResourcesModule, LessonsModule],
  exports: [LearningResourcesModule, LessonsModule],
})
export class ResourcesDomainModule {}
