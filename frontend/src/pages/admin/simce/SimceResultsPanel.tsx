import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { LoadingSpinner } from "../../../components/common/LoadingSpinner";
import { EmptyState } from "../../../components/common/EmptyState";
import { exportSimceCourseResultsToPdf } from "../../../lib/simce-export";
import type { SimceAnswerKey, SimceAssessment, SimceResultsSummary } from "./simce.types";

interface Props {
  assessment: SimceAssessment;
}

const LEVELS = [
  { min: 75, label: "Adecuado", color: "var(--success)", bg: "#22c55e20" },
  { min: 50, label: "Elemental", color: "var(--warning)", bg: "#f59e0b20" },
  { min: 0, label: "Inicial", color: "var(--danger)", bg: "#ef444420" },
];

function levelFor(pct: number) {
  return LEVELS.find((level) => pct >= level.min) ?? LEVELS[LEVELS.length - 1];
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
    refetchInterval: 8000,
  });

  const keyQuery = useQuery({
    queryKey: ["simce-answer-key", assessment.id],
    queryFn: () => api.getSimceAnswerKey(assessment.id) as Promise<SimceAnswerKey>,
  });

  const data = resultsQuery.data;

  const stats = useMemo(() => {
    if (!data?.results) return null;
    const answered = data.results.filter((result) => result.answered);
    return {
      max: answered.length ? Math.max(...answered.map((result) => result.percentage)) : 0,
      min: answered.length ? Math.min(...answered.map((result) => result.percentage)) : 0,
      avg: data.avgPercentage,
      adequate: answered.filter((result) => result.percentage >= 75).length,
      elemental: answered.filter((result) => result.percentage >= 50 && result.percentage < 75).length,
      initial: answered.filter((result) => result.percentage < 50).length,
    };
  }, [data]);

  if (resultsQuery.isLoading) return <LoadingSpinner label="Cargando resultados..." />;
  if (!data) return <EmptyState title="Sin resultados" description="Aun no hay datos de resultados." />;

  const weakest = data.weakestQuestions || [];
  const answerKeyItems = keyQuery.data?.items || [];
  const minAchievementScore = Math.ceil(data.maxScore * 0.5);
  const adequateScore = Math.ceil(data.maxScore * 0.75);
  const elementalMax = Math.max(minAchievementScore, adequateScore - 1);

  const handleExportPdf = () => {
    exportSimceCourseResultsToPdf(data);
  };

  const handleExportExcel = () => {
    window.open(`/api/v1/simce/${assessment.id}/export/excel?type=course`, "_blank");
  };

  return (
    <div className="simce-results">
      <div className="panel-heading">
        <div>
          <h3>Resultados del curso</h3>
          <p style={{ color: "var(--muted)", fontSize: ".84rem" }}>
            {data.totalQuestions} preguntas · {data.maxScore} pts max · {data.answeredCount}/{data.totalStudents} respondieron
            {resultsQuery.isFetching ? " · actualizando..." : ""}
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
          <div className="kpi-card"><span>Maximo</span><strong>{stats.max}%</strong></div>
          <div className="kpi-card"><span>Minimo</span><strong>{stats.min}%</strong></div>
          <div className="kpi-card" style={{ borderLeftColor: "var(--success)" }}><span>Adecuado</span><strong>{stats.adequate}</strong></div>
          <div className="kpi-card" style={{ borderLeftColor: "var(--warning)" }}><span>Elemental</span><strong>{stats.elemental}</strong></div>
          <div className="kpi-card" style={{ borderLeftColor: "var(--danger)" }}><span>Inicial</span><strong>{stats.initial}</strong></div>
        </div>
      )}

      <div className="kpi-grid simce-kpi-row">
        <div className="kpi-card"><span>Total preguntas</span><strong>{data.totalQuestions}</strong></div>
        <div className="kpi-card"><span>Punt. maximo</span><strong>{data.maxScore}</strong></div>
        <div className="kpi-card"><span>Exigencia SIMCE</span><strong>50%</strong></div>
        <div className="kpi-card"><span>Punt. min. logro</span><strong>{minAchievementScore}</strong></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 16 }}>
        <div className="kpi-card" style={{ background: "#ef444410", borderColor: "#fca5a5" }}>
          <span>Inicial</span>
          <strong>0 - {Math.max(0, minAchievementScore - 1)} pts</strong>
          <small>0 - 49%</small>
        </div>
        <div className="kpi-card" style={{ background: "#f59e0b10", borderColor: "#fbbf24" }}>
          <span>Elemental</span>
          <strong>{minAchievementScore} - {elementalMax} pts</strong>
          <small>50 - 74%</small>
        </div>
        <div className="kpi-card" style={{ background: "#22c55e10", borderColor: "#86efac" }}>
          <span>Adecuado</span>
          <strong>{adequateScore} - {data.maxScore} pts</strong>
          <small>75 - 100%</small>
        </div>
      </div>

      {answerKeyItems.length > 0 && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-heading">
            <div>
              <h3 style={{ fontSize: "1rem" }}>Pauta de respuestas - exclusivo docente</h3>
              <p style={{ color: "var(--muted)", fontSize: ".8rem" }}>
                Esta pauta no se entrega a estudiantes. Se muestra al profesor para correccion y revision posterior.
              </p>
            </div>
          </div>
          <div className="simce-table-wrap">
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>N</th>
                  <th>OA</th>
                  <th>Respuesta correcta</th>
                  <th>Alt.</th>
                  <th>Puntaje</th>
                </tr>
              </thead>
              <tbody>
                {answerKeyItems.map((item) => (
                  <tr key={item.questionNumber}>
                    <td>{item.questionNumber}</td>
                    <td>{item.oa?.code || "-"}</td>
                    <td>{item.observation || item.correctOption}</td>
                    <td><strong>{item.correctOption}</strong></td>
                    <td>{item.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {weakest.length > 0 && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-heading">
            <div>
              <h3 style={{ fontSize: "1rem" }}>Preguntas con mayor dificultad</h3>
              <p style={{ color: "var(--muted)", fontSize: ".8rem" }}>
                Preguntas con menor porcentaje de acierto.
              </p>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {weakest.map((question) => {
              const color = difficultyColor(question.correctPercent);
              const tags = [
                question.axis?.name,
                question.skill?.name,
                question.oa ? `${question.oa.code}: ${question.oa.description}` : "",
              ].filter(Boolean).join(" · ");
              return (
                <div key={question.questionNumber} className="simce-review-bar-row" style={{ padding: "4px 0" }}>
                  <span className="simce-review-bar-row__label" style={{ fontSize: ".78rem", fontWeight: 600 }}>
                    P{question.questionNumber}
                  </span>
                  <div className="simce-review-bar-row__track">
                    <div
                      className="simce-review-bar-row__fill"
                      style={{ width: `${question.correctPercent}%`, background: color, height: 14, borderRadius: 4 }}
                    />
                  </div>
                  <div style={{ minWidth: 60, textAlign: "right", fontSize: ".78rem", fontWeight: 600, color }}>
                    {question.correctPercent}%
                  </div>
                  <span style={{ fontSize: ".72rem", color: "var(--muted)", minWidth: 120 }}>
                    ({question.correctCount}/{question.totalResponses} aciertos)
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

      <div className="panel-heading">
        <div>
          <h3 style={{ fontSize: "1rem" }}>Registro de resultados del curso</h3>
          <p style={{ color: "var(--muted)", fontSize: ".8rem" }}>
            Se autollena mientras los estudiantes envian o el profesor registra respuestas.
          </p>
        </div>
      </div>

      <div className="simce-table-wrap">
        <table className="table table--compact">
          <thead>
            <tr>
              <th>N lista</th>
              <th>Nombre del estudiante</th>
              <th>Correctas/{data.totalQuestions}</th>
              <th>Incorrectas</th>
              <th>Omitidas</th>
              <th>Puntaje</th>
              <th>% Logro</th>
              <th>Nivel SIMCE</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {(data.results || []).map((result, index) => {
              const level = levelFor(result.percentage);
              const completed = Boolean(result.completed);
              return (
                <tr key={result.student.id} style={!result.answered ? { opacity: 0.55 } : {}}>
                  <td>{index + 1}</td>
                  <td>
                    <strong>{result.student.lastName}, {result.student.firstName}</strong>
                    {!result.answered && <span style={{ color: "var(--muted)", fontSize: ".75rem", display: "block" }}>Sin responder</span>}
                  </td>
                  <td style={{ color: "var(--success)", textAlign: "center" }}>{result.answered ? result.totalCorrect : "-"}</td>
                  <td style={{ color: "var(--danger)", textAlign: "center" }}>{result.answered ? result.totalIncorrect : "-"}</td>
                  <td style={{ color: "var(--muted)", textAlign: "center" }}>{result.answered ? result.totalOmitted : "-"}</td>
                  <td style={{ textAlign: "center" }}>{result.answered ? `${result.totalScore}/${data.maxScore}` : "-"}</td>
                  <td style={{ fontWeight: 700, color: level.color, textAlign: "center" }}>{result.answered ? `${result.percentage}%` : "-"}</td>
                  <td>
                    {result.answered ? (
                      <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: ".75rem", background: level.bg, color: level.color, fontWeight: 600 }}>
                        {result.performanceLevel || level.label}
                      </span>
                    ) : "-"}
                  </td>
                  <td>
                    {completed ? (
                      <span className="badge badge--active">Respondio</span>
                    ) : result.answered ? (
                      <span className="badge badge--warning">{result.responseCount || 0}/{data.totalQuestions}</span>
                    ) : (
                      <span className="badge badge--inactive">Pendiente</span>
                    )}
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
