import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { useInstitution } from "../../app/InstitutionContext";

export function CalculationsPage() {
  const [periodId, setPeriodId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const { selectedInstitution } = useInstitution();

  const coursesQuery = useQuery({
    queryKey: ["courses-calc", selectedInstitution?.id],
    queryFn: () => api.listCourses({ institutionId: selectedInstitution?.id }),
    enabled: Boolean(selectedInstitution?.id),
  });

  const academicYearsQuery = useQuery({
    queryKey: ["academic-years-calc", selectedInstitution?.id],
    queryFn: () => api.listAcademicYears(selectedInstitution?.id || ""),
    enabled: Boolean(selectedInstitution?.id),
  });

  const periodsQuery = useQuery({
    queryKey: ["periods-calc", academicYearId],
    queryFn: () => api.listPeriods(academicYearId),
    enabled: Boolean(academicYearId),
  });

  const periodAveragesQuery = useQuery({
    queryKey: ["period-averages", periodId],
    queryFn: () => api.getPeriodAverages(periodId),
    enabled: Boolean(periodId),
  });

  const yearAverageQuery = useQuery({
    queryKey: ["year-average", academicYearId],
    queryFn: () => api.getYearAverage(academicYearId),
    enabled: Boolean(academicYearId),
  });

  const years = academicYearsQuery.data || [];
  const periods = periodsQuery.data || [];
  const periodAverages = periodAveragesQuery.data as Record<string, unknown> | null;
  const yearAverage = yearAverageQuery.data as Record<string, unknown> | null;

  const periodStudents = (periodAverages as { students?: { studentName: string; avgGrade: number; gradedCount: number; totalCount: number }[] })?.students || [];
  const yearStudents = (yearAverage as { students?: { studentName: string; avgGrade: number; semesters: Record<string, number>; totalGrades: number }[] })?.students || [];

  return (
    <>
      <section className="panel">
        <h3>Promedios Ponderados</h3>
        <p style={{ color: "var(--muted)", fontSize: ".84rem", marginBottom: 12 }}>
          Calculo de promedios por periodo y resumen anual con ponderaciones.
        </p>
        <div className="form-row">
          <div className="form-field">
            <label>Ano Academico</label>
            <select value={academicYearId} onChange={(e) => { setAcademicYearId(e.target.value); setPeriodId(""); }}>
              <option value="">Seleccionar ano...</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>{y.year}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Periodo</label>
            <select value={periodId} onChange={(e) => setPeriodId(e.target.value)} disabled={!academicYearId}>
              <option value="">Seleccionar periodo...</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {periodAveragesQuery.isLoading ? <LoadingSpinner label="Calculando promedios..." /> : null}

      {periodId && periodAverages && (
        <section className="panel">
          <h3>Promedios del Periodo</h3>
          {periodStudents.length > 0 ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Estudiante</th><th>Promedio</th><th>Notas</th><th>Nivel</th></tr>
                </thead>
                <tbody>
                  {periodStudents.map((s, i) => (
                    <tr key={i}>
                      <td><strong>{s.studentName}</strong></td>
                      <td style={{ fontWeight: 700, color: s.avgGrade < 4.0 ? "var(--danger)" : s.avgGrade >= 5.5 ? "var(--success)" : "var(--ink)" }}>{s.avgGrade.toFixed(1).replace(".", ",")}</td>
                      <td>{s.gradedCount} / {s.totalCount}</td>
                      <td><span className={`badge ${s.avgGrade >= 5.5 ? "badge--active" : s.avgGrade >= 4.0 ? "badge--warning" : "badge--inactive"}`}>{s.avgGrade >= 5.5 ? "Avanzado" : s.avgGrade >= 4.0 ? "Adecuado" : "Critico"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: "var(--muted)" }}>Sin datos de promedios para este periodo.</p>
          )}
        </section>
      )}

      {academicYearId && yearAverage && (
        <section className="panel">
          <h3>Resumen Anual</h3>
          {yearStudents.length > 0 ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Estudiante</th><th>Semestre 1</th><th>Semestre 2</th><th>Prom. Anual</th><th>Total notas</th></tr>
                </thead>
                <tbody>
                  {yearStudents.map((s, i) => (
                    <tr key={i}>
                      <td><strong>{s.studentName}</strong></td>
                      <td style={{ fontWeight: 600 }}>{s.semesters?.["1"] ? Number(s.semesters["1"]).toFixed(1).replace(".", ",") : "—"}</td>
                      <td style={{ color: "var(--muted)" }}>{s.semesters?.["2"] ? Number(s.semesters["2"]).toFixed(1).replace(".", ",") : "—"}</td>
                      <td><span className={`badge ${s.avgGrade >= 4.0 ? "badge--active" : "badge--inactive"}`}>{s.avgGrade.toFixed(1).replace(".", ",")}</span></td>
                      <td style={{ textAlign: "center" }}>{s.totalGrades}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: "var(--muted)" }}>Sin datos de resumen anual.</p>
          )}
        </section>
      )}
    </>
  );
}
