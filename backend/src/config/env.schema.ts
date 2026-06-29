import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());
const optionalPositiveInt = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().positive().optional(),
);

const weakSecretValues = [
  "change-me",
  "change-me-generate-secure-random",
  "change-me-generate-secure-random-min-32-characters",
  "cordillera_dev_2026",
  "cordillera_minio_2026",
  "AdminObservability2026!",
  "AdminDev2026*",
];

function isWeakSecret(value: string | undefined) {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return weakSecretValues.some((weak) => normalized.includes(weak.toLowerCase()));
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    HOST: z.string().default("0.0.0.0"),

    DATABASE_URL: z
      .string()
      .url()
      .refine((value) => value.startsWith("postgresql://") || value.startsWith("postgres://"), {
        message: "DATABASE_URL must start with postgresql:// or postgres://",
      }),

    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    JWT_ISSUER: z.string().default("cordillera-saas"),
    JWT_AUDIENCE: z.string().default("cordillera-app"),
    JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
    JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
    COOKIE_SECRET: z.string().min(32).optional(),

    CORS_ORIGINS: z.string().default("http://localhost:3000"),
    FRONTEND_URL: optionalUrl,

    BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(14).default(10),
    ENABLE_DEMO_SEED: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),

    SMTP_HOST: optionalString,
    SMTP_PORT: optionalPositiveInt,
    SMTP_USER: optionalString,
    SMTP_PASS: optionalString,
    SMTP_FROM: optionalString,
    NOTIFICATION_EMAILS_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),

    REDIS_URL: optionalUrl,
    STORAGE_DRIVER: z.enum(["local", "minio"]).default("local"),
    MINIO_ENDPOINT: z.string().default("minio"),
    MINIO_PORT: z.coerce.number().int().positive().default(9000),
    MINIO_USE_SSL: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    MINIO_ACCESS_KEY: z.string().default("cordillera"),
    MINIO_SECRET_KEY: z.string().default("cordillera_minio_2026"),
    MINIO_DOCUMENTS_BUCKET: z.string().default("educacore-documents"),
    MINIO_TEMP_BUCKET: z.string().default("educacore-temp"),
    MINIO_ARCHIVES_BUCKET: z.string().default("educacore-archives"),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") return;

    const requireStrongSecret = (key: keyof typeof env, minLength = 32) => {
      const value = String(env[key] ?? "");
      if (value.length < minLength || isWeakSecret(value)) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: `${String(key)} must be set to a strong production value`,
        });
      }
    };

    requireStrongSecret("JWT_SECRET");
    requireStrongSecret("COOKIE_SECRET");
    requireStrongSecret("MINIO_SECRET_KEY");

    if (env.ENABLE_DEMO_SEED) {
      ctx.addIssue({
        code: "custom",
        path: ["ENABLE_DEMO_SEED"],
        message: "ENABLE_DEMO_SEED must be false in production",
      });
    }

    if (env.BCRYPT_ROUNDS < 12) {
      ctx.addIssue({
        code: "custom",
        path: ["BCRYPT_ROUNDS"],
        message: "BCRYPT_ROUNDS must be at least 12 in production",
      });
    }

    if (!env.FRONTEND_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["FRONTEND_URL"],
        message: "FRONTEND_URL is required in production",
      });
    }

    const corsOrigins = env.CORS_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
    if (
      corsOrigins.length === 0 ||
      corsOrigins.some((origin) => origin === "*" || origin.includes("localhost"))
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["CORS_ORIGINS"],
        message: "CORS_ORIGINS must list exact non-localhost origins in production",
      });
    }

    if (!env.REDIS_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["REDIS_URL"],
        message: "REDIS_URL is required in production",
      });
    }

    if (
      env.STORAGE_DRIVER === "minio" &&
      (isWeakSecret(env.MINIO_ACCESS_KEY) || isWeakSecret(env.MINIO_SECRET_KEY))
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["MINIO_SECRET_KEY"],
        message: "MinIO credentials must be strong production values",
      });
    }

    if (
      env.NOTIFICATION_EMAILS_ENABLED &&
      (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !env.SMTP_FROM)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["SMTP_HOST"],
        message:
          "SMTP_HOST, SMTP_USER, SMTP_PASS and SMTP_FROM are required when notifications are enabled",
      });
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${errors}`);
  }

  return result.data;
}
