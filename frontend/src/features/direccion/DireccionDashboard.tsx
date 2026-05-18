import { useQuery } from "@tanstack/react-query";
import { ShellLayout } from "../../components/common/ShellLayout";
import { KpiCard } from "../../components/common/KpiCard";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { api } from "../../lib/api";
import type { AuthUser } from "../../types/api";

interface Props {
  user: AuthUser;
  onLogout: () => void;
}

export function DireccionDashboard({ user, onLogout }: Props) {
  const overviewQuery = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => api.adminOverview(),
  });

  const alertsQuery = useQuery({
    queryKey: ["alerts-management"],
    queryFn: () => api.myAlerts(),
  });

  const overview = overviewQuery.data;

  if (overviewQuery.isLoading) {
    return <LoadingSpinner label="Cargando panel de direccion..." size="lg" />;
  }

  return (
    <ShellLayout
      title="Panel Direccion"
      subtitle={`Bienvenido/a ${user.name}. Supervision general del establecimiento, indicadores clave y monitoreo pedagogico.`}
      right={<button onClick={onLogout}>Cerrar sesion</button>}
    >
      <section className="kpi-grid">
        <KpiCard label="Estudiantes activos" value={overview?.studentCount ?? "-"} />
        <KpiCard label="Cursos" value={overview?.courseCount ?? "-"} />
        <KpiCard label="Docentes" value={overview?.teacherCount ?? "-"} />
        <KpiCard label="Evaluaciones publicadas" value={overview?.assessmentCount ?? "-"} />
      </section>

      <section className="kpi-grid" style={{ marginTop: "1rem" }}>
        <KpiCard
          label="Alumnos en riesgo"
          value={alertsQuery.data?.summary?.atRiskCount ?? "-"}
        />
        <KpiCard
          label="OAs con bajo rendimiento"
          value={alertsQuery.data?.summary?.lowPerformingOaCount ?? "-"}
        />
        <KpiCard
          label="Cobertura evaluaciones (%)"
          value={overview?.coverageRate ? `${overview.coverageRate}%` : "-"}
        />
        <KpiCard
          label="Asignaturas activas"
          value={overview?.subjectCount ?? "-"}
        />
      </section>

      <section className="panel" style={{ marginTop: "1.5rem" }}>
        <h3>Resumen institucional</h3>
        <p>
          El panel de Direccion permite supervisar resultados academicos, cobertura de
          evaluaciones, alertas de riesgo y gestion pedagogica en tiempo real. Accede a
          las secciones del menu lateral para explorar reportes detallados, curriculum,
          banco de preguntas y rutas remediales.
        </p>
      </section>

      {alertsQuery.data && alertsQuery.data.recent && alertsQuery.data.recent.length > 0 && (
        <section className="panel" style={{ marginTop: "1rem" }}>
          <h3>Alertas recientes</h3>
          <ul>
            {alertsQuery.data.recent.slice(0, 5).map((alert: { id: string; message: string }) => (
              <li key={alert.id}>{alert.message}</li>
            ))}
          </ul>
        </section>
      )}
    </ShellLayout>
  );
}
