import { useMemo, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { LoadingSpinner } from "../../../components/common/LoadingSpinner";
import { EmptyState } from "../../../components/common/EmptyState";
import { useToast } from "../../../components/common/Toast";
import type { SimceAssessment } from "./simce.types";
import type { CourseStudentRow } from "../../../types/api";

const OPTIONS = ["A", "B", "C", "D", "E"];

function getStudentId(s: CourseStudentRow): string {
  return s.student_id ?? "";
}
function getFirstName(s: CourseStudentRow): string {
  return s.first_name ?? "";
}
function getLastName(s: CourseStudentRow): string {
  return s.last_name ?? "";
}

interface Props {
  assessment: SimceAssessment;
}

export function SimceStudentResponseGrid({ assessment }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [optimisticAnswers, setOptimisticAnswers] = useState<Record<number, string | null>>({});

  const keyQuery = useQuery({
    queryKey: ["simce-answer-key", assessment.id],
    queryFn: () => api.getSimceAnswerKey(assessment.id) as Promise<{ totalQuestions: number; items: { questionNumber: number }[] }>,
  });

  const studentsQuery = useQuery({
    queryKey: ["simce-course-students", assessment.id],
    queryFn: () => api.getCourseStudents(assessment.course?.id || ""),
    enabled: Boolean(assessment.course?.id),
  });

  const resultQuery = useQuery({
    queryKey: ["simce-student-result", assessment.id, selectedStudent],
    queryFn: () => api.getSimceStudentResult(assessment.id, selectedStudent!) as Promise<{
      questions: { questionNumber: number; selectedOption: string | null; status: string; isCorrect: boolean | null; scoreObtained: number }[];
    }>,
    enabled: Boolean(selectedStudent),
  });

  const responseMutation = useMutation({
    mutationFn: async (payload: { questionNumber: number; selectedOption: string | null }) => {
      const studentId = selectedStudent;
      if (!studentId) return;
      await api.saveSimceStudentResponses(assessment.id, studentId, {
        responses: [{ questionNumber: payload.questionNumber, selectedOption: payload.selectedOption || undefined }],
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["simce-student-result", assessment.id, selectedStudent] });
      queryClient.invalidateQueries({ queryKey: ["simce-results", assessment.id] });
      setOptimisticAnswers((prev) => {
        const next = { ...prev };
        delete next[variables.questionNumber];
        return next;
      });
    },
    onError: (error, variables) => {
      toast(error instanceof Error ? error.message : "No se pudo guardar la respuesta.", "error");
      setOptimisticAnswers((prev) => {
        const next = { ...prev };
        delete next[variables.questionNumber];
        return next;
      });
    },
  });

  const questionCount = keyQuery.data?.totalQuestions || 30;
  const students = studentsQuery.data || [];

  const existingAnswers = useMemo(() => {
    const map: Record<number, string | null> = {};
    if (resultQuery.data?.questions) {
      resultQuery.data.questions.forEach((q) => {
        map[q.questionNumber] = q.selectedOption ?? null;
      });
    }
    Object.entries(optimisticAnswers).forEach(([qnum, val]) => {
      map[Number(qnum)] = val;
    });
    return map;
  }, [resultQuery.data, optimisticAnswers]);

  const handleAnswer = useCallback((qnum: number, option: string | null) => {
    if (!selectedStudent) return;
    setOptimisticAnswers((prev) => ({ ...prev, [qnum]: option }));
    responseMutation.mutate({ questionNumber: qnum, selectedOption: option });
  }, [selectedStudent, responseMutation]);

  const handleBulkPaste = useCallback(() => {
    if (!selectedStudent) return;
    const input = window.prompt("Pega las respuestas (una por pregunta, ej: B,D,A,C,B,E,...):");
    if (!input) return;
    const letters = input.split(/[,;\s]+/).map((s) => s.trim().toUpperCase()).filter((s) => s.length === 1 && "ABCDE".includes(s));
    if (!letters.length) {
      toast("No se detectaron alternativas válidas (A, B, C, D, E).", "warning");
      return;
    }

    const ops: Record<number, string | null> = {};
    letters.forEach((letter, index) => {
      ops[index + 1] = letter;
    });

    const responses = Object.entries(ops).map(([qnum, opt]) => ({
      questionNumber: Number(qnum),
      selectedOption: opt || undefined,
    }));

    setOptimisticAnswers(ops);
    api.saveSimceStudentResponses(assessment.id, selectedStudent, { responses })
      .then(() => {
        toast(`${responses.length} respuestas guardadas.`, "success");
        queryClient.invalidateQueries({ queryKey: ["simce-student-result", assessment.id, selectedStudent] });
        queryClient.invalidateQueries({ queryKey: ["simce-results", assessment.id] });
        setOptimisticAnswers({});
      })
      .catch((error) => {
        toast(error instanceof Error ? error.message : "Error al guardar.", "error");
        setOptimisticAnswers({});
      });
  }, [selectedStudent, assessment.id, queryClient, toast]);

  const selectedStudentLabel = useMemo(() => {
    if (!selectedStudent) return null;
    const s = students.find((stu) => getStudentId(stu) === selectedStudent);
    return s ? `${getLastName(s)}, ${getFirstName(s)}` : selectedStudent;
  }, [selectedStudent, students]);

  const pendingCount = Object.keys(optimisticAnswers).length;

  return (
    <div className="simce-responses">
      <div className="panel-heading">
        <div>
          <h3>Respuestas por alumno</h3>
          <p style={{ color: "var(--muted)", fontSize: ".84rem" }}>
            Selecciona un alumno y marca sus alternativas. También puedes pegar todas las respuestas de una vez.
          </p>
        </div>
        {selectedStudentLabel && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {pendingCount > 0 && <span className="badge badge--warning">Guardando {pendingCount}...</span>}
            <span className="badge badge--info">{selectedStudentLabel}</span>
            <button className="btn-small" onClick={handleBulkPaste}>Pegar respuestas</button>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        {studentsQuery.isLoading ? <LoadingSpinner size="sm" /> : students.length === 0 ? (
          <EmptyState title="Sin alumnos" description="No hay alumnos matriculados en este curso." />
        ) : (
          <select
            value={selectedStudent || ""}
            onChange={(e) => {
              setSelectedStudent(e.target.value || null);
              setOptimisticAnswers({});
            }}
            style={{ maxWidth: 400 }}
          >
            <option value="">Seleccionar alumno</option>
            {students.map((s) => (
              <option key={getStudentId(s)} value={getStudentId(s)}>
                {getLastName(s)}, {getFirstName(s)}
              </option>
            ))}
          </select>
        )}
      </div>

      {selectedStudent && resultQuery.isLoading && !resultQuery.data && (
        <LoadingSpinner label="Cargando respuestas..." />
      )}

      {selectedStudent && resultQuery.data && (
        <div className="simce-response-grid">
          <div className="simce-response-header">
            <span>Pregunta</span>
            {OPTIONS.map((opt) => (
              <span key={opt}>{opt}</span>
            ))}
            <span>—</span>
          </div>
          {Array.from({ length: questionCount }, (_, i) => i + 1).map((qnum) => {
            const current = existingAnswers[qnum] ?? null;
            const isPending = qnum in optimisticAnswers;
            return (
              <div
                key={qnum}
                className="simce-response-row"
                style={{ opacity: isPending ? 0.6 : 1 }}
              >
                <span className="simce-response-row__num">{qnum}</span>
                {OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`simce-option-btn ${current === opt ? "simce-option-btn--selected" : ""}`}
                    onClick={() => handleAnswer(qnum, current === opt ? null : opt)}
                    disabled={responseMutation.isPending}
                    style={current === opt ? { background: "var(--primary)", color: "white", fontWeight: 700 } : {}}
                  >
                    {opt}
                  </button>
                ))}
                <button
                  type="button"
                  className={`simce-option-btn ${current === null ? "simce-option-btn--selected" : ""}`}
                  onClick={() => handleAnswer(qnum, null)}
                  disabled={responseMutation.isPending}
                  style={current === null ? { background: "var(--muted)", color: "white" } : {}}
                  title="Omitir / sin respuesta"
                >
                  —
                </button>
              </div>
            );
          })}
        </div>
      )}

      {selectedStudent && !resultQuery.isLoading && !resultQuery.data && students.length > 0 && (
        <EmptyState title="Sin respuestas" description="Este alumno aún no tiene respuestas registradas. Marca las alternativas arriba." />
      )}
    </div>
  );
}
