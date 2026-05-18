import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { EmptyState } from "../../components/common/EmptyState";

export function FastCorrectionPage() {
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");

  const assessmentsQuery = useQuery({
    queryKey: ["assessments-correction"],
    queryFn: () => api.listAssessments({ status: "IN_GRADING" }) as Promise<{ assessment_id: string; title: string; course_name: string; subject_name: string; attempts_count: number }[]>,
  });

  const pendingQuery = useQuery({
    queryKey: ["pending-grading", selectedAssessmentId],
    queryFn: () => api.getPendingGrading(selectedAssessmentId) as Promise<{ assessmentId: string; totalPending: number; byStudent: { studentName: string; pendingCount: number }[] }>,
    enabled: Boolean(selectedAssessmentId),
  });

  const assessments = (assessmentsQuery.data || []) as { assessment_id: string; title: string; course_name: string; subject_name: string; attempts_count: number }[];
  const pending = pendingQuery.data;

  return (
    <>
      <section className="panel">
        <h3>Corrección Rápida</h3>
        <p style={{ color: "var(--muted)" }}>
          Selecciona una evaluación en estado IN_GRADING para ver el resumen de correcciones pendientes.
        </p>
        <div className="form-row" style={{ marginBottom: 12 }}>
          <div className="form-field">
            <label>Evaluación con correcciones pendientes</label>
            <select value={selectedAssessmentId} onChange={(e) => setSelectedAssessmentId(e.target.value)}>
              <option value="">Seleccionar...</option>
              {assessments.map((a) => (<option key={a.assessment_id} value={a.assessment_id}>{a.title} - {a.course_name}</option>))}
            </select>
          </div>
        </div>
      </section>

      {selectedAssessmentId && (
        <section className="panel">
          <h3>Pendientes de corrección</h3>
          {pendingQuery.isLoading ? <LoadingSpinner size="sm" /> : null}
          {!pending ? (
            <EmptyState title="Selecciona una evaluación" description="Elige una evaluación para ver las respuestas pendientes de corrección manual." />
          ) : pending.totalPending === 0 ? (
            <EmptyState title="Sin pendientes" description="No hay respuestas pendientes de corrección para esta evaluación." />
          ) : (
            <>
              <div className="kpi-grid">
                <div className="kpi-card"><span>Total pendientes</span><strong>{pending.totalPending}</strong></div>
                <div className="kpi-card"><span>Alumnos con pendientes</span><strong>{pending.byStudent.length}</strong></div>
              </div>
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table className="table">
                  <thead><tr><th>Alumno</th><th>Respuestas pendientes</th></tr></thead>
                  <tbody>
                    {pending.byStudent.map((s: { studentName: string; pendingCount: number }, i: number) => (
                      <tr key={i}>
                        <td><strong>{s.studentName}</strong></td>
                        <td><span className="badge badge--warning">{s.pendingCount}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {assessments.length === 0 && !assessmentsQuery.isLoading && (
        <section className="panel">
          <EmptyState
            title="Sin evaluaciones pendientes"
            description="No hay evaluaciones en estado IN_GRADING. Las correcciones rápidas estarán disponibles cuando haya evaluaciones con respuestas de ensayo o desarrollo."
          />
        </section>
      )}
    </>
  );
}
