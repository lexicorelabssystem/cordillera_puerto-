import { jest } from "@jest/globals";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard.js";
import type { JwtPayload } from "../../common/decorators/current-user.decorator.js";

describe("RolesGuard", () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: ReturnType<typeof jest.fn> };

  function mockContext(user?: JwtPayload | null): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(null),
    } as unknown as jest.Mocked<Reflector>;
    guard = new RolesGuard(reflector);
  });

  it("debe permitir si no hay roles requeridos", () => {
    const ctx = mockContext({ sub: "u1", role: "TEACHER", email: "t@t.cl", name: "T" });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("debe permitir si el rol del usuario esta en los requeridos", () => {
    reflector.getAllAndOverride.mockReturnValue(["ADMIN", "DIRECTION"]);
    const ctx = mockContext({ sub: "u1", role: "ADMIN", email: "a@a.cl", name: "A" });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("debe lanzar ForbiddenException si el rol no esta en los requeridos", () => {
    reflector.getAllAndOverride.mockReturnValue(["SUPER_ADMIN"]);
    const ctx = mockContext({ sub: "u1", role: "TEACHER", email: "t@t.cl", name: "T" });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it("debe lanzar ForbiddenException si no hay usuario autenticado", () => {
    reflector.getAllAndOverride.mockReturnValue(["ADMIN"]);
    const ctx = mockContext(null);

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it("debe mostrar mensaje con roles requeridos y rol actual", () => {
    reflector.getAllAndOverride.mockReturnValue(["SUPER_ADMIN", "ADMIN"]);
    const ctx = mockContext({ sub: "u1", role: "STUDENT", email: "s@t.cl", name: "S" });

    try {
      guard.canActivate(ctx);
    } catch (e) {
      const ex = e as ForbiddenException;
      expect(ex.message).toContain("SUPER_ADMIN, ADMIN");
      expect(ex.message).toContain("STUDENT");
    }
  });
});
