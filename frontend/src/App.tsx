import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate, useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppProviders } from "./app/providers";
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
import { api } from "./lib/api";
import type { AdminOverview, RoleAlerts } from "./types/api";

const AdminLayout = lazy(() =>
  import("./pages/admin/AdminLayout").then((m) => ({ default: m.AdminLayout }))
);
const OverviewPage = lazy(() =>
  import("./pages/admin/OverviewPage").then((m) => ({ default: m.OverviewPage }))
);
const InstitutionsView = lazy(() =>
  import("./features/admin/InstitutionsView").then((m) => ({ default: m.InstitutionsView }))
);
const UsersView = lazy(() =>
  import("./features/admin/UsersView").then((m) => ({ default: m.UsersView }))
);
const AcademicYearsView = lazy(() =>
  import("./features/admin/AcademicYearsView").then((m) => ({ default: m.AcademicYearsView }))
);
const CoursesView = lazy(() =>
  import("./features/admin/CoursesView").then((m) => ({ default: m.CoursesView }))
);
const AssessmentsPage = lazy(() =>
  import("./pages/admin/AssessmentsPage").then((m) => ({ default: m.AssessmentsPage }))
);
const GradeChangeRequestsPage = lazy(() =>
  import("./pages/admin/GradeChangeRequestsPage").then((m) => ({ default: m.GradeChangeRequestsPage }))
);
const CurriculumPage = lazy(() =>
  import("./pages/admin/CurriculumPage").then((m) => ({ default: m.CurriculumPage }))
);
const QuestionBankPage = lazy(() =>
  import("./pages/admin/QuestionBankPage").then((m) => ({ default: m.QuestionBankPage }))
);
const StudentGradesPage = lazy(() =>
  import("./pages/admin/StudentGradesPage").then((m) => ({ default: m.StudentGradesPage }))
);
const SimceBankPage = lazy(() =>
  import("./pages/admin/SimceBankPage").then((m) => ({ default: m.SimceBankPage }))
);
const ReportsPage = lazy(() =>
  import("./pages/admin/ReportsPage").then((m) => ({ default: m.ReportsPage }))
);
const RemedialRoutesPage = lazy(() =>
  import("./pages/admin/RemedialRoutesPage").then((m) => ({ default: m.RemedialRoutesPage }))
);
const FastCorrectionPage = lazy(() =>
  import("./pages/admin/FastCorrectionPage").then((m) => ({ default: m.FastCorrectionPage }))
);
const AlertsPage = lazy(() =>
  import("./pages/admin/AlertsPage").then((m) => ({ default: m.AlertsPage }))
);
const AuditLogsPage = lazy(() =>
  import("./pages/admin/AuditLogsPage").then((m) => ({ default: m.AuditLogsPage }))
);
const EvaluationsMonitorPage = lazy(() =>
  import("./pages/admin/EvaluationsPage").then((m) => ({ default: m.EvaluationsPage }))
);
const CurriculumCoveragePage = lazy(() =>
  import("./pages/admin/CurriculumCoveragePage").then((m) => ({ default: m.CurriculumCoveragePage }))
);
const ImportPage = lazy(() =>
  import("./pages/admin/ImportPage").then((m) => ({ default: m.ImportPage }))
);
const ExportPage = lazy(() =>
  import("./pages/admin/ExportPage").then((m) => ({ default: m.ExportPage }))
);
const LearningResourcesPage = lazy(() =>
  import("./pages/admin/LearningResourcesPage").then((m) => ({ default: m.LearningResourcesPage }))
);
const CalculationsPage = lazy(() =>
  import("./pages/admin/CalculationsPage").then((m) => ({ default: m.CalculationsPage }))
);

interface AdminContext {
  overview: AdminOverview;
}

function useAdminContext() {
  return useOutletContext<AdminContext>();
}

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

function OverviewPageWrapper() {
  const { overview } = useAdminContext();
  return <OverviewPage overview={overview} />;
}

function StudentGradesPageWrapper() {
  const { overview } = useAdminContext();
  return <StudentGradesPage overview={overview} />;
}

function AlertsPageWrapper() {
  const { overview } = useAdminContext();
  const alertsQuery = useQuery<RoleAlerts>({
    queryKey: ["alerts-management"],
    queryFn: api.myAlerts,
  });
  return <AlertsPage alerts={alertsQuery.data} overview={overview} />;
}

function EvaluationsMonitorWrapper() {
  const { overview } = useAdminContext();
  return <EvaluationsMonitorPage overview={overview} />;
}

function CurriculumCoverageWrapper() {
  const { overview } = useAdminContext();
  return <CurriculumCoveragePage overview={overview} />;
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

  const role = user.role;
  const redirectPath =
    role === "TEACHER" ? "/teacher" :
    role === "STUDENT" ? "/student" :
    role === "DIRECTION" ? "/direction" : "/admin";

  return (
    <ErrorBoundary>
    <Routes>
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {!user ? (
        <Route path="*" element={<LoginPage onLogin={login} loading={loading} error={error} />} />
      ) : user.mustChangePassword ? (
        <Route path="*" element={<ChangePasswordPage onSubmit={changePassword} loading={loading} error={error} />} />
      ) : (
        <>
          <Route path="/" element={<Navigate to={redirectPath} replace />} />
          <Route path="/teacher" element={<ProfesorDashboard user={user} onLogout={logout} />} />
          <Route path="/student" element={<AlumnoDashboard user={user} onLogout={logout} />} />
          <Route path="/admin/*" element={<Suspense fallback={<LoadingSpinner label="Cargando modulo..." />}><ErrorBoundary><AdminLayout user={user} onLogout={logout} mode="admin" /></ErrorBoundary></Suspense>}>
            <Route index element={<OverviewPageWrapper />} />
            <Route path="instituciones" element={<SuspenseWrapper><InstitutionsView /></SuspenseWrapper>} />
            <Route path="usuarios" element={<SuspenseWrapper><UsersView /></SuspenseWrapper>} />
            <Route path="academico" element={<SuspenseWrapper><AcademicYearsView /></SuspenseWrapper>} />
            <Route path="cursos" element={<SuspenseWrapper><CoursesView /></SuspenseWrapper>} />
            <Route path="curriculum" element={<SuspenseWrapper><CurriculumPage /></SuspenseWrapper>} />
            <Route path="cobertura-curricular" element={<CurriculumCoverageWrapper />} />
            <Route path="banco-preguntas" element={<SuspenseWrapper><QuestionBankPage /></SuspenseWrapper>} />
            <Route path="evaluaciones" element={<SuspenseWrapper><AssessmentsPage /></SuspenseWrapper>} />
            <Route path="monitoreo" element={<EvaluationsMonitorWrapper />} />
            <Route path="cambios-nota" element={<SuspenseWrapper><GradeChangeRequestsPage /></SuspenseWrapper>} />
            <Route path="notas" element={<StudentGradesPageWrapper />} />
            <Route path="simce" element={<SuspenseWrapper><SimceBankPage /></SuspenseWrapper>} />
            <Route path="reportes" element={<SuspenseWrapper><ReportsPage /></SuspenseWrapper>} />
            <Route path="remedial" element={<SuspenseWrapper><RemedialRoutesPage /></SuspenseWrapper>} />
            <Route path="materiales" element={<SuspenseWrapper><LearningResourcesPage /></SuspenseWrapper>} />
            <Route path="promedios" element={<SuspenseWrapper><CalculationsPage /></SuspenseWrapper>} />
            <Route path="correccion" element={<SuspenseWrapper><FastCorrectionPage /></SuspenseWrapper>} />
            <Route path="alertas" element={<AlertsPageWrapper />} />
            <Route path="auditoria" element={<SuspenseWrapper><AuditLogsPage /></SuspenseWrapper>} />
            <Route path="importar" element={<SuspenseWrapper><ImportPage /></SuspenseWrapper>} />
            <Route path="exportar" element={<SuspenseWrapper><ExportPage /></SuspenseWrapper>} />
          </Route>
          <Route path="/direction/*" element={<Suspense fallback={<LoadingSpinner label="Cargando modulo..." />}><ErrorBoundary><AdminLayout user={user} onLogout={logout} mode="direction" /></ErrorBoundary></Suspense>}>
            <Route index element={<OverviewPageWrapper />} />
            <Route path="instituciones" element={<SuspenseWrapper><InstitutionsView /></SuspenseWrapper>} />
            <Route path="academico" element={<SuspenseWrapper><AcademicYearsView /></SuspenseWrapper>} />
            <Route path="cursos" element={<SuspenseWrapper><CoursesView /></SuspenseWrapper>} />
            <Route path="curriculum" element={<SuspenseWrapper><CurriculumPage /></SuspenseWrapper>} />
            <Route path="cobertura-curricular" element={<CurriculumCoverageWrapper />} />
            <Route path="banco-preguntas" element={<SuspenseWrapper><QuestionBankPage /></SuspenseWrapper>} />
            <Route path="evaluaciones" element={<SuspenseWrapper><AssessmentsPage /></SuspenseWrapper>} />
            <Route path="monitoreo" element={<EvaluationsMonitorWrapper />} />
            <Route path="cambios-nota" element={<SuspenseWrapper><GradeChangeRequestsPage /></SuspenseWrapper>} />
            <Route path="notas" element={<StudentGradesPageWrapper />} />
            <Route path="simce" element={<SuspenseWrapper><SimceBankPage /></SuspenseWrapper>} />
            <Route path="reportes" element={<SuspenseWrapper><ReportsPage /></SuspenseWrapper>} />
            <Route path="remedial" element={<SuspenseWrapper><RemedialRoutesPage /></SuspenseWrapper>} />
            <Route path="materiales" element={<SuspenseWrapper><LearningResourcesPage /></SuspenseWrapper>} />
            <Route path="promedios" element={<SuspenseWrapper><CalculationsPage /></SuspenseWrapper>} />
            <Route path="correccion" element={<SuspenseWrapper><FastCorrectionPage /></SuspenseWrapper>} />
            <Route path="alertas" element={<AlertsPageWrapper />} />
          </Route>
          <Route path="*" element={<Navigate to={redirectPath} replace />} />
        </>
      )}
    </Routes>
    </ErrorBoundary>
  );
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
