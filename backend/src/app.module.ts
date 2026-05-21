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
import { HealthController } from "./health.controller.js";

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: "default",
        ttl: 60_000,
        limit: 60,
      },
      {
        name: "auth",
        ttl: 60_000,
        limit: 10,
      },
      {
        name: "write",
        ttl: 60_000,
        limit: 30,
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
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
