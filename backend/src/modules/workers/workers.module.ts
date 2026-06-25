import { Module, Logger } from "@nestjs/common";
import { WorkersService } from "./workers.service.js";
import { ExportsProcessor } from "./processors/exports.processor.js";
import { RecalculationsProcessor } from "./processors/recalculations.processor.js";
import { SimcePdfProcessor } from "./processors/simce-pdf.processor.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { ExportsModule } from "../data-ops/exports/exports.module.js";
import { GradingModule } from "../assessments/grading/grading.module.js";
import { SimceModule } from "../simce/simce.module.js";

@Module({
  imports: [PrismaModule, ExportsModule, GradingModule, SimceModule],
  providers: [
    ExportsProcessor,
    RecalculationsProcessor,
    SimcePdfProcessor,
    WorkersService,
    {
      provide: "WORKER_LOGGER",
      useValue: new Logger("BullMQ Worker"),
    },
  ],
  exports: [WorkersService],
})
export class WorkersModule {}
