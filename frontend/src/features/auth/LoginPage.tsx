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
        <h1>CORDILLERA SAAS</h1>
        <p>Plataforma de Monitoreo de Aprendizajes para establecimientos educacionales chilenos.</p>
        <div className="login-hero__features">
          <div className="login-hero__feature">
            <span className="login-hero__feature-icon">&#128202;</span>
            <span>KPIs pedagogicos en tiempo real</span>
          </div>
          <div className="login-hero__feature">
            <span className="login-hero__feature-icon">&#128214;</span>
            <span>Evaluaciones y banco de preguntas</span>
          </div>
          <div className="login-hero__feature">
            <span className="login-hero__feature-icon">&#128221;</span>
            <span>Reportes, alertas y rutas remediales</span>
          </div>
          <div className="login-hero__feature">
            <span className="login-hero__feature-icon">&#128187;</span>
            <span>Escala de notas chilena 1.0 a 7.0</span>
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
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Demo2026!*" required />
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
