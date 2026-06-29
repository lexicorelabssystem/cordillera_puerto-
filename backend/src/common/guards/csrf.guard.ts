import { Injectable, CanActivate, ExecutionContext, Logger } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import {
  getAllowedOrigins,
  isOriginAllowed,
  normalizeOrigin,
} from "../security/allowed-origins.js";

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly logger = new Logger(CsrfGuard.name);
  private readonly allowedOrigins: string[];
  private readonly isProduction: boolean;

  constructor() {
    this.allowedOrigins = getAllowedOrigins();
    this.isProduction = process.env.NODE_ENV === "production";
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<FastifyRequest>();

    if (SAFE_METHODS.includes(req.method)) {
      return true;
    }

    const originHeader = (req.headers.origin || "") as string;
    const refererHeader = (req.headers.referer || "") as string;
    const source = originHeader || refererHeader;

    if (!source) {
      if (this.isProduction) {
        this.logger.warn(`CSRF: ${req.method} ${req.url} sin Origin ni Referer en produccion`);
        return false;
      }
      return true;
    }

    const originUrl = normalizeOrigin(source);
    const allowed = isOriginAllowed(originUrl, this.allowedOrigins);

    if (!allowed) {
      this.logger.warn(`CSRF: origen ${originUrl} no permitido para ${req.method} ${req.url}`);
    }

    return allowed;
  }
}
