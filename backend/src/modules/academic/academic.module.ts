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
import { AttendanceModule } from "./attendance/attendance.module.js";
import { ObservationsModule } from "./observations/observations.module.js";
import { ClassBookModule } from "./class-book/class-book.module.js";

@Module({
  imports: [
    InstitutionsModule, AcademicYearsModule, PeriodsModule,
    CoursesModule, SubjectsModule, StudentsModule,
    TeachersModule, EnrollmentsModule, CalculationsModule,
    AttendanceModule, ObservationsModule, ClassBookModule,
  ],
  exports: [
    InstitutionsModule, AcademicYearsModule, PeriodsModule,
    CoursesModule, SubjectsModule, StudentsModule,
    TeachersModule, EnrollmentsModule, CalculationsModule,
    AttendanceModule, ObservationsModule, ClassBookModule,
  ],
})
export class AcademicModule {}
