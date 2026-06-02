import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProviders } from "./app/providers";
import { InstitutionProvider } from "./app/InstitutionContext";
import { useAuth } from "./hooks/useAuth";
import { LoginPage } from "./features/auth/LoginPage";
import { ChangePasswordPage } from "./features/auth/ChangePasswordPage";
import { ForgotPasswordPage } from "./features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./features/auth/ResetPasswordPage";
import { ProfesorDashboard } from "./features/profesor/ProfesorDashboard";
import { AlumnoDashboard } from "./features/alumno/AlumnoDashboard";
import { LoadingSpinner } from "./components/common/LoadingSpinner";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { ToastProvider } from "./components/common/Toast";
import { adminRoutes, directionRoutes, utpRoutes } from "./app/routes";
import type { AuthUser } from "./types/api";

const AdminLayout = lazy(() =>
  import("./pages/admin/AdminLayout").then((m) => ({ default: m.AdminLayout }))
);

function SuspenseWrapper({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner label={label} />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

function getDefaultRouteForRole(role: AuthUser["role"]) {
  switch (role) {
    case "SUPER_ADMIN":
      return "/admin";
    case "DIRECTION":
      return "/direction";
    case "UTP":
      return "/utp";
    case "TEACHER":
      return "/teacher";
    case "STUDENT":
      return "/student";
    default:
      return "/sin-acceso";
  }
}

function RequireRole({
  user,
  allowed,
  children,
}: {
  user: AuthUser;
  allowed: AuthUser["role"][];
  children: React.ReactNode;
}) {
  if (!allowed.includes(user.role)) {
    return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
  }

  return <>{children}</>;
}

function NoAccess({ user, logout }: { user: AuthUser; logout: () => Promise<void> }) {
  return (
    <main className="shell shell--no-access">
      <section className="panel">
        <h1>Sin acceso habilitado</h1>
        <p>
          El rol {user.role} no tiene una vista activa en esta etapa del sistema.
        </p>
        <button className="btn-logout" onClick={logout}>
          Salir
        </button>
      </section>
    </main>
  );
}

function AuthenticatedApp({ user, logout }: { user: AuthUser; logout: () => Promise<void> }) {
  const redirectPath = getDefaultRouteForRole(user.role);

  return (
    <InstitutionProvider>
      <ErrorBoundary>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route path="/" element={<Navigate to={redirectPath} replace />} />
          <Route path="/sin-acceso" element={<NoAccess user={user} logout={logout} />} />
          <Route path="/teacher/*" element={
            <RequireRole user={user} allowed={["TEACHER"]}>
              <ProfesorDashboard user={user} onLogout={logout} />
            </RequireRole>
          } />
          <Route path="/student/*" element={
            <RequireRole user={user} allowed={["STUDENT"]}>
              <AlumnoDashboard user={user} onLogout={logout} />
            </RequireRole>
          } />

          <Route path="/admin/*" element={
            <RequireRole user={user} allowed={["SUPER_ADMIN"]}>
              <SuspenseWrapper label="Cargando modulo...">
                <AdminLayout user={user} onLogout={logout} mode="admin" />
              </SuspenseWrapper>
            </RequireRole>
          }>
            {adminRoutes()}
          </Route>

          <Route path="/direction/*" element={
            <RequireRole user={user} allowed={["DIRECTION"]}>
              <SuspenseWrapper label="Cargando modulo...">
                <AdminLayout user={user} onLogout={logout} mode="direction" />
              </SuspenseWrapper>
            </RequireRole>
          }>
            {directionRoutes()}
          </Route>

          <Route path="/utp/*" element={
            <RequireRole user={user} allowed={["UTP"]}>
              <SuspenseWrapper label="Cargando modulo...">
                <AdminLayout user={user} onLogout={logout} mode="utp" />
              </SuspenseWrapper>
            </RequireRole>
          }>
            {utpRoutes()}
          </Route>

          <Route path="*" element={<Navigate to={redirectPath} replace />} />
        </Routes>
      </ErrorBoundary>
    </InstitutionProvider>
  );
}

function AppContent() {
  const { user, loading, error, validating, login, logout, changePassword } = useAuth();

  if (validating) {
    return <LoadingSpinner label="Verificando sesion..." size="lg" />;
  }

  if (!user) {
    return <LoginPage onLogin={login} loading={loading} error={error} />;
  }

  if (user.mustChangePassword) {
    return <ChangePasswordPage onSubmit={changePassword} loading={loading} error={error} />;
  }

  return <AuthenticatedApp user={user} logout={logout} />;
}

export default function App() {
  return (
    <ToastProvider>
      <AppProviders>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </AppProviders>
    </ToastProvider>
  );
}
