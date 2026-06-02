import type { AdminOverview } from "../../types/api";
import { KpiCard } from "../../components/common/KpiCard";

interface Props {
  overview: AdminOverview;
}

function levelBadgeClass(level: string) {
  if (level === "Alto") return "badge--active";
  if (level === "Medio") return "badge--warning";
  return "badge--inactive";
}

function statusBadgeClass(status: string) {
  if (status === "PUBLISHED") return "badge--active";
  if (status === "ACTIVE") return "badge--warning";
  return "badge--inactive";
}

export function OverviewPage({ overview }: Props) {
  const totals = overview.totals;
  const cursosConNotas = overview.semaforoCursos.filter((row) => row.total_grades > 0);
  const promedioGeneral =
    cursosConNotas.length > 0
      ? (
          cursosConNotas.reduce((sum, row) => sum + (row.avg_grade ?? 0), 0) /
          cursosConNotas.length
        ).toFixed(1)
      : "-";
  const cursosEnRiesgo = overview.semaforoCursos.filter((row) => row.level === "Bajo").length;
  const evaluacionesActivas = overview.recentAssessments.filter(
    (assessment) => assessment.status === "PUBLISHED" || assessment.status === "ACTIVE"
  ).length;

  return (
    <>
      <section className="kpi-grid">
        <KpiCard label="Usuarios" value={totals.users} />
        <KpiCard label="Cursos" value={totals.courses} />
        <KpiCard label="Alumnos" value={totals.students} />
        <KpiCard label="Evaluaciones" value={totals.assessments} />
      </section>

      <section className="overview-summary">
        <article className="overview-summary__card">
          <span>Promedio general</span>
          <strong>{promedioGeneral}</strong>
          <p>{cursosConNotas.length} cursos con registros de notas</p>
        </article>
        <article className="overview-summary__card overview-summary__card--warning">
          <span>Cursos en riesgo</span>
          <strong>{cursosEnRiesgo}</strong>
          <p>Nivel bajo en el semáforo académico</p>
        </article>
        <article className="overview-summary__card">
          <span>Evaluaciones activas</span>
          <strong>{evaluacionesActivas}</strong>
          <p>Publicadas o disponibles recientemente</p>
        </article>
      </section>

      <div className="overview-grid">
        <section className="panel overview-grid__main">
          <div className="panel-heading">
            <div>
              <h3>Semáforo de logro por curso</h3>
              <p>Promedio, nivel y cantidad de registros para revisar la salud académica.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table table--compact">
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
                    <td>
                      <strong>{row.course_name}</strong>
                    </td>
                    <td>{row.avg_grade ?? "-"}</td>
                    <td>
                      <span className={`badge ${levelBadgeClass(row.level)}`}>{row.level}</span>
                    </td>
                    <td>{row.total_grades}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel overview-grid__side">
          <div className="panel-heading">
            <div>
              <h3>Alertas pedagógicas</h3>
              <p>Prioridades que conviene atender primero.</p>
            </div>
          </div>
          {overview.alertas.length === 0 ? (
            <div className="empty-inline">
              <strong>Sin alertas críticas</strong>
              <span>El monitoreo no registra cursos con riesgo alto en este momento.</span>
            </div>
          ) : (
            <div className="alert-list">
              {overview.alertas.map((alerta) => (
                <article key={alerta.courseName} className="alert-card">
                  <strong>{alerta.courseName}</strong>
                  <span>Promedio {alerta.avgGrade}</span>
                  <p>{alerta.suggestion}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Evaluaciones recientes</h3>
            <p>Últimos instrumentos creados, con curso, estado y docente responsable.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table table--compact">
            <thead>
              <tr>
                <th>Evaluación</th>
                <th>Curso</th>
                <th>Asignatura</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Profesor</th>
                <th>Respuestas</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              {overview.recentAssessments.map((assessment) => (
                <tr key={assessment.assessment_id}>
                  <td>
                    <strong>{assessment.title}</strong>
                  </td>
                  <td>{assessment.course_name}</td>
                  <td>{assessment.subject_name}</td>
                  <td>{assessment.assessment_type}</td>
                  <td>
                    <span className={`badge ${statusBadgeClass(assessment.status)}`}>
                      {assessment.status}
                    </span>
                  </td>
                  <td>{assessment.teacher_name}</td>
                  <td>{assessment.attempts_count}</td>
                  <td>{assessment.grades_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
