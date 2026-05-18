import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { EmptyState } from "../../components/common/EmptyState";

const ENTITY_TYPES = [
  { value: "students", label: "Estudiantes", accept: ".csv,.xlsx" },
  { value: "questions", label: "Preguntas", accept: ".csv,.xlsx" },
  { value: "grades", label: "Notas", accept: ".csv,.xlsx" },
  { value: "enrollments", label: "Matrículas", accept: ".csv,.xlsx" },
];

export function ImportPage() {
  const queryClient = useQueryClient();
  const [entityType, setEntityType] = useState("students");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");

  const jobsQuery = useQuery({
    queryKey: ["import-jobs"],
    queryFn: () => api.listAuditLogs({ action: "IMPORT" }) as Promise<{ data: { id: string; action: string; entityType: string; createdAt: string }[] }>,
  });

  const uploadMutation = useMutation({
    mutationFn: ({ entity, file }: { entity: string; file: File }) => api.uploadImport(entity, file),
    onSuccess: (data: { jobId?: string; id?: string }) => {
      setMessage(`Archivo subido correctamente. Job: ${data.jobId || data.id || "N/A"}`);
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["import-jobs"] });
    },
    onError: (e) => setMessage(e instanceof Error ? e.message : "Error al subir archivo"),
  });

  function handleUpload() {
    if (!file) { setMessage("Selecciona un archivo."); return; }
    uploadMutation.mutate({ entity: entityType, file });
  }

  const selected = ENTITY_TYPES.find((e) => e.value === entityType);

  return (
    <>
      <section className="panel">
        <h3>Importar datos</h3>
        <p style={{ color: "var(--muted)", marginBottom: 12 }}>
          Sube archivos CSV o XLSX con datos estructurados. Se validarán antes de la importación definitiva.
        </p>
        <div className="form-grid">
          <div className="form-field">
            <label>Tipo de entidad</label>
            <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
              {ENTITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Archivo</label>
            <input
              type="file"
              accept={selected?.accept || ".csv,.xlsx"}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>
        <div className="form-actions">
          <button onClick={handleUpload} disabled={uploadMutation.isPending || !file}>
            {uploadMutation.isPending ? "Subiendo..." : "Subir y validar"}
          </button>
        </div>
        {message ? <p className="form-message">{message}</p> : null}
      </section>

      <section className="panel">
        <h3>Descargar plantillas</h3>
        <p style={{ color: "var(--muted)", marginBottom: 8 }}>
          Usa estas plantillas como referencia para preparar tus archivos de importación.
        </p>
        <div className="form-row">
          {ENTITY_TYPES.map((t) => (
            <a
              key={t.value}
              href={`/api/v1/files/template/${t.value}`}
              download
              className="btn-small"
              style={{ textDecoration: "none", display: "inline-block", textAlign: "center" }}
            >
              Plantilla {t.label}
            </a>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>Historial de importaciones</h3>
        {jobsQuery.isLoading ? <LoadingSpinner size="sm" /> : null}
        {!jobsQuery.data || ((jobsQuery.data as { data: unknown[] }).data || []).length === 0 ? (
          <EmptyState title="Sin importaciones" description="Aún no se han realizado importaciones de datos." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Fecha</th><th>Tipo</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {((jobsQuery.data as { data: { id: string; action: string; entityType: string; createdAt: string }[] }).data || []).map((job: { id: string; action: string; entityType: string; createdAt: string }) => (
                  <tr key={job.id}>
                    <td>{new Date(job.createdAt).toLocaleString("es-CL")}</td>
                    <td><span className="badge badge--role">{job.entityType}</span></td>
                    <td><span className="badge badge--active">Completado</span></td>
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
