const DEV_DEFAULT_ORIGINS = ["http://localhost:5173"];

export function normalizeOrigin(raw: string): string {
  const value = raw.trim().replace(/\/+$/, "");
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return value;
  }
}

export function getAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const isProduction = env.NODE_ENV === "production";
  const configured = [
    ...(env.CORS_ORIGINS || (!isProduction ? DEV_DEFAULT_ORIGINS.join(",") : "")).split(","),
    env.FRONTEND_URL,
  ];

  const exactOrigins = configured
    .map((origin) => origin?.trim())
    .filter((origin): origin is string => Boolean(origin))
    .filter((origin) => origin !== "*" && !origin.startsWith("*."))
    .map(normalizeOrigin);

  return [...new Set(exactOrigins)];
}

export function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  const normalized = normalizeOrigin(origin);
  return allowedOrigins.includes(normalized);
}
