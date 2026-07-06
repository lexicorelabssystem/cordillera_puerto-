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
        <div className="login-hero__brand">
          <img src="/educacore.png" alt="EducaCore" />
        </div>
        <div className="login-hero__copy">
          <p className="login-hero__eyebrow">Sistema de gestion escolar</p>
          <h1>EducaCore</h1>
          <p>
            Gestion educativa, evaluaciones y seguimiento pedagogico para comunidades escolares.
          </p>
        </div>
      </section>
      <section className="login-panel" aria-label="Acceso a EducaCore">
        <form className="login-form" onSubmit={handleSubmit}>
          <h2>Iniciar Sesion</h2>
          <p style={{ color: "var(--muted-light)", fontSize: ".88rem", marginBottom: "4px" }}>
            Acceso para Administracion, Direccion, UTP, Profesores y Alumnos.
          </p>
          <label className="form-field">
            <label>Correo electronico</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="admin@cordillera.cl" required autoFocus />
          </label>
          <label className="form-field">
            <label>Contrasena</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Admin2026*" required />
          </label>
          {error ? <div className="error">{error}</div> : null}
          <button disabled={loading} type="submit">
            {loading ? "Verificando..." : "Ingresar"}
          </button>
          <a href="/forgot-password">
            Olvidaste tu contrasena?
          </a>
        </form>
      </section>
    </main>
  );
}
