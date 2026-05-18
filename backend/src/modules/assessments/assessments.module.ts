import { Module } from "@nestjs/common";
import { AssessmentsModule } from "./assessments/assessments.module.js";
import { AttemptsModule } from "./attempts/attempts.module.js";
import { GradingModule } from "./grading/grading.module.js";
import { GradeChangeRequestsModule } from "./grade-change-requests/grade-change-requests.module.js";

@Module({
  imports: [AssessmentsModule, AttemptsModule, GradingModule, GradeChangeRequestsModule],
  exports: [AssessmentsModule, AttemptsModule, GradingModule, GradeChangeRequestsModule],
})
export class AssessmentsDomainModule {}
