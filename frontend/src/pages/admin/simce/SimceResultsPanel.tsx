import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { api } from "../../../lib/api";
import { LoadingSpinner } from "../../../components/common/LoadingSpinner";
import { EmptyState } from "../../../components/common/EmptyState";
import { useToast } from "../../../components/common/Toast";
import { exportSimceCourseResultsToPdf } from "../../../lib/simce-export";
import type { SimceAssessment, SimceResultsSummary } from "./simce.types";

interface Props {
  assessment: SimceAssessment;
}

const LEVELS = [
  { min: 80, label: "Avanzado", color: "var(--success)", bg: "#22c55e20" },
  { min: 60, label: "Adecuado", color: "var(--info)", bg: "#3b82f620" },
  { min: 40, label: "Básico", color: "var(--warning)", bg: "#f59e0b20" },
  { min: 0, label: "Crítico", color: "var(--danger)", bg: "#ef444420" },
];

function levelFor(pct: number) {
  return LEVELS.find((l) => pct >= l.min) ?? LEVELS[LEVELS.length - 1];
}

function difficultyColor(pct: number): string {
  if (pct >= 70) return "var(--success)";
  if (pct >= 50) return "var(--warning)";
  return "var(--danger)";
}

export function SimceResultsPanel({ assessment }: Props) {
  const resultsQuery = useQuery({
    queryKey: ["simce-results", assessment.id],
    queryFn: () => api.getSimceResults(assessment.id) as Promise<SimceResultsSummary>,
  });

  const data = resultsQuery.data;

  const stats = useMemo(() => {
    if (!data?.results) return null;
    const answered = data.results.filter((r) => r.answered);
    return {
      max: answered.length ? Math.max(...answered.map((r) => r.percentage)) : 0,
      min: answered.length ? Math.min(...answered.map((r) => r.percentage)) : 0,
      avg: data.avgPercentage,
      advanced: answered.filter((r) => r.percentage >= 80).length,
      adequate: answered.filter((r) => r.percentage >= 60 && r.percentage < 80).length,
      basic: answered.filter((r) => r.percentage >= 40 && r.percentage < 60).length,
      critical: answered.filter((r) => r.percentage < 40).length,
    };
  }, [data]);

  const performanceData = useMemo(() => {
    if (!data?.skillsPerformance || !data?.axesPerformance || !data?.oasPerformance) return null;
    return {
      skills: data.skillsPerformance.slice(0, 8),
      axes: data.axesPerformance.slice(0, 8),
      oas: data.oasPerformance.slice(0, 8),
    };
  }, [data]);

  if (resultsQuery.isLoading) return <LoadingSpinner label="Cargando resultados..." />;
  if (!data) return <EmptyState title="Sin resultados" description="Aún no hay datos de resultados." />;

  const weakest = data.weakestQuestions || [];
  const perf = performanceData;

  const handleExportPdf = () => {
    if (!data) return;
    exportSimceCourseResultsToPdf(data);
  };

  const handleExportExcel = async () => {
    if (!data) return;
    window.open(`/api/v1/simce/${assessment.id}/export/excel?type=course`, "_blank");
  };

  return (
    <div className="simce-results">
      <div className="panel-heading">
        <div>
          <h3>Resultados del curso</h3>
          <p style={{ color: "var(--muted)", fontSize: ".84rem" }}>
            {data.totalQuestions} preguntas · {data.maxScore} pts máx · {data.answeredCount}/{data.totalStudents} respondieron
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-small btn-secondary" onClick={handleExportPdf}>
            Exportar PDF
          </button>
          <button className="btn-small btn-primary" onClick={handleExportExcel}>
            Exportar Excel
          </button>
        </div>
      </div>

      {stats && (
        <div className="kpi-grid simce-kpi-row">
          <div className="kpi-card"><span>Promedio</span><strong>{stats.avg}%</strong></div>
          <div className="kpi-card"><span>Máximo</span><strong>{stats.max}%</strong></div>
          <div className="kpi-card"><span>Mínimo</span><strong>{stats.min}%</strong></div>
          <div className="kpi-card" style={{ borderLeftColor: "var(--success)" }}><span>Avanzado</span><strong>{stats.advanced}</strong></div>
          <div className="kpi-card" style={{ borderLeftColor: "var(--info)" }}><span>Adecuado</span><strong>{stats.adequate}</strong></div>
          <div className="kpi-card" style={{ borderLeftColor: "var(--warning)" }}><span>Básico</span><strong>{stats.basic}</strong></div>
          <div className="kpi-card" style={{ borderLeftColor: "var(--danger)" }}><span>Crítico</span><strong>{stats.critical}</strong></div>
        </div>
      )}

      {/* ─── Preguntas con mayor dificultad ─── */}
      {weakest.length > 0 && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-heading">
            <div>
              <h3 style={{ fontSize: "1rem" }}>Preguntas con mayor dificultad</h3>
              <p style={{ color: "var(--muted)", fontSize: ".8rem" }}>
                Las {weakest.length} preguntas con menor porcentaje de acierto.
              </p>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {weakest.map((q) => {
              const color = difficultyColor(q.correctPercent);
              const axisLabel = q.axis?.name ?? "";
              const skillLabel = q.skill?.name ?? "";
              const oaLabel = q.oa ? `${q.oa.code}: ${q.oa.description}` : "";
              const tags = [axisLabel, skillLabel, oaLabel].filter(Boolean).join(" · ");
              return (
                <div key={q.questionNumber} className="simce-review-bar-row" style={{ padding: "4px 0" }}>
                  <span className="simce-review-bar-row__label" style={{ fontSize: ".78rem", fontWeight: 600 }}>
                    P{q.questionNumber}
                  </span>
                  <div className="simce-review-bar-row__track">
                    <div
                      className="simce-review-bar-row__fill"
                      style={{ width: `${q.correctPercent}%`, background: color, height: 14, borderRadius: 4 }}
                    />
                  </div>
                  <div style={{ minWidth: 60, textAlign: "right", fontSize: ".78rem", fontWeight: 600, color }}>
                    {q.correctPercent}%
                  </div>
                  <span style={{ fontSize: ".72rem", color: "var(--muted)", minWidth: 120 }}>
                    ({q.correctCount}/{q.totalResponses} aciertos)
                  </span>
                  <span style={{ fontSize: ".72rem", color: "var(--muted)", flex: 1, textAlign: "right" }}>
                    {tags}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Habilidades y ejes más descendidos ─── */}
      {perf && (
        <div className="simce-analysis-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginBottom: 16 }}>
          {perf.skills.length > 0 && (
            <div className="panel" style={{ margin: 0 }}>
              <div className="panel-heading">
                <h3 style={{ fontSize: ".9rem", margin: 0 }}>Habilidades más descendidas</h3>
              </div>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perf.skills} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value: number) => [`${value}%`, "Acierto promedio"]} />
                    <Bar dataKey="avgCorrectPercent" radius={[0, 4, 4, 0]} barSize={16}>
                      {perf.skills.map((_, idx) => (
                        <Cell key={idx} fill={idx < 3 ? "var(--danger)" : "var(--warning)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {perf.axes.length > 0 && (
            <div className="panel" style={{ margin: 0 }}>
              <div className="panel-heading">
                <h3 style={{ fontSize: ".9rem", margin: 0 }}>Ejes con menor rendimiento</h3>
              </div>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perf.axes} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value: number) => [`${value}%`, "Acierto promedio"]} />
                    <Bar dataKey="avgCorrectPercent" radius={[0, 4, 4, 0]} barSize={16}>
                      {perf.axes.map((_, idx) => (
                        <Cell key={idx} fill={idx < 3 ? "var(--danger)" : "var(--info)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {perf.oas.length > 0 && (
            <div className="panel" style={{ margin: 0 }}>
              <div className="panel-heading">
                <h3 style={{ fontSize: ".9rem", margin: 0 }}>OA con menor rendimiento</h3>
              </div>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perf.oas} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value: number) => [`${value}%`, "Acierto promedio"]} />
                    <Bar dataKey="avgCorrectPercent" radius={[0, 4, 4, 0]} barSize={16}>
                      {perf.oas.map((_, idx) => (
                        <Cell key={idx} fill={idx < 3 ? "var(--danger)" : "var(--accent)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Tabla de estudiantes ─── */}
      <div className="simce-table-wrap">
        <table className="table table--compact">
          <thead>
            <tr>
              <th>#</th>
              <th>Estudiante</th>
              <th>Correctas</th>
              <th>Incorrectas</th>
              <th>Omitidas</th>
              <th>Puntaje</th>
              <th>%</th>
              <th>Nivel</th>
            </tr>
          </thead>
          <tbody>
            {(data.results || []).map((r, index) => {
              const level = levelFor(r.percentage);
              return (
                <tr key={r.student.id} style={!r.answered ? { opacity: 0.5 } : {}}>
                  <td>{index + 1}</td>
                  <td>
                    <strong>{r.student.lastName}, {r.student.firstName}</strong>
                    {!r.answered && <span style={{ color: "var(--muted)", fontSize: ".75rem", display: "block" }}>Sin responder</span>}
                  </td>
                  <td style={{ color: "var(--success)", textAlign: "center" }}>{r.answered ? r.totalCorrect : "-"}</td>
                  <td style={{ color: "var(--danger)", textAlign: "center" }}>{r.answered ? r.totalIncorrect : "-"}</td>
                  <td style={{ color: "var(--muted)", textAlign: "center" }}>{r.answered ? r.totalOmitted : "-"}</td>
                  <td style={{ textAlign: "center" }}>{r.answered ? `${r.totalScore}/${data.maxScore}` : "-"}</td>
                  <td style={{ fontWeight: 700, color: level.color, textAlign: "center" }}>{r.answered ? `${r.percentage}%` : "-"}</td>
                  <td>
                    {r.answered ? (
                      <span style={{
                        display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: ".75rem",
                        background: level.bg, color: level.color, fontWeight: 600,
                      }}>
                        {level.label}
                      </span>
                    ) : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
