import { Module } from "@nestjs/common";
import { WorkersService } from "./workers.service.js";
import { ExportsProcessor } from "./processors/exports.processor.js";
import { RecalculationsProcessor } from "./processors/recalculations.processor.js";
import { SimcePdfProcessor } from "./processors/simce-pdf.processor.js";
import { ReportsProcessor } from "./processors/reports.processor.js";
import { CleanupProcessor } from "./processors/cleanup.processor.js";
import { ArchiveProcessor } from "./processors/archive.processor.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { ExportsModule } from "../data-ops/exports/exports.module.js";
import { GradingModule } from "../assessments/grading/grading.module.js";
import { SimceModule } from "../simce/simce.module.js";
import { ReportsModule } from "../insights/reports/reports.module.js";
import { ArchivesModule } from "../archives/archives.module.js";

@Module({
  imports: [PrismaModule, ExportsModule, GradingModule, SimceModule, ReportsModule, ArchivesModule],
  providers: [ExportsProcessor, RecalculationsProcessor, SimcePdfProcessor, ReportsProcessor, CleanupProcessor, ArchiveProcessor, WorkersService],
  exports: [WorkersService],
})
export class WorkersModule {}