import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ShellLayout } from "../../components/common/ShellLayout";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { useToast } from "../../components/common/Toast";
import { api } from "../../lib/api";
import type { AuthUser } from "../../types/api";

interface Props {
  user: AuthUser;
  onLogout: () => void;
}

interface TeacherAssignmentView {
  assignment_id: string;
  course_id: string;
  course_name: string;
  subject_id: string;
  subject_name: string;
}

interface ImportedQuestion {
  draftQuestionId: string;
  numero: number;
  enunciado: string;
  tipo: string;
  alternativas: string[];
  respuestaCorrecta: string | null;
  puntaje: number;
  confianza: number;
}

function normalizeAssignments(data: unknown[]): TeacherAssignmentView[] {
  return data
    .map((assignment) => {
      const raw = assignment as {
        assignment_id?: string;
        course_id?: string;
        course_name?: string;
        subject_id?: string;
        subject_name?: string;
        id?: string;
        courseId?: string;
        subjectId?: string;
        course?: { id?: string; name?: string };
        subject?: { id?: string; name?: string };
      };
      return {
        assignment_id: raw.assignment_id ?? raw.id ?? "",
        course_id: raw.course_id ?? raw.courseId ?? raw.course?.id ?? "",
        course_name: raw.course_name ?? raw.course?.name ?? "Curso sin nombre",
        subject_id: raw.subject_id ?? raw.subjectId ?? raw.subject?.id ?? "",
        subject_name: raw.subject_name ?? raw.subject?.name ?? "Asignatura sin nombre",
      };
    })
    .filter((assignment) => assignment.assignment_id && assignment.course_id && assignment.subject_id);
}

export function ImportarPruebaPage({ user, onLogout }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const assignmentsQuery = useQuery({
    queryKey: ["teacher-assignments"],
    queryFn: () => api.myAssignments(),
  });
  const assignments = useMemo(() => normalizeAssignments((assignmentsQuery.data || []) as unknown[]), [assignmentsQuery.data]);
  const [assignmentId, setAssignmentId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [draftId, setDraftId] = useState("");
  const [questions, setQuestions] = useState<ImportedQuestion[]>([]);
  const selectedAssignment = assignments.find((assignment) => assignment.assignment_id === assignmentId);

  useEffect(() => {
    if (!assignmentId && assignments[0]) setAssignmentId(assignments[0].assignment_id);
  }, [assignmentId, assignments]);

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecciona un PDF.");
      if (!selectedAssignment) throw new Error("Selecciona curso y asignatura.");
      return api.importEvaluationPdf({
        file,
        courseId: selectedAssignment.course_id,
        subjectId: selectedAssignment.subject_id,
      });
    },
    onSuccess: (result) => {
      setDraftId(result.draftId);
      setQuestions(result.questions);
      toast(`Se detectaron ${result.questions.length} pregunta(s).`, "success");
    },
    onError: (error) => {
      toast(error instanceof Error ? error.message : "No se pudo importar el PDF.", "error");
    },
  });

  const commitMutation = useMutation({
    mutationFn: async () => {
      if (!draftId) throw new Error("Primero importa un PDF.");
      if (!selectedAssignment) throw new Error("Selecciona curso y asignatura.");
      const approved = questions.filter((question) => question.enunciado.trim());
      return api.commitImportedEvaluation(draftId, {
        courseId: selectedAssignment.course_id,
        subjectId: selectedAssignment.subject_id,
        questions: approved.map((question) => ({
          draftQuestionId: question.draftQuestionId,
          number: question.numero,
          statement: question.enunciado,
          type: question.tipo,
          alternatives: question.alternativas,
          correctAnswer: question.respuestaCorrecta,
          points: Number(question.puntaje) || 1,
        })),
      });
    },
    onSuccess: (result) => {
      toast(`${result.createdCount} pregunta(s) guardada(s) en el banco.`, "success");
      queryClient.invalidateQueries({ queryKey: ["questions"] });
      setDraftId("");
      setQuestions([]);
      setFile(null);
    },
    onError: (error) => {
      toast(error instanceof Error ? error.message : "No se pudo guardar en el banco.", "error");
    },
  });

  function updateQuestion(index: number, patch: Partial<ImportedQuestion>) {
    setQuestions((current) => current.map((question, i) => (i === index ? { ...question, ...patch } : question)));
  }

  function updateAlternative(questionIndex: number, alternativeIndex: number, value: string) {
    setQuestions((current) =>
      current.map((question, i) => {
        if (i !== questionIndex) return question;
        const alternatives = [...question.alternativas];
        alternatives[alternativeIndex] = value;
        return { ...question, alternativas: alternatives };
      }),
    );
  }

  const readyToSave = questions.length > 0 && questions.every((question) => {
    if (question.tipo !== "MULTIPLE_CHOICE" && question.tipo !== "TRUE_FALSE") return question.enunciado.trim();
    return question.enunciado.trim() && question.alternativas.filter(Boolean).length >= 2 && Boolean(question.respuestaCorrecta);
  });

  return (
    <ShellLayout
      title="Importador Inteligente de Pruebas"
      subtitle="Sube un PDF digital, revisa las preguntas detectadas y confirma la pauta antes de guardarlas."
      className="shell--teacher"
      right={<button className="btn-logout" onClick={onLogout}>Salir</button>}
    >
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Importar PDF</h3>
            <p>Las respuestas correctas quedan vacias hasta que las marques manualmente.</p>
          </div>
          <Link className="btn-secondary" to="/teacher">Volver</Link>
        </div>

        {assignmentsQuery.isLoading ? <LoadingSpinner size="sm" /> : null}
        <div className="teacher-material-upload">
          <div className="form-field">
            <label>Curso y asignatura</label>
            <select value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)}>
              {assignments.map((assignment) => (
                <option key={assignment.assignment_id} value={assignment.assignment_id}>
                  {assignment.course_name} - {assignment.subject_name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>PDF de la prueba</label>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            {file ? <small>{file.name}</small> : null}
          </div>
          <button disabled={!file || !selectedAssignment || importMutation.isPending} onClick={() => importMutation.mutate()}>
            {importMutation.isPending ? "Procesando..." : "Extraer preguntas"}
          </button>
        </div>
      </section>

      {questions.length ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Revision docente</h3>
              <p>{questions.length} pregunta(s) en borrador. Edita, asigna puntaje y marca la respuesta correcta.</p>
            </div>
            <button disabled={!readyToSave || commitMutation.isPending} onClick={() => commitMutation.mutate()}>
              {commitMutation.isPending ? "Guardando..." : "Guardar en banco de preguntas"}
            </button>
          </div>

          <div className="imported-test-list">
            {questions.map((question, questionIndex) => (
              <article key={question.draftQuestionId} className="imported-test-question">
                <div className="imported-test-question__head">
                  <strong>Pregunta {question.numero}</strong>
                  <span className="badge badge--info">{Math.round(question.confianza * 100)}% confianza</span>
                </div>
                <div className="form-field">
                  <label>Enunciado</label>
                  <textarea value={question.enunciado} onChange={(event) => updateQuestion(questionIndex, { enunciado: event.target.value })} rows={3} />
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label>Tipo</label>
                    <select value={question.tipo} onChange={(event) => updateQuestion(questionIndex, { tipo: event.target.value })}>
                      <option value="MULTIPLE_CHOICE">Seleccion multiple</option>
                      <option value="TRUE_FALSE">Verdadero/Falso</option>
                      <option value="SHORT_ANSWER">Respuesta corta</option>
                      <option value="ESSAY">Desarrollo</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Puntaje</label>
                    <input
                      type="number"
                      min={0.1}
                      step={0.5}
                      value={question.puntaje}
                      onChange={(event) => updateQuestion(questionIndex, { puntaje: Number(event.target.value) })}
                    />
                  </div>
                </div>

                {(question.tipo === "MULTIPLE_CHOICE" || question.tipo === "TRUE_FALSE") ? (
                  <div className="imported-test-options">
                    {question.alternativas.map((alternative, alternativeIndex) => (
                      <label key={`${question.draftQuestionId}-${alternativeIndex}`} className="imported-test-option">
                        <input
                          type="radio"
                          name={`correct-${question.draftQuestionId}`}
                          checked={question.respuestaCorrecta === alternative}
                          onChange={() => updateQuestion(questionIndex, { respuestaCorrecta: alternative })}
                        />
                        <input
                          value={alternative}
                          onChange={(event) => {
                            const wasCorrect = question.respuestaCorrecta === alternative;
                            updateAlternative(questionIndex, alternativeIndex, event.target.value);
                            if (wasCorrect) updateQuestion(questionIndex, { respuestaCorrecta: event.target.value });
                          }}
                        />
                      </label>
                    ))}
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => updateQuestion(questionIndex, { alternativas: [...question.alternativas, ""], respuestaCorrecta: question.respuestaCorrecta })}
                    >
                      Agregar alternativa
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </ShellLayout>
  );
}
