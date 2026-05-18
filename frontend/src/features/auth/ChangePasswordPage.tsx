import { FormEvent, useState } from "react";

interface Props {
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>;
  loading: boolean;
  error: string;
}

export function ChangePasswordPage({ onSubmit, loading, error }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError("");
    if (newPassword !== confirmPassword) {
      setLocalError("La confirmacion de clave no coincide.");
      return;
    }
    await onSubmit(currentPassword, newPassword);
  }

  return (
    <main className="login-page">
      <section className="login-hero">
        <h1>Actualizacion de seguridad</h1>
        <p>Debes cambiar tu clave temporal antes de acceder al sistema.</p>
      </section>
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>Cambiar clave</h2>
        <label>
          Clave actual
          <input
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            type="password"
            required
          />
        </label>
        <label>
          Nueva clave
          <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" required />
        </label>
        <label>
          Confirmar nueva clave
          <input
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            type="password"
            required
          />
        </label>
        {localError ? <div className="error">{localError}</div> : null}
        {error ? <div className="error">{error}</div> : null}
        <button disabled={loading} type="submit">{loading ? "Actualizando..." : "Guardar nueva clave"}</button>
      </form>
    </main>
  );
}
