import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from "@nestjs/swagger";
import type { FastifyRequest, FastifyReply } from "fastify";
import { AuthService } from "./auth.service.js";
import { LoginDto, ChangePasswordDto, RefreshTokenDto, LoginResponseDto } from "./dto/login.dto.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import { Public } from "../../common/decorators/public.decorator.js";
import { CurrentUser, JwtPayload } from "../../common/decorators/current-user.decorator.js";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Iniciar sesión", description: "Autentica un usuario y establece cookies JWT httpOnly." })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: "Login exitoso", type: LoginResponseDto })
  @ApiResponse({ status: 401, description: "Credenciales inválidas" })
  @ApiResponse({ status: 403, description: "Cuenta desactivada" })
  @ApiResponse({ status: 429, description: "Demasiados intentos fallidos" })
  async login(
    @Body() dto: LoginDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.authService.login(dto.email, dto.password);
    this.setAuthCookies(reply, result.token, result.refreshToken);
    return result;
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Renovar access token", description: "Usa el refresh token de cookie o body para obtener nuevos tokens." })
  @ApiBody({ type: RefreshTokenDto, required: false })
  @ApiResponse({ status: 200, description: "Token renovado", type: LoginResponseDto })
  @ApiResponse({ status: 401, description: "Refresh token inválido o expirado" })
  async refresh(
    @Body() dto: RefreshTokenDto | undefined,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const refreshToken = dto?.refreshToken ?? req.cookies?.refresh_token;
    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token requerido");
    }
    const result = await this.authService.refreshAccessToken(refreshToken);
    this.setAuthCookies(reply, result.token, result.refreshToken);
    return result;
  }

  @Get("me")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Validar sesión", description: "Retorna los datos del usuario autenticado." })
  @ApiResponse({ status: 200, description: "Sesión válida" })
  @ApiResponse({ status: 401, description: "Token inválido o expirado" })
  async me(@CurrentUser() user: JwtPayload) {
    return { user };
  }

  @Post("change-password")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Cambiar contraseña", description: "Cambia la contraseña del usuario autenticado." })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 200, description: "Contraseña cambiada exitosamente", type: LoginResponseDto })
  @ApiResponse({ status: 400, description: "Datos inválidos o política incumplida" })
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.authService.changePassword(user.sub, dto.currentPassword, dto.newPassword);
    this.setAuthCookies(reply, result.token, result.refreshToken);
    return result;
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Cerrar sesión", description: "Revoca todos los refresh tokens y elimina cookies." })
  @ApiResponse({ status: 204, description: "Sesión cerrada" })
  async logout(
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.authService.logout(user.sub);
    this.clearAuthCookies(reply);
  }

  @Public()
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 300_000 } })
  @ApiOperation({ summary: "Solicitar recuperación de contraseña" })
  async forgotPassword(@Body() dto: { email: string }) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 300_000 } })
  @ApiOperation({ summary: "Restablecer contraseña con token" })
  async resetPassword(@Body() dto: { token: string; newPassword: string }) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  private setAuthCookies(reply: FastifyReply, accessToken: string, refreshToken: string) {
    const isProd = process.env.NODE_ENV === "production";
    const sameSite: "none" | "lax" = isProd ? "none" : "lax";
    const cookieBase = { httpOnly: true, secure: isProd, sameSite, path: "/" as const };
    reply.setCookie("access_token", accessToken, { ...cookieBase, maxAge: 900 });
    reply.setCookie("refresh_token", refreshToken, {
      ...cookieBase,
      maxAge: 604800,
      path: "/api/v1/auth",
    });
  }

  private clearAuthCookies(reply: FastifyReply) {
    const isProd = process.env.NODE_ENV === "production";
    const sameSite: "none" | "lax" = isProd ? "none" : "lax";
    const cookieBase = { httpOnly: true, secure: isProd, sameSite, path: "/" as const };
    reply.setCookie("access_token", "", { ...cookieBase, maxAge: 0 });
    reply.setCookie("refresh_token", "", { ...cookieBase, maxAge: 0, path: "/api/v1/auth" });
  }
}
