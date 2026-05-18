import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { EmptyState } from "../../components/common/EmptyState";

interface PeriodAverage {
  periodId: string;
  periodName: string;
  average: number;
  gradeCount: number;
  weight: number;
}

interface YearSummary {
  studentId: string;
  studentName: string;
  periodAverages: { periodId: string; periodName: string; average: number; weight: number }[];
  yearAverage: number;
  totalGrades: number;
  status: string;
}

export function CalculationsPage() {
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [message, setMessage] = useState("");

  const institutionsQuery = useQuery({ queryKey: ["inst-calc"], queryFn: () => api.listInstitutions() });
  const institutionId = institutionsQuery.data?.[0]?.id || "";

  const coursesQuery = useQuery({
    queryKey: ["courses-calc", institutionId],
    queryFn: () => api.listCourses({ institutionId }),
    enabled: Boolean(institutionId),
  });

  const subjectsQuery = useQuery({ queryKey: ["subjects-calc"], queryFn: () => api.listSubjects() });

  const courseId = selectedCourseId || coursesQuery.data?.[0]?.course_id || "";
  const subjectId = selectedSubjectId || subjectsQuery.data?.[0]?.id || "";

  const averagesQuery = useQuery({
    queryKey: ["period-averages", courseId, subjectId],
    queryFn: () => api.getPeriodAverages({ courseId, subjectId }) as Promise<{ periodAverages: PeriodAverage[]; overallAverage: number }>,
    enabled: Boolean(courseId) && Boolean(subjectId),
  });

  const yearSummaryQuery = useQuery({
    queryKey: ["year-summary", courseId],
    queryFn: () => api.getStudentYearSummary({ studentId: "", courseId }) as Promise<YearSummary[]>,
    enabled: Boolean(courseId),
  });

  const summaries = yearSummaryQuery.data || [];
  const avgData = averagesQuery.data;

  return (
    <>
      {message ? <p className="form-message">{message}</p> : null}

      <section className="panel">
        <h3>Cálculo de Promedios Ponderados</h3>
        <div className="form-row" style={{ marginBottom: 12 }}>
          <div className="form-field">
            <label>Curso</label>
            <select value={courseId} onChange={(e) => setSelectedCourseId(e.target.value)}>
              {(coursesQuery.data || []).map((c) => (<option key={c.course_id} value={c.course_id}>{c.course_name}</option>))}
            </select>
          </div>
          <div className="form-field">
            <label>Asignatura</label>
            <select value={subjectId} onChange={(e) => setSelectedSubjectId(e.target.value)}>
              {(subjectsQuery.data || []).map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
          </div>
        </div>
      </section>

      {avgData && (
        <section className="panel">
          <h3>Promedios por período</h3>
          <div className="kpi-grid">
            <div className="kpi-card"><span>Promedio general</span><strong>{avgData.overallAverage?.toFixed(2) || "-"}</strong></div>
            {(avgData.periodAverages || []).map((p: PeriodAverage) => (
              <div key={p.periodId} className="kpi-card">
                <span>{p.periodName} (peso {p.weight}%)</span>
                <strong>{p.average?.toFixed(2) || "-"}</strong>
                <small>{p.gradeCount} notas</small>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <h3>Resumen anual por alumno ({summaries.length})</h3>
        {yearSummaryQuery.isLoading ? <LoadingSpinner size="sm" /> : null}
        {summaries.length === 0 && !yearSummaryQuery.isLoading ? (
          <EmptyState title="Sin datos" description="Selecciona un curso con evaluaciones registradas para ver el resumen anual." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Alumno</th><th>Promedio anual</th><th>Total notas</th><th>Estado</th></tr></thead>
              <tbody>
                {summaries.map((s: YearSummary) => (
                  <tr key={s.studentId}>
                    <td><strong>{s.studentName}</strong></td>
                    <td><strong>{s.yearAverage?.toFixed(2) || "-"}</strong></td>
                    <td>{s.totalGrades}</td>
                    <td><span className={`badge ${s.status === "PROMOVIDO" ? "badge--active" : "badge--warning"}`}>{s.status || "Pendiente"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
