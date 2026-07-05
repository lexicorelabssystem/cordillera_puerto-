import { Module } from "@nestjs/common";
import { FilesModule } from "../../data-ops/files/files.module.js";
import { AssessmentTemplatesController } from "./assessment-templates.controller.js";
import { AssessmentTemplatesService } from "./assessment-templates.service.js";
import { DocumentAssessmentParserService } from "../import/document-assessment-parser.service.js";

@Module({
  imports: [FilesModule],
  controllers: [AssessmentTemplatesController],
  providers: [AssessmentTemplatesService, DocumentAssessmentParserService],
  exports: [AssessmentTemplatesService],
})
export class AssessmentTemplatesModule {}
