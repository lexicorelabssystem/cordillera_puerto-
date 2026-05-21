import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useInstitution } from "../../app/InstitutionContext";
import { useToast } from "../../components/common/Toast";

export function ReportsPage() {
  const queryClient = useQueryClient();
  const { selectedInstitution } = useInstitution();
  const { toast } = useToast();

  const reportsQuery = useQuery({
    queryKey: ["reports-list"],
    queryFn: () => api.listReports({ limit: 10 }) as Promise<unknown[]>,
  });

  const generateReport = useMutation({
    mutationFn: (payload: { type: string }) => api.generateReport({
      type: payload.type,
      institutionId: selectedInstitution?.id,
    }),
    onSuccess: () => {
      toast("Reporte generado correctamente.", "success");
      queryClient.invalidateQueries({ queryKey: ["reports-list"] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Error al generar reporte.", "error"),
  });

  const items = (reportsQuery.data || []) as unknown as { id: string; type: string; status: string; format: string; generatedAt: string | null; filters: Record<string, string> }[];

  const tiposReporte = [
    { icon: "📋", label: "Reporte por Curso", type: "reporte_curso", desc: "Consolidado de notas, promedios y riesgo por curso." },
    { icon: "👤", label: "Reporte por Estudiante", type: "reporte_estudiante", desc: "Historial completo individual." },
    { icon: "🎯", label: "Reporte por OA", type: "reporte_oa", desc: "Logro por cada Objetivo de Aprendizaje." },
    { icon: "⚠️", label: "Estudiantes en Riesgo", type: "reporte_riesgo", desc: "Listado de estudiantes bajo 4.0." },
  ];

  return (
    <>
      <section className="panel">
        <h3>Reportes Pedagógicos</h3>
        <p style={{ color: "var(--muted)", fontSize: ".84rem", marginBottom: 12 }}>
          Genera reportes para docentes, UTP y dirección. Formatos PDF, XLSX y CSV.
        </p>

        <div className="module-grid">
          {tiposReporte.map((r) => (
            <article key={r.type} className="module-card" style={{ cursor: "pointer" }}>
              <span style={{ fontSize: "1.5rem" }}>{r.icon}</span>
              <strong>{r.label}</strong>
              <small>{r.desc}</small>
              <button className="btn-small" style={{ marginTop: 4 }} onClick={() => generateReport.mutate({ type: r.type })} disabled={generateReport.isPending}>{generateReport.isPending ? "Generando..." : "Generar"}</button>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>Reportes generados ({items.length})</h3>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Tipo</th><th>Formato</th><th>Filtros</th><th>Estado</th><th>Fecha</th></tr></thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td><strong>{tiposReporte.find((t) => t.type === r.type)?.label || r.type}</strong></td>
                  <td><span className="badge badge--role">{r.format.toUpperCase()}</span></td>
                  <td style={{ fontSize: ".78rem" }}>{Object.values(r.filters).join(", ")}</td>
                  <td><span className={`badge ${r.status === "COMPLETED" ? "badge--active" : "badge--warning"}`}>{r.status}</span></td>
                  <td style={{ whiteSpace: "nowrap" }}>{r.generatedAt ? new Date(r.generatedAt).toLocaleDateString("es-CL") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
