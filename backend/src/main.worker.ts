import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { WorkerAppModule } from "./worker-app.module.js";

async function bootstrap() {
  const logger = new Logger("WorkerBootstrap");
  const app = await NestFactory.createApplicationContext(WorkerAppModule);

  const { WorkersService } = await import("./modules/workers/workers.service.js");
  const workersService = app.get(WorkersService);

  await workersService.startAll();

  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal} — shutting down worker...`);
    await workersService.shutdownAll();
    await app.close();
    logger.log("Worker shut down");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled Rejection:", reason instanceof Error ? reason.stack : String(reason));
  });

  process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception:", error.stack);
    process.exit(1);
  });

  logger.log("BullMQ Worker process running");
}

bootstrap();
