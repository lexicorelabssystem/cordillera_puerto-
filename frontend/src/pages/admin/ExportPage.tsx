import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { EmptyState } from "../../components/common/EmptyState";
import { useToast } from "../../components/common/Toast";
import { useInstitution } from "../../app/InstitutionContext";

const ENTITY_TYPES = [
  { value: "students", label: "Estudiantes" },
  { value: "grades", label: "Notas" },
  { value: "questions", label: "Preguntas" },
  { value: "courses", label: "Cursos" },
];

const FORMATS = [
  { value: "xlsx", label: "Excel (.xlsx)" },
  { value: "csv", label: "CSV" },
  { value: "json", label: "JSON" },
];

export function ExportPage() {
  const queryClient = useQueryClient();
  const [entityType, setEntityType] = useState("students");
  const [format, setFormat] = useState("xlsx");

  const { selectedInstitution } = useInstitution();

  const { toast } = useToast();

  const exportsQuery = useQuery({
    queryKey: ["export-jobs"],
    queryFn: api.listExportJobs,
    refetchInterval: (query) => ((query.state.data ?? []).some((job) => ["PENDING", "QUEUED", "waiting", "active", "PROCESSING"].includes(job.status)) ? 3000 : false),
  });

  const exportMutation = useMutation({
    mutationFn: api.requestExport,
    onSuccess: () => {
      toast("Exportacion solicitada. El archivo estara disponible en breve.", "success");
      queryClient.invalidateQueries({ queryKey: ["export-jobs"] });
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Error al solicitar exportación", "error"),
  });

  function handleExport() {
    exportMutation.mutate({
      entityType,
      format,
      institutionId: selectedInstitution?.id || undefined,
    });
  }

  return (
    <>
      <section className="panel">
        <h3>Exportar datos</h3>
        <p style={{ color: "var(--muted)", marginBottom: 12 }}>
          Genera archivos con los datos del sistema. La exportación se procesa en segundo plano.
        </p>
        <div className="form-grid">
          <div className="form-field">
            <label>Entidad a exportar</label>
            <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
              {ENTITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Formato</label>
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              {FORMATS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-actions">
          <button onClick={handleExport} disabled={exportMutation.isPending}>
            {exportMutation.isPending ? "Procesando..." : "Exportar"}
          </button>
        </div>
      </section>

      <section className="panel">
        <h3>Historial de exportaciones</h3>
        {exportsQuery.isLoading ? <LoadingSpinner size="sm" /> : null}
        {!exportsQuery.data?.length ? (
          <EmptyState title="Sin exportaciones" description="Aún no se han solicitado exportaciones." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Fecha</th><th>Entidad</th><th>Formato</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {exportsQuery.data?.map((job) => (
                  <tr key={job.id}>
                    <td>{new Date(job.createdAt).toLocaleString("es-CL")}</td>
                    <td><span className="badge badge--role">{job.entityType}</span></td>
                    <td>{job.format.toUpperCase()}</td>
                    <td>
                      <span className={`badge ${["COMPLETED", "completed"].includes(job.status) ? "badge--active" : "badge--warning"}`}>{job.status}</span>
                      {job.fileUrl ? <a href={job.fileUrl} style={{ marginLeft: 8 }}>Descargar</a> : null}
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
