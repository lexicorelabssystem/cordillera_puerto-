import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useToast } from "../../components/common/Toast";

const PHASE_LABELS: Record<string, string> = {
  uploading: "Subiendo archivo...",
  validating: "Validando datos...",
  importing: "Importando registros...",
  done: "Completado",
  error: "Error",
};

export function StudentBulkImportPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploadPhase, setUploadPhase] = useState<string | null>(null);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [validationResult, setValidationResult] = useState<{
    jobId: string;
    status: string;
    summary: { totalRows: number; validRows: number; errorRows: number; errors: { row: number; errors: string[] }[] };
  } | null>(null);
  const [importResult, setImportResult] = useState<{
    importJobId: string;
    success: number;
    failed: number;
  } | null>(null);

  const importJobsQuery = useQuery({
    queryKey: ["import-jobs", "students"],
    queryFn: () => api.listImportJobs("students"),
  });

  async function handleUpload() {
    if (!file) {
      toast("Selecciona un archivo.", "warning");
      return;
    }

    setUploadPercent(0);
    setValidationResult(null);
    setImportResult(null);

    try {
      setUploadPhase("uploading");
      const uploadResult = await api.uploadImportWithProgress("students", file, (percent) => {
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
      toast("Archivo validado. Revisa los resultados y confirma la importacion.", "success");
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["import-jobs"] });
    } catch (e) {
      setUploadPhase("error");
      toast(e instanceof Error ? e.message : "Error al procesar archivo", "error");
    }
  }

  const confirmMutation = useMutation({
    mutationFn: () => {
      if (!validationResult) throw new Error("No hay resultados de validacion");
      setUploadPhase("importing");
      return api.confirmImport(validationResult.jobId, validationResult.summary.errorRows > 0);
    },
    onSuccess: (data) => {
      setUploadPhase("done");
      setImportResult({ importJobId: data.importJobId, success: data.success, failed: data.failed });
      toast(`${data.success} alumnos importados correctamente.${data.failed > 0 ? ` ${data.failed} omitidos.` : ""}`, "success");
      setValidationResult(null);
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["import-jobs"] });
    },
    onError: (e) => {
      setUploadPhase("error");
      toast(e instanceof Error ? e.message : "Error al importar", "error");
    },
  });

  const deleteImportMutation = useMutation({
    mutationFn: api.deleteImportData,
    onSuccess: (data) => {
      toast(`${data.studentsDeleted} alumnos eliminados definitivamente de la importacion.`, "success");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["import-jobs"] });
      setImportResult(null);
      handleReset();
    },
    onError: (e) => {
      toast(e instanceof Error ? e.message : "Error al eliminar importacion.", "error");
    },
  });

  function handleDeleteImport(importJobId: string, count: number) {
    if (!window.confirm(`Eliminar definitivamente los ${count} registro(s) creados por esta importacion? Esta accion no se puede deshacer.`)) return;
    deleteImportMutation.mutate(importJobId);
  }

  function handleReset() {
    setUploadPhase(null);
    setUploadPercent(0);
    setValidationResult(null);
    setImportResult(null);
  }

  return (
    <section className="panel">
      <h3>Importar alumnos masivamente</h3>
      <p style={{ color: "var(--muted)", marginBottom: 12 }}>
        Formato requerido: columna A nombre completo, B RUT, C curso y D correo electronico.
        El nombre completo se separa como dos primeros nombres y dos apellidos. Si el curso viene sin letra (por ejemplo, 1° básico), se conservará como curso de procedencia sin sección.
      </p>

      {!uploadPhase ? (
        <>
          <div className="form-grid">
            <div className="form-field">
              <label>Archivo Excel o CSV</label>
              <input
                type="file"
                accept=".csv,.xlsx"
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
      ) : null}

      {uploadPhase ? (
        <div className={`teacher-material-upload-progress${uploadPhase === "error" ? " teacher-material-upload-progress--error" : uploadPhase === "done" ? " teacher-material-upload-progress--done" : ""}`}>
          <div className="teacher-material-upload-progress__header">
            <strong>{PHASE_LABELS[uploadPhase] || uploadPhase}</strong>
            {(uploadPhase === "uploading" || uploadPhase === "importing") ? (
              <span>{uploadPercent}%</span>
            ) : null}
          </div>
          <div className="teacher-material-upload-progress__track" aria-hidden="true">
            <span style={{ width: `${uploadPhase === "done" ? 100 : uploadPhase === "error" ? 100 : uploadPercent}%` }} />
          </div>
          <div className="teacher-material-upload-progress__meta">
            {uploadPhase === "uploading" ? <span>Subiendo archivo al servidor...</span> : null}
            {uploadPhase === "validating" ? <span>Verificando columnas y datos...</span> : null}
            {uploadPhase === "importing" ? <span>Creando alumnos, usuarios y matriculas...</span> : null}
            {uploadPhase === "done" && !validationResult && !importResult ? <span>Procesamiento finalizado</span> : null}
            {uploadPhase === "done" && validationResult ? (
              <span>
                {validationResult.summary.totalRows} filas: {validationResult.summary.validRows} validas, {validationResult.summary.errorRows} con errores
              </span>
            ) : null}
            {uploadPhase === "done" && importResult ? (
              <span>{importResult.success} alumnos importados{importResult.failed > 0 ? `, ${importResult.failed} omitidos` : ""}</span>
            ) : null}
            {uploadPhase === "error" ? <span>Ocurrio un error. Intenta de nuevo.</span> : null}
          </div>
        </div>
      ) : null}

      {validationResult ? (
        <div style={{ marginTop: 16 }}>
          {validationResult.summary.errorRows > 0 ? (
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
                Las filas con errores seran omitidas. Las {validationResult.summary.validRows} filas validas seran importadas.
              </p>
            </div>
          ) : null}

          <div className="form-actions" style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => confirmMutation.mutate()}
              disabled={confirmMutation.isPending || validationResult.summary.validRows === 0}
              className="btn-primary"
            >
              {confirmMutation.isPending ? "Importando..." : `Confirmar importacion (${validationResult.summary.validRows} registros)`}
            </button>
            <button onClick={handleReset} className="btn-secondary">
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {importResult ? (
        <div className="form-actions" style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={handleReset}>
            Nueva importacion
          </button>
          <button
            className="btn-danger"
            onClick={() => handleDeleteImport(importResult.importJobId, importResult.success)}
            disabled={deleteImportMutation.isPending || importResult.success === 0}
          >
            {deleteImportMutation.isPending ? "Eliminando..." : "Eliminar definitivo esta importacion"}
          </button>
        </div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        <h4 style={{ margin: "0 0 10px" }}>Importaciones recientes de alumnos</h4>
        {importJobsQuery.isLoading ? (
          <p style={{ color: "var(--muted)", margin: 0 }}>Cargando historial...</p>
        ) : null}
        {importJobsQuery.data && importJobsQuery.data.length > 0 ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Fecha</th><th>Estado</th><th>Registros</th><th>Eliminable</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {importJobsQuery.data.slice(0, 8).map((job) => (
                  <tr key={job.id}>
                    <td>{new Date(job.createdAt).toLocaleString("es-CL")}</td>
                    <td><span className={job.status === "COMPLETED" ? "badge badge--active" : "badge badge--inactive"}>{job.deletedAt ? "Eliminada" : job.status}</span></td>
                    <td>{job.successRows}/{job.totalRows}</td>
                    <td>{job.trackedRecords > 0 ? `${job.trackedRecords} registros` : "Sin trazabilidad"}</td>
                    <td>
                      {job.status === "COMPLETED" && job.trackedRecords > 0 ? (
                        <button
                          className="btn-small btn-danger"
                          onClick={() => handleDeleteImport(job.id, job.trackedRecords)}
                          disabled={deleteImportMutation.isPending}
                        >
                          Eliminar definitivo
                        </button>
                      ) : (
                        <span style={{ color: "var(--muted)", fontSize: ".82rem" }}>No disponible</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}
