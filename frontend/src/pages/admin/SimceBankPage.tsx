import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { EmptyState } from "../../components/common/EmptyState";

export function SimceBankPage() {
  const assessmentsQuery = useQuery({
    queryKey: ["simce-assessments"],
    queryFn: () => api.listAssessments({ assessmentType: "SIMCE" }) as Promise<{ assessment_id: string; title: string; assessment_type: string; status: string; course_name: string; subject_name: string; attempts_count: number; grades_count: number }[]>,
  });

  const items = assessmentsQuery.data || [];

  return (
    <section className="panel">
      <h3>Banco de Ensayos SIMCE</h3>
      {assessmentsQuery.isLoading ? <LoadingSpinner size="sm" /> : null}
      {items.length === 0 && !assessmentsQuery.isLoading ? (
        <EmptyState
          title="Sin ensayos SIMCE"
          description="Crea evaluaciones tipo SIMCE desde el módulo de Evaluaciones para que aparezcan aquí."
          action={<button onClick={() => window.location.hash = "/admin/evaluaciones"}>Ir a Evaluaciones</button>}
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Ensayo</th><th>Curso</th><th>Asignatura</th><th>Intentos</th><th>Notas</th><th>Estado</th></tr></thead>
            <tbody>
              {items.map((a: { assessment_id: string; title: string; course_name: string; subject_name: string; attempts_count: number; grades_count: number; status: string }) => (
                <tr key={a.assessment_id}>
                  <td><strong>{a.title}</strong></td>
                  <td>{a.course_name}</td>
                  <td>{a.subject_name}</td>
                  <td>{a.attempts_count}</td>
                  <td>{a.grades_count}</td>
                  <td><span className={`badge ${a.status === "PUBLISHED" ? "badge--active" : "badge--warning"}`}>{a.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
