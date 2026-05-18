import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { EmptyState } from "../../components/common/EmptyState";

interface ChangeRequest {
  id: string;
  gradeId: string;
  requestedBy: string;
  oldGrade: number;
  newGrade: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
  grade: {
    student: { id: string; firstName: string; lastName: string };
    assessment: { id: string; title: string; courseId: string; subjectId: string };
  };
  requester: { id: string; firstName: string; lastName: string; email: string };
  reviewer: { id: string; firstName: string; lastName: string } | null;
}

export function GradeChangeRequestsPage() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<"PENDING" | "APPROVED" | "REJECTED" | "">("");
  const [reviewNotes, setReviewNotes] = useState("");

  const requestsQuery = useQuery({
    queryKey: ["grade-change-requests", statusFilter],
    queryFn: () => api.listGradeChangeRequests(statusFilter ? { status: statusFilter } : undefined) as Promise<ChangeRequest[]>,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api.approveGradeChangeRequest(id, notes),
    onSuccess: () => { setMessage("Solicitud aprobada. Nota actualizada."); setReviewNotes(""); queryClient.invalidateQueries({ queryKey: ["grade-change-requests"] }); },
    onError: (e) => setMessage(e instanceof Error ? e.message : "Error al aprobar"),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api.rejectGradeChangeRequest(id, notes),
    onSuccess: () => { setMessage("Solicitud rechazada."); setReviewNotes(""); queryClient.invalidateQueries({ queryKey: ["grade-change-requests"] }); },
    onError: (e) => setMessage(e instanceof Error ? e.message : "Error al rechazar"),
  });

  const requests = requestsQuery.data || [];

  return (
    <>
      {message ? <p className="form-message">{message}</p> : null}

      <section className="panel">
        <h3>Solicitudes de cambio de nota</h3>
        <div className="form-row" style={{ marginBottom: 12 }}>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "PENDING" | "APPROVED" | "REJECTED" | "")}>
            <option value="">Todos los estados</option>
            <option value="PENDING">Pendientes</option>
            <option value="APPROVED">Aprobadas</option>
            <option value="REJECTED">Rechazadas</option>
          </select>
        </div>

        {requestsQuery.isLoading ? <LoadingSpinner size="sm" /> : null}
        {requests.length === 0 && !requestsQuery.isLoading ? (
          <EmptyState title="Sin solicitudes" description="No hay solicitudes de cambio de nota registradas." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Fecha</th><th>Alumno</th><th>Evaluación</th><th>Nota actual</th><th>Nota propuesta</th><th>Motivo</th><th>Solicitante</th><th>Estado</th><th>Acción</th></tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{new Date(r.createdAt).toLocaleDateString("es-CL")}</td>
                    <td><strong>{r.grade.student.firstName} {r.grade.student.lastName}</strong></td>
                    <td>{r.grade.assessment.title.slice(0, 30)}</td>
                    <td>{r.oldGrade}</td>
                    <td><strong>{r.newGrade}</strong></td>
                    <td style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }}>{r.reason}</td>
                    <td>{r.requester.firstName} {r.requester.lastName}</td>
                    <td>
                      <span className={`badge ${r.status === "APPROVED" ? "badge--active" : r.status === "REJECTED" ? "badge--inactive" : "badge--warning"}`}>
                        {r.status === "PENDING" ? "Pendiente" : r.status === "APPROVED" ? "Aprobada" : "Rechazada"}
                      </span>
                    </td>
                    <td>
                      {r.status === "PENDING" ? (
                        <div className="action-buttons" style={{ flexDirection: "column", gap: 4 }}>
                          <input
                            placeholder="Notas de revisión..."
                            value={reviewNotes}
                            onChange={(e) => setReviewNotes(e.target.value)}
                            style={{ width: 120, fontSize: "0.75rem", padding: "4px 6px" }}
                          />
                          <div style={{ display: "flex", gap: 4 }}>
                            <button className="btn-small" onClick={() => approveMutation.mutate({ id: r.id, notes: reviewNotes })} disabled={approveMutation.isPending}>Aprobar</button>
                            <button className="btn-small btn-danger" onClick={() => rejectMutation.mutate({ id: r.id, notes: reviewNotes })} disabled={rejectMutation.isPending}>Rechazar</button>
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                          {r.reviewer ? `${r.reviewer.firstName} ${r.reviewer.lastName}` : "Sistema"}
                        </span>
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
