import { Module } from "@nestjs/common";
import { AxesModule } from "./axes/axes.module.js";
import { SkillsModule } from "./skills/skills.module.js";
import { CurriculumUnitsModule } from "./curriculum-units/curriculum-units.module.js";
import { LearningObjectivesModule } from "./learning-objectives/learning-objectives.module.js";
import { QuestionBankModule } from "./question-bank/question-bank.module.js";

@Module({
  imports: [
    AxesModule,
    SkillsModule,
    CurriculumUnitsModule,
    LearningObjectivesModule,
    QuestionBankModule,
  ],
  exports: [
    AxesModule,
    SkillsModule,
    CurriculumUnitsModule,
    LearningObjectivesModule,
    QuestionBankModule,
  ],
})
export class CurriculumModule {}
