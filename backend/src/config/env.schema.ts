import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),

  DATABASE_URL: z.string().url().startsWith("postgresql://"),

  JWT_SECRET: z.string().min(64, "JWT_SECRET must be at least 64 characters"),
  JWT_ISSUER: z.string().default("cordillera-saas"),
  JWT_AUDIENCE: z.string().default("cordillera-app"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  COOKIE_SECRET: z.string().min(32).optional(),

  CORS_ORIGINS: z.string().default("http://localhost:3000"),

  BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(14).default(10),
  ENABLE_DEMO_SEED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  • ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${errors}`);
  }

  return result.data;
}
