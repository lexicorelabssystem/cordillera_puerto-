import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { api } from "../../lib/api";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { EmptyState } from "../../components/common/EmptyState";
import { useToast } from "../../components/common/Toast";

const ALL_ENTITY_TYPES = [
  { value: "students", label: "Estudiantes", accept: ".csv,.xlsx" },
  { value: "questions", label: "Preguntas", accept: ".csv,.xlsx" },
  { value: "grades", label: "Notas", accept: ".csv,.xlsx" },
  { value: "enrollments", label: "Matrículas", accept: ".csv,.xlsx" },
];

const UTP_ENTITY_TYPES = [
  { value: "students", label: "Estudiantes", accept: ".csv,.xlsx" },
];

const PHASE_LABELS: Record<string, string> = {
  uploading: "Subiendo archivo...",
  validating: "Validando datos...",
  importing: "Importando registros...",
  done: "Completado",
  error: "Error",
};

export function ImportPage() {
  const location = useLocation();
  const isUtp = location.pathname.startsWith("/utp");
  const ENTITY_TYPES = isUtp ? UTP_ENTITY_TYPES : ALL_ENTITY_TYPES;
  const queryClient = useQueryClient();
  const [entityType, setEntityType] = useState("students");
  const [file, setFile] = useState<File | null>(null);
  const { toast } = useToast();

  const [uploadPhase, setUploadPhase] = useState<string | null>(null);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [validationResult, setValidationResult] = useState<{
    jobId: string;
    status: string;
    summary: { totalRows: number; validRows: number; errorRows: number; errors: { row: number; errors: string[] }[] };
  } | null>(null);
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
  } | null>(null);

  const jobsQuery = useQuery({
    queryKey: ["import-jobs"],
    queryFn: () => api.listAuditLogs({ action: "IMPORT" }) as Promise<{ data: { id: string; action: string; entityType: string; createdAt: string }[] }>,
  });

  async function handleUpload() {
    if (!file) { toast("Selecciona un archivo.", "success"); return; }

    setUploadPercent(0);
    setValidationResult(null);
    setImportResult(null);

    try {
      setUploadPhase("uploading");
      const uploadResult = await api.uploadImportWithProgress(entityType, file, (percent) => {
        setUploadPercent(percent);
      });

      setUploadPhase("validating");
      const validateResult = await api.validateImport(uploadResult.importJobId);

      setValidationResult({
        jobId: uploadResult.importJobId,
        status: validateResult.status,
        summary: validateResult.summary,
      });

      setUploadPhase("done");
      toast("Archivo validado. Revisa los resultados y confirma la importación.", "success");
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["import-jobs"] });
    } catch (e) {
      setUploadPhase("error");
      toast(e instanceof Error ? e.message : "Error al procesar archivo", "error");
    }
  }

  const confirmMutation = useMutation({
    mutationFn: () => {
      if (!validationResult) throw new Error("No hay resultados de validación");
      setUploadPhase("importing");
      return api.confirmImport(validationResult.jobId, validationResult.summary.errorRows > 0);
    },
    onSuccess: (data) => {
      setUploadPhase("done");
      setImportResult({ success: data.success, failed: data.failed });
      toast(`${data.success} registros importados correctamente.${data.failed > 0 ? ` ${data.failed} errores omitidos.` : ""}`, "success");
      setValidationResult(null);
      queryClient.invalidateQueries({ queryKey: ["import-jobs"] });
    },
    onError: (e) => {
      setUploadPhase("error");
      toast(e instanceof Error ? e.message : "Error al importar", "error");
    },
  });

  function handleReset() {
    setUploadPhase(null);
    setUploadPercent(0);
    setValidationResult(null);
    setImportResult(null);
  }

  const selected = ENTITY_TYPES.find((e) => e.value === entityType);
  const isProcessing = uploadPhase && uploadPhase !== "done" && uploadPhase !== "error";

  return (
    <>
      <section className="panel">
        <h3>Importar datos</h3>
        <p style={{ color: "var(--muted)", marginBottom: 12 }}>
          Sube archivos CSV o XLSX con datos estructurados. Se validarán antes de la importación definitiva.
        </p>

        {!uploadPhase && (
          <>
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
              <button onClick={handleUpload} disabled={!file}>
                Subir y validar
              </button>
            </div>
          </>
        )}

        {uploadPhase && (
          <div className={`teacher-material-upload-progress${uploadPhase === "error" ? " teacher-material-upload-progress--error" : uploadPhase === "done" ? " teacher-material-upload-progress--done" : ""}`}>
            <div className="teacher-material-upload-progress__header">
              <strong>{PHASE_LABELS[uploadPhase] || uploadPhase}</strong>
              {(uploadPhase === "uploading" || uploadPhase === "importing") && (
                <span>{uploadPercent}%</span>
              )}
            </div>
            <div className="teacher-material-upload-progress__track" aria-hidden="true">
              <span style={{ width: `${uploadPhase === "done" ? 100 : uploadPhase === "error" ? 100 : uploadPercent}%` }} />
            </div>
            <div className="teacher-material-upload-progress__meta">
              {uploadPhase === "uploading" && <span>Subiendo archivo al servidor...</span>}
              {uploadPhase === "validating" && <span>Verificando columnas y datos...</span>}
              {uploadPhase === "importing" && <span>Creando registros en la base de datos...</span>}
              {uploadPhase === "done" && !validationResult && !importResult && <span>Procesamiento finalizado</span>}
              {uploadPhase === "done" && validationResult && (
                <span>
                  {validationResult.summary.totalRows} filas: {validationResult.summary.validRows} válidas, {validationResult.summary.errorRows} con errores
                </span>
              )}
              {uploadPhase === "done" && importResult && (
                <span>{importResult.success} registros importados{importResult.failed > 0 ? `, ${importResult.failed} omitidos` : ""}</span>
              )}
              {uploadPhase === "error" && <span>Ocurrió un error. Intenta de nuevo.</span>}
            </div>
          </div>
        )}

        {validationResult && (
          <div style={{ marginTop: 16 }}>
            {validationResult.summary.errorRows > 0 && (
              <div className="panel" style={{ background: "var(--warning-bg, #fff8e1)", marginBottom: 12 }}>
                <h4 style={{ color: "var(--warning, #f57c00)" }}>
                  {validationResult.summary.errorRows} fila(s) con errores
                </h4>
                <ul style={{ fontSize: "0.875rem", maxHeight: 200, overflow: "auto" }}>
                  {validationResult.summary.errors.map((err, i) => (
                    <li key={i}>
                      Fila {err.row}: {err.errors.join(", ")}
                    </li>
                  ))}
                </ul>
                <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 8 }}>
                  Las filas con errores serán omitidas. Las {validationResult.summary.validRows} filas válidas serán importadas.
                </p>
              </div>
            )}

            <div className="form-actions" style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => confirmMutation.mutate()}
                disabled={confirmMutation.isPending}
                className="btn-primary"
              >
                {confirmMutation.isPending ? "Importando..." : `Confirmar importación (${validationResult.summary.validRows} registros)`}
              </button>
              <button onClick={handleReset} className="btn-secondary">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {importResult && (
          <div className="form-actions" style={{ marginTop: 16 }}>
            <button onClick={handleReset}>
              Nueva importación
            </button>
          </div>
        )}
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
