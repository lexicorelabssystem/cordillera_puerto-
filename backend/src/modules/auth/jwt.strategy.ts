import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Inject } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { AppConfig } from "../../config/config.module.js";
import type { JwtPayload } from "../../common/decorators/current-user.decorator.js";
import { PrismaService } from "../prisma/prisma.service.js";

function cookieExtractor(req: FastifyRequest): string | null {
  let token: string | null = null;
  if (req.cookies?.access_token) {
    token = req.cookies.access_token;
  }
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }
  }
  return token;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    @Inject("APP_CONFIG") config: AppConfig,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      ignoreExpiration: false,
      secretOrKey: config.jwtSecret,
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException("Usuario no encontrado o desactivado");
    }

    return {
      sub: user.id,
      role: user.role,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      institutionId: user.institutionId ?? undefined,
    };
  }
}
