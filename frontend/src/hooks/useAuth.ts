import { useState, useEffect, useRef, useCallback } from "react";
import type { AuthUser } from "../types/api";
import { api, setSessionExpiredHandler } from "../lib/api";

const USER_KEY = "cordillera_user";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [validating, setValidating] = useState(true);
  const mountedRef = useRef(true);

  const forceLogout = useCallback(() => {
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setValidating(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    setSessionExpiredHandler(forceLogout);

    let refreshTimer: ReturnType<typeof setInterval> | undefined;

    api.me()
      .then(({ user: currentUser }) => {
        if (!mountedRef.current) return;
        localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
        setUser(currentUser);

        refreshTimer = setInterval(async () => {
          try {
            await fetch(`${import.meta.env.VITE_API_BASE_URL || "/api/v1"}/auth/refresh`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
            });
          } catch {
            // Silent fail — next API call will trigger refresh or force logout
          }
        }, 10 * 60 * 1000);
      })
      .catch(() => {
        if (!mountedRef.current) return;
        localStorage.removeItem(USER_KEY);
        setUser(null);
      })
      .finally(() => {
        if (mountedRef.current) setValidating(false);
      });

    return () => {
      mountedRef.current = false;
      if (refreshTimer) clearInterval(refreshTimer);
    };
  }, [forceLogout]);

  function storeUser(currentUser: AuthUser) {
    localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
    setUser(currentUser);
  }

  async function login(email: string, password: string) {
    setLoading(true);
    setError("");
    try {
      const result = await api.login({ email, password });
      storeUser(result.user);
    } catch (err) {
      if (err instanceof TypeError) {
        setError("No se pudo conectar con el servidor. Verifica que backend y frontend esten ejecutandose.");
      } else {
        setError(err instanceof Error ? err.message : "No fue posible iniciar sesion");
      }
    } finally {
      setLoading(false);
    }
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    setLoading(true);
    setError("");
    try {
      const result = await api.changePassword({ currentPassword, newPassword });
      storeUser(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible cambiar la clave");
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await api.logout();
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }

  return { user, loading, error, validating, login, logout, changePassword };
}
