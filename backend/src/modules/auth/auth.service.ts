import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  Inject,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcrypt";
import * as crypto from "node:crypto";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditLogsService } from "../audit-logs/audit-logs.service.js";
import { EmailService } from "../notifications/email.service.js";
import type { AppConfig } from "../../config/config.module.js";
import type { JwtPayload } from "../../common/decorators/current-user.decorator.js";
import { validatePasswordPolicy } from "../../common/utils/password-policy.js";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditLog: AuditLogsService,
    private readonly emailService: EmailService,
    @Inject("APP_CONFIG") private readonly config: AppConfig,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      throw new UnauthorizedException("Credenciales inválidas");
    }

    if (!user.isActive) {
      throw new ForbiddenException("Cuenta desactivada. Contacte al administrador.");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException("Credenciales inválidas");
    }

    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      institutionId: user.institutionId ?? undefined,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.generateRefreshToken(user.id),
    ]);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    this.logger.log(`Login exitoso: ${user.email} (${user.role})`);
    await this.auditLog.log({
      actorId: user.id, action: "LOGIN_SUCCESS", entityType: "auth", entityId: user.id,
      metadata: JSON.stringify({ email: user.email, role: user.role }),
    });

    return {
      token: accessToken,
      refreshToken,
      user: {
        sub: user.id,
        role: user.role,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        institutionId: user.institutionId,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  async refreshAccessToken(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored) {
      throw new UnauthorizedException("Refresh token inválido");
    }

    if (stored.revokedAt) {
      throw new UnauthorizedException("Refresh token revocado");
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token expirado");
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const payload: JwtPayload = {
      sub: stored.user.id,
      role: stored.user.role,
      email: stored.user.email,
      name: `${stored.user.firstName} ${stored.user.lastName}`,
      institutionId: stored.user.institutionId ?? undefined,
    };

    const [newAccessToken, newRefreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.generateRefreshToken(stored.user.id),
    ]);

    return {
      token: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        sub: stored.user.id,
        role: stored.user.role,
        name: `${stored.user.firstName} ${stored.user.lastName}`,
        email: stored.user.email,
        institutionId: stored.user.institutionId,
        mustChangePassword: stored.user.mustChangePassword,
      },
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException("Usuario no encontrado");
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new BadRequestException("La contraseña actual es incorrecta");
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException("La nueva contraseña debe ser distinta de la actual");
    }

    this.validatePasswordPolicy(newPassword);

    const passwordHash = await bcrypt.hash(newPassword, this.config.bcryptRounds);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.auditLog.log({
      actorId: userId, action: "PASSWORD_CHANGED", entityType: "auth", entityId: userId,
    });

    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      institutionId: user.institutionId ?? undefined,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.generateRefreshToken(user.id),
    ]);

    return {
      token: accessToken,
      refreshToken,
      user: {
        sub: user.id,
        role: user.role,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        institutionId: user.institutionId,
        mustChangePassword: false,
      },
    };
  }

  async updateProfile(userId: string, firstName: string, lastName: string) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      },
    });

    await this.auditLog.log({
      actorId: userId,
      action: "PROFILE_UPDATED",
      entityType: "auth",
      entityId: userId,
      metadata: JSON.stringify({ firstName: updated.firstName, lastName: updated.lastName }),
    });

    const payload: JwtPayload = {
      sub: updated.id,
      role: updated.role,
      email: updated.email,
      name: `${updated.firstName} ${updated.lastName}`,
      institutionId: updated.institutionId ?? undefined,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.generateRefreshToken(updated.id),
    ]);

    return {
      token: accessToken,
      refreshToken,
      user: {
        sub: updated.id,
        role: updated.role,
        name: `${updated.firstName} ${updated.lastName}`,
        email: updated.email,
        institutionId: updated.institutionId,
        mustChangePassword: updated.mustChangePassword,
      },
    };
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.auditLog.log({
      actorId: userId, action: "LOGOUT", entityType: "auth", entityId: userId,
    });
  }

  async validateUser(userId: string): Promise<JwtPayload | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive || user.deletedAt) return null;

    return {
      sub: user.id,
      role: user.role,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      institutionId: user.institutionId ?? undefined,
    };
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    const rawToken = crypto.randomBytes(48).toString("hex");
    const tokenHash = this.hashToken(rawToken);

    const expiresIn = this.parseDuration(this.config.jwtRefreshExpiresIn);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + expiresIn),
      },
    });

    return rawToken;
  }

  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7d
    const value = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return value * (multipliers[unit] ?? multipliers.d);
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user || !user.isActive) {
      return { ok: true, message: "Si el correo existe, recibirás instrucciones para restablecer tu clave." };
    }

    const resetToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email, purpose: "password-reset" },
      { expiresIn: "15m" },
    );

    await this.auditLog.log({
      actorId: user.id, action: "PASSWORD_RESET_REQUESTED", entityType: "auth", entityId: user.id,
    });

    const userName = `${user.firstName} ${user.lastName}`;

    this.emailService.sendPasswordReset(user.email, resetToken, userName).catch((err) => {
      this.logger.warn(`Failed to send password reset email to ${user.email}: ${err?.message ?? String(err)}`);
    });

    this.logger.log(`Password reset requested for ${user.email} (email ${this.config.notificationsEnabled ? "sent" : "logged only"})`);

    return {
      ok: true,
      message: "Si el correo existe, recibirás instrucciones para restablecer tu clave.",
    };
  }

  async resetPassword(token: string, newPassword: string) {
    let payload: { sub: string; email: string; purpose: string };
    try {
      payload = await this.jwtService.verifyAsync<{ sub: string; email: string; purpose: string }>(token);
    } catch {
      throw new BadRequestException("El token de recuperación es inválido o ha expirado.");
    }

    if (payload.purpose !== "password-reset") {
      throw new BadRequestException("Token inválido.");
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new BadRequestException("Usuario no encontrado o desactivado.");
    }

    this.validatePasswordPolicy(newPassword);

    const passwordHash = await bcrypt.hash(newPassword, this.config.bcryptRounds);

    await this.prisma.user.update({
      where: { id: payload.sub },
      data: { passwordHash, mustChangePassword: false },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId: payload.sub, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.auditLog.log({
      actorId: payload.sub, action: "PASSWORD_RESET", entityType: "auth", entityId: payload.sub,
    });

    return { ok: true, message: "Contraseña restablecida correctamente. Ya puedes iniciar sesión." };
  }

  validatePasswordPolicy(password: string): true {
    return validatePasswordPolicy(password);
  }
}
