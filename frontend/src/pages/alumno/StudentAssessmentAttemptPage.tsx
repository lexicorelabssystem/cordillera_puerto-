import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { ShellLayout } from "../../components/common/ShellLayout";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { Modal } from "../../components/common/Modal";
import { useToast } from "../../components/common/Toast";
import { api } from "../../lib/api";
import { formatGradeLevel } from "../../lib/grade-levels";
import type { AuthUser } from "../../types/api";

interface Props {
  user: AuthUser;
  onLogout: () => void;
}

type LocalAnswer = { selectedOptionId?: string; textAnswer?: string };

function letterFor(index: number) {
  return String.fromCharCode(65 + index);
}

function levelFor(percent: number) {
  if (percent <= 49) return { name: "INICIAL", text: "0 – 49% · Requiere apoyo intensivo", cls: "simce-exam__level--inicial" };
  if (percent <= 74) return { name: "ELEMENTAL", text: "50 – 74% · Desarrollo basico logrado", cls: "simce-exam__level--elemental" };
  return { name: "ADECUADO", text: "75 – 100% · Aprendizajes consolidados", cls: "simce-exam__level--adecuado" };
}

function secondsToMMSS(total: number) {
  const m = Math.floor(total / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function StudentAssessmentAttemptPage({ user, onLogout }: Props) {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [attemptId, setAttemptId] = useState("");
  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>({});
  const [submitted, setSubmitted] = useState<null | {
    correct: number;
    total: number;
    percentage: number;
    grade: number | null;
    pendingManual: number;
    answers: { questionId: string; selectedOptionId: string | null; textAnswer: string | null; isCorrect: boolean | null; score: number | null }[];
  }>(null);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  const assessmentQuery = useQuery({
    queryKey: ["student-assessment-detail", id],
    queryFn: () => api.getAssessment(id!),
    enabled: Boolean(id),
  });

  const attemptQuery = useQuery({
    queryKey: ["student-assessment-attempt", attemptId],
    queryFn: () => api.getAssessmentAttempt(attemptId),
    enabled: Boolean(attemptId),
    refetchInterval: (q) => q.state.data?.status === "IN_PROGRESS" ? 60000 : false,
  });

  const assessment = assessmentQuery.data;
  const attempt = attemptQuery.data;

  const questions = useMemo(
    () => [...(assessment?.questions ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [assessment?.questions],
  );

  const locked = Boolean(attempt?.status && attempt.status !== "IN_PROGRESS");
  const totalQuestions = questions.length;
  const answeredCount = useMemo(() => {
    return questions.filter((q) => {
      const a = answers[q.questionId];
      return a?.selectedOptionId || a?.textAnswer?.trim();
    }).length;
  }, [questions, answers]);
  const progressPercent = totalQuestions ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  const answerPayload = useMemo(
    () =>
      Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        selectedOptionId: answer.selectedOptionId,
        textAnswer: answer.textAnswer,
      })),
    [answers],
  );

  useEffect(() => {
    if (!attemptId || locked || timerSeconds === null || timerSeconds <= 0) return;

    const id = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev === null || prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [attemptId, locked, timerSeconds]);

  const startMutation = useMutation({
    mutationFn: () => api.startAssessmentAttempt(id!),
    onSuccess: (result) => {
      setAttemptId(result.attemptId);
      if (result.timeLimitMin) {
        setTimerSeconds(result.timeLimitMin * 60);
      }
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
    },
    onError: (error) => {
      toast(error instanceof Error ? error.message : "No se pudo guardar.", "error");
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!attemptId) throw new Error("Primero inicia la evaluacion.");
      if (answerPayload.length) {
        await api.saveAssessmentAnswers(attemptId, { answers: answerPayload });
      }
      return api.submitAssessmentAttempt(attemptId, { confirmEmpty: true });
    },
    onSuccess: (result) => {
      setShowSubmitConfirm(false);
      setSubmitted({
        correct: Math.round((result.percentage / 100) * totalQuestions),
        total: totalQuestions,
        percentage: result.percentage,
        grade: result.grade,
        pendingManual: result.pendingManualCount,
        answers: [],
      });
      toast("Evaluacion enviada.", "success");
      queryClient.invalidateQueries({ queryKey: ["student-portal"] });
      queryClient.invalidateQueries({ queryKey: ["student-assessment-attempt", attemptId] });
    },
    onError: (error) => {
      toast(error instanceof Error ? error.message : "No se pudo enviar.", "error");
    },
  });

  function setOption(questionId: string, selectedOptionId: string) {
    setAnswers((cur) => ({ ...cur, [questionId]: { selectedOptionId } }));
  }

  function setText(questionId: string, textAnswer: string) {
    setAnswers((cur) => ({ ...cur, [questionId]: { textAnswer } }));
  }

  async function printSubmittedResult() {
    if (!attemptId) return;
    try {
      await attemptQuery.refetch();
      window.setTimeout(() => window.print(), 0);
    } catch {
      toast("No se pudo preparar la revisión para imprimir.", "error");
    }
  }
  function downloadCSV() {
    const rows = questions.map((q) => {
      const a = answers[q.questionId];
      const opts = q.question.options ?? [];
      const selected = a?.selectedOptionId ? opts.find((o) => o.id === a.selectedOptionId) : null;
      const selectedText = selected ? `${letterFor(opts.indexOf(selected))}. ${selected.text}` : (a?.textAnswer ?? "Sin responder");
      return [user.name, q.questionId, selectedText];
    });
    const csv = [["Estudiante", "PreguntaID", "Respuesta"], ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `respuestas_${user.name.replace(/\s+/g, "_")}_${Date.now()}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

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
        <section className="panel"><p>No se pudo cargar esta evaluacion.</p></section>
      </ShellLayout>
    );
  }

  const subjectName = assessment.subject?.name
    ?? assessment.questions.find((item) => item.question.subject?.name)?.question.subject?.name
    ?? "General";
  const gradeLabel = assessment.course?.gradeLevel
    ? formatGradeLevel(assessment.course.gradeLevel)
    : assessment.course?.name ?? "Sin nivel";
  const displayTitle = assessment.title.replace(/_+/g, " ").replace(/\s+/g, " ").trim();

  return (
    <ShellLayout title="" subtitle="" className="shell--student simce-exam-shell" right={<button onClick={onLogout}>Cerrar sesion</button>}>
      <div className="simce-exam">
        <header className="simce-exam__topbar">
          <div className="simce-exam__topbar-main">
            <div>
              <div className="simce-exam__brand">Plataforma de Monitoreo de Aprendizajes · Cordillera</div>
              <h1 className="simce-exam__title">{displayTitle}</h1>
              <p className="simce-exam__subtitle">{assessment.description || `${assessment.assessmentType} · ${subjectName} · ${gradeLabel}`}</p>
            </div>
            <div className="simce-exam__badge">{assessment.assessmentType === "SIMCE" ? "SIMCE" : "PRUEBA"}</div>
          </div>
          <section className="simce-exam__meta-grid">
            <div className="simce-exam__meta-item">
              <div className="simce-exam__meta-label">Asignatura</div>
              <div className="simce-exam__meta-value">{subjectName}</div>
            </div>
            <div className="simce-exam__meta-item">
              <div className="simce-exam__meta-label">Nivel</div>
              <div className="simce-exam__meta-value">{gradeLabel}</div>
            </div>
            <div className="simce-exam__meta-item">
              <div className="simce-exam__meta-label">Estudiante</div>
              <div className="simce-exam__meta-value">{user.name}</div>
            </div>
            <div className="simce-exam__meta-item">
              <div className="simce-exam__meta-label">Tiempo / Preguntas</div>
              <div className="simce-exam__meta-value">
                {assessment.timeLimitMin ? `${assessment.timeLimitMin} min` : "Sin limite"} · {totalQuestions} preguntas
              </div>
            </div>
            <div className="simce-exam__meta-item">
              <div className="simce-exam__meta-label">Puntaje maximo</div>
              <div className="simce-exam__meta-value">{assessment.maxScore} pts</div>
            </div>
          </section>
        </header>

        {!attemptId && !locked ? (
          <section className="simce-exam__card">
            <div className="simce-exam__card-title">Instrucciones — lee con atencion antes de comenzar</div>
            <div className="simce-exam__card-body simce-exam__instructions">
              <ul>
                <li>Esta evaluacion contiene <strong>{totalQuestions} preguntas</strong>.</li>
                {assessment.assessmentType === "MULTIPLE_CHOICE" || questions.some((q) => q.question.type === "MULTIPLE_CHOICE") ? (
                  <li>Cada pregunta de seleccion multiple tiene alternativas. Solo una es correcta.</li>
                ) : null}
                <li>Lee con calma cada pregunta y analiza todas las alternativas antes de responder.</li>
                {assessment.timeLimitMin ? <li>Dispones de <strong>{assessment.timeLimitMin} minutos</strong>. El cronometro es referencial.</li> : null}
                <li>Al finalizar, presiona <strong>Enviar evaluacion</strong> para ver el resultado.</li>
              </ul>
              <div className="simce-exam__init">
                <h3>¿Listo para comenzar?</h3>
                <p>Una vez que inicies, el tiempo comenzara a correr.</p>
                <button className="simce-exam__btn simce-exam__btn--primary" disabled={startMutation.isPending} onClick={() => startMutation.mutate()}>
                  {startMutation.isPending ? "Iniciando..." : "Iniciar evaluacion"}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {!submitted && (attemptId || locked) ? (
          <>
            <div className="simce-exam__sticky">
              <div className="simce-exam__progress-wrap">
                <div className="simce-exam__progress-bar" style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="simce-exam__pill">{answeredCount} / {totalQuestions} respondidas</div>
              <div className="simce-exam__pill">
                {timerSeconds !== null ? secondsToMMSS(timerSeconds) : assessment.timeLimitMin ? `${assessment.timeLimitMin}:00` : "--:--"}
              </div>
            </div>

            <section className="simce-exam__card">
              <div className="simce-exam__card-title">Preguntas · {assessment.title}</div>
              <div className="simce-exam__card-body">
                {questions.map((item, index) => {
                  const question = item.question;
                  const local = answers[item.questionId] ?? {};
                  const isObjective = question.type === "MULTIPLE_CHOICE" || question.type === "TRUE_FALSE";
                  const options = question.options ?? [];
                  return (
                    <article key={item.id} className="simce-exam__question" id={`pregunta-${index + 1}`}>
                      <div className="simce-exam__question-header">
                        <span>Pregunta {index + 1}</span>
                        <span>{item.points} pts</span>
                      </div>
                      <div className="simce-exam__question-body">
                        <div className="simce-exam__question-text">{question.statement}</div>
                        {isObjective ? (
                          <div className="simce-exam__options">
                            {options.map((option, optionIndex) => (
                              <label key={option.id} className="simce-exam__option">
                                <input
                                  type="radio"
                                  disabled={locked}
                                  name={`q-${item.questionId}`}
                                  checked={local.selectedOptionId === option.id}
                                  onChange={() => setOption(item.questionId, option.id)}
                                />
                                <span>
                                  <span className="simce-exam__option-letter">{letterFor(optionIndex)}</span>
                                  {option.text}
                                </span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <textarea
                            className="simce-exam__textarea"
                            disabled={locked}
                            rows={5}
                            placeholder="Escribe tu respuesta..."
                            value={local.textAnswer ?? ""}
                            onChange={(e) => setText(item.questionId, e.target.value)}
                          />
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            {!locked ? (
              <div className="simce-exam__actions">
                <button className="simce-exam__btn simce-exam__btn--secondary" onClick={window.print}>Imprimir</button>
                <button className="simce-exam__btn simce-exam__btn--secondary" onClick={downloadCSV}>Descargar CSV</button>
                <button className="simce-exam__btn simce-exam__btn--secondary" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                  {saveMutation.isPending ? "Guardando..." : "Guardar progreso"}
                </button>
                <button className="simce-exam__btn simce-exam__btn--primary" disabled={submitMutation.isPending} onClick={() => setShowSubmitConfirm(true)}>
                  {submitMutation.isPending ? "Enviando..." : "Enviar evaluacion"}
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        {submitted ? (
          <section className="simce-exam__result" style={{ display: "block" }}>
            <div style={{ background: "var(--success-bg, #ecfdf3)", color: "var(--success-text, #067647)", padding: "12px 16px", borderRadius: 8, marginBottom: 20, fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
              Evaluacion enviada exitosamente
            </div>
            <h2 style={{ margin: 0 }}>Resultado de la evaluacion</h2>
            <p style={{ margin: "6px 0 0", color: "#475467" }}>{user.name} · {assessment.title}</p>
            <div className="simce-exam__result-grid">
              <div className="simce-exam__result-item">
                <div className="simce-exam__result-number">{submitted.correct}</div>
                <div className="simce-exam__result-label">Correctas (aprox)</div>
              </div>
              <div className="simce-exam__result-item">
                <div className="simce-exam__result-number">{submitted.percentage}%</div>
                <div className="simce-exam__result-label">Logro</div>
              </div>
              <div className="simce-exam__result-item">
                <div className="simce-exam__result-number">{submitted.grade !== null ? submitted.grade : "--"}</div>
                <div className="simce-exam__result-label">Nota</div>
              </div>
              <div className="simce-exam__result-item">
                <div className="simce-exam__result-number">{totalQuestions}</div>
                <div className="simce-exam__result-label">Total preguntas</div>
              </div>
            </div>
            {(() => {
              const level = levelFor(submitted.percentage);
              return (
                <div className={`simce-exam__level ${level.cls}`}>
                  {level.name} · {level.text}
                </div>
              );
            })()}
            {submitted.pendingManual > 0 ? (
              <p style={{ marginTop: 10, color: "var(--muted)", fontSize: 13 }}>
                {submitted.pendingManual} pregunta(s) requieren correccion manual del profesor.
              </p>
            ) : null}
            <div className="simce-exam__actions" style={{ justifyContent: "flex-start", marginTop: 12 }}>
              <button className="simce-exam__btn simce-exam__btn--secondary" onClick={() => setShowReview(!showReview)}>
                {showReview ? "Ocultar revision" : "Mostrar/ocultar revision"}
              </button>
              <button className="simce-exam__btn simce-exam__btn--secondary" disabled={attemptQuery.isFetching} onClick={printSubmittedResult}>{attemptQuery.isFetching ? "Preparando..." : "Imprimir resultado"}</button>
            </div>
            <div className={`simce-exam__answer-review ${showReview ? "is-visible" : ""}`}>
              <div className="simce-exam__answer-review-heading">
                <h3>Revisión de respuestas</h3>
                <p>Compara tu alternativa con la respuesta correcta y revisa su explicación.</p>
              </div>
              {questions.map((item, index) => {
                const question = item.question;
                const answerData = attempt?.answers?.find((answer) => answer.questionId === item.questionId) as undefined | {
                  selectedOptionId: string | null;
                  textAnswer: string | null;
                  isCorrect?: boolean | null;
                  status?: string;
                  question?: { explanation?: string | null; options: { id: string; text: string; sortOrder: number; isCorrect?: boolean }[] };
                };
                const reviewOptions = ([...(answerData?.question?.options ?? question.options ?? [])] as { id: string; text: string; sortOrder: number; isCorrect?: boolean }[]).sort((a, b) => a.sortOrder - b.sortOrder);
                const selectedOptionId = answerData?.selectedOptionId ?? answers[item.questionId]?.selectedOptionId ?? null;
                const selectedOption = reviewOptions.find((option) => option.id === selectedOptionId);
                const correctOption = reviewOptions.find((option) => option.isCorrect);
                const explanation = answerData?.question?.explanation?.trim();
                const isObjective = question.type === "MULTIPLE_CHOICE" || question.type === "TRUE_FALSE";
                const isCorrect = answerData?.isCorrect === true;
                const isPending = answerData?.isCorrect == null && Boolean(answerData);
                const feedback = explanation
                  ? explanation
                  : correctOption
                    ? `La alternativa correcta es ${letterFor(reviewOptions.indexOf(correctOption))}: ${correctOption.text}.`
                    : "Esta pregunta requiere revisión del profesor.";

                return (
                  <article className={`simce-exam__answer-card ${isCorrect ? "is-correct" : isPending ? "is-pending" : "is-incorrect"}`} key={item.id}>
                    <div className="simce-exam__answer-card-head">
                      <span className="simce-exam__answer-number">{index + 1}</span>
                      <strong>{question.statement}</strong>
                      <span className="simce-exam__answer-status">
                        {isCorrect ? "✓ Correcta" : isPending ? "Pendiente" : "✕ Incorrecta"}
                      </span>
                    </div>
                    {isObjective ? (
                      <div className="simce-exam__answer-options">
                        {reviewOptions.map((option, optionIndex) => {
                          const selected = option.id === selectedOptionId;
                          const correct = option.isCorrect === true;
                          return (
                            <div className={`simce-exam__answer-option ${correct ? "is-correct" : ""} ${selected && !correct ? "is-selected-wrong" : ""}`} key={option.id}>
                              <span className="simce-exam__answer-letter">{letterFor(optionIndex)}</span>
                              <span>{option.text}</span>
                              <span className="simce-exam__answer-option-tag">
                                {correct && selected ? "Tu respuesta · Correcta" : correct ? "Respuesta correcta" : selected ? "Tu respuesta" : ""}
                              </span>
                            </div>
                          );
                        })}
                        {!selectedOption ? <p className="simce-exam__answer-omitted">No respondiste esta pregunta.</p> : null}
                      </div>
                    ) : (
                      <div className="simce-exam__answer-written">
                        <strong>Tu respuesta:</strong>
                        <p>{answerData?.textAnswer?.trim() || answers[item.questionId]?.textAnswer?.trim() || "Sin responder"}</p>
                      </div>
                    )}
                    <div className="simce-exam__answer-feedback">
                      <strong>{isCorrect ? "¿Por qué es correcta?" : isPending ? "Criterio de revisión" : "¿Por qué es incorrecta?"}</strong>
                      <p>{feedback}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <Modal
          isOpen={showSubmitConfirm}
          onClose={() => {
            if (!submitMutation.isPending) setShowSubmitConfirm(false);
          }}
          title="¿Enviar evaluación?"
          size="sm"
          className="simce-submit-modal"
          footer={(
            <>
              <button
                type="button"
                className="simce-exam__btn simce-exam__btn--secondary"
                disabled={submitMutation.isPending}
                onClick={() => setShowSubmitConfirm(false)}
              >
                Volver y revisar
              </button>
              <button
                type="button"
                className="simce-exam__btn simce-exam__btn--primary"
                disabled={submitMutation.isPending}
                onClick={() => submitMutation.mutate()}
              >
                {submitMutation.isPending ? "Enviando..." : "Sí, enviar evaluación"}
              </button>
            </>
          )}
        >
          <div className="simce-submit-confirm">
            <div className="simce-submit-confirm__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M22 2 11 13" />
                <path d="m22 2-7 20-4-9-9-4Z" />
              </svg>
            </div>
            <p className="simce-submit-confirm__lead">
              Revisa el resumen antes de finalizar. Después del envío ya no podrás modificar tus respuestas.
            </p>
            <div className="simce-submit-confirm__summary">
              <div>
                <span>Respondidas</span>
                <strong>{answeredCount}</strong>
              </div>
              <div className={answeredCount < totalQuestions ? "is-pending" : "is-complete"}>
                <span>Sin responder</span>
                <strong>{Math.max(totalQuestions - answeredCount, 0)}</strong>
              </div>
            </div>
            {answeredCount < totalQuestions ? (
              <div className="simce-submit-confirm__warning" role="status">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 9v4" />
                  <path d="M12 17h.01" />
                  <path d="M10.3 3.7 2.4 17.4A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.6L13.7 3.7a2 2 0 0 0-3.4 0Z" />
                </svg>
                Aún tienes {totalQuestions - answeredCount} pregunta(s) sin responder. Puedes volver para completarlas.
              </div>
            ) : (
              <div className="simce-submit-confirm__ready" role="status">
                Todas las preguntas están respondidas. Tu evaluación está lista para enviar.
              </div>
            )}
          </div>
        </Modal>
        <div className="simce-exam__footer">
          Plataforma Cordillera · Evaluacion digital · {displayTitle}
        </div>
      </div>
    </ShellLayout>
  );
}
