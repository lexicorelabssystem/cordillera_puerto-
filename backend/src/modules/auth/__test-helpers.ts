import type { AppConfig } from "../../config/config.module.js";

export function mockConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    nodeEnv: "test",
    isProduction: false,
    port: 4000,
    host: "0.0.0.0",
    jwtSecret: "test-secret-that-is-at-least-64-characters-long-for-testing-purposes-only",
    jwtIssuer: "test-issuer",
    jwtAudience: "test-audience",
    jwtAccessExpiresIn: "15m",
    jwtRefreshExpiresIn: "7d",
    corsOrigins: ["http://localhost:5173"],
    frontendUrl: "http://localhost:5173",
    bcryptRounds: 4,
    enableDemoSeed: false,
    smtp: {
      host: "",
      port: 587,
      user: "",
      pass: "",
      from: "noreply@test.cl",
    },
    notificationsEnabled: false,
    redisUrl: undefined,
    storage: {
      driver: "local",
      endpoint: "localhost",
      port: 9000,
      useSSL: false,
      accessKey: "test",
      secretKey: "test-secret",
      documentsBucket: "test-documents",
      tempBucket: "test-temp",
      archivesBucket: "test-archives",
    },
    ...overrides,
  };
}

export const MOCK_USER_ID = "user-001";
export const MOCK_EMAIL = "admin@cordillera.cl";
export const MOCK_PASSWORD = "Admin123*";
export const MOCK_HASH = "$2a$04$1pgTkmExC8DaKCTt00oNpeyilpzC8u7dS3AiLTcKzZ8GpTH1KyQjK";

export const mockUser = {
  id: MOCK_USER_ID,
  email: MOCK_EMAIL,
  firstName: "Admin",
  lastName: "Sistema",
  role: "SUPER_ADMIN",
  isActive: true,
  passwordHash: MOCK_HASH,
  mustChangePassword: false,
  lastLoginAt: null,
  institutionId: "inst-001",
  deletedAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

export const mockRefreshToken = {
  id: "rt-001",
  userId: MOCK_USER_ID,
  tokenHash: "hashed-refresh-token",
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  revokedAt: null,
  user: mockUser,
};
