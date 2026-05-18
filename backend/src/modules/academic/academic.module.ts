import { Module } from "@nestjs/common";
import { InstitutionsModule } from "./institutions/institutions.module.js";
import { AcademicYearsModule } from "./academic-years/academic-years.module.js";
import { PeriodsModule } from "./periods/periods.module.js";
import { CoursesModule } from "./courses/courses.module.js";
import { SubjectsModule } from "./subjects/subjects.module.js";
import { StudentsModule } from "./students/students.module.js";
import { TeachersModule } from "./teachers/teachers.module.js";
import { EnrollmentsModule } from "./enrollments/enrollments.module.js";
import { CalculationsModule } from "./calculations/calculations.module.js";

@Module({
  imports: [
    InstitutionsModule, AcademicYearsModule, PeriodsModule,
    CoursesModule, SubjectsModule, StudentsModule,
    TeachersModule, EnrollmentsModule, CalculationsModule,
  ],
  exports: [
    InstitutionsModule, AcademicYearsModule, PeriodsModule,
    CoursesModule, SubjectsModule, StudentsModule,
    TeachersModule, EnrollmentsModule, CalculationsModule,
  ],
})
export class AcademicModule {}
