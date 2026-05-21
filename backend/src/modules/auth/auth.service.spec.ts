import { jest } from "@jest/globals";
import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { UnauthorizedException, ForbiddenException, BadRequestException } from "@nestjs/common";
import { AuthService } from "./auth.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditLogsService } from "../audit-logs/audit-logs.service.js";
import { EmailService } from "../notifications/email.service.js";
import {
  mockConfig,
  MOCK_USER_ID,
  MOCK_EMAIL,
  MOCK_PASSWORD,
  MOCK_HASH,
  mockUser,
  mockRefreshToken,
} from "./__test-helpers.js";

describe("AuthService", () => {
  let service: AuthService;
  let prismaUser: Record<string, jest.Mock<(...args: any[]) => any>>;
  let prismaRt: Record<string, jest.Mock<(...args: any[]) => any>>;
  let jwtSign: jest.Mock<(...args: any[]) => any>;
  let jwtVerify: jest.Mock<(...args: any[]) => any>;
  let auditLogMock: { log: jest.Mock<(...args: any[]) => any> };

  beforeEach(async () => {
    prismaUser = {
      findUnique: jest.fn(),
      update: jest.fn(),
    };
    prismaRt = {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    };
    jwtSign = jest.fn<(...args: any[]) => any>().mockResolvedValue("mock-access-token");
    jwtVerify = jest.fn<(...args: any[]) => any>();
    auditLogMock = { log: jest.fn<(...args: any[]) => any>().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: prismaUser,
            refreshToken: prismaRt,
            $transaction: (cb: () => Promise<unknown>) => cb(),
          },
        },
        {
          provide: JwtService,
          useValue: { signAsync: jwtSign, verifyAsync: jwtVerify },
        },
        { provide: AuditLogsService, useValue: auditLogMock },
        { provide: EmailService, useValue: { send: jest.fn<(...args: any[]) => any>(), sendPasswordReset: jest.fn<(...args: any[]) => any>().mockResolvedValue(true) } },
        { provide: "APP_CONFIG", useValue: mockConfig() },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe("login", () => {
    it("debe autenticar con credenciales correctas (hash real)", async () => {
      prismaUser.findUnique.mockResolvedValue(mockUser);
      prismaUser.update.mockResolvedValue({ ...mockUser, lastLoginAt: new Date() });

      const result = await service.login(MOCK_EMAIL, MOCK_PASSWORD);

      expect(result.token).toBe("mock-access-token");
      expect(result.user.email).toBe(MOCK_EMAIL);
      expect(result.user.role).toBe("SUPER_ADMIN");
    });

    it("debe normalizar email a minusculas", async () => {
      prismaUser.findUnique.mockResolvedValue(mockUser);

      await service.login("Admin@Cordillera.CL", MOCK_PASSWORD);

      expect(prismaUser.findUnique).toHaveBeenCalledWith({
        where: { email: "admin@cordillera.cl" },
      });
    });

    it("debe lanzar si usuario no existe", async () => {
      prismaUser.findUnique.mockResolvedValue(null);

      await expect(service.login("noexiste@test.cl", "p")).rejects.toThrow(UnauthorizedException);
    });

    it("debe lanzar si contraseña incorrecta", async () => {
      prismaUser.findUnique.mockResolvedValue(mockUser);

      await expect(service.login(MOCK_EMAIL, "WrongPass1!")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("debe lanzar si cuenta desactivada", async () => {
      prismaUser.findUnique.mockResolvedValue({ ...mockUser, isActive: false });

      await expect(service.login(MOCK_EMAIL, MOCK_PASSWORD)).rejects.toThrow(ForbiddenException);
    });

    it("debe registrar auditoria", async () => {
      prismaUser.findUnique.mockResolvedValue(mockUser);

      await service.login(MOCK_EMAIL, MOCK_PASSWORD);

      expect(auditLogMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: "LOGIN_SUCCESS" }),
      );
    });
  });

  describe("refreshAccessToken", () => {
    it("debe renovar con token valido", async () => {
      prismaRt.findUnique.mockResolvedValue(mockRefreshToken);
      prismaRt.update.mockResolvedValue({ ...mockRefreshToken, revokedAt: new Date() });

      const result = await service.refreshAccessToken("raw-refresh");

      expect(result.token).toBe("mock-access-token");
      expect(prismaRt.update).toHaveBeenCalled();
    });

    it("debe lanzar si token no existe", async () => {
      prismaRt.findUnique.mockResolvedValue(null);
      await expect(service.refreshAccessToken("invalid")).rejects.toThrow(UnauthorizedException);
    });

    it("debe lanzar si token revocado", async () => {
      prismaRt.findUnique.mockResolvedValue({ ...mockRefreshToken, revokedAt: new Date() });
      await expect(service.refreshAccessToken("revoked")).rejects.toThrow(UnauthorizedException);
    });

    it("debe lanzar si token expiro", async () => {
      prismaRt.findUnique.mockResolvedValue({ ...mockRefreshToken, expiresAt: new Date(Date.now() - 1000) });
      await expect(service.refreshAccessToken("expired")).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("changePassword", () => {
    it("debe cambiar contraseña exitosamente", async () => {
      prismaUser.findUnique.mockResolvedValue(mockUser);
      prismaUser.update.mockResolvedValue({ ...mockUser, mustChangePassword: false });
      prismaRt.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.changePassword(MOCK_USER_ID, MOCK_PASSWORD, "NuevoPass123*");

      expect(result.token).toBe("mock-access-token");
      expect(prismaRt.updateMany).toHaveBeenCalled();
    });

    it("debe lanzar si contraseña actual incorrecta", async () => {
      prismaUser.findUnique.mockResolvedValue(mockUser);
      await expect(
        service.changePassword(MOCK_USER_ID, "WrongPass1!", "NuevoPass123*"),
      ).rejects.toThrow(BadRequestException);
    });

    it("debe lanzar si nueva es igual a actual", async () => {
      prismaUser.findUnique.mockResolvedValue(mockUser);
      await expect(
        service.changePassword(MOCK_USER_ID, MOCK_PASSWORD, MOCK_PASSWORD),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("password policy", () => {
    it("acepta: 10+ chars, mayuscula, minuscula, numero, simbolo", () => {
      expect(() => service.validatePasswordPolicy("Valida1234*")).not.toThrow();
      expect(() => service.validatePasswordPolicy("Abcdefgh1!")).not.toThrow();
    });

    it("rechaza <10 caracteres", () => {
      expect(() => service.validatePasswordPolicy("Corta1*")).toThrow(BadRequestException);
    });

    it("rechaza sin minuscula", () => {
      expect(() => service.validatePasswordPolicy("TODOMAYUS123*")).toThrow(BadRequestException);
    });

    it("rechaza sin mayuscula", () => {
      expect(() => service.validatePasswordPolicy("todominus123*")).toThrow(BadRequestException);
    });

    it("rechaza sin numero", () => {
      expect(() => service.validatePasswordPolicy("SinNumeros**")).toThrow(BadRequestException);
    });

    it("rechaza sin simbolo", () => {
      expect(() => service.validatePasswordPolicy("SinSimbolo123")).toThrow(BadRequestException);
    });
  });

  describe("logout", () => {
    it("revoca todos los refresh tokens y audita", async () => {
      await service.logout(MOCK_USER_ID);

      expect(prismaRt.updateMany).toHaveBeenCalledWith({
        where: { userId: MOCK_USER_ID, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(auditLogMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: "LOGOUT" }),
      );
    });
  });

  describe("validateUser", () => {
    it("retorna usuario activo", async () => {
      prismaUser.findUnique.mockResolvedValue(mockUser);
      const result = await service.validateUser(MOCK_USER_ID);
      expect(result).not.toBeNull();
      expect(result!.email).toBe(MOCK_EMAIL);
    });

    it("retorna null si inactivo", async () => {
      prismaUser.findUnique.mockResolvedValue({ ...mockUser, isActive: false });
      expect(await service.validateUser(MOCK_USER_ID)).toBeNull();
    });

    it("retorna null si eliminado", async () => {
      prismaUser.findUnique.mockResolvedValue({ ...mockUser, deletedAt: new Date() });
      expect(await service.validateUser(MOCK_USER_ID)).toBeNull();
    });
  });

  describe("forgotPassword", () => {
    it("retorna ok si usuario existe", async () => {
      prismaUser.findUnique.mockResolvedValue(mockUser);

      const result = await service.forgotPassword(MOCK_EMAIL);

      expect(result.ok).toBe(true);
      expect(result.message).toBeDefined();
    });

    it("retorna ok sin token si no existe", async () => {
      prismaUser.findUnique.mockResolvedValue(null);
      const result = await service.forgotPassword("noexiste@test.cl");
      expect(result.ok).toBe(true);
      expect(result.message).toBeDefined();
    });
  });

  describe("resetPassword", () => {
    it("restablece con token valido", async () => {
      jwtVerify.mockResolvedValue({
        sub: MOCK_USER_ID, email: MOCK_EMAIL, purpose: "password-reset",
      });
      prismaUser.findUnique.mockResolvedValue(mockUser);
      prismaUser.update.mockResolvedValue(mockUser);

      const result = await service.resetPassword("valid-token", "NuevoPass123*");

      expect(result.ok).toBe(true);
      expect(prismaUser.update).toHaveBeenCalled();
    });

    it("lanza con token expirado", async () => {
      jwtVerify.mockRejectedValue(new Error("jwt expired"));
      await expect(service.resetPassword("expired", "NuevoPass123*")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("lanza si proposito no es password-reset", async () => {
      jwtVerify.mockResolvedValue({ sub: MOCK_USER_ID, email: MOCK_EMAIL, purpose: "other" });
      await expect(service.resetPassword("bad-purpose", "NuevoPass123*")).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
