import { Injectable, CanActivate, ExecutionContext, Logger } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly logger = new Logger(CsrfGuard.name);
  private readonly allowedOrigins: string[];

  constructor() {
    this.allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<FastifyRequest>();

    if (SAFE_METHODS.includes(req.method)) {
      return true;
    }

    const origin = (req.headers.origin || req.headers.referer || "") as string;

    if (!origin) {
      const host = req.headers.host || "";
      const referer = req.headers.referer || "";
      const isSameOrigin = referer.includes(host) || !referer;
      if (!isSameOrigin) {
        this.logger.warn(`CSRF: ${req.method} ${req.url} sin Origin, Referer inconsistente`);
        return false;
      }
      return true;
    }

    const originUrl = this.extractOrigin(origin);
    const allowed = this.allowedOrigins.some((o) => {
      if (o === "*") return true;
      return this.extractOrigin(o) === originUrl || this.matchWildcard(o, originUrl);
    });

    if (!allowed) {
      this.logger.warn(`CSRF: origen ${originUrl} no permitido para ${req.method} ${req.url}`);
    }

    return allowed;
  }

  private extractOrigin(raw: string): string {
    try {
      const url = new URL(raw);
      return `${url.protocol}//${url.host}`;
    } catch {
      return raw.replace(/\/+$/, "");
    }
  }

  private matchWildcard(pattern: string, origin: string): boolean {
    if (!pattern.startsWith("*.")) return false;
    const domain = pattern.slice(2);
    return origin.endsWith("://" + domain) || origin.endsWith("." + domain);
  }
}
