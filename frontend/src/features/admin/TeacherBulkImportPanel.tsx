import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useToast } from "../../components/common/Toast";
import { useInstitution } from "../../app/InstitutionContext";

type ValidationState = {
  jobId: string;
  summary: {
    totalRows: number;
    validRows: number;
    errorRows: number;
    errors: { row: number; errors: string[] }[];
  };
};

export function TeacherBulkImportPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedInstitution } = useInstitution();
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "validating" | "ready" | "importing" | "done" | "error">("idle");
  const [percent, setPercent] = useState(0);
  const [validation, setValidation] = useState<ValidationState | null>(null);

  const jobs = useQuery({
    queryKey: ["import-jobs", "teachers"],
    queryFn: () => api.listImportJobs("teachers"),
  });

  async function uploadAndValidate() {
    if (!file || !selectedInstitution?.id) {
      toast("Selecciona una institucion y un archivo Excel.", "warning");
      return;
    }
    setValidation(null);
    setPercent(0);
    try {
      setPhase("uploading");
      const uploaded = await api.uploadImportWithProgress(
        "teachers",
        file,
        setPercent,
        selectedInstitution.id,
      );
      setPhase("validating");
      const result = await api.validateImport(uploaded.importJobId);
      setValidation({ jobId: uploaded.importJobId, summary: result.summary });
      setPhase("ready");
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["import-jobs", "teachers"] });
      toast("Planilla validada. Revisa el resultado antes de confirmar.", "success");
    } catch (error) {
      setPhase("error");
      toast(error instanceof Error ? error.message : "No se pudo procesar la planilla.", "error");
    }
  }

  const confirmImport = useMutation({
    mutationFn: async () => {
      if (!validation) throw new Error("No hay una importacion validada");
      setPhase("importing");
      return api.confirmImport(validation.jobId, validation.summary.errorRows > 0);
    },
    onSuccess: (result) => {
      setPhase("done");
      setValidation(null);
      toast(`${result.success} profesor(es) importado(s).${result.failed ? ` ${result.failed} fila(s) omitida(s).` : ""}`, result.failed ? "warning" : "success");
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["import-jobs", "teachers"] });
    },
    onError: (error) => {
      setPhase("error");
      toast(error instanceof Error ? error.message : "No se pudo importar.", "error");
    },
  });

  const deleteImport = useMutation({
    mutationFn: api.deleteImportData,
    onSuccess: (result) => {
      toast(`${result.teachersDeleted} profesor(es) eliminado(s) definitivamente.`, "success");
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["import-jobs", "teachers"] });
    },
    onError: (error) => toast(error instanceof Error ? error.message : "No se pudo eliminar la importacion.", "error"),
  });

  function removeImport(id: string, count: number) {
    if (window.confirm(`Eliminar definitivamente los ${count} profesor(es) creados por esta importacion? Esta accion no se puede deshacer.`)) {
      deleteImport.mutate(id);
    }
  }

  function reset() {
    setFile(null);
    setPercent(0);
    setValidation(null);
    setPhase("idle");
  }

  return (
    <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--line-light)" }}>
      <h3 style={{ marginTop: 0 }}>Importar profesores masivamente</h3>
      <p style={{ color: "var(--muted)", marginBottom: 12 }}>
        Formato de la planilla: columna A Nombre, B RUT, C Asignatura y D Correo.
        La clave temporal para los nuevos profesores sera <strong>Temp2026**</strong> y deberan cambiarla al ingresar.
      </p>

      {!selectedInstitution?.id ? <p className="error">Selecciona una institucion antes de importar.</p> : null}

      <div className="form-row" style={{ alignItems: "end" }}>
        <div className="form-field">
          <label>Archivo Excel o CSV</label>
          <input type="file" accept=".xlsx,.csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </div>
        <button onClick={uploadAndValidate} disabled={!file || !selectedInstitution?.id || ["uploading", "validating", "importing"].includes(phase)}>
          {phase === "uploading" ? `Subiendo ${percent}%...` : phase === "validating" ? "Validando..." : "Subir y validar"}
        </button>
      </div>

      {validation ? (
        <div style={{ marginTop: 14 }}>
          <strong>
            {validation.summary.totalRows} filas: {validation.summary.validRows} validas y {validation.summary.errorRows} con errores
          </strong>
          {validation.summary.errors.length ? (
            <ul style={{ maxHeight: 180, overflow: "auto", fontSize: ".86rem" }}>
              {validation.summary.errors.map((error, index) => (
                <li key={index}>Fila {error.row}: {error.errors.join(", ")}</li>
              ))}
            </ul>
          ) : null}
          <div className="form-actions">
            <button onClick={() => confirmImport.mutate()} disabled={!validation.summary.validRows || confirmImport.isPending}>
              {confirmImport.isPending ? "Importando..." : `Confirmar importacion (${validation.summary.validRows})`}
            </button>
            <button className="btn-secondary" onClick={reset}>Cancelar</button>
          </div>
        </div>
      ) : null}

      {phase === "done" || phase === "error" ? (
        <div className="form-actions" style={{ marginTop: 12 }}>
          <button className="btn-secondary" onClick={reset}>Nueva importacion</button>
        </div>
      ) : null}

      <div style={{ marginTop: 18 }}>
        <h4>Importaciones recientes de profesores</h4>
        {jobs.data?.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Fecha</th><th>Estado</th><th>Registros</th><th>Acciones</th></tr></thead>
              <tbody>
                {jobs.data.slice(0, 8).map((job) => (
                  <tr key={job.id}>
                    <td>{new Date(job.createdAt).toLocaleString("es-CL")}</td>
                    <td><span className={job.status === "COMPLETED" ? "badge badge--active" : "badge badge--inactive"}>{job.deletedAt ? "Eliminada" : job.status}</span></td>
                    <td>{job.successRows}/{job.totalRows}</td>
                    <td>
                      {job.status === "COMPLETED" && job.trackedRecords > 0 ? (
                        <button className="btn-small btn-danger" disabled={deleteImport.isPending} onClick={() => removeImport(job.id, job.trackedRecords)}>
                          Eliminar importacion
                        </button>
                      ) : <span style={{ color: "var(--muted)", fontSize: ".82rem" }}>No disponible</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p style={{ color: "var(--muted)" }}>{jobs.isLoading ? "Cargando..." : "Aun no hay importaciones."}</p>}
      </div>
    </div>
  );
}
