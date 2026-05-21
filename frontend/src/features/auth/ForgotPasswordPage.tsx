import { FormEvent, useState } from "react";
import { api } from "../../lib/api";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const result = await api.forgotPassword(email);
      setSent(true);
      setMessage(result.message);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error al procesar la solicitud.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-hero">
        <h1>CORDILLERA SAAS v4</h1>
        <p>Recupera el acceso a tu cuenta.</p>
      </section>
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>Recuperar clave</h2>
        {!sent ? (
          <>
            <p>Ingresa tu correo electrónico y te enviaremos instrucciones.</p>
            <label>
              Correo
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
            </label>
            <button disabled={loading} type="submit">{loading ? "Enviando..." : "Enviar"}</button>
          </>
        ) : (
          <>
            <p>{message}</p>
            <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: 8 }}>
              El token de recuperacion se ha enviado a tu correo electronico.
            </p>
            <a href="/reset-password" style={{ textAlign: "center", display: "block", fontWeight: 600, color: "var(--accent)" }}>
              Ir a restablecer clave
            </a>
          </>
        )}
        {message && !sent ? <div className="error">{message}</div> : null}
        <a href="/" style={{ fontSize: "0.85rem", textAlign: "center", color: "var(--muted)" }}>
          Volver al inicio
        </a>
      </form>
    </main>
  );
}
