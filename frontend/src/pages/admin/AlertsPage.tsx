import type { AdminOverview, RoleAlerts } from "../../types/api";

interface Props {
  alerts?: RoleAlerts;
  overview: AdminOverview;
}

export function AlertsPage({ alerts, overview }: Props) {
  return (
    <>
      <section className="panel">
        <h3>Semaforo de logro por curso</h3>
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
        <h3>Alertas pedagógicas</h3>
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
        <h3>Notificaciones institucionales por riesgo académico</h3>
        {!alerts?.alerts.length ? (
          <p>Sin alertas activas del sistema.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Curso</th>
                  <th>Alumno</th>
                  <th>Semestre</th>
                  <th>Promedio</th>
                  <th>Nivel</th>
                  <th>Mensaje</th>
                </tr>
              </thead>
              <tbody>
                {alerts.alerts.map((a) => (
                  <tr key={`${a.studentId}-${a.semester}-${a.courseId}`}>
                    <td>{a.courseName}</td>
                    <td>{a.studentName}</td>
                    <td>{a.semester}</td>
                    <td>{a.avgGrade}</td>
                    <td><span className={`badge ${a.level === "CRITICO" ? "badge--inactive" : a.level === "ALTO" ? "badge--warning" : "badge--active"}`}>{a.level}</span></td>
                    <td>{a.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
