import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { useToast } from "../../components/common/Toast";

export function GradeChangeRequestsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<"PENDING" | "APPROVED" | "REJECTED" | "">("");

  const requestsQuery = useQuery({
    queryKey: ["grade-change-requests", statusFilter],
    queryFn: () => api.listGradeChangeRequests(statusFilter ? { status: statusFilter } : undefined) as Promise<unknown[]>,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => api.approveGradeChangeRequest(id, notes),
    onSuccess: () => {
      toast("Solicitud aprobada.", "success");
      queryClient.invalidateQueries({ queryKey: ["grade-change-requests"] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Error al aprobar.", "error"),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => api.rejectGradeChangeRequest(id, notes),
    onSuccess: () => {
      toast("Solicitud rechazada.", "success");
      queryClient.invalidateQueries({ queryKey: ["grade-change-requests"] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Error al rechazar.", "error"),
  });

  const requests = (requestsQuery.data || []) as unknown as { id: string; studentName: string; courseName: string; subjectName: string; assessmentTitle: string; oldGrade: number; newGrade: number; reason: string; status: string; requestedBy: string; createdAt: string }[];

  return (
    <section className="panel">
      <h3>Solicitudes de cambio de nota</h3>
      <p style={{ color: "var(--muted)", fontSize: ".84rem", marginBottom: 12 }}>Revisiones de notas solicitadas por docentes. Revisa, aprueba o rechaza cada solicitud.</p>
      <div className="form-row" style={{ marginBottom: 12 }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="">Todos los estados</option>
          <option value="PENDING">Pendientes</option>
          <option value="APPROVED">Aprobadas</option>
          <option value="REJECTED">Rechazadas</option>
        </select>
      </div>
      {requestsQuery.isLoading ? <LoadingSpinner label="Cargando solicitudes..." /> : (
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Fecha</th><th>Alumno</th><th>Evaluación</th><th>Curso</th><th>Asignatura</th><th>Nota actual</th><th>Nota propuesta</th><th>Motivo</th><th>Profesor</th><th>Estado</th><th>Acción</th></tr></thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td style={{ whiteSpace: "nowrap" }}>{new Date(r.createdAt).toLocaleDateString("es-CL")}</td>
                <td><strong>{r.studentName}</strong></td>
                <td>{r.assessmentTitle}</td>
                <td>{r.courseName}</td>
                <td>{r.subjectName}</td>
                <td><span style={{ color: r.oldGrade < 4.0 ? "var(--danger)" : "var(--ink)", fontWeight: 600 }}>{r.oldGrade.toFixed(1).replace(".", ",")}</span></td>
                <td><strong style={{ color: r.newGrade >= 4.0 ? "var(--success)" : "var(--ink)" }}>{r.newGrade.toFixed(1).replace(".", ",")}</strong></td>
                <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", fontSize: ".8rem" }}>{r.reason}</td>
                <td>{r.requestedBy}</td>
                <td><span className={`badge ${r.status === "APPROVED" ? "badge--active" : r.status === "REJECTED" ? "badge--inactive" : "badge--warning"}`}>{r.status === "PENDING" ? "Pendiente" : r.status === "APPROVED" ? "Aprobada" : "Rechazada"}</span></td>
                <td>
                  {r.status === "PENDING" && (
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn-small" onClick={() => approveMutation.mutate({ id: r.id })} disabled={approveMutation.isPending}>Aprobar</button>
                      <button className="btn-small btn-danger" onClick={() => rejectMutation.mutate({ id: r.id })} disabled={rejectMutation.isPending}>Rechazar</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </section>
  );
}
