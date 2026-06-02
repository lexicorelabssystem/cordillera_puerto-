import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { useToast } from "../../components/common/Toast";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} dias`;
}

export function BandejaPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");

  const notifQuery = useQuery({
    queryKey: ["notifications", filter],
    queryFn: () => api.getNotifications({ status: filter === "UNREAD" ? "PENDING" : undefined }),
  });

  const unreadQuery = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: () => api.getUnreadNotificationCount(),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => {
      toast("Todas las notificaciones marcadas como leidas.", "success");
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  const notifications = notifQuery.data?.notifications || [];
  const unreadCount = unreadQuery.data ?? 0;

  return (
    <div className="bandeja-page">
      <header className="libro-header-v2">
        <div className="libro-header-v2__inner">
          <div className="libro-header-v2__title">
            <div className="libro-header-v2__icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
            <div>
              <h1>Bandeja de Notificaciones</h1>
              <p>Cambios de nota y novedades del sistema</p>
            </div>
          </div>
        </div>
      </header>

      {notifQuery.isLoading && <LoadingSpinner label="Cargando notificaciones..." />}

      {notifQuery.isError && (
        <section className="panel">
          <p className="error">Error al cargar las notificaciones.</p>
        </section>
      )}

      {!notifQuery.isLoading && (
        <section className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className={`btn ${filter === "ALL" ? "btn--primary" : "btn--ghost"}`}
                onClick={() => setFilter("ALL")}
              >
                Todas ({notifQuery.data?.total ?? 0})
              </button>
              <button
                className={`btn ${filter === "UNREAD" ? "btn--primary" : "btn--ghost"}`}
                onClick={() => setFilter("UNREAD")}
              >
                No leidas ({unreadCount})
              </button>
            </div>
            {unreadCount > 0 && (
              <button className="btn btn--ghost" onClick={() => markAllReadMutation.mutate()} disabled={markAllReadMutation.isPending}>
                Marcar todas como leidas
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="empty-state">
              <strong>No hay notificaciones{filter === "UNREAD" ? " pendientes" : ""}</strong>
              <p>Las notificaciones de cambios de nota apareceran aqui.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>Titulo</th>
                    <th>Mensaje</th>
                    <th style={{ width: 120 }}>Fecha</th>
                    <th style={{ width: 80 }}>Estado</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.map((n) => (
                    <tr key={n.id} style={{ background: n.status === "READ" ? "transparent" : "var(--accent-light)" }}>
                      <td style={{ textAlign: "center" }}>
                        {n.status !== "READ" && (
                          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }}/>
                        )}
                      </td>
                      <td><strong>{n.title}</strong></td>
                      <td style={{ whiteSpace: "pre-wrap", fontSize: ".84rem" }}>{n.message}</td>
                      <td style={{ fontSize: ".78rem", color: "var(--muted)" }}>{timeAgo(n.createdAt)}</td>
                      <td>
                        <span className={`badge ${n.status === "READ" ? "badge--inactive" : "badge--active"}`}>
                          {n.status === "READ" ? "Leida" : "Nueva"}
                        </span>
                      </td>
                      <td>
                        {n.status !== "READ" && (
                          <button
                            className="btn btn--ghost"
                            onClick={() => markReadMutation.mutate(n.id)}
                            disabled={markReadMutation.isPending}
                            title="Marcar como leida"
                            style={{ padding: "4px 8px", fontSize: ".7rem" }}
                          >
                            OK
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
      )}
    </div>
  );
}
