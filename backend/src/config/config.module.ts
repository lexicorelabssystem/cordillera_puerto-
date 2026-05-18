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
    bcryptRounds: env.BCRYPT_ROUNDS,
    enableDemoSeed: env.ENABLE_DEMO_SEED,
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
