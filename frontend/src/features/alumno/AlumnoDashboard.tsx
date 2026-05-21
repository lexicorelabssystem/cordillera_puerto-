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

export function AlumnoDashboard({ user, onLogout }: Props) {
  const portalQuery = useQuery({ queryKey: ["student-portal"], queryFn: api.studentPortal });
  const portal = portalQuery.data;

  if (portalQuery.isLoading) {
    return (
      <ShellLayout title="Pantalla Alumno" subtitle="Cargando tus datos..." right={null}>
        <LoadingSpinner label="Cargando panel de estudiante..." size="lg" />
      </ShellLayout>
    );
  }

  if (portalQuery.isError) {
    return (
      <ShellLayout title="Pantalla Alumno" subtitle="Error al cargar tus datos" right={null}>
        <section className="panel">
          <p style={{ color: "var(--danger)" }}>
            No se pudieron cargar tus datos academicos. Intenta recargar la pagina o contacta a tu profesor.
          </p>
        </section>
      </ShellLayout>
    );
  }

  return (
    <ShellLayout
      title="Pantalla Alumno"
      subtitle={`Bienvenido ${user.name}. Aqui puedes ver tus notas, KPI y avance semestral.`}
      right={<button onClick={onLogout}>Cerrar sesion</button>}
    >
      <section className="kpi-grid">
        <KpiCard label="Promedio general" value={portal?.overall.avgGrade ?? "-"} />
        <KpiCard label="Equivalente %" value={portal ? `${portal.overall.avgPercent}%` : "-"} />
        <KpiCard label="Nivel de desempeno" value={portal?.overall.level ?? "-"} />
        <KpiCard label="Estado anual" value={portal?.overall.status ?? "-"} />
      </section>

      <section className="panel">
        <h3>Cierre semestral</h3>
        {!portal?.semesters?.length ? (
          <p style={{ color: "var(--muted)" }}>No hay datos de cierre semestral disponibles.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Semestre</th>
                  <th>Promedio</th>
                  <th>Total notas</th>
                  <th>Cierre</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {portal.semesters.map((s) => (
                  <tr key={s.semester}>
                    <td>{s.semester}</td>
                    <td>{s.avgGrade}</td>
                    <td>{s.totalGrades}</td>
                    <td>{s.closed ? "Cerrado" : "Abierto"}</td>
                    <td>{s.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h3>Alertas personales</h3>
        {!portal?.alerts?.length ? (
          <p style={{ color: "var(--muted)" }}>Sin alertas academicas por ahora.</p>
        ) : (
          <div className="alert-list">
            {portal.alerts.map((a, idx) => (
              <article key={`${a.type}-${idx}`} className="alert-card">
                <strong>{a.type}</strong>
                <p>{a.message}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h3>Seguimiento de evaluaciones</h3>
        {!portal?.grades?.length ? (
          <p style={{ color: "var(--muted)" }}>Aun no tienes evaluaciones registradas.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Semestre</th>
                  <th>Asignatura</th>
                  <th>Evaluacion</th>
                  <th>Tipo</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {portal.grades.map((row) => (
                  <tr key={row.assessment_id}>
                    <td>{row.applied_at}</td>
                    <td>{row.semester ?? "-"}</td>
                    <td>{row.subject}</td>
                    <td>{row.title}</td>
                    <td>{row.assessment_type}</td>
                    <td>{row.grade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </ShellLayout>
  );
}
