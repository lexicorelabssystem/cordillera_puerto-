import { Module } from "@nestjs/common";
import { AssessmentsModule } from "./assessments/assessments.module.js";
import { AttemptsModule } from "./attempts/attempts.module.js";
import { GradingModule } from "./grading/grading.module.js";
import { GradeChangeRequestsModule } from "./grade-change-requests/grade-change-requests.module.js";
import { ImportTestModule } from "./import/import-test.module.js";

@Module({
  imports: [AssessmentsModule, AttemptsModule, GradingModule, GradeChangeRequestsModule, ImportTestModule],
  exports: [AssessmentsModule, AttemptsModule, GradingModule, GradeChangeRequestsModule, ImportTestModule],
})
export class AssessmentsDomainModule {}
