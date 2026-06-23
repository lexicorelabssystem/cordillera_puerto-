import { Module } from "@nestjs/common";
import { ImportsController } from "./imports.controller.js";
import { ImportsService } from "./imports.service.js";
import { ImportsParserService } from "./imports-parser.service.js";
import { ImportsStudentService } from "./imports-student.service.js";
import { ImportsTeacherService } from "./imports-teacher.service.js";

@Module({
  controllers: [ImportsController],
  providers: [ImportsService, ImportsParserService, ImportsStudentService, ImportsTeacherService],
  exports: [ImportsService],
})
export class ImportsModule {}
