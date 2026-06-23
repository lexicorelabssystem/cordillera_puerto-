import React, { Suspense, lazy } from "react";
import { Route, useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { ErrorBoundary } from "../components/common/ErrorBoundary";
import { api } from "../lib/api";
import type { AdminOverview, AuthUser, RoleAlerts } from "../types/api";
import { useFeatureFlags } from "../hooks/useFeatureFlags";
import { DEFAULT_FEATURES, type FeatureFlag } from "@cordillera/shared/features.js";

function Lazy({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

interface AdminContext {
  overview: AdminOverview;
  user: AuthUser;
}

function useAdminContext() {
  return useOutletContext<AdminContext>();
}

const OverviewPage = lazy(() =>
  import("../pages/admin/OverviewPage").then((m) => ({ default: m.OverviewPage }))
);
const InstitutionsView = lazy(() =>
  import("../features/admin/InstitutionsView").then((m) => ({ default: m.InstitutionsView }))
);
const UsersView = lazy(() =>
  import("../features/admin/UsersView").then((m) => ({ default: m.UsersView }))
);
const AcademicYearsView = lazy(() =>
  import("../features/admin/AcademicYearsView").then((m) => ({ default: m.AcademicYearsView }))
);
const CoursesView = lazy(() =>
  import("../features/admin/CoursesView").then((m) => ({ default: m.CoursesView }))
);
const AssessmentsPage = lazy(() =>
  import("../pages/admin/AssessmentsPage").then((m) => ({ default: m.AssessmentsPage }))
);
const AssessmentTemplatesPage = lazy(() =>
  import("../pages/admin/AssessmentTemplatesPage").then((m) => ({ default: m.AssessmentTemplatesPage }))
);
const GradeChangeRequestsPage = lazy(() =>
  import("../pages/admin/GradeChangeRequestsPage").then((m) => ({ default: m.GradeChangeRequestsPage }))
);
const CurriculumPage = lazy(() =>
  import("../pages/admin/CurriculumPage").then((m) => ({ default: m.CurriculumPage }))
);
const QuestionBankPage = lazy(() =>
  import("../pages/admin/QuestionBankPage").then((m) => ({ default: m.QuestionBankPage }))
);
const StudentGradesPage = lazy(() =>
  import("../pages/admin/StudentGradesPage").then((m) => ({ default: m.StudentGradesPage }))
);
const SimceBankPage = lazy(() =>
  import("../pages/admin/SimceBankPage").then((m) => ({ default: m.SimceBankPage }))
);
const ReportsPage = lazy(() =>
  import("../pages/admin/ReportsPage").then((m) => ({ default: m.ReportsPage }))
);
const RemedialRoutesPage = lazy(() =>
  import("../pages/admin/RemedialRoutesPage").then((m) => ({ default: m.RemedialRoutesPage }))
);
const CorreccionPruebasPage = lazy(() =>
  import("../pages/admin/CorreccionPruebasPage").then((m) => ({ default: m.CorreccionPruebasPage }))
);
const FastCorrectionPage = lazy(() =>
  import("../pages/admin/FastCorrectionPage").then((m) => ({ default: m.FastCorrectionPage }))
);
const ProfesoresPage = lazy(() =>
  import("../pages/admin/ProfesoresPage").then((m) => ({ default: m.ProfesoresPage }))
);
const AlumnosPorCursoPage = lazy(() =>
  import("../pages/admin/AlumnosPorCursoPage").then((m) => ({ default: m.AlumnosPorCursoPage }))
);
const AlertsPage = lazy(() =>
  import("../pages/admin/AlertsPage").then((m) => ({ default: m.AlertsPage }))
);
const AttendancePage = lazy(() =>
  import("../pages/admin/AttendancePage").then((m) => ({ default: m.AttendancePage }))
);
const AuditLogsPage = lazy(() =>
  import("../pages/admin/AuditLogsPage").then((m) => ({ default: m.AuditLogsPage }))
);
const EvaluationsPage = lazy(() =>
  import("../pages/admin/EvaluationsPage").then((m) => ({ default: m.EvaluationsPage }))
);
const CurriculumCoveragePage = lazy(() =>
  import("../pages/admin/CurriculumCoveragePage").then((m) => ({ default: m.CurriculumCoveragePage }))
);
const ImportPage = lazy(() =>
  import("../pages/admin/ImportPage").then((m) => ({ default: m.ImportPage }))
);
const ExportPage = lazy(() =>
  import("../pages/admin/ExportPage").then((m) => ({ default: m.ExportPage }))
);
const LearningResourcesPage = lazy(() =>
  import("../pages/admin/LearningResourcesPage").then((m) => ({ default: m.LearningResourcesPage }))
);
const CalculationsPage = lazy(() =>
  import("../pages/admin/CalculationsPage").then((m) => ({ default: m.CalculationsPage }))
);
const LibroEvaluacionesPage = lazy(() =>
  import("../pages/admin/LibroEvaluacionesPage").then((m) => ({ default: m.LibroEvaluacionesPage }))
);

const GradebookPage = lazy(() =>
  import("../pages/admin/GradebookPage").then((m) => ({ default: m.GradebookPage }))
);

const BandejaPage = lazy(() =>
  import("../pages/admin/BandejaPage").then((m) => ({ default: m.BandejaPage }))
);

const AssessmentDetailPage = lazy(() =>
  import("../pages/admin/AssessmentDetailPage").then((m) => ({ default: m.AssessmentDetailPage }))
);

const StudentFullProfilePage = lazy(() =>
  import("../pages/admin/StudentFullProfilePage").then((m) => ({ default: m.StudentFullProfilePage }))
);

function OverviewWrapper() {
  const { overview } = useAdminContext();
  return <OverviewPage overview={overview} />;
}

function StudentGradesWrapper() {
  const { overview } = useAdminContext();
  return <StudentGradesPage overview={overview} />;
}

function EvaluationsMonitorWrapper() {
  const { overview } = useAdminContext();
  return <EvaluationsPage overview={overview} />;
}

function CurriculumCoverageWrapper() {
  const { overview } = useAdminContext();
  return <CurriculumCoveragePage overview={overview} />;
}

function AlertsPageWrapper() {
  const { overview } = useAdminContext();
  const alertsQuery = useQuery<RoleAlerts>({
    queryKey: ["alerts-management"],
    queryFn: () => api.myAlerts(),
  });
  return <AlertsPage alerts={alertsQuery.data} overview={overview} />;
}

function adminRoutes(mode: "admin" | "direction" | "utp" = "admin") {
  const ff = DEFAULT_FEATURES;
  const includeAdminOnly = mode === "admin";
  const includeUsers = mode === "admin" || mode === "utp";

  return (
    <>
      <Route index element={<Lazy><OverviewWrapper /></Lazy>} />
      <Route path="instituciones" element={<Lazy><InstitutionsView /></Lazy>} />
      {includeUsers && <Route path="usuarios" element={<Lazy><UsersView /></Lazy>} />}
      <Route path="academico" element={<Lazy><AcademicYearsView /></Lazy>} />
      <Route path="cursos" element={<Lazy><CoursesView /></Lazy>} />
      <Route path="alumnos" element={<Lazy><AlumnosPorCursoPage /></Lazy>} />
      <Route path="profesores" element={<Lazy><ProfesoresPage /></Lazy>} />
      <Route path="curriculum" element={<Lazy><CurriculumPage /></Lazy>} />
      <Route path="cobertura-curricular" element={<Lazy><CurriculumCoverageWrapper /></Lazy>} />
      <Route path="banco-preguntas" element={<Lazy><QuestionBankPage /></Lazy>} />
      <Route path="evaluaciones" element={<Lazy><AssessmentsPage /></Lazy>} />
      <Route path="banco-pruebas" element={<Lazy><AssessmentTemplatesPage /></Lazy>} />
      <Route path="libro-evaluaciones" element={<Lazy><LibroEvaluacionesPage /></Lazy>} />
      <Route path="gradebook" element={<Lazy><GradebookPage /></Lazy>} />
      <Route path="evaluaciones/:id" element={<Lazy><AssessmentDetailPage /></Lazy>} />
      <Route path="alumnos/:id" element={<Lazy><StudentFullProfilePage /></Lazy>} />
      {ff.online_assessments && <Route path="monitoreo" element={<Lazy><EvaluationsMonitorWrapper /></Lazy>} />}
      <Route path="cambios-nota" element={<Lazy><GradeChangeRequestsPage /></Lazy>} />
      <Route path="notas" element={<Lazy><StudentGradesWrapper /></Lazy>} />
      {ff.simce_bank && <Route path="simce" element={<Lazy><SimceBankPage /></Lazy>} />}
      <Route path="reportes" element={<Lazy><ReportsPage /></Lazy>} />
      {ff.remedial_routes && <Route path="remedial" element={<Lazy><RemedialRoutesPage /></Lazy>} />}
      <Route path="materiales" element={<Lazy><LearningResourcesPage /></Lazy>} />
      <Route path="promedios" element={<Lazy><CalculationsPage /></Lazy>} />
      {ff.online_assessments && <Route path="correccion" element={<Lazy><CorreccionPruebasPage /></Lazy>} />}
      <Route path="correccion-rapida" element={<Lazy><FastCorrectionPage /></Lazy>} />
      <Route path="alertas" element={<Lazy><AlertsPageWrapper /></Lazy>} />
      <Route path="asistencia" element={<Lazy><AttendancePage /></Lazy>} />
      <Route path="auditoria" element={<Lazy><AuditLogsPage /></Lazy>} />
      <Route path="bandeja" element={<Lazy><BandejaPage /></Lazy>} />
      {(includeAdminOnly || mode === "utp") && <Route path="importar" element={<Lazy><ImportPage /></Lazy>} />}
      {includeAdminOnly && <Route path="exportar" element={<Lazy><ExportPage /></Lazy>} />}
    </>
  );
}

function directionRoutes() {
  return adminRoutes("direction");
}

function utpRoutes() {
  return adminRoutes("utp");
}

export { adminRoutes, directionRoutes, utpRoutes };
