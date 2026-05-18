import type { AdminOverview } from "../../types/api";

interface Props {
  overview: AdminOverview;
}

export function EvaluationsPage({ overview }: Props) {
  const byType = new Map<string, number>();
  overview.recentAssessments.forEach((a) => {
    byType.set(a.assessment_type, (byType.get(a.assessment_type) || 0) + 1);
  });

  return (
    <>
      <section className="panel">
        <h3>Monitoreo de Evaluaciones</h3>
        <div className="module-grid">
          {Array.from(byType.entries()).map(([type, count]) => (
            <article key={type} className="module-card">
              <span>{count} evaluaciones</span>
              <strong>{type}</strong>
            </article>
          ))}
        </div>
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
                  <td><span className={`badge ${a.status === "PUBLISHED" || a.status === "ACTIVE" ? "badge--active" : "badge--inactive"}`}>{a.status}</span></td>
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
