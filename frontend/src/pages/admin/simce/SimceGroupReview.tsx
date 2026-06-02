import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { LoadingSpinner } from "../../../components/common/LoadingSpinner";
import { EmptyState } from "../../../components/common/EmptyState";
import type { SimceAssessment, GroupReview, GroupReviewQuestion } from "./simce.types";

interface Props {
  assessment: SimceAssessment;
}

const OPTIONS = ["A", "B", "C", "D", "E"];

function difficultyColor(pct: number): { color: string; bg: string; label: string } {
  if (pct >= 70) return { color: "var(--success)", bg: "var(--success-light, #e6ffe6)", label: "Fácil" };
  if (pct >= 50) return { color: "var(--warning)", bg: "var(--warning-light, #fef3c7)", label: "Media" };
  return { color: "var(--danger)", bg: "var(--danger-light, #ffe6e6)", label: "Difícil" };
}

export function SimceGroupReview({ assessment }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState<"detailed" | "overview">("detailed");

  const reviewQuery = useQuery({
    queryKey: ["simce-group-review", assessment.id],
    queryFn: () => api.getSimceGroupReview(assessment.id) as Promise<GroupReview>,
  });

  const data = reviewQuery.data;

  const difficultyGroups = useMemo(() => {
    if (!data?.questions) return null;
    const easy = data.questions.filter((q) => q.correctPercent >= 70).length;
    const medium = data.questions.filter((q) => q.correctPercent >= 50 && q.correctPercent < 70).length;
    const hard = data.questions.filter((q) => q.correctPercent < 50).length;
    return { easy, medium, hard };
  }, [data]);

  if (reviewQuery.isLoading) return <LoadingSpinner label="Cargando revisión grupal..." />;
  if (!data || !data.questions.length) return <EmptyState title="Sin datos" description="No hay respuestas para revisar." />;

  const total = data.questions.length;
  const question = data.questions[currentIndex];
  if (!question && mode === "detailed") return null;

  function goPrev() { setCurrentIndex((i) => Math.max(0, i - 1)); }
  function goNext() { setCurrentIndex((i) => Math.min(total - 1, i + 1)); }

  return (
    <div className="simce-review">
      <div className="panel-heading">
        <div>
          <h3>Revisión grupal</h3>
          <p style={{ color: "var(--muted)", fontSize: ".84rem" }}>
            {data.totalStudents} estudiantes · {total} preguntas
            {difficultyGroups && (
              <span>
                {" "}·{" "}
                <span style={{ color: "var(--success)", fontWeight: 600 }}>{difficultyGroups.easy} fáciles</span>
                {" · "}
                <span style={{ color: "var(--warning)", fontWeight: 600 }}>{difficultyGroups.medium} medias</span>
                {" · "}
                <span style={{ color: "var(--danger)", fontWeight: 600 }}>{difficultyGroups.hard} difíciles</span>
              </span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid var(--line)" }}>
            <button
              type="button"
              className="btn-small"
              style={{
                borderRadius: 0,
                background: mode === "detailed" ? "var(--primary)" : "transparent",
                color: mode === "detailed" ? "#fff" : "var(--text)",
                fontWeight: mode === "detailed" ? 600 : 400,
              }}
              onClick={() => setMode("detailed")}
            >
              Detallada
            </button>
            <button
              type="button"
              className="btn-small"
              style={{
                borderRadius: 0,
                background: mode === "overview" ? "var(--primary)" : "transparent",
                color: mode === "overview" ? "#fff" : "var(--text)",
                fontWeight: mode === "overview" ? 600 : 400,
              }}
              onClick={() => setMode("overview")}
            >
              General
            </button>
          </div>
          {mode === "detailed" && (
            <div style={{ display: "flex", gap: 4 }}>
              <button className="btn-secondary" onClick={goPrev} disabled={currentIndex === 0}>
                Anterior
              </button>
              <span style={{ alignSelf: "center", fontWeight: 600, fontSize: ".9rem", padding: "0 4px" }}>
                {currentIndex + 1}/{total}
              </span>
              <button className="btn-primary" onClick={goNext} disabled={currentIndex === total - 1}>
                Siguiente
              </button>
            </div>
          )}
        </div>
      </div>

      {mode === "detailed" && question && (
        <DetailView question={question} totalStudents={data.totalStudents} />
      )}

      {mode === "overview" && (
        <OverviewGrid
          questions={data.questions}
          totalStudents={data.totalStudents}
          onSelect={(idx) => { setCurrentIndex(idx); setMode("detailed"); }}
        />
      )}
    </div>
  );
}

// ─── Vista detallada (una pregunta) ─────────────────────

function DetailView({
  question,
  totalStudents,
}: {
  question: GroupReviewQuestion;
  totalStudents: number;
}) {
  const diff = difficultyColor(question.correctPercent);
  const maxCount = Math.max(1, ...Object.values(question.optionDistribution), question.correct);

  return (
    <>
      {/* Difficulty indicator */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 14px",
          borderRadius: 8,
          background: diff.bg,
          marginBottom: 12,
          border: `1px solid ${diff.color}30`,
        }}
      >
        <span className="simce-correction-cell__num" style={{ fontSize: "1.1rem", fontWeight: 800, color: diff.color }}>
          P{question.questionNumber}
        </span>
        <div>
          <strong style={{ color: diff.color }}>Alternativa correcta: {question.correctOption}</strong>
          <span style={{ display: "block", color: "var(--muted)", fontSize: ".78rem" }}>
            {question.correctPercent}% de acierto — {question.correct} de {question.totalStudents} estudiantes
          </span>
        </div>
        <span
          style={{
            marginLeft: "auto",
            padding: "3px 10px",
            borderRadius: 10,
            fontSize: ".78rem",
            fontWeight: 700,
            background: diff.color,
            color: "#fff",
          }}
        >
          {diff.label}
        </span>
      </div>

      <div className="simce-review-stats">
        <div className="simce-review-stat simce-review-stat--correct">
          <strong>{question.correct}</strong>
          <span>Correctas ({question.correctPercent}%)</span>
        </div>
        <div className="simce-review-stat simce-review-stat--incorrect">
          <strong>{question.incorrect}</strong>
          <span>Incorrectas</span>
        </div>
        <div className="simce-review-stat simce-review-stat--omitted">
          <strong>{question.omitted}</strong>
          <span>Omitidas</span>
        </div>
      </div>

      <div className="simce-review-bars">
        <h4 style={{ marginBottom: 8 }}>Distribución de respuestas</h4>
        {OPTIONS.map((opt) => {
          const count = question.optionDistribution[opt] || 0;
          const percent = totalStudents > 0 ? Math.round((count / totalStudents) * 100) : 0;
          const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;
          const isCorrect = opt === question.correctOption;
          return (
            <div key={opt} className="simce-review-bar-row">
              <span className="simce-review-bar-row__label">
                {opt}{isCorrect ? " ✓" : ""}
              </span>
              <div className="simce-review-bar-row__track">
                <div
                  className={`simce-review-bar-row__fill ${isCorrect ? "simce-review-bar-row__fill--correct" : ""}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <span className="simce-review-bar-row__count">{count} ({percent}%)</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── Vista general (todas las preguntas) ─────────────────

function OverviewGrid({
  questions,
  totalStudents,
  onSelect,
}: {
  questions: GroupReviewQuestion[];
  totalStudents: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
      {questions.map((q, idx) => {
        const diff = difficultyColor(q.correctPercent);
        return (
          <button
            key={q.questionNumber}
            type="button"
            onClick={() => onSelect(idx)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              padding: "10px 12px",
              borderRadius: 8,
              border: `1.5px solid ${diff.color}40`,
              background: diff.bg,
              cursor: "pointer",
              textAlign: "left",
              transition: "box-shadow .15s",
              width: "100%",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 2px ${diff.color}60`; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = ""; }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontWeight: 800, fontSize: ".9rem", color: diff.color }}>P{q.questionNumber}</span>
              <span style={{ fontSize: ".7rem", padding: "1px 6px", borderRadius: 8, background: diff.color, color: "#fff", fontWeight: 700 }}>
                {diff.label}
              </span>
            </div>
            <div style={{ fontSize: ".75rem", color: "var(--muted)" }}>
              Alt. correcta: <strong style={{ color: "var(--text)" }}>{q.correctOption}</strong>
            </div>
            {/* Progress bar */}
            <div style={{ width: "100%", marginTop: 6 }}>
              <div
                style={{
                  height: 6,
                  borderRadius: 3,
                  background: "var(--muted-light, #e5e7eb)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${q.correctPercent}%`,
                    background: diff.color,
                    borderRadius: 3,
                    transition: "width .3s",
                  }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, fontSize: ".7rem", color: "var(--muted)" }}>
                <span>{q.correctPercent}% acierto</span>
                <span>{q.correct}/{totalStudents}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
