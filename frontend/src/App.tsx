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
import { adminRoutes, directionRoutes } from "./app/routes";
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

function AuthenticatedApp({ user, logout }: { user: AuthUser; logout: () => Promise<void> }) {
  const redirectPath =
    user.role === "TEACHER" ? "/teacher" :
    user.role === "STUDENT" ? "/student" :
    user.role === "DIRECTION" ? "/direction" : "/admin";

  return (
    <InstitutionProvider>
      <ErrorBoundary>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route path="/" element={<Navigate to={redirectPath} replace />} />
          <Route path="/teacher" element={<ProfesorDashboard user={user} onLogout={logout} />} />
          <Route path="/student" element={<AlumnoDashboard user={user} onLogout={logout} />} />

          <Route path="/admin/*" element={
            <SuspenseWrapper label="Cargando modulo...">
              <AdminLayout user={user} onLogout={logout} mode="admin" />
            </SuspenseWrapper>
          }>
            {adminRoutes()}
          </Route>

          <Route path="/direction/*" element={
            <SuspenseWrapper label="Cargando modulo...">
              <AdminLayout user={user} onLogout={logout} mode="direction" />
            </SuspenseWrapper>
          }>
            {directionRoutes()}
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
