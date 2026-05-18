import { Module } from "@nestjs/common";
import { ReportsModule } from "./reports/reports.module.js";
import { AlertsModule } from "./alerts/alerts.module.js";
import { RemedialPlansModule } from "./remedial-plans/remedial-plans.module.js";

@Module({
  imports: [ReportsModule, AlertsModule, RemedialPlansModule],
  exports: [ReportsModule, AlertsModule, RemedialPlansModule],
})
export class InsightsModule {}
