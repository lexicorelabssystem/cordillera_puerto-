import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";

interface RemedialPlan {
  id: string;
  title: string;
  description: string;
  status: string;
  preScore: number | null;
  postScore: number | null;
  startDate: string;
  endDate: string;
  student: { firstName: string; lastName: string };
  learningObjective: { code: string; description: string; subject?: { name: string } };
}

export function RemedialRoutesPage() {
  const plansQuery = useQuery<RemedialPlan[]>({
    queryKey: ["remedial-plans"],
    queryFn: () => api.listRemedialPlans() as Promise<RemedialPlan[]>,
  });

  const plans = plansQuery.data || [];
  const activePlans = plans.filter((p) => p.status === "ACTIVE" || p.status === "IN_PROGRESS");
  const pendingPlans = plans.filter((p) => p.status === "PENDING");
  const completedPlans = plans.filter((p) => p.status === "COMPLETED" || p.status === "EFFECTIVE");

  return (
    <>
      <section className="panel">
        <h3>Rutas Remediales</h3>
        <p style={{ color: "var(--muted)", fontSize: ".84rem", marginBottom: 12 }}>
          Planes de refuerzo generados a partir de OA con rendimiento bajo lo esperado. Cada plan incluye actividades focalizadas y seguimiento.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <div className="kpi-card"><span>Planes activos</span><strong>{activePlans.length}</strong></div>
          <div className="kpi-card libro-card--warning"><span>Pendientes</span><strong>{pendingPlans.length}</strong></div>
          <div className="kpi-card"><span>Completados</span><strong>{completedPlans.length}</strong></div>
          <div className="kpi-card libro-card--danger"><span>Estudiantes</span><strong>{new Set(plans.map((p) => p.student?.firstName + p.student?.lastName)).size}</strong></div>
        </div>
      </section>

      <section className="panel">
        <h3>Planes remediales ({plans.length})</h3>
        {plansQuery.isLoading ? <LoadingSpinner label="Cargando planes..." /> : plans.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No hay planes remediales registrados. Usa la deteccion automatica desde el modulo de Reportes.</p>
        ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Estudiante</th><th>Asignatura</th><th>OA</th><th>Nota pre</th><th>Estado</th><th>Plan</th></tr></thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.student?.firstName} {p.student?.lastName}</strong></td>
                  <td>{p.learningObjective?.subject?.name || "-"}</td>
                  <td><span className="badge badge--role">{p.learningObjective?.code}</span> <small>{p.learningObjective?.description?.slice(0, 40)}...</small></td>
                  <td style={{ fontWeight: 600, color: (p.preScore ?? 0) < 4.0 ? "var(--danger)" : "var(--ink)" }}>{p.preScore?.toFixed(1).replace(".", ",") || "-"}</td>
                  <td><span className={`badge ${p.status === "ACTIVE" || p.status === "IN_PROGRESS" ? "badge--active" : p.status === "COMPLETED" || p.status === "EFFECTIVE" ? "badge--active" : "badge--warning"}`}>
                    {p.status === "PENDING" ? "Pendiente" : p.status === "IN_PROGRESS" ? "En progreso" : p.status === "COMPLETED" ? "Completado" : p.status === "EFFECTIVE" ? "Efectivo" : p.status}
                  </span></td>
                  <td style={{ fontSize: ".84rem" }}>{p.title}</td>
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

