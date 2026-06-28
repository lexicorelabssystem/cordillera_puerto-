import { Module } from "@nestjs/common";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "./config/config.module.js";
import { PrismaModule } from "./modules/prisma/prisma.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { UsersModule } from "./modules/users/users.module.js";
import { AcademicModule } from "./modules/academic/academic.module.js";
import { CurriculumModule } from "./modules/curriculum/curriculum.module.js";
import { AssessmentsDomainModule } from "./modules/assessments/assessments.module.js";
import { ResourcesDomainModule } from "./modules/resources/resources.module.js";
import { InsightsModule } from "./modules/insights/insights.module.js";
import { DataOpsModule } from "./modules/data-ops/data-ops.module.js";
import { AuditLogsModule } from "./modules/audit-logs/audit-logs.module.js";
import { PermissionsModule } from "./modules/permissions/permissions.module.js";
import { AdminModule } from "./modules/admin/admin.module.js";
import { FeatureFlagsModule } from "./modules/features/feature-flags.module.js";
import { NotificationsModule } from "./modules/notifications/notifications.module.js";
import { CacheModule } from "./modules/cache/cache.module.js";
import { StorageModule } from "./modules/storage/storage.module.js";
import { SimceModule } from "./modules/simce/simce.module.js";
import { QueueModule } from "./modules/queue/queue.module.js";
import { JobsModule } from "./modules/jobs/jobs.module.js";
import { ObservabilityModule } from "./modules/observability/observability.module.js";
import { ArchivesModule } from "./modules/archives/archives.module.js";
import { HealthController } from "./health.controller.js";
import { DemoSeedService } from "./demo-seed.service.js";

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: "default",
        ttl: 60_000,
        limit: 300,
      },
    ]),
    ConfigModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    AcademicModule,
    CurriculumModule,
    AssessmentsDomainModule,
    ResourcesDomainModule,
    InsightsModule,
    DataOpsModule,
    AuditLogsModule,
    PermissionsModule,
    AdminModule,
    FeatureFlagsModule,
    NotificationsModule,
    CacheModule,
    StorageModule,
    SimceModule,
    QueueModule,
    JobsModule,
    ObservabilityModule,
    ArchivesModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    DemoSeedService,
  ],
})
export class AppModule {}
