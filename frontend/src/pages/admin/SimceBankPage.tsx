import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";

export function SimceBankPage() {
  const assessmentsQuery = useQuery({
    queryKey: ["simce-assessments"],
    queryFn: () => api.listAssessments({ assessmentType: "SIMCE" }) as Promise<unknown[]>,
  });

  const items = (assessmentsQuery.data || []) as unknown as { assessment_id: string; title: string; assessment_type: string; status: string; course_name: string; subject_name: string; attempts_count: number; grades_count: number }[];

  return (
    <section className="panel">
      <h3>Banco de Ensayos SIMCE</h3>
      <p style={{ color: "var(--muted)", fontSize: ".84rem", marginBottom: 12 }}>
        Banco de ensayos tipo SIMCE disponibles para 4° y 6° básico. Cada ensayo incluye preguntas alineadas a los OA del nivel.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div className="kpi-card"><span>Total ensayos</span><strong>{items.length}</strong></div>
        <div className="kpi-card" style={{ borderLeftColor: "var(--success)" }}><span>Matemática 4°</span><strong>{items.filter((a) => a.subject_name?.includes("Matemática") && a.course_name?.includes("4")).length}</strong></div>
        <div className="kpi-card" style={{ borderLeftColor: "var(--info)" }}><span>Lectura 4°</span><strong>{items.filter((a) => a.subject_name?.includes("Lenguaje") && a.course_name?.includes("4")).length}</strong></div>
        <div className="kpi-card" style={{ borderLeftColor: "var(--warning)" }}><span>Matemática 6°</span><strong>{items.filter((a) => a.subject_name?.includes("Matemática") && a.course_name?.includes("6")).length}</strong></div>
        <div className="kpi-card" style={{ borderLeftColor: "var(--accent)" }}><span>Lectura 6°</span><strong>{items.filter((a) => a.subject_name?.includes("Lenguaje") && a.course_name?.includes("6")).length}</strong></div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Ensayo</th><th>Curso</th><th>Asignatura</th><th>Intentos</th><th>Notas</th><th>Estado</th></tr></thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.assessment_id}>
                <td><strong>{a.title}</strong></td>
                <td>{a.course_name}</td>
                <td>{a.subject_name}</td>
                <td style={{ textAlign: "center" }}>{a.attempts_count}</td>
                <td style={{ textAlign: "center" }}>{a.grades_count}</td>
                <td><span className={`badge ${a.status === "PUBLISHED" || a.status === "ACTIVE" ? "badge--active" : "badge--warning"}`}>{a.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
