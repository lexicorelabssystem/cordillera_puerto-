import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { EmptyState } from "../../components/common/EmptyState";

interface AssessmentOption {
  assessment_id: string;
  title: string;
  assessment_type?: string;
  status: string;
  course_name: string;
  subject_name: string;
  attempts_count: number;
  grades_count?: number;
}

interface PendingGrading {
  assessmentId: string;
  totalPending: number;
  byStudent: { studentName: string; pendingCount: number }[];
}

const statusOrder: Record<string, number> = {
  IN_GRADING: 0,
  CLOSED: 1,
  GRADED: 2,
};

export function FastCorrectionPage() {
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");

  const assessmentsQuery = useQuery<AssessmentOption[]>({
    queryKey: ["assessments-correction"],
    queryFn: async () => {
      const data = (await api.listAssessments()) as AssessmentOption[];
      return data
        .filter((assessment) => ["IN_GRADING", "CLOSED", "GRADED"].includes(assessment.status))
        .sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9) || a.course_name.localeCompare(b.course_name) || a.title.localeCompare(b.title));
    },
  });

  const pendingQuery = useQuery<PendingGrading>({
    queryKey: ["pending-grading", selectedAssessmentId],
    queryFn: () => api.getPendingGrading(selectedAssessmentId) as Promise<PendingGrading>,
    enabled: Boolean(selectedAssessmentId),
  });

  const assessments = assessmentsQuery.data || [];
  const selectedAssessment = assessments.find((assessment) => assessment.assessment_id === selectedAssessmentId);
  const pending = pendingQuery.data;

  useEffect(() => {
    if (!selectedAssessmentId && assessments.length > 0) {
      setSelectedAssessmentId(assessments[0]!.assessment_id);
    }
  }, [assessments, selectedAssessmentId]);

  const summary = useMemo(() => ({
    total: assessments.length,
    inGrading: assessments.filter((assessment) => assessment.status === "IN_GRADING" || assessment.status === "CLOSED").length,
    graded: assessments.filter((assessment) => assessment.status === "GRADED").length,
    attempts: assessments.reduce((total, assessment) => total + (assessment.attempts_count || 0), 0),
    grades: assessments.reduce((total, assessment) => total + (assessment.grades_count || 0), 0),
  }), [assessments]);

  return (
    <>
      <section className="panel">
        <h3>Corrección Masiva</h3>
        <p style={{ color: "var(--muted)" }}>
          Selecciona una evaluación para revisar pendientes manuales o validar datos ya corregidos automáticamente.
        </p>

        {assessmentsQuery.isLoading ? <LoadingSpinner label="Cargando evaluaciones..." /> : assessments.length === 0 ? (
          <EmptyState title="Sin evaluaciones" description="No hay evaluaciones disponibles para revisar." />
        ) : (
          <>
            <section className="correccion-stats-grid" style={{ marginTop: 12, marginBottom: 16 }}>
              <div className="libro-card"><span className="libro-card__label">Evaluaciones</span><strong className="libro-card__value">{summary.total}</strong></div>
              <div className="libro-card libro-card--warning"><span className="libro-card__label">Por revisar</span><strong className="libro-card__value">{summary.inGrading}</strong></div>
              <div className="libro-card"><span className="libro-card__label">Corregidas</span><strong className="libro-card__value" style={{ color: "var(--success)" }}>{summary.graded}</strong></div>
              <div className="libro-card"><span className="libro-card__label">Intentos</span><strong className="libro-card__value">{summary.attempts}</strong></div>
              <div className="libro-card"><span className="libro-card__label">Notas</span><strong className="libro-card__value">{summary.grades}</strong></div>
            </section>

            <div className="form-row" style={{ marginBottom: 12 }}>
              <div className="form-field">
                <label>Evaluación</label>
                <select value={selectedAssessmentId} onChange={(event) => setSelectedAssessmentId(event.target.value)}>
                  {assessments.map((assessment) => (
                    <option key={assessment.assessment_id} value={assessment.assessment_id}>
                      {assessment.title} - {assessment.course_name} - {assessment.status}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}
      </section>

      {selectedAssessmentId && (
        <section className="panel">
          <h3>Pendientes de corrección</h3>
          {selectedAssessment ? (
            <p style={{ color: "var(--muted)", marginTop: -4 }}>
              {selectedAssessment.subject_name} - {selectedAssessment.course_name} - {selectedAssessment.attempts_count} intentos - {selectedAssessment.grades_count || 0} notas
            </p>
          ) : null}

          {pendingQuery.isLoading ? <LoadingSpinner size="sm" /> : null}
          {!pending ? (
            <EmptyState title="Cargando datos" description="Estamos consultando las respuestas pendientes de la evaluación seleccionada." />
          ) : pending.totalPending === 0 ? (
            <EmptyState title="Sin pendientes manuales" description="Esta evaluación no tiene respuestas pendientes. Las alternativas ya fueron corregidas automáticamente." />
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
                    {pending.byStudent.map((student) => (
                      <tr key={student.studentName}>
                        <td><strong>{student.studentName}</strong></td>
                        <td><span className="badge badge--warning">{student.pendingCount}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}
    </>
  );
}
