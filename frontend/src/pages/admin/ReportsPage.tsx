import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { EmptyState } from "../../components/common/EmptyState";
import type { AdminCourseRow } from "../../types/api";

export function ReportsPage() {
  const queryClient = useQueryClient();
  const [reportType, setReportType] = useState<"STUDENT" | "COURSE" | "INSTITUTIONAL">("COURSE");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [message, setMessage] = useState("");

  const institutionsQuery = useQuery({ queryKey: ["inst-for-reports"], queryFn: () => api.listInstitutions() });
  const institutionId = institutionsQuery.data?.[0]?.id || "";

  const coursesQuery = useQuery<AdminCourseRow[]>({
    queryKey: ["courses-for-reports", institutionId],
    queryFn: () => api.listCourses({ institutionId }),
    enabled: Boolean(institutionId),
  });

  const reportsQuery = useQuery({
    queryKey: ["reports-list"],
    queryFn: () => api.listReports({ limit: 10 }) as Promise<{ data: { id: string; type: string; status: string; format: string; generatedAt: string | null }[] }>,
  });

  const generateMutation = useMutation({
    mutationFn: api.generateReport,
    onSuccess: (data) => {
      setMessage(`Reporte generado: ${data.reportId}. Recarga la tabla para verlo.`);
      queryClient.invalidateQueries({ queryKey: ["reports-list"] });
    },
    onError: (e) => setMessage(e instanceof Error ? e.message : "Error al generar reporte"),
  });

  function handleGenerate() {
    if (reportType === "COURSE" && !selectedCourseId) { setMessage("Selecciona un curso para el reporte."); return; }
    if (reportType === "STUDENT" && !selectedStudentId) { setMessage("Selecciona un alumno para el reporte."); return; }

    generateMutation.mutate({
      type: reportType,
      courseId: reportType === "COURSE" ? selectedCourseId : undefined,
      studentId: reportType === "STUDENT" ? selectedStudentId : undefined,
      institutionId: reportType === "INSTITUTIONAL" ? institutionId : undefined,
    });
  }

  const reportList = (reportsQuery.data as { data: { id: string; type: string; status: string; format: string; generatedAt: string | null }[] })?.data || [];

  return (
    <>
      <section className="panel">
        <h3>Generar Reporte Pedagógico</h3>
        <div className="form-grid">
          <div className="form-field">
            <label>Tipo de reporte</label>
            <select value={reportType} onChange={(e) => setReportType(e.target.value as "STUDENT" | "COURSE" | "INSTITUTIONAL")}>
              <option value="COURSE">Por Curso</option>
              <option value="STUDENT">Por Alumno</option>
              <option value="INSTITUTIONAL">Institucional</option>
            </select>
          </div>
          {reportType === "COURSE" && (
            <div className="form-field">
              <label>Curso</label>
              <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)}>
                <option value="">Seleccionar curso...</option>
                {(coursesQuery.data || []).map((c) => (
                  <option key={c.course_id} value={c.course_id}>{c.course_name} ({c.grade_level}°)</option>
                ))}
              </select>
            </div>
          )}
          {reportType === "STUDENT" && (
            <div className="form-field">
              <label>ID del Alumno</label>
              <input
                placeholder="UUID del alumno..."
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
              />
            </div>
          )}
        </div>
        <div className="form-actions">
          <button onClick={handleGenerate} disabled={generateMutation.isPending}>
            {generateMutation.isPending ? "Generando..." : "Generar reporte"}
          </button>
        </div>
        {message ? <p className="form-message">{message}</p> : null}
      </section>

      <section className="panel">
        <h3>Reportes generados</h3>
        {reportsQuery.isLoading ? <LoadingSpinner size="sm" /> : null}
        {reportList.length === 0 && !reportsQuery.isLoading ? (
          <EmptyState title="Sin reportes" description="Genera tu primer reporte pedagógico usando el formulario superior." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Tipo</th><th>Estado</th><th>Formato</th><th>Generado</th><th></th></tr>
              </thead>
              <tbody>
                {reportList.map((r) => (
                  <tr key={r.id}>
                    <td><span className="badge badge--role">{r.type}</span></td>
                    <td><span className={`badge ${r.status === "COMPLETED" ? "badge--active" : "badge--warning"}`}>{r.status}</span></td>
                    <td>{r.format}</td>
                    <td>
                      {r.generatedAt
                        ? new Date(r.generatedAt).toLocaleDateString("es-CL")
                        : "Pendiente"}
                    </td>
                    <td>
                      {r.status === "COMPLETED" && (
                        <button className="btn-small btn-secondary" onClick={() => {
                          api.getReport(r.id).then((data) => {
                            setMessage(JSON.stringify(data, null, 2).slice(0, 500) + "...");
                          }).catch(() => setMessage("No se pudo cargar el reporte."));
                        }}>
                          Ver
                        </button>
                      )}
                    </td>
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
