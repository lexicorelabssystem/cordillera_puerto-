import { useState, useEffect } from "react";
import type { AuthUser } from "../types/api";
import { api } from "../lib/api";

const USER_KEY = "auth_user";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [validating, setValidating] = useState(true);

  useEffect(() => {
    api.me()
      .then(({ user: currentUser }) => {
        localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
        setUser(currentUser);
      })
      .catch(() => {
        localStorage.removeItem(USER_KEY);
        setUser(null);
      })
      .finally(() => setValidating(false));
  }, []);

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
