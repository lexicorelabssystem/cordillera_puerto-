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
        <p className="login-hero__eyebrow">Sistema de gestion y acompanamiento escolar</p>
        <h1>Gestion educativa conectada para comunidades escolares.</h1>
        <p>
          Centraliza evaluaciones, seguimiento pedagogico y acompanamiento docente en una plataforma clara para equipos directivos, profesores y estudiantes.
        </p>
        <div className="login-hero__features" aria-label="Capacidades principales de EducaCore">
          <div className="login-hero__feature">
            <span>Seguimiento academico por curso, asignatura y estudiante.</span>
          </div>
          <div className="login-hero__feature">
            <span>Evaluaciones digitales, material de apoyo y retroalimentacion docente.</span>
          </div>
          <div className="login-hero__feature">
            <span>Informacion institucional organizada para decisiones pedagogicas oportunas.</span>
          </div>
        </div>
      </section>
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
    </main>
  );
}
