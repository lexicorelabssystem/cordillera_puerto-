import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { LoadingSpinner } from "../../../components/common/LoadingSpinner";
import { EmptyState } from "../../../components/common/EmptyState";
import { useToast } from "../../../components/common/Toast";
import { exportSimceStudentResultToPdf } from "../../../lib/simce-export";
import type { SimceAssessment, StudentResult, StudentResultQuestion } from "./simce.types";

interface Props {
  assessment: SimceAssessment;
}

function getStudentId(s: Record<string, unknown>): string {
  return (s.student_id ?? s.studentId ?? "") as string;
}

function getFirstName(s: Record<string, unknown>): string {
  return (s.first_name ?? s.firstName ?? "") as string;
}

function getLastName(s: Record<string, unknown>): string {
  return (s.last_name ?? s.lastName ?? "") as string;
}

export function SimceCorrectionView({ assessment }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

  const resultsQuery = useQuery({
    queryKey: ["simce-results", assessment.id],
    queryFn: () => api.getSimceResults(assessment.id) as Promise<{ results: { student: Record<string, unknown>; answered: boolean; percentage: number; totalCorrect: number; totalIncorrect: number; totalOmitted: number; totalQuestions: number; totalScore: number }[] }>,
  });

  const studentResultQuery = useQuery({
    queryKey: ["simce-student-result", assessment.id, selectedStudent],
    queryFn: () => api.getSimceStudentResult(assessment.id, selectedStudent!) as Promise<StudentResult>,
    enabled: Boolean(selectedStudent),
  });

  const students = resultsQuery.data?.results || [];

  const result = studentResultQuery.data;

  return (
    <div className="simce-correction">
      <div className="panel-heading">
        <div>
          <h3>Corrección por alumno</h3>
          <p style={{ color: "var(--muted)", fontSize: ".84rem" }}>
            Revisa las respuestas de cada alumno: verde = correcta, rojo = incorrecta, gris = omitida.
          </p>
        </div>
        {result && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn-small btn-secondary"
              onClick={() => exportSimceStudentResultToPdf(result)}
            >
              Exportar PDF
            </button>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        {resultsQuery.isLoading ? <LoadingSpinner size="sm" /> : students.length === 0 ? (
          <EmptyState title="Sin resultados" description="Aún no hay respuestas ingresadas." />
        ) : (
          <select value={selectedStudent || ""} onChange={(e) => setSelectedStudent(e.target.value || null)} style={{ maxWidth: 400 }}>
            <option value="">Seleccionar alumno</option>
            {students.map((s: { student: Record<string, unknown>; answered: boolean; percentage: number }) => {
              const raw = s.student;
              return (
                <option key={getStudentId(raw)} value={getStudentId(raw)}>
                  {getLastName(raw)}, {getFirstName(raw)}
                  {" "}{s.answered ? `(${s.percentage}%)` : "(sin responder)"}
                </option>
              );
            })}
          </select>
        )}
      </div>

      {selectedStudent && studentResultQuery.isLoading && <LoadingSpinner label="Cargando resultado..." />}

      {result && (
        <>
          <div className="kpi-grid simce-kpi-row">
            <div className="kpi-card"><span>Correctas</span><strong style={{ color: "var(--success)" }}>{result.summary.totalCorrect}</strong></div>
            <div className="kpi-card"><span>Incorrectas</span><strong style={{ color: "var(--danger)" }}>{result.summary.totalIncorrect}</strong></div>
            <div className="kpi-card"><span>Omitidas</span><strong style={{ color: "var(--muted)" }}>{result.summary.totalOmitted}</strong></div>
            <div className="kpi-card"><span>Puntaje</span><strong>{result.summary.totalScore} / {result.summary.maxScore}</strong></div>
            <div className="kpi-card"><span>Porcentaje</span><strong style={{ color: result.summary.percentage >= 60 ? "var(--success)" : "var(--danger)" }}>{result.summary.percentage}%</strong></div>
            <div className="kpi-card"><span>Nivel</span><strong>{result.summary.performanceLevel}</strong></div>
          </div>

          <div className="simce-correction-grid">
            {result.questions.map((q) => (
              <div
                key={q.questionNumber}
                className={`simce-correction-cell simce-correction-cell--${q.status.toLowerCase()}`}
                style={{
                  borderColor:
                    q.status === "CORRECT" ? "var(--success)" :
                    q.status === "INCORRECT" ? "var(--danger)" : "var(--muted)",
                  background:
                    q.status === "CORRECT" ? "var(--success-light, #e6ffe6)" :
                    q.status === "INCORRECT" ? "var(--danger-light, #ffe6e6)" : "var(--muted-light, #f5f5f5)",
                }}
              >
                <span className="simce-correction-cell__num">{q.questionNumber}</span>
                <div className="simce-correction-cell__content">
                  <span>Marcó: <strong>{q.selectedOption || "—"}</strong></span>
                  <span>Correcta: <strong>{q.correctOption}</strong></span>
                  <span>Puntaje: {q.scoreObtained}/{q.score}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
