import { FormEvent, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../lib/api";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get("token") || "";
  const [token, setToken] = useState(tokenFromUrl);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (newPassword !== confirmPassword) {
      setMessage("Las claves no coinciden.");
      return;
    }
    if (newPassword.length < 10) {
      setMessage("La clave debe tener al menos 10 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const result = await api.resetPassword(token, newPassword);
      setSuccess(true);
      setMessage(result.message);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error al restablecer la clave.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-hero">
        <h1>CORDILLERA SAAS v4</h1>
        <p>Establece una nueva clave de acceso.</p>
      </section>
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>Nueva clave</h2>
        {!success ? (
          <>
            <p>Ingresa el token de recuperación y tu nueva clave.</p>
            <label>
              Token de recuperación
              <input value={token} onChange={(e) => setToken(e.target.value)} required placeholder="Pega el token aquí" />
            </label>
            <label>
              Nueva clave (mín. 10 caracteres, mayúscula, minúscula, número, símbolo)
              <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" required minLength={10} />
            </label>
            <label>
              Confirmar clave
              <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" required />
            </label>
            {message ? <div className="error">{message}</div> : null}
            <button disabled={loading} type="submit">{loading ? "Restableciendo..." : "Restablecer clave"}</button>
          </>
        ) : (
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "#1d6e3a", fontWeight: 600 }}>{message}</p>
            <a href="/" style={{ fontWeight: 600, color: "var(--accent)" }}>Ir al inicio de sesión</a>
          </div>
        )}
        <a href="/" style={{ fontSize: "0.85rem", textAlign: "center", color: "var(--muted)" }}>
          Volver al inicio
        </a>
      </form>
    </main>
  );
}
