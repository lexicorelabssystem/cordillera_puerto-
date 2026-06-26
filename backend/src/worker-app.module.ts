import { Module } from "@nestjs/common";
import { ConfigModule } from "./config/config.module.js";
import { PrismaModule } from "./modules/prisma/prisma.module.js";
import { QueueModule } from "./modules/queue/queue.module.js";
import { WorkersModule } from "./modules/workers/workers.module.js";
import { NotificationsModule } from "./modules/notifications/notifications.module.js";

@Module({
  imports: [ConfigModule, PrismaModule, QueueModule, WorkersModule, NotificationsModule],
})
export class WorkerAppModule {}
