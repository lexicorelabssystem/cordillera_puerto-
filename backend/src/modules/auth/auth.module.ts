import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthService } from "./auth.service.js";
import { AuthController } from "./auth.controller.js";
import { JwtStrategy } from "./jwt.strategy.js";
import { TokenCleanupService } from "./token-cleanup.service.js";
import { ConfigModule } from "../../config/config.module.js";
import { AuditLogsModule } from "../audit-logs/audit-logs.module.js";
import type { AppConfig } from "../../config/config.module.js";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: ["APP_CONFIG"],
      useFactory: (config: AppConfig) => ({
        secret: config.jwtSecret,
        signOptions: {
          expiresIn: config.jwtAccessExpiresIn as "15m" | "1h" | "2h" | "7d" | number,
          issuer: config.jwtIssuer,
          audience: config.jwtAudience,
        },
      }),
    }),
    AuditLogsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, TokenCleanupService],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
