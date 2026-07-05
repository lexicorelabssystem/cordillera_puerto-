import { Module } from "@nestjs/common";
import { SimceController } from "./simce.controller.js";
import { SimceService } from "./simce.service.js";
import { DocumentAssessmentParserService } from "../assessments/import/document-assessment-parser.service.js";

@Module({
  controllers: [SimceController],
  providers: [SimceService, DocumentAssessmentParserService],
  exports: [SimceService],
})
export class SimceModule {}
