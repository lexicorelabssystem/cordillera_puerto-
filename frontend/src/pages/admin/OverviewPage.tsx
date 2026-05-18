import type { AdminOverview } from "../../types/api";
import { KpiCard } from "../../components/common/KpiCard";

interface Props {
  overview: AdminOverview;
}

export function OverviewPage({ overview }: Props) {
  const totals = overview.totals;
  return (
    <>
      <section className="kpi-grid">
        <KpiCard label="Usuarios" value={totals.users} />
        <KpiCard label="Cursos" value={totals.courses} />
        <KpiCard label="Alumnos" value={totals.students} />
        <KpiCard label="Evaluaciones" value={totals.assessments} />
      </section>
      <section className="panel">
        <h3>Semaforo de Logro por Curso</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Curso</th>
                <th>Promedio</th>
                <th>Nivel</th>
                <th>Registros</th>
              </tr>
            </thead>
            <tbody>
              {overview.semaforoCursos.map((row) => (
                <tr key={row.course_id}>
                  <td><strong>{row.course_name}</strong></td>
                  <td>{row.avg_grade ?? "-"}</td>
                  <td><span className={`badge ${row.level === "Alto" ? "badge--active" : row.level === "Medio" ? "badge--warning" : "badge--inactive"}`}>{row.level}</span></td>
                  <td>{row.total_grades}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h3>Alertas Pedagógicas</h3>
        {overview.alertas.length === 0 ? (
          <p>Sin alertas críticas en este momento.</p>
        ) : (
          <div className="alert-list">
            {overview.alertas.map((alerta) => (
              <article key={alerta.courseName} className="alert-card">
                <strong>{alerta.courseName}</strong> | Promedio {alerta.avgGrade}
                <p>{alerta.suggestion}</p>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="panel">
        <h3>Evaluaciones Recientes</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Evaluación</th>
                <th>Curso</th>
                <th>Asignatura</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Profesor</th>
              </tr>
            </thead>
            <tbody>
              {overview.recentAssessments.map((a) => (
                <tr key={a.assessment_id}>
                  <td><strong>{a.title}</strong></td>
                  <td>{a.course_name}</td>
                  <td>{a.subject_name}</td>
                  <td>{a.assessment_type}</td>
                  <td><span className={`badge ${a.status === "PUBLISHED" ? "badge--active" : a.status === "ACTIVE" ? "badge--warning" : "badge--inactive"}`}>{a.status}</span></td>
                  <td>{a.teacher_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
