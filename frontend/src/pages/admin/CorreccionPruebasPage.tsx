import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { VoiceTextarea } from "../../components/voice/VoiceTextarea";

interface AssessmentItem {
  assessment_id: string;
  title: string;
  assessment_type: string;
  status: string;
  course_name: string;
  subject_name: string;
  attempts_count: number;
  grades_count: number;
}

interface AttemptAnswer {
  questionId: string;
  question: { statement: string; type: string };
  textAnswer: string | null;
  selectedOptionId: string | null;
  score: number | null;
  status: string;
  isCorrect: boolean | null;
}

interface AttemptRow {
  id: string;
  studentId: string;
  student: { firstName: string; lastName: string };
  status: string;
  totalScore: number | null;
  percentage: number | null;
  answers: AttemptAnswer[];
}

function calcularNota(puntaje: number, max: number): number {
  const pct = max > 0 ? puntaje / max : 0;
  return Math.round((1.0 + pct * 6) * 10) / 10;
}

export function CorreccionPruebasPage() {
  const [evaluacionId, setEvaluacionId] = useState<string>("");
  const [estudianteIdx, setEstudianteIdx] = useState(0);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [puntajesManuales, setPuntajesManuales] = useState<Record<string, number>>({});
  const [mensajeGuardado, setMensajeGuardado] = useState("");
  const [modoRapido, setModoRapido] = useState(true);
  const [puntajesRapidos, setPuntajesRapidos] = useState<Record<string, string>>({});

  const assessmentsQuery = useQuery<AssessmentItem[]>({
    queryKey: ["assessments-correccion"],
    queryFn: () => api.listAssessments({ status: "IN_GRADING" }) as Promise<AssessmentItem[]>,
  });

  const attemptsQuery = useQuery<AttemptRow[]>({
    queryKey: ["attempts-correccion", evaluacionId],
    queryFn: () => api.getAssessmentAttempts(evaluacionId) as Promise<AttemptRow[]>,
    enabled: Boolean(evaluacionId),
  });

  const summaryQuery = useQuery({
    queryKey: ["grading-summary", evaluacionId],
    queryFn: () => api.getGradingSummary(evaluacionId),
    enabled: Boolean(evaluacionId),
  });

  const assessments = assessmentsQuery.data || [];
  const attempts = attemptsQuery.data || [];
  const summary = summaryQuery.data as { title?: string; totalQuestions?: number; totalAttempts?: number; answersByStatus?: Record<string, number>; grades?: { average: number; count: number; details: { studentName: string; grade: number }[] } } | undefined;

  const evaluacion = assessments.find((a) => a.assessment_id === evaluacionId) || null;
  const puntajeMaximo = evaluacion
    ? attempts.reduce((max, attempt) => {
        const maxPerStudent = attempt.answers.length; 
        return maxPerStudent > max ? maxPerStudent : max;
      }, 0) * 10
    : 100;

  const stats = useMemo(() => {
    const completados = attempts.filter((a) => a.status === "COMPLETED").length;
    const corregidos = attempts.filter((a) => a.status !== "IN_PROGRESS" && a.percentage !== null).length;
    const pendientesRevision = attempts.filter((a) => a.answers.some((ans) => ans.status === "MANUAL_REVIEW" || ans.status === "PENDING")).length;
    const notas = attempts.filter((a) => a.totalScore !== null).map((a) => calcularNota(a.totalScore || 0, puntajeMaximo));
    const promedioNotas = notas.length > 0 ? notas.reduce((s, n) => s + n, 0) / notas.length : 0;
    const bajo4 = notas.filter((n) => n < 4.0).length;
    return {
      total: attempts.length,
      completados,
      corregidos,
      pendientesRevision,
      promedioNotas,
      bajo4,
    };
  }, [attempts, puntajeMaximo]);

  const intentoActual = attempts[estudianteIdx] || null;

  function handleSelectEvaluacion(id: string) {
    setEvaluacionId(id);
    setEstudianteIdx(0);
    setFeedback({});
    setPuntajesManuales({});
    setPuntajesRapidos({});
    setMensajeGuardado("");
  }

  function handleGuardarCorreccion() {
    setMensajeGuardado("Correccion guardada correctamente.");
    setTimeout(() => setMensajeGuardado(""), 2500);
  }

  function handleSetPuntaje(preguntaId: string, valor: number) {
    setPuntajesManuales((prev) => ({ ...prev, [preguntaId]: valor }));
  }

  function navegarEstudiante(dir: "prev" | "next") {
    if (dir === "prev" && estudianteIdx > 0) setEstudianteIdx(estudianteIdx - 1);
    if (dir === "next" && estudianteIdx < attempts.length - 1) setEstudianteIdx(estudianteIdx + 1);
  }

  function handlePuntajeRapido(intentoId: string, valor: string) {
    setPuntajesRapidos((prev) => ({ ...prev, [intentoId]: valor }));
  }

  function getNotaRapida(intentoId: string): string {
    const raw = puntajesRapidos[intentoId];
    if (!raw) return "—";
    const pts = parseFloat(raw.replace(",", "."));
    if (isNaN(pts) || pts < 0) return "—";
    const nota = calcularNota(pts, puntajeMaximo);
    return nota.toFixed(1).replace(".", ",");
  }

  const evaluacionesPorAsignatura = useMemo(() => {
    const grupos: Record<string, AssessmentItem[]> = {};
    for (const ev of assessments) {
      const key = `${ev.subject_name} | ${ev.course_name}`;
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(ev);
    }
    return grupos;
  }, [assessments]);

  return (
    <div className="correccion-module">
      <header className="libro-header" style={{ marginBottom: 16 }}>
        <div className="libro-header__title">
          <h1>Correccion de Pruebas</h1>
          <p>Revisa y califica evaluaciones. Modo rapido para ingreso directo de notas o modo detallado para revision pregunta por pregunta.</p>
        </div>
      </header>

      <section className="panel">
        <h3>Seleccionar evaluacion para corregir</h3>
        {assessmentsQuery.isLoading ? <LoadingSpinner label="Cargando evaluaciones..." /> : assessments.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No hay evaluaciones pendientes de correccion.</p>
        ) : (
        <div className="form-grid">
          {Object.entries(evaluacionesPorAsignatura).map(([grupo, evs]) => (
            <div key={grupo} style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: ".78rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>{grupo}</label>
              {evs.map((ev) => (
                <button
                  key={ev.assessment_id}
                  className={`correccion-eval-btn ${evaluacionId === ev.assessment_id ? "correccion-eval-btn--active" : ""}`}
                  onClick={() => handleSelectEvaluacion(ev.assessment_id)}
                  style={{ justifyContent: "flex-start", textAlign: "left", background: evaluacionId === ev.assessment_id ? "var(--accent)" : "var(--card)", color: evaluacionId === ev.assessment_id ? "#fff" : "var(--ink)", border: `1.5px solid ${evaluacionId === ev.assessment_id ? "var(--accent)" : "var(--line)"}` }}
                >
                  <div>
                    <strong style={{ display: "block", fontSize: ".86rem" }}>{ev.title}</strong>
                    <small style={{ opacity: .7 }}>{ev.assessment_type} · {ev.attempts_count} intentos · <span className="badge badge--warning" style={{ fontSize: ".68rem" }}>{ev.status}</span></small>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
        )}
      </section>

      {evaluacion && attempts.length > 0 && (
        <>
          <section className="panel" style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: ".9rem" }}>Modo de correccion:</span>
            <button className={modoRapido ? "btn-primary" : "btn-secondary"} onClick={() => setModoRapido(true)} style={{ fontSize: ".84rem" }}>Rapido (nota directa)</button>
            <button className={!modoRapido ? "btn-primary" : "btn-secondary"} onClick={() => setModoRapido(false)} style={{ fontSize: ".84rem" }}>Detallado (pregunta por pregunta)</button>
          </section>

          <section className="correccion-stats-grid">
            <div className="libro-card"><span className="libro-card__label">Completados</span><strong className="libro-card__value">{stats.completados}/{stats.total}</strong></div>
            <div className="libro-card"><span className="libro-card__label">Corregidos</span><strong className="libro-card__value" style={{ color: stats.corregidos === stats.total ? "var(--success)" : "var(--ink)" }}>{stats.corregidos}/{stats.total}</strong></div>
            <div className="libro-card libro-card--warning"><span className="libro-card__label">Pendientes</span><strong className="libro-card__value">{stats.pendientesRevision}</strong></div>
            <div className="libro-card"><span className="libro-card__label">Promedio notas</span><strong className="libro-card__value" style={{ color: stats.promedioNotas < 4.0 ? "var(--danger)" : "var(--success)" }}>{stats.promedioNotas.toFixed(1).replace(".", ",")}</strong></div>
            <div className="libro-card libro-card--danger"><span className="libro-card__label">Bajo 4.0</span><strong className="libro-card__value">{stats.bajo4}</strong></div>
          </section>

          {modoRapido ? (
            <section className="panel">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                <h3 style={{ margin: 0, padding: 0, border: 0 }}>Correccion rapida — {evaluacion.title}</h3>
                <span style={{ fontSize: ".84rem", color: "var(--muted)" }}>Puntaje maximo: {puntajeMaximo} pts | Escala: 1.0 a 7.0</span>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>#</th><th>Estudiante</th><th>Puntaje ({puntajeMaximo} max)</th><th>Nota</th><th>Estado</th></tr>
                  </thead>
                  <tbody>
                    {attempts.map((int, i) => (
                      <tr key={int.id} style={{ background: i === estudianteIdx ? "var(--accent-light)" : undefined }}>
                        <td>{i + 1}</td>
                        <td><strong>{int.student.firstName} {int.student.lastName}</strong></td>
                        <td>
                          <input
                            type="text" inputMode="decimal"
                            className="libro-edit-input" style={{ width: 72 }}
                            placeholder="Puntaje"
                            value={puntajesRapidos[int.id] ?? int.totalScore?.toString() ?? ""}
                            onChange={(e) => handlePuntajeRapido(int.id, e.target.value)}
                          />
                        </td>
                        <td style={{ fontWeight: 700, fontSize: "1rem", color: (() => { const n = puntajesRapidos[int.id]; if (!n) return "var(--muted)"; const pts = parseFloat(n.replace(",", ".")); if (isNaN(pts)) return "var(--muted)"; const nota = calcularNota(pts, puntajeMaximo); return nota < 4.0 ? "var(--danger)" : nota >= 6.0 ? "var(--success)" : "var(--ink)"; })() }}>
                          {getNotaRapida(int.id) !== "—" ? getNotaRapida(int.id) : int.percentage !== null ? calcularNota(int.totalScore || 0, puntajeMaximo).toFixed(1).replace(".", ",") : "—"}
                        </td>
                        <td><span className={`badge ${int.status === "COMPLETED" ? "badge--active" : int.status === "TIMED_OUT" ? "badge--inactive" : "badge--warning"}`}>{int.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="form-actions" style={{ marginTop: 16, justifyContent: "space-between", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleGuardarCorreccion}>Guardar todas las correcciones</button>
                </div>
                {mensajeGuardado && <span style={{ color: "var(--success)", fontWeight: 600, fontSize: ".88rem" }}>{mensajeGuardado}</span>}
              </div>
              <div className="libro-leyenda" style={{ marginTop: 12 }}>
                <span style={{ fontSize: ".78rem", color: "var(--muted)" }}>Ingresa el puntaje total de cada estudiante. La nota se calcula automaticamente: Nota = 1.0 + (puntaje / {puntajeMaximo}) * 6.0</span>
              </div>
            </section>
          ) : (
            <>
              <section className="panel">
                <div className="correccion-nav">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button className="btn-small btn-secondary" onClick={() => navegarEstudiante("prev")} disabled={estudianteIdx === 0}>Anterior</button>
                    <span style={{ fontWeight: 600, fontSize: ".9rem" }}>Estudiante {estudianteIdx + 1} de {attempts.length}</span>
                    <button className="btn-small btn-secondary" onClick={() => navegarEstudiante("next")} disabled={estudianteIdx >= attempts.length - 1}>Siguiente</button>
                    <select value={estudianteIdx} onChange={(e) => setEstudianteIdx(Number(e.target.value))} style={{ width: "auto", minWidth: 200, fontSize: ".82rem" }}>
                      {attempts.map((int, i) => (
                        <option key={int.id} value={i}>{int.student.firstName} {int.student.lastName} {int.status !== "IN_PROGRESS" ? "OK" : "..."}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {intentoActual && (
                      <>
                        <span style={{ fontSize: ".84rem", color: "var(--muted)" }}><strong>{intentoActual.student.firstName} {intentoActual.student.lastName}</strong></span>
                        {intentoActual.percentage !== null && (
                          <span className={`badge ${calcularNota(intentoActual.totalScore || 0, puntajeMaximo) >= 4.0 ? "badge--active" : "badge--inactive"}`}>
                            Nota: {calcularNota(intentoActual.totalScore || 0, puntajeMaximo).toFixed(1).replace(".", ",")}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </section>

              {intentoActual && (
                <section className="panel">
                  <h3>Revision de respuestas — {intentoActual.student.firstName} {intentoActual.student.lastName}</h3>
                  <div className="correccion-preguntas">
                    {intentoActual.answers.map((respuesta, idx) => {
                      const esMC = respuesta.question?.type === "MULTIPLE_CHOICE" || respuesta.question?.type === "TRUE_FALSE";
                      const esAbierta = !esMC;

                      return (
                        <article key={respuesta.questionId} className={`correccion-pregunta-card ${respuesta.isCorrect === false ? "correccion-pregunta--incorrecta" : respuesta.isCorrect === true ? "correccion-pregunta--correcta" : respuesta.status === "MANUAL_REVIEW" ? "correccion-pregunta--manual" : ""}`}>
                          <div className="correccion-pregunta-header">
                            <span className="badge badge--role">Pregunta {idx + 1}</span>
                            <span className="badge">{respuesta.question?.type?.replace("_", " ") || "ABIERTA"}</span>
                            {respuesta.score !== null && <span style={{ fontSize: ".78rem", color: "var(--muted)" }}>{respuesta.score} pts</span>}
                            <span className={`badge ${respuesta.isCorrect === true ? "badge--active" : respuesta.isCorrect === false ? "badge--inactive" : "badge--warning"}`}>
                              {respuesta.isCorrect === true ? "Correcta" : respuesta.isCorrect === false ? "Incorrecta" : respuesta.status}
                            </span>
                          </div>
                          <div className="correccion-enunciado">
                            <p>{respuesta.question?.statement}</p>
                          </div>
                          {esAbierta && respuesta.textAnswer && (
                            <div className="correccion-respuesta-abierta">
                              <label>Respuesta del estudiante:</label>
                              <div className="correccion-respuesta-texto">{respuesta.textAnswer}</div>
                            </div>
                          )}
                          <div className="correccion-feedback">
                            <div className="form-field">
                              <label>Retroalimentacion (escribe o dicta por voz)</label>
                              <VoiceTextarea value={feedback[respuesta.questionId] || ""} onChange={(val) => setFeedback((prev) => ({ ...prev, [respuesta.questionId]: val }))} placeholder="Escribe o dicta tu retroalimentacion..." rows={2} />
                            </div>
                            <div style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
                              <div className="form-field" style={{ maxWidth: 140 }}>
                                <label>Puntaje</label>
                                <input type="number" min={0} max={10} step={0.5} value={puntajesManuales[respuesta.questionId] ?? respuesta.score ?? ""} onChange={(e) => handleSetPuntaje(respuesta.questionId, Number(e.target.value))} style={{ textAlign: "center", fontWeight: 700 }} />
                              </div>
                              <span style={{ fontSize: ".82rem", color: "var(--muted)" }}>{esMC ? "Auto-corregida" : "Revision manual"}</span>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  <div className="form-actions" style={{ marginTop: 16, justifyContent: "space-between", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={handleGuardarCorreccion}>Guardar correccion</button>
                      <button className="btn-secondary" onClick={() => navegarEstudiante("next")} disabled={estudianteIdx >= attempts.length - 1}>Guardar y siguiente</button>
                    </div>
                    {mensajeGuardado && <span style={{ color: "var(--success)", fontWeight: 600, fontSize: ".88rem" }}>{mensajeGuardado}</span>}
                  </div>
                </section>
              )}

              <section className="panel">
                <h3>Resumen de estudiantes — {evaluacion.title}</h3>
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>#</th><th>Estudiante</th><th>Correctas</th><th>Incorrectas</th><th>Pendientes</th><th>Puntaje</th><th>Nota</th><th>Estado</th></tr></thead>
                    <tbody>
                      {attempts.map((int, i) => {
                        const correctas = int.answers.filter((r) => r.isCorrect === true).length;
                        const incorrectas = int.answers.filter((r) => r.isCorrect === false).length;
                        const pendientes = int.answers.filter((r) => r.status === "MANUAL_REVIEW" || r.status === "PENDING").length;
                        const puntajeMax = int.answers.length * 10;
                        const nota = int.totalScore !== null ? calcularNota(int.totalScore, puntajeMax > 0 ? puntajeMax : 100) : null;
                        return (
                          <tr key={int.id} onClick={() => setEstudianteIdx(i)} style={{ cursor: "pointer", background: i === estudianteIdx ? "var(--accent-light)" : undefined }}>
                            <td>{i + 1}</td>
                            <td><strong>{int.student.firstName} {int.student.lastName}</strong></td>
                            <td><span style={{ color: "var(--success)", fontWeight: 600 }}>{correctas}</span></td>
                            <td><span style={{ color: "var(--danger)", fontWeight: 600 }}>{incorrectas}</span></td>
                            <td><span style={{ color: "var(--warning)", fontWeight: 600 }}>{pendientes}</span></td>
                            <td><strong>{int.totalScore !== null ? `${int.totalScore}/${puntajeMax}` : "—"}</strong></td>
                            <td>{nota !== null ? <span className={`badge ${nota >= 4.0 ? "badge--active" : "badge--inactive"}`}>{nota.toFixed(1).replace(".", ",")}</span> : <span className="badge badge--warning">Pendiente</span>}</td>
                            <td><span className={`badge ${int.status !== "IN_PROGRESS" ? "badge--active" : "badge--warning"}`}>{int.status}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </>
      )}

      {!evaluacion && attemptsQuery.isLoading && <LoadingSpinner label="Cargando intentos..." />}

      {!evaluacion && assessments.length > 0 && attemptsQuery.isFetched && (
        <section className="panel">
          <div className="empty-state">
            <span className="empty-state__icon">..</span>
            <strong>Selecciona una evaluacion para comenzar la correccion</strong>
            <p>Elige una evaluacion del panel superior. Puedes usar el modo rapido para ingreso directo de notas o el modo detallado para revision pregunta por pregunta.</p>
          </div>
        </section>
      )}
    </div>
  );
}
