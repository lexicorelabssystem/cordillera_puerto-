import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShellLayout } from "../../components/common/ShellLayout";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { useToast } from "../../components/common/Toast";
import { api } from "../../lib/api";
import type { AuthUser } from "../../types/api";

interface Props {
  user: AuthUser;
  onLogout: () => void;
}

type LocalAnswer = {
  selectedOptionId?: string;
  textAnswer?: string;
};

function formatRemaining(seconds?: number | null) {
  if (seconds === null || seconds === undefined) return "Sin limite";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function StudentAssessmentAttemptPage({ user, onLogout }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [attemptId, setAttemptId] = useState("");
  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>({});
  const [submittedResult, setSubmittedResult] = useState<null | {
    percentage: number;
    grade: number | null;
    pendingManualCount: number;
  }>(null);

  const assessmentQuery = useQuery({
    queryKey: ["student-assessment-detail", id],
    queryFn: () => api.getAssessment(id!),
    enabled: Boolean(id),
  });

  const attemptQuery = useQuery({
    queryKey: ["student-assessment-attempt", attemptId],
    queryFn: () => api.getAssessmentAttempt(attemptId),
    enabled: Boolean(attemptId),
    refetchInterval: (query) => query.state.data?.status === "IN_PROGRESS" ? 30000 : false,
  });

  useEffect(() => {
    const savedAnswers = attemptQuery.data?.answers ?? [];
    if (!savedAnswers.length) return;
    setAnswers((current) => {
      const next = { ...current };
      for (const answer of savedAnswers) {
        next[answer.questionId] = {
          selectedOptionId: answer.selectedOptionId ?? undefined,
          textAnswer: answer.textAnswer ?? undefined,
        };
      }
      return next;
    });
  }, [attemptQuery.data?.answers]);

  const questions = useMemo(
    () => [...(assessmentQuery.data?.questions ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [assessmentQuery.data?.questions],
  );

  const answerPayload = useMemo(
    () =>
      Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        selectedOptionId: answer.selectedOptionId,
        textAnswer: answer.textAnswer,
      })),
    [answers],
  );

  const startMutation = useMutation({
    mutationFn: () => api.startAssessmentAttempt(id!),
    onSuccess: (result) => {
      setAttemptId(result.attemptId);
      toast("Evaluacion iniciada.", "success");
    },
    onError: (error) => {
      toast(error instanceof Error ? error.message : "No se pudo iniciar la evaluacion.", "error");
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!attemptId) throw new Error("Primero inicia la evaluacion.");
      return api.saveAssessmentAnswers(attemptId, { answers: answerPayload });
    },
    onSuccess: () => {
      toast("Progreso guardado.", "success");
      queryClient.invalidateQueries({ queryKey: ["student-assessment-attempt", attemptId] });
    },
    onError: (error) => {
      toast(error instanceof Error ? error.message : "No se pudo guardar.", "error");
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!attemptId) throw new Error("Primero inicia la evaluacion.");
      if (!window.confirm("Al enviar la evaluacion no podras modificar tus respuestas. ¿Deseas continuar?")) {
        throw new Error("Envio cancelado.");
      }
      if (answerPayload.length) {
        await api.saveAssessmentAnswers(attemptId, { answers: answerPayload });
      }
      return api.submitAssessmentAttempt(attemptId, { confirmEmpty: true });
    },
    onSuccess: (result) => {
      setSubmittedResult({
        percentage: result.percentage,
        grade: result.grade,
        pendingManualCount: result.pendingManualCount,
      });
      toast("Evaluacion enviada.", "success");
      queryClient.invalidateQueries({ queryKey: ["student-portal"] });
      queryClient.invalidateQueries({ queryKey: ["student-assessment-attempt", attemptId] });
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "Envio cancelado.") return;
      toast(error instanceof Error ? error.message : "No se pudo enviar.", "error");
    },
  });

  function setOption(questionId: string, selectedOptionId: string) {
    setAnswers((current) => ({ ...current, [questionId]: { selectedOptionId } }));
  }

  function setText(questionId: string, textAnswer: string) {
    setAnswers((current) => ({ ...current, [questionId]: { textAnswer } }));
  }

  const assessment = assessmentQuery.data;
  const attempt = attemptQuery.data;
  const locked = attempt?.status && attempt.status !== "IN_PROGRESS";
  const remainingSeconds = attempt?.timeRemainingSec ?? (assessment?.timeLimitMin ? assessment.timeLimitMin * 60 : null);

  if (assessmentQuery.isLoading) {
    return (
      <ShellLayout title="Evaluacion" subtitle="Cargando..." className="shell--student" right={<button onClick={onLogout}>Cerrar sesion</button>}>
        <LoadingSpinner label="Cargando evaluacion..." />
      </ShellLayout>
    );
  }

  if (!assessment) {
    return (
      <ShellLayout title="Evaluacion" subtitle="No disponible" className="shell--student" right={<button onClick={onLogout}>Cerrar sesion</button>}>
        <section className="panel">
          <p>No se pudo cargar esta evaluacion.</p>
          <Link className="btn-secondary" to="/student">Volver</Link>
        </section>
      </ShellLayout>
    );
  }

  return (
    <ShellLayout
      title={assessment.title}
      subtitle={`${assessment.assessmentType} - ${assessment.status}`}
      className="shell--student"
      right={<button onClick={onLogout}>Cerrar sesion</button>}
    >
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Formulario digital</h3>
            <p>{assessment.description || "Lee cada pregunta y responde antes de enviar."}</p>
          </div>
          <Link className="btn-secondary" to="/student">Volver</Link>
        </div>
        <div className="kpi-grid">
          <div className="kpi-card"><span>Preguntas</span><strong>{questions.length}</strong></div>
          <div className="kpi-card"><span>Puntaje</span><strong>{assessment.maxScore}</strong></div>
          <div className="kpi-card"><span>Tiempo</span><strong>{formatRemaining(remainingSeconds)}</strong></div>
        </div>
        {!attemptId && (
          <button disabled={startMutation.isPending || assessment.status !== "ACTIVE"} onClick={() => startMutation.mutate()}>
            {startMutation.isPending ? "Iniciando..." : "Iniciar evaluacion"}
          </button>
        )}
        {assessment.status !== "ACTIVE" && !attemptId ? (
          <p style={{ color: "var(--muted)" }}>La evaluacion no esta activa para responder en este momento.</p>
        ) : null}
      </section>

      {attemptId ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Respuestas</h3>
              <p>{locked ? "Este intento ya fue enviado." : "Puedes guardar progreso antes de enviar."}</p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn-secondary" disabled={Boolean(locked) || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                {saveMutation.isPending ? "Guardando..." : "Guardar progreso"}
              </button>
              <button disabled={Boolean(locked) || submitMutation.isPending} onClick={() => submitMutation.mutate()}>
                {submitMutation.isPending ? "Enviando..." : "Enviar evaluacion"}
              </button>
            </div>
          </div>

          <div className="imported-test-list">
            {questions.map((item, index) => {
              const question = item.question;
              const local = answers[item.questionId] ?? {};
              const isObjective = question.type === "MULTIPLE_CHOICE" || question.type === "TRUE_FALSE";
              return (
                <article key={item.id} className="imported-test-question">
                  <div className="imported-test-question__head">
                    <strong>Pregunta {index + 1}</strong>
                    <span className="badge badge--role">{item.points} pts</span>
                  </div>
                  <p>{question.statement}</p>
                  {isObjective ? (
                    <div className="imported-test-options">
                      {(question.options ?? []).map((option) => (
                        <label key={option.id} className="imported-test-option">
                          <input
                            type="radio"
                            disabled={Boolean(locked)}
                            name={`answer-${question.id}`}
                            checked={local.selectedOptionId === option.id}
                            onChange={() => setOption(item.questionId, option.id)}
                          />
                          <span>{option.text}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="form-field">
                      <label>Respuesta</label>
                      <textarea
                        disabled={Boolean(locked)}
                        rows={5}
                        value={local.textAnswer ?? ""}
                        onChange={(event) => setText(item.questionId, event.target.value)}
                      />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {submittedResult ? (
        <section className="panel">
          <h3>Resultado</h3>
          <p>
            Logro {submittedResult.percentage}%.
            {submittedResult.grade !== null
              ? ` Nota ${submittedResult.grade}.`
              : " La nota queda pendiente de correccion manual."}
          </p>
        </section>
      ) : null}
    </ShellLayout>
  );
}
