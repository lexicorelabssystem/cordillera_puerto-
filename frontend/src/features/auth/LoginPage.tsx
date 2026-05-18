import { FormEvent, useState } from "react";

interface Props {
  onLogin: (email: string, password: string) => Promise<void> | void;
  loading: boolean;
  error: string;
}

export function LoginPage({ onLogin, loading, error }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onLogin(email, password);
  }

  return (
    <main className="login-page">
      <section className="login-hero">
        <h1>CORDILLERA SAAS v4</h1>
        <p>Gestion de notas 0.0 a 7.0, KPI pedagogicos y monitoreo por curso en tiempo real.</p>
      </section>
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>Ingreso</h2>
        <p>Acceso habilitado para perfiles: Administracion, Direccion, Profesores y Alumnos.</p>
        <label>
          Correo
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>
        <label>
          Clave
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </label>
        {error ? <div className="error">{error}</div> : null}
        <button disabled={loading} type="submit">{loading ? "Entrando..." : "Entrar"}</button>
        <a href="/forgot-password" style={{ fontSize: "0.85rem", textAlign: "center", color: "var(--muted)" }}>
          ¿Olvidaste tu clave?
        </a>
      </form>
    </main>
  );
}
