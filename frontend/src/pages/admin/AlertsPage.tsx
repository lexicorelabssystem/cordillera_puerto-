import type { AdminOverview, RoleAlerts } from "../../types/api";

interface Props {
  alerts?: RoleAlerts;
  overview: AdminOverview;
}

export function AlertsPage({ alerts, overview }: Props) {

  return (
    <>
      <section className="panel">
        <h3>Semáforo de logro por curso</h3>
        <p style={{ color: "var(--muted)", fontSize: ".84rem", marginBottom: 12 }}>
          Monitoreo visual del rendimiento por curso. Verde = Alto (≥5.5), Amarillo = Medio (≥4.0), Rojo = Bajo (&lt;4.0).
        </p>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Curso</th><th>Promedio</th><th>Nivel</th><th>Registros</th></tr></thead>
            <tbody>
              {overview.semaforoCursos.map((row) => (
                <tr key={row.course_id}>
                  <td><strong>{row.course_name}</strong></td>
                  <td style={{ fontWeight: 700, color: (row.avg_grade ?? 0) < 4.0 ? "var(--danger)" : (row.avg_grade ?? 0) >= 5.5 ? "var(--success)" : "var(--ink)" }}>{row.avg_grade?.toFixed(1).replace(".", ",") ?? "—"}</td>
                  <td><span className={`badge ${row.level === "Alto" ? "badge--active" : row.level === "Medio" ? "badge--warning" : "badge--inactive"}`}>{row.level}</span></td>
                  <td style={{ textAlign: "center" }}>{row.total_grades}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h3>Alertas pedagógicas</h3>
        {overview.alertas.length === 0 ? (
          <p style={{ color: "var(--success)", fontWeight: 500 }}>Sin alertas críticas. Todos los cursos mantienen rendimiento adecuado.</p>
        ) : (
          <div className="alert-list">
            {overview.alertas.map((alerta) => (
              <article key={alerta.courseName} className="alert-card">
                <strong>{alerta.courseName}</strong> | Promedio {alerta.avgGrade.toFixed(1).replace(".", ",")}
                <p>{alerta.suggestion}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h3>Notificaciones institucionales</h3>
        {!alerts?.alerts?.length ? (
          <p style={{ color: "var(--muted)", fontSize: ".88rem" }}>Sin alertas activas del sistema en este momento. El monitoreo continúa en tiempo real.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Curso</th><th>Alumno</th><th>Semestre</th><th>Promedio</th><th>Nivel</th><th>Mensaje</th></tr></thead>
              <tbody>
                {alerts.alerts.map((a) => (
                  <tr key={`${a.studentId}-${a.semester}-${a.courseId}`}>
                    <td>{a.courseName}</td><td>{a.studentName}</td><td>{a.semester}</td>
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
