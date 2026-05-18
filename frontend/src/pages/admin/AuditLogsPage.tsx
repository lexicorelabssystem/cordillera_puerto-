import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";

interface AuditLogRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
  actor: { id: string; email: string; firstName: string; lastName: string; role: string } | null;
  institution: { id: string; name: string } | null;
}

export function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const logsQuery = useQuery<{ data: AuditLogRow[]; meta: { page: number; total: number; totalPages: number; hasNext: boolean; hasPrevious: boolean } }>({
    queryKey: ["audit-logs", { page, action: actionFilter, entityType: entityTypeFilter, dateFrom, dateTo }],
    queryFn: () => api.listAuditLogs({
      page,
      limit: 20,
      action: actionFilter || undefined,
      entityType: entityTypeFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }) as Promise<{ data: AuditLogRow[]; meta: { page: number; total: number; totalPages: number; hasNext: boolean; hasPrevious: boolean } }>,
  });

  const summaryQuery = useQuery({
    queryKey: ["audit-summary", 7],
    queryFn: () => api.auditSummary(7) as Promise<{ totalEvents: number; topActions: { action: string; count: number }[]; dailyActivity: { day: string; total: number }[] }>,
  });

  const logs = (logsQuery.data as { data: AuditLogRow[] })?.data || [];
  const meta = (logsQuery.data as { meta: { page: number; total: number; totalPages: number; hasNext: boolean; hasPrevious: boolean } })?.meta;
  const summary = summaryQuery.data;

  return (
    <>
      <section className="panel">
        <h3>Registro de Auditoría</h3>

        <div className="form-row" style={{ marginBottom: 12 }}>
          <input
            placeholder="Filtrar por acción..."
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          />
          <input
            placeholder="Filtrar por entidad..."
            value={entityTypeFilter}
            onChange={(e) => { setEntityTypeFilter(e.target.value); setPage(1); }}
          />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            placeholder="Desde"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            placeholder="Hasta"
          />
        </div>

        {summary && (
          <div className="kpi-grid" style={{ marginBottom: 12 }}>
            <div className="kpi-card">
              <span>Eventos (7 días)</span>
              <strong>{summary.totalEvents}</strong>
            </div>
            <div className="kpi-card" style={{ gridColumn: "span 3" }}>
              <span>Acciones más frecuentes</span>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {summary.topActions.map((a) => (
                  <span key={a.action} className="badge badge--role" style={{ fontSize: "0.78rem" }}>
                    {a.action} ({a.count})
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {logsQuery.isLoading ? <LoadingSpinner size="sm" /> : null}
        {logs.length === 0 && !logsQuery.isLoading ? (
          <div className="empty-state">
            <strong>Sin registros de auditoría</strong>
            <p>No hay eventos registrados con los filtros actuales.</p>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Acción</th>
                    <th>Entidad</th>
                    <th>ID Entidad</th>
                    <th>Actor</th>
                    <th>Institución</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {new Date(log.createdAt).toLocaleString("es-CL", {
                          day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td>
                        <span className={`badge ${log.action.includes("DELETE") || log.action.includes("REVOKE") || log.action.includes("REJECTED")
                          ? "badge--inactive"
                          : log.action.includes("CREATE") || log.action.includes("APPROVED") || log.action.includes("ASSIGNED")
                            ? "badge--active"
                            : "badge--warning"}`}>
                          {log.action}
                        </span>
                      </td>
                      <td>{log.entityType}</td>
                      <td style={{ fontSize: "0.78rem", color: "var(--muted)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {log.entityId || "-"}
                      </td>
                      <td>{log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : "Sistema"}</td>
                      <td>{log.institution?.name || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {meta ? (
              <div className="pagination">
                <span>Página {meta.page} de {meta.totalPages} ({meta.total} registros)</span>
                <div className="pagination-buttons">
                  <button disabled={!meta.hasPrevious} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</button>
                  <button disabled={!meta.hasNext} onClick={() => setPage((p) => p + 1)}>Siguiente</button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </>
  );
}
