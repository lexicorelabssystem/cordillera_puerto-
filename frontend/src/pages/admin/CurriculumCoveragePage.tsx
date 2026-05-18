import type { AdminOverview } from "../../types/api";

interface Props {
  overview: AdminOverview;
}

export function CurriculumCoveragePage({ overview }: Props) {
  const byGrade = new Map<number, { courses: string[] }>();
  overview.courses.forEach((c) => {
    const entry = byGrade.get(c.grade_level) || { courses: [] };
    entry.courses.push(c.course_name);
    byGrade.set(c.grade_level, entry);
  });

  return (
    <>
      <section className="panel">
        <h3>Cobertura Curricular por Nivel</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nivel</th>
                <th>Cursos</th>
                <th>Asignaturas disponibles</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(byGrade.entries()).sort(([a], [b]) => a - b).map(([grade, data]) => (
                <tr key={grade}>
                  <td><strong>{grade}° Básico</strong></td>
                  <td>{data.courses.join(", ")}</td>
                  <td>{overview.subjects.length} asignaturas</td>
                  <td><span className="badge badge--active">Activo</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h3>Asignaturas del Sistema</h3>
        <div className="module-grid">
          {overview.subjects.map((s) => (
            <article key={s.id} className="module-card">
              <span>{s.code || "S/C"}</span>
              <strong>{s.name}</strong>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
