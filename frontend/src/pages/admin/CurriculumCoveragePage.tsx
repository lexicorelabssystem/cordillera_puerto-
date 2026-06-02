import type { AdminOverview } from "../../types/api";

interface Props {
  overview: AdminOverview;
}

function gradeLevelLabel(grade: number) {
  if (grade >= 9 && grade <= 12) return `${grade - 8}\u00b0 Medio`;
  return `${grade}\u00b0 B\u00e1sico`;
}

export function CurriculumCoveragePage({ overview }: Props) {
  const byGrade = new Map<number, { courses: string[] }>();
  (overview.courses || []).forEach((c) => {
    const entry = byGrade.get(c.grade_level) || { courses: [] };
    entry.courses.push(c.course_name);
    byGrade.set(c.grade_level, entry);
  });

  return (
    <>
      <section className="panel">
        <h3>Cobertura Curricular por Nivel</h3>
        <p style={{ color: "var(--muted)", fontSize: ".84rem", marginBottom: 12 }}>
          Estructura curricular del establecimiento: cursos activos, asignaturas disponibles y cobertura por nivel.
        </p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nivel</th>
                <th>Cursos</th>
                <th>Asignaturas</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(byGrade.entries()).sort(([a], [b]) => a - b).map(([grade, info]) => (
                <tr key={grade}>
                  <td><strong>{gradeLevelLabel(grade)}</strong></td>
                  <td>{info.courses.join(", ")}</td>
                  <td>{overview.subjects.filter((s) => {
                    if (grade <= 8) return s.name === "Lenguaje" || s.name === "Matemática";
                    if (grade === 6) return true;
                    if (grade === 8) return true;
                    return s.name === "Lenguaje" || s.name === "Matemática";
                  }).map((s) => s.name).join(", ")}</td>
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
