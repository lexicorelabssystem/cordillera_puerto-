import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AcademicYear, PeriodRow } from "../../types/api";
import { api } from "../../lib/api";

export function AcademicYearsView() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [selectedYearId, setSelectedYearId] = useState<string>("");
  const [editingYearId, setEditingYearId] = useState<string | null>(null);
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);

  const [yearForm, setYearForm] = useState({
    year: new Date().getFullYear(),
    startDate: "",
    endDate: "",
  });

  const [periodForm, setPeriodForm] = useState({
    name: "",
    type: "SEMESTER",
    startDate: "",
    endDate: "",
    weight: 50,
  });

  const institutions = useQuery({
    queryKey: ["institutions-for-years"],
    queryFn: () => api.listInstitutions(),
  });
  const institutionId = institutions.data?.[0]?.id || "";

  const years = useQuery({
    queryKey: ["academic-years", institutionId],
    queryFn: () => api.listAcademicYears(institutionId),
    enabled: Boolean(institutionId),
  });

  useEffect(() => {
    const activeYear = years.data?.find((y) => y.isActive);
    if (activeYear && !selectedYearId) setSelectedYearId(activeYear.id);
  }, [years.data, selectedYearId]);

  const periods = useQuery({
    queryKey: ["periods", selectedYearId],
    queryFn: () => api.listPeriods(selectedYearId),
    enabled: Boolean(selectedYearId),
  });

  const createYear = useMutation({
    mutationFn: api.createAcademicYear,
    onSuccess: () => {
      setMessage("Año académico creado.");
      setYearForm({ year: new Date().getFullYear(), startDate: "", endDate: "" });
      setEditingYearId(null);
      queryClient.invalidateQueries({ queryKey: ["academic-years"] });
    },
    onError: (e) => setMessage(e instanceof Error ? e.message : "Error al crear año"),
  });

  const updateYear = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.updateAcademicYear(id, data),
    onSuccess: () => {
      setMessage("Año académico actualizado.");
      setEditingYearId(null);
      queryClient.invalidateQueries({ queryKey: ["academic-years"] });
    },
    onError: (e) => setMessage(e instanceof Error ? e.message : "Error al actualizar"),
  });

  const closeYear = useMutation({
    mutationFn: api.closeAcademicYear,
    onSuccess: () => {
      setMessage("Año académico cerrado.");
      queryClient.invalidateQueries({ queryKey: ["academic-years"] });
    },
    onError: (e) => setMessage(e instanceof Error ? e.message : "Error al cerrar"),
  });

  const reopenYear = useMutation({
    mutationFn: api.reopenAcademicYear,
    onSuccess: () => {
      setMessage("Año académico reabierto.");
      queryClient.invalidateQueries({ queryKey: ["academic-years"] });
    },
    onError: (e) => setMessage(e instanceof Error ? e.message : "Error al reabrir"),
  });

  const createPeriod = useMutation({
    mutationFn: api.createPeriod,
    onSuccess: () => {
      setMessage("Periodo creado.");
      setPeriodForm({ name: "", type: "SEMESTER", startDate: "", endDate: "", weight: 50 });
      setEditingPeriodId(null);
      queryClient.invalidateQueries({ queryKey: ["periods"] });
    },
    onError: (e) => setMessage(e instanceof Error ? e.message : "Error al crear periodo"),
  });

  const updatePeriod = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.updatePeriod(id, data),
    onSuccess: () => {
      setMessage("Periodo actualizado.");
      setEditingPeriodId(null);
      queryClient.invalidateQueries({ queryKey: ["periods"] });
    },
    onError: (e) => setMessage(e instanceof Error ? e.message : "Error al actualizar"),
  });

  const closePeriod = useMutation({
    mutationFn: api.closePeriod,
    onSuccess: () => {
      setMessage("Periodo cerrado.");
      queryClient.invalidateQueries({ queryKey: ["periods"] });
    },
    onError: (e) => setMessage(e instanceof Error ? e.message : "Error al cerrar"),
  });

  const reopenPeriod = useMutation({
    mutationFn: api.reopenPeriod,
    onSuccess: () => {
      setMessage("Periodo reabierto.");
      queryClient.invalidateQueries({ queryKey: ["periods"] });
    },
    onError: (e) => setMessage(e instanceof Error ? e.message : "Error al reabrir"),
  });

  function startEditYear(y: AcademicYear) {
    setEditingYearId(y.id);
    setYearForm({
      year: y.year,
      startDate: y.startDate.slice(0, 10),
      endDate: y.endDate.slice(0, 10),
    });
  }

  function startEditPeriod(p: PeriodRow) {
    setEditingPeriodId(p.id);
    setPeriodForm({
      name: p.name,
      type: p.type,
      startDate: p.startDate.slice(0, 10),
      endDate: p.endDate.slice(0, 10),
      weight: p.weight ?? 50,
    });
  }

  function handleSaveYear() {
    if (!institutionId) return;
    if (!yearForm.startDate || !yearForm.endDate) {
      setMessage("Fechas de inicio y fin son obligatorias.");
      return;
    }
    const payload = {
      institutionId,
      year: yearForm.year,
      startDate: yearForm.startDate,
      endDate: yearForm.endDate,
    };
    if (editingYearId) {
      updateYear.mutate({ id: editingYearId, data: payload });
    } else {
      createYear.mutate(payload);
    }
  }

  function handleSavePeriod() {
    if (!selectedYearId) return;
    if (!periodForm.name || !periodForm.startDate || !periodForm.endDate) {
      setMessage("Nombre y fechas son obligatorios.");
      return;
    }
    const payload = {
      academicYearId: selectedYearId,
      name: periodForm.name,
      type: periodForm.type,
      startDate: periodForm.startDate,
      endDate: periodForm.endDate,
      weight: periodForm.weight,
    };
    if (editingPeriodId) {
      updatePeriod.mutate({ id: editingPeriodId, data: payload });
    } else {
      createPeriod.mutate(payload);
    }
  }

  const yearList = years.data || [];
  const periodList = periods.data || [];

  return (
    <>
      <section className="panel">
        <h3>Años Académicos</h3>
        {yearList.length === 0 ? (
          <div className="empty-state">
            <strong>No hay años académicos</strong>
            <p>Crea el primer año académico para comenzar.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Año</th>
                  <th>Fechas</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {yearList.map((y) => (
                  <tr key={y.id}>
                    <td>
                      <strong>{y.year}</strong>
                    </td>
                    <td>
                      {y.startDate.slice(0, 10)} → {y.endDate.slice(0, 10)}
                    </td>
                    <td>
                      <span className={`badge ${y.isActive ? "badge--active" : "badge--inactive"}`}>
                        {y.isActive ? "Activo" : "Cerrado"}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn-small" onClick={() => { setSelectedYearId(y.id); startEditYear(y); }}>
                          Editar
                        </button>
                        {y.isActive ? (
                          <button
                            className="btn-small btn-danger"
                            onClick={() => {
                              if (window.confirm(`¿Cerrar año ${y.year}? Se validarán los periodos.`)) {
                                closeYear.mutate(y.id);
                              }
                            }}
                          >
                            Cerrar año
                          </button>
                        ) : (
                          <button
                            className="btn-small"
                            onClick={() => {
                              if (window.confirm(`¿Reabrir año ${y.year}?`)) {
                                reopenYear.mutate(y.id);
                              }
                            }}
                          >
                            Reabrir año
                          </button>
                        )}
                        <button
                          className="btn-small"
                          onClick={() => setSelectedYearId(y.id)}
                          style={{ background: selectedYearId === y.id ? "var(--accent)" : undefined, color: selectedYearId === y.id ? "white" : undefined }}
                        >
                          Ver periodos
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h4 style={{ marginTop: 16 }}>{editingYearId ? "Editar año académico" : "Crear nuevo año académico"}</h4>
        <div className="form-grid">
          <div className="form-field">
            <label>Año</label>
            <input
              type="number"
              value={yearForm.year}
              onChange={(e) => setYearForm((s) => ({ ...s, year: Number(e.target.value) }))}
            />
          </div>
          <div className="form-field">
            <label>Fecha inicio</label>
            <input
              type="date"
              value={yearForm.startDate}
              onChange={(e) => setYearForm((s) => ({ ...s, startDate: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label>Fecha fin</label>
            <input
              type="date"
              value={yearForm.endDate}
              onChange={(e) => setYearForm((s) => ({ ...s, endDate: e.target.value }))}
            />
          </div>
        </div>
        <div className="form-actions">
          <button onClick={handleSaveYear} disabled={!institutionId}>
            {editingYearId ? "Actualizar año" : "Crear año académico"}
          </button>
          {editingYearId ? (
            <button className="btn-secondary" onClick={() => { setEditingYearId(null); setYearForm({ year: new Date().getFullYear(), startDate: "", endDate: "" }); }}>
              Cancelar
            </button>
          ) : null}
        </div>
      </section>

      {selectedYearId ? (
        <section className="panel">
          <h3>Periodos del año seleccionado</h3>
          {periods.isLoading ? <p>Cargando periodos...</p> : null}
          {periodList.length === 0 && !periods.isLoading ? (
            <div className="empty-state">
              <strong>Sin periodos</strong>
              <p>Crea el primer periodo para este año académico.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Tipo</th>
                    <th>Fechas</th>
                    <th>Ponderación</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {periodList.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.name}</strong></td>
                      <td>{p.type}</td>
                      <td>{p.startDate.slice(0, 10)} → {p.endDate.slice(0, 10)}</td>
                      <td>{p.weight ? `${p.weight}%` : "-"}</td>
                      <td>
                        <span className={`badge ${p.status === "ACTIVE" ? "badge--active" : "badge--inactive"}`}>
                          {p.status}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button className="btn-small" onClick={() => startEditPeriod(p)}>Editar</button>
                          {p.status === "ACTIVE" ? (
                            <button className="btn-small btn-danger" onClick={() => {
                              if (window.confirm(`¿Cerrar periodo "${p.name}"?`)) closePeriod.mutate(p.id);
                            }}>
                              Cerrar
                            </button>
                          ) : (
                            <button className="btn-small" onClick={() => {
                              if (window.confirm(`¿Reabrir periodo "${p.name}"?`)) reopenPeriod.mutate(p.id);
                            }}>
                              Reabrir
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h4 style={{ marginTop: 16 }}>{editingPeriodId ? "Editar periodo" : "Crear nuevo periodo"}</h4>
          <div className="form-grid">
            <div className="form-field">
              <label>Nombre *</label>
              <input
                placeholder="Semestre 1, Trimestre 1..."
                value={periodForm.name}
                onChange={(e) => setPeriodForm((s) => ({ ...s, name: e.target.value }))}
              />
            </div>
            <div className="form-field">
              <label>Tipo</label>
              <select value={periodForm.type} onChange={(e) => setPeriodForm((s) => ({ ...s, type: e.target.value }))}>
                <option value="SEMESTER">Semestre</option>
                <option value="TRIMESTER">Trimestre</option>
                <option value="BIMESTER">Bimestre</option>
                <option value="CUSTOM">Personalizado</option>
              </select>
            </div>
            <div className="form-field">
              <label>Ponderación (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={periodForm.weight}
                onChange={(e) => setPeriodForm((s) => ({ ...s, weight: Number(e.target.value) }))}
              />
            </div>
            <div className="form-field">
              <label>Fecha inicio *</label>
              <input type="date" value={periodForm.startDate} onChange={(e) => setPeriodForm((s) => ({ ...s, startDate: e.target.value }))} />
            </div>
            <div className="form-field">
              <label>Fecha fin *</label>
              <input type="date" value={periodForm.endDate} onChange={(e) => setPeriodForm((s) => ({ ...s, endDate: e.target.value }))} />
            </div>
          </div>
          <div className="form-actions">
            <button onClick={handleSavePeriod} disabled={!selectedYearId}>
              {editingPeriodId ? "Actualizar periodo" : "Crear periodo"}
            </button>
            {editingPeriodId ? (
              <button className="btn-secondary" onClick={() => { setEditingPeriodId(null); setPeriodForm({ name: "", type: "SEMESTER", startDate: "", endDate: "", weight: 50 }); }}>
                Cancelar
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {message ? <p className="form-message">{message}</p> : null}
    </>
  );
}
