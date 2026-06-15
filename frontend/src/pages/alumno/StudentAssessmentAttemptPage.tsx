import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { ShellLayout } from "../../components/common/ShellLayout";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { useToast } from "../../components/common/Toast";
import { api } from "../../lib/api";
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

  const assessmentQuery = useQuery({
    queryKey: ["student-assessment-detail", id],
    queryFn: () => api.getAssessment(id!),
    enabled: Boolean(id),
  });

  const attemptQuery = useQuery({
    queryKey: ["student-assessment-attempt", attemptId],
    queryFn: () => api.getAssessmentAttempt(attemptId),
    enabled: Boolean(attemptId),
    refetchInterval: (q) => q.state.data?.status === "IN_PROGRESS" ? 15000 : false,
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
      if (!window.confirm("Al enviar la evaluacion no podras modificar tus respuestas. ¿Deseas continuar?")) {
        throw new Error("Envio cancelado.");
      }
      if (answerPayload.length) {
        await api.saveAssessmentAnswers(attemptId, { answers: answerPayload });
      }
      return api.submitAssessmentAttempt(attemptId, { confirmEmpty: true });
    },
    onSuccess: (result) => {
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
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "Envio cancelado.") return;
      toast(error instanceof Error ? error.message : "No se pudo enviar.", "error");
    },
  });

  function setOption(questionId: string, selectedOptionId: string) {
    setAnswers((cur) => ({ ...cur, [questionId]: { selectedOptionId } }));
  }

  function setText(questionId: string, textAnswer: string) {
    setAnswers((cur) => ({ ...cur, [questionId]: { textAnswer } }));
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

  const subjectName = assessment.subjectId ?? "General";
  const gradeLabel = "Sin nivel";

  return (
    <ShellLayout title="" subtitle="" className="shell--student simce-exam-shell" right={<button onClick={onLogout}>Cerrar sesion</button>}>
      <div className="simce-exam">
        <header className="simce-exam__topbar">
          <div className="simce-exam__topbar-main">
            <div>
              <div className="simce-exam__brand">Plataforma de Monitoreo de Aprendizajes · Cordillera</div>
              <h1 className="simce-exam__title">{assessment.title}</h1>
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

        {attemptId || locked ? (
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
                <button className="simce-exam__btn simce-exam__btn--primary" disabled={submitMutation.isPending} onClick={() => submitMutation.mutate()}>
                  {submitMutation.isPending ? "Enviando..." : "Enviar evaluacion"}
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        {submitted ? (
          <section className="simce-exam__result" style={{ display: "block" }}>
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
              <button className="simce-exam__btn simce-exam__btn--secondary" onClick={window.print}>Imprimir resultado</button>
            </div>
            {showReview ? (
              <div className="simce-exam__review" style={{ display: "block" }}>
                <table>
                  <thead>
                    <tr>
                      <th>N°</th>
                      <th>Pregunta</th>
                      <th>Tu respuesta</th>
                      <th>Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {questions.map((item, index) => {
                      const q = item.question;
                      const a = answers[item.questionId];
                      const opts = q.options ?? [];
                      const selectedOpt = a?.selectedOptionId ? opts.find((o) => o.id === a.selectedOptionId) : null;
                      const selectedText = selectedOpt
                        ? `${letterFor(opts.indexOf(selectedOpt))}. ${selectedOpt.text}`
                        : a?.textAnswer?.trim() || "Sin responder";
                      return (
                        <tr key={item.id}>
                          <td>{index + 1}</td>
                          <td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {q.statement}
                          </td>
                          <td>{selectedText}</td>
                          <td>
                            {a?.selectedOptionId || a?.textAnswer ? "Pendiente correccion" : "Sin responder"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        ) : null}

        <div className="simce-exam__footer">
          Plataforma Cordillera · Evaluacion digital · {assessment.title}
        </div>
      </div>
    </ShellLayout>
  );
}
