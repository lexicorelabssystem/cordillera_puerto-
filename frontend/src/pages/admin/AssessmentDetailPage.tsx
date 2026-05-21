import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

function formatearNota(n: number | null): string {
  if (n === null || n === undefined) return "\u2014";
  return n.toFixed(1).replace(".", ",");
}

function colorNota(n: number | null): string {
  if (n === null) return "var(--muted)";
  if (n < 4.0) return "var(--danger)";
  if (n >= 6.0) return "var(--success)";
  return "var(--ink)";
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador", PUBLISHED: "Publicada", ACTIVE: "Activa",
  CLOSED: "Cerrada", IN_GRADING: "En Correccion", GRADED: "Calificada",
  REPORTED: "Reportada", ARCHIVED: "Archivada",
};

const DIST_COLORS = ["var(--success)", "var(--accent)", "var(--warning)", "var(--danger)"];

export function AssessmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"overview" | "students" | "questions" | "attempts">("overview");

  const assessmentQuery = useQuery({
    queryKey: ["assessment-detail", id],
    queryFn: () => api.getAssessment(id!),
    enabled: Boolean(id),
  });

  const attemptsQuery = useQuery({
    queryKey: ["assessment-attempts", id],
    queryFn: () => api.getAssessmentAttempts(id!) as Promise<{
      id: string; studentId: string;
      student: { firstName: string; lastName: string };
      status: string; totalScore: number | null; percentage: number | null;
      answers: { questionId: string; question: { statement: string; type: string };
        textAnswer: string | null; selectedOptionId: string | null;
        score: number | null; status: string; isCorrect: boolean | null }[];
    }[]>,
    enabled: Boolean(id),
  });

  const gradingSummaryQuery = useQuery({
    queryKey: ["grading-summary", id],
    queryFn: () => api.getGradingSummary(id!) as Promise<{
      assessmentId: string; title: string; totalQuestions: number; totalAttempts: number;
      answersByStatus: Record<string, number>;
      grades: { studentId: string; studentName: string; score: number | null; percentage: number | null; grade: number }[];
    }>,
    enabled: Boolean(id),
  });

  const a = assessmentQuery.data as Record<string, unknown> | undefined;
  const attempts = (attemptsQuery.data || []) as unknown[];
  const summary = gradingSummaryQuery.data;

  if (assessmentQuery.isLoading) return <LoadingSpinner label="Cargando evaluacion..." />;
  if (!a) return <div className="panel"><p className="error">Evaluacion no encontrada.</p></div>;

  const grades = summary?.grades || [];
  const avgGrade = grades.length > 0
    ? Number((grades.reduce((s, g) => s + (g.grade ?? 0), 0) / grades.length).toFixed(1))
    : null;
  const approved = grades.filter((g) => (g.grade ?? 0) >= 4.0).length;
  const below4 = grades.filter((g) => (g.grade ?? 0) < 4.0).length;
  const approvalRate = grades.length > 0 ? Math.round((approved / grades.length) * 100) : 0;

  const distData = [
    { name: "≥6.0", value: grades.filter((g) => (g.grade ?? 0) >= 6.0).length },
    { name: "5.0-5.9", value: grades.filter((g) => (g.grade ?? 0) >= 5.0 && (g.grade ?? 0) < 6.0).length },
    { name: "4.0-4.9", value: grades.filter((g) => (g.grade ?? 0) >= 4.0 && (g.grade ?? 0) < 5.0).length },
    { name: "<4.0", value: below4 },
  ].filter((d) => d.value > 0);

  const questions = (a.questions as { questionId: string; points: number; question?: { id: string; statement: string; type: string } }[]) || [];

  return (
    <div className="assessment-detail">
      {/* Breadcrumb */}
      <div className="breadcrumbs">
        <span className="breadcrumbs__item"><a href="#" onClick={(e) => { e.preventDefault(); navigate("/admin/evaluaciones"); }}>Evaluaciones</a></span>
        <span className="breadcrumbs__sep">/</span>
        <span className="breadcrumbs__item">{a.title as string || "Detalle"}</span>
      </div>

      {/* ═══ HEADER ═══ */}
      <header className="gradebook-header" style={{ marginBottom: 0 }}>
        <div className="gradebook-header__inner">
          <div className="gradebook-header__brand">
            <div className="gradebook-header__icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            </div>
            <div>
              <h1>{a.title as string || "Evaluacion"}</h1>
              <p className="gradebook-header__meta">
                {(a.course as { name?: string })?.name || "\u2014"} &middot; {(a.subject as { name?: string })?.name || "\u2014"} &middot; {(a.teacher as { user?: { firstName: string; lastName: string } })?.user?.firstName || ""} {(a.teacher as { user?: { firstName: string; lastName: string } })?.user?.lastName || ""}
              </p>
            </div>
          </div>
          <span className={`badge ${a.status === "GRADED" ? "badge--active" : a.status === "ACTIVE" ? "badge--warning" : "badge--inactive"}`} style={{ fontSize: ".9rem", padding: "8px 18px" }}>
            {STATUS_LABELS[a.status as string] || (a.status as string)}
          </span>
        </div>
      </header>

      {/* ═══ METADATA ═══ */}
      <section className="panel" style={{ marginTop: 16 }}>
        <div className="gb-modal-meta" style={{ borderBottom: "none", paddingBottom: 0 }}>
          <div className="gb-modal-meta__item"><span>Tipo</span><span className="badge badge--role">{a.assessmentType as string}</span></div>
          <div className="gb-modal-meta__item"><span>Semestre</span><strong>{a.semester as number}°</strong></div>
          <div className="gb-modal-meta__item"><span>Puntaje Max</span><strong>{a.maxScore as number}</strong></div>
          <div className="gb-modal-meta__item"><span>Preguntas</span><strong>{questions.length}</strong></div>
          <div className="gb-modal-meta__item"><span>Intentos</span><strong>{summary?.totalAttempts || 0}</strong></div>
          <div className="gb-modal-meta__item"><span>Calificados</span><strong>{grades.length}</strong></div>
          {(a.weight as number) !== undefined && <div className="gb-modal-meta__item"><span>Ponderacion</span><strong>{a.weight as number}%</strong></div>}
        </div>
      </section>

      {/* ═══ KPI CARDS ═══ */}
      <section className="gradebook-kpi-grid" style={{ marginTop: 0 }}>
        <div className="gradebook-kpi-card">
          <div className="gradebook-kpi-card__icon" style={{ background: (avgGrade ?? 0) < 4.0 ? "var(--danger-bg)" : "var(--success-bg)", color: (avgGrade ?? 0) < 4.0 ? "var(--danger)" : "var(--success)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <div><span>Promedio</span><strong style={{ color: colorNota(avgGrade) }}>{formatearNota(avgGrade)}</strong></div>
        </div>
        <div className="gradebook-kpi-card">
          <div className="gradebook-kpi-card__icon" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div><span>Aprobacion</span><strong>{approvalRate}%</strong></div>
        </div>
        <div className="gradebook-kpi-card gradebook-kpi-card--danger">
          <div className="gradebook-kpi-card__icon" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>&#9888;</div>
          <div><span>Bajo 4.0</span><strong style={{ color: "var(--danger)" }}>{below4}</strong></div>
        </div>
        <div className="gradebook-kpi-card">
          <div className="gradebook-kpi-card__icon" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>&#128214;</div>
          <div><span>Estudiantes</span><strong>{grades.length}</strong></div>
        </div>
      </section>

      {/* ═══ TABS ═══ */}
      <section className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <div className="gb-detail-tabs">
          {(["overview", "students", "questions", "attempts"] as const).map((t) => (
            <button key={t} className={`gb-detail-tab ${tab === t ? "gb-detail-tab--active" : ""}`} onClick={() => setTab(t)}>
              {t === "overview" ? "Resumen" : t === "students" ? "Estudiantes" : t === "questions" ? "Preguntas" : "Intentos"}
            </button>
          ))}
        </div>

        <div className="gb-detail-tab-content">
          {/* ═══ TAB: OVERVIEW ═══ */}
          {tab === "overview" && (
            <div style={{ padding: 24 }}>
              {distData.length > 0 && (
                <>
                  <h4>Distribucion de Notas</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "center" }}>
                    <div style={{ width: "100%", height: 220 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={distData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                            {distData.map((_, i) => <Cell key={i} fill={DIST_COLORS[i % DIST_COLORS.length]} />)}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div>
                      {grades.length > 0 && (
                        <div style={{ width: "100%", height: 220 }}>
                          <ResponsiveContainer>
                            <BarChart data={grades.slice(0, 20).map((g) => ({ name: g.studentName?.split(" ")[0] || "", nota: g.grade ?? 0 }))}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--line-light)" />
                              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "var(--muted)" }} />
                              <YAxis domain={[0, 7]} tick={{ fontSize: 10 }} />
                              <Tooltip />
                              <Bar dataKey="nota" radius={[3, 3, 0, 0]} fill="var(--accent)" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
              <h4 style={{ marginTop: 20 }}>Resumen de Correccion</h4>
              <div className="gb-drawer-kpis">
                {summary?.answersByStatus && Object.entries(summary.answersByStatus).map(([status, count]) => (
                  <div className="gb-drawer-kpi" key={status}>
                    <span>{status.replace("_", " ")}</span>
                    <strong>{count as number}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ TAB: STUDENTS ═══ */}
          {tab === "students" && (
            <div style={{ padding: 24 }}>
              <h4>Resultados por Estudiante ({grades.length})</h4>
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table className="table">
                  <thead><tr><th>#</th><th>Estudiante</th><th>Puntaje</th><th>Porcentaje</th><th>Nota</th><th>Estado</th></tr></thead>
                  <tbody>
                    {grades.map((g, i) => (
                      <tr key={g.studentId}>
                        <td>{i + 1}</td>
                        <td><strong>{g.studentName}</strong></td>
                        <td style={{ textAlign: "center" }}>{g.score ?? "\u2014"}</td>
                        <td style={{ textAlign: "center" }}>{g.percentage != null ? `${g.percentage}%` : "\u2014"}</td>
                        <td style={{ fontWeight: 700, color: colorNota(g.grade), textAlign: "center", fontSize: "1.05rem" }}>{formatearNota(g.grade)}</td>
                        <td>{g.grade != null && g.grade >= 4.0 ? <span className="badge badge--active">Aprobado</span> : g.grade != null ? <span className="badge badge--inactive">Reprobado</span> : <span className="badge badge--warning">Pendiente</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══ TAB: QUESTIONS ═══ */}
          {tab === "questions" && (
            <div style={{ padding: 24 }}>
              <h4>Preguntas de la Evaluacion ({questions.length})</h4>
              {questions.length > 0 ? (
                <div className="table-wrap" style={{ marginTop: 12 }}>
                  <table className="table">
                    <thead><tr><th>#</th><th>Enunciado</th><th>Tipo</th><th>Puntos</th></tr></thead>
                    <tbody>
                      {questions.map((q, i) => (
                        <tr key={q.questionId}>
                          <td style={{ textAlign: "center", fontWeight: 600 }}>{i + 1}</td>
                          <td style={{ fontSize: ".86rem" }}>{q.question?.statement || "\u2014"}</td>
                          <td><span className="badge badge--role">{q.question?.type?.replace("_", " ") || "\u2014"}</span></td>
                          <td style={{ textAlign: "center", fontWeight: 700 }}>{q.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ color: "var(--muted)" }}>No hay preguntas asociadas a esta evaluacion.</p>
              )}
            </div>
          )}

          {/* ═══ TAB: ATTEMPTS ═══ */}
          {tab === "attempts" && (
            <div style={{ padding: 24 }}>
              <h4>Intentos de los Estudiantes ({attempts.length})</h4>
              {attempts.length > 0 ? (
                <div className="table-wrap" style={{ marginTop: 12 }}>
                  <table className="table">
                    <thead><tr><th>#</th><th>Estudiante</th><th>Estado</th><th>Puntaje</th><th>%</th><th>Respuestas</th></tr></thead>
                    <tbody>
                      {(attempts as { id: string; studentId: string; student: { firstName: string; lastName: string }; status: string; totalScore: number | null; percentage: number | null; answers: { isCorrect: boolean | null }[] }[]).map((att, i) => {
                        const correct = att.answers?.filter((r) => r.isCorrect === true).length || 0;
                        const total = att.answers?.length || 0;
                        return (
                          <tr key={att.id}>
                            <td>{i + 1}</td>
                            <td><strong>{att.student.firstName} {att.student.lastName}</strong></td>
                            <td><span className={`badge ${att.status === "COMPLETED" ? "badge--active" : "badge--warning"}`}>{att.status}</span></td>
                            <td style={{ textAlign: "center", fontWeight: 600 }}>{att.totalScore ?? "\u2014"}</td>
                            <td style={{ textAlign: "center" }}>{att.percentage != null ? `${att.percentage}%` : "\u2014"}</td>
                            <td style={{ textAlign: "center" }}>{correct}/{total}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ color: "var(--muted)" }}>No hay intentos registrados.</p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
