import { ExecutionContext } from "@nestjs/common";
import { CsrfGuard } from "./csrf.guard.js";

describe("CsrfGuard", () => {
  let guard: CsrfGuard;

  function mockContext(method: string, origin?: string, referer?: string, host = "localhost:4000"): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          url: "/api/v1/some-endpoint",
          headers: {
            origin: origin ?? null,
            referer: referer ?? null,
            host,
          },
        }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    process.env.CORS_ORIGINS = "http://localhost:5173,https://app.ejemplo.cl";
    guard = new CsrfGuard();
  });

  describe("safe methods", () => {
    it("debe permitir GET sin Origin", () => {
      expect(guard.canActivate(mockContext("GET"))).toBe(true);
    });

    it("debe permitir HEAD sin Origin", () => {
      expect(guard.canActivate(mockContext("HEAD"))).toBe(true);
    });

    it("debe permitir OPTIONS sin Origin", () => {
      expect(guard.canActivate(mockContext("OPTIONS"))).toBe(true);
    });
  });

  describe("mutating methods with valid origin", () => {
    it("debe permitir POST con Origin permitido", () => {
      expect(
        guard.canActivate(mockContext("POST", "http://localhost:5173")),
      ).toBe(true);
    });

    it("debe permitir PUT con Origin HTTPS permitido", () => {
      expect(
        guard.canActivate(mockContext("PUT", "https://app.ejemplo.cl")),
      ).toBe(true);
    });

    it("debe permitir DELETE con Referer permitido", () => {
      expect(
        guard.canActivate(
          mockContext("DELETE", undefined, "http://localhost:5173/page"),
        ),
      ).toBe(true);
    });

    it("debe permitir PATCH con wildcard de subdominio", () => {
      process.env.CORS_ORIGINS = "*.ejemplo.cl";
      guard = new CsrfGuard();
      expect(
        guard.canActivate(mockContext("PATCH", "https://admin.ejemplo.cl")),
      ).toBe(true);
    });
  });

  describe("mutating methods with invalid origin", () => {
    it("debe bloquear POST con origen malicioso", () => {
      expect(
        guard.canActivate(mockContext("POST", "https://evil.com")),
      ).toBe(false);
    });

    it("debe bloquear POST con Referer malicioso", () => {
      expect(
        guard.canActivate(
          mockContext("POST", undefined, "https://evil.com/api"),
        ),
      ).toBe(false);
    });
  });

  describe("same-origin requests", () => {
    it("debe permitir POST sin Origin ni Referer (same-origin)", () => {
      expect(guard.canActivate(mockContext("POST"))).toBe(true);
    });
  });
});
