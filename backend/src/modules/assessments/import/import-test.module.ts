import { Module } from "@nestjs/common";
import { FilesModule } from "../../data-ops/files/files.module.js";
import { DocumentAssessmentParserService } from "./document-assessment-parser.service.js";
import { AssessmentUploadController, ImportTestController } from "./import-test.controller.js";
import { ImportTestService } from "./import-test.service.js";

@Module({
  imports: [FilesModule],
  controllers: [ImportTestController, AssessmentUploadController],
  providers: [ImportTestService, DocumentAssessmentParserService],
})
export class ImportTestModule {}
