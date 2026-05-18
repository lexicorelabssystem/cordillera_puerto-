import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "../../hooks/useAuth";

vi.mock("../../lib/api", () => ({
  api: {
    me: vi.fn(),
    login: vi.fn(),
    changePassword: vi.fn(),
    logout: vi.fn(),
  },
}));

import { api } from "../../lib/api";

const mockUser = {
  sub: "u1",
  role: "SUPER_ADMIN" as const,
  name: "Admin",
  email: "admin@cordillera.cl",
  mustChangePassword: false,
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("useAuth", () => {
  it("inicia validando sesion", async () => {
    (api.me as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("no session"));
    const { result } = renderHook(() => useAuth());

    expect(result.current.validating).toBe(true);

    await vi.waitFor(() => {
      expect(result.current.validating).toBe(false);
    });
    expect(result.current.user).toBeNull();
  });

  it("restaura sesion si el token es valido", async () => {
    (api.me as ReturnType<typeof vi.fn>).mockResolvedValue({ user: mockUser });
    const { result } = renderHook(() => useAuth());

    await vi.waitFor(() => {
      expect(result.current.validating).toBe(false);
    });
    expect(result.current.user).toEqual(mockUser);
  });

  it("login exitoso guarda usuario en estado", async () => {
    (api.me as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("no session"));
    (api.login as ReturnType<typeof vi.fn>).mockResolvedValue({ user: mockUser });

    const { result } = renderHook(() => useAuth());

    await vi.waitFor(() => {
      expect(result.current.validating).toBe(false);
    });

    await act(async () => {
      await result.current.login("admin@cordillera.cl", "Admin123*");
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe("");
  });

  it("login fallido muestra error", async () => {
    (api.me as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("no session"));
    (api.login as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Credenciales invalidas"));

    const { result } = renderHook(() => useAuth());

    await vi.waitFor(() => {
      expect(result.current.validating).toBe(false);
    });

    await act(async () => {
      await result.current.login("bad@test.cl", "wrong");
    });

    expect(result.current.user).toBeNull();
    expect(result.current.error).toBe("Credenciales invalidas");
  });

  it("logout limpia usuario y llama a api.logout", async () => {
    (api.me as ReturnType<typeof vi.fn>).mockResolvedValue({ user: mockUser });

    const { result } = renderHook(() => useAuth());

    await vi.waitFor(() => {
      expect(result.current.validating).toBe(false);
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(api.logout).toHaveBeenCalled();
  });
});
