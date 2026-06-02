import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { LoadingSpinner } from "../../../components/common/LoadingSpinner";
import { EmptyState } from "../../../components/common/EmptyState";
import { Modal } from "../../../components/common/Modal";
import { useInstitution } from "../../../app/InstitutionContext";
import { SimceCreateModal } from "./SimceCreateModal";
import type { SimceAssessment, SimceKpiStats } from "./simce.types";
import type { AcademicYear } from "../../../types/api";

interface Props {
  onSelect: (id: string) => void;
  selectedId: string | null;
}

const statusLabels: Record<string, string> = {
  DRAFT: "Borrador",
  KEY_PENDING: "Pauta pendiente",
  READY_TO_CORRECT: "Lista para corregir",
  CORRECTED: "Corregida",
};

const statusColors: Record<string, string> = {
  DRAFT: "var(--muted)",
  KEY_PENDING: "var(--warning)",
  READY_TO_CORRECT: "var(--info)",
  CORRECTED: "var(--success)",
};

export function SimceAssessmentList({ onSelect, selectedId }: Props) {
  const queryClient = useQueryClient();
  const { selectedInstitution } = useInstitution();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const query = useQuery({
    queryKey: ["simce-assessments", academicYearId],
    queryFn: () => api.listSimceAssessments(academicYearId ? { academicYearId } : {}) as Promise<{ data: SimceAssessment[] }>,
  });

  const academicYearsQuery = useQuery({
    queryKey: ["simce-filter-academic-years", selectedInstitution?.id],
    queryFn: () => selectedInstitution?.id ? api.listAcademicYears(selectedInstitution.id) as Promise<AcademicYear[]> : Promise.resolve([]),
    enabled: Boolean(selectedInstitution?.id),
  });

  const items = query.data?.data || [];
  const filtered = useMemo(() => {
    const term = search.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return items.filter((item) => {
      if (statusFilter && item.status !== statusFilter) return false;
      if (!term) return true;
      return [item.title, item.course?.name, item.subject?.name]
        .some((v) => (v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(term));
    });
  }, [items, search, statusFilter]);

  const stats: SimceKpiStats = useMemo(() => ({
    total: items.length,
    draft: items.filter((i) => i.status === "DRAFT").length,
    keyPending: items.filter((i) => i.status === "KEY_PENDING").length,
    ready: items.filter((i) => i.status === "READY_TO_CORRECT").length,
    corrected: items.filter((i) => i.status === "CORRECTED").length,
  }), [items]);

  return (
    <>
      <div className="simce-list">
        <div className="panel-heading">
          <div>
            <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Pruebas SIMCE</h2>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: ".84rem" }}>
              {items.length} pruebas registradas
            </p>
          </div>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            + Nueva prueba
          </button>
        </div>

        <div className="kpi-grid simce-kpi-row">
          <div className="kpi-card"><span>Total</span><strong>{stats.total}</strong></div>
          <div className="kpi-card" style={{ borderLeftColor: "var(--muted)" }}><span>Borrador</span><strong>{stats.draft}</strong></div>
          <div className="kpi-card" style={{ borderLeftColor: "var(--warning)" }}><span>Pauta pend.</span><strong>{stats.keyPending}</strong></div>
          <div className="kpi-card" style={{ borderLeftColor: "var(--info)" }}><span>Listas</span><strong>{stats.ready}</strong></div>
          <div className="kpi-card" style={{ borderLeftColor: "var(--success)" }}><span>Corregidas</span><strong>{stats.corrected}</strong></div>
        </div>

        <div className="simce-filters">
          <input
            type="search"
            placeholder="Buscar por título, curso o asignatura..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
          <select value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)}>
            <option value="">Todos los años</option>
            {(academicYearsQuery.data || []).map((ay: AcademicYear) => (
              <option key={ay.id} value={ay.id}>{ay.year}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="DRAFT">Borrador</option>
            <option value="KEY_PENDING">Pauta pendiente</option>
            <option value="READY_TO_CORRECT">Lista para corregir</option>
            <option value="CORRECTED">Corregida</option>
          </select>
        </div>

        {query.isLoading ? (
          <LoadingSpinner label="Cargando pruebas SIMCE..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Sin pruebas SIMCE"
            description="Crea tu primera prueba SIMCE para comenzar a trabajar con pautas, respuestas y corrección automática."
          />
        ) : (
          <div className="simce-table-wrap">
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Prueba</th>
                  <th>Curso</th>
                  <th>Asignatura</th>
                  <th>Preguntas</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    className={item.id === selectedId ? "simce-row--selected" : ""}
                    style={item.id === selectedId ? { background: "var(--surface-highlight, #eef2ff)" } : {}}
                  >
                    <td><strong>{item.title}</strong></td>
                    <td>{item.course?.name ?? "-"} {item.course?.gradeLevel ? `${item.course.gradeLevel}°` : ""}</td>
                    <td>{item.subject?.name ?? "-"}</td>
                    <td style={{ textAlign: "center" }}>{item._count?.answerKeys ?? 0}</td>
                    <td>
                      <span style={{
                        display: "inline-block",
                        padding: "2px 10px",
                        borderRadius: 12,
                        fontSize: ".78rem",
                        fontWeight: 600,
                        background: `${statusColors[item.status] || "var(--muted)"}20`,
                        color: statusColors[item.status] || "var(--muted)",
                      }}>
                        {statusLabels[item.status] || item.status}
                      </span>
                    </td>
                    <td>
                      <button className="btn-small" onClick={() => onSelect(item.id)}>
                        Abrir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Nueva prueba SIMCE" size="md">
        <SimceCreateModal
          onCreated={(id) => { setShowCreate(false); queryClient.invalidateQueries({ queryKey: ["simce-assessments"] }); onSelect(id); }}
          onCancel={() => setShowCreate(false)}
        />
      </Modal>
    </>
  );
}
