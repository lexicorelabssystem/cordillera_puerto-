import { Global, Module } from "@nestjs/common";
import { validateEnv, type EnvConfig } from "./env.schema.js";
import "dotenv/config";

export type AppConfig = ReturnType<typeof buildConfig>;

function buildConfig(env: EnvConfig) {
  return {
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === "production",
    port: env.PORT,
    host: env.HOST,
    jwtSecret: env.JWT_SECRET,
    jwtIssuer: env.JWT_ISSUER,
    jwtAudience: env.JWT_AUDIENCE,
    jwtAccessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
    jwtRefreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
    corsOrigins: env.CORS_ORIGINS.split(",").map((s) => s.trim()),
    frontendUrl: env.FRONTEND_URL ?? "",
    bcryptRounds: env.BCRYPT_ROUNDS,
    enableDemoSeed: env.ENABLE_DEMO_SEED,
    smtp: {
      host: env.SMTP_HOST ?? "",
      port: env.SMTP_PORT ?? 587,
      user: env.SMTP_USER ?? "",
      pass: env.SMTP_PASS ?? "",
      from: env.SMTP_FROM ?? "noreply@cordillera.cl",
    },
    notificationsEnabled: env.NOTIFICATION_EMAILS_ENABLED,
    redisUrl: env.REDIS_URL,
    storage: {
      driver: env.STORAGE_DRIVER,
      endpoint: env.MINIO_ENDPOINT,
      port: env.MINIO_PORT,
      useSSL: env.MINIO_USE_SSL,
      accessKey: env.MINIO_ACCESS_KEY,
      secretKey: env.MINIO_SECRET_KEY,
      documentsBucket: env.MINIO_DOCUMENTS_BUCKET,
      tempBucket: env.MINIO_TEMP_BUCKET,
      archivesBucket: env.MINIO_ARCHIVES_BUCKET,
    },
  };
}

@Global()
@Module({
  providers: [
    {
      provide: "APP_CONFIG",
      useFactory: () => buildConfig(validateEnv()),
    },
  ],
  exports: ["APP_CONFIG"],
})
export class ConfigModule {}
