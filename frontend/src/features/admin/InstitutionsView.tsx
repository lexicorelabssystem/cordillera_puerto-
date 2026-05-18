import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Institution } from "../../types/api";
import { api } from "../../lib/api";

export function InstitutionsView() {
  const queryClient = useQueryClient();
  const [localMessage, setLocalMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    rbd: "",
    address: "",
    phone: "",
    email: "",
    logoUrl: "",
    sede: "",
    region: "",
    comuna: "",
    jornada: "",
  });

  const institutions = useQuery({
    queryKey: ["institutions"],
    queryFn: () => api.listInstitutions(true),
  });

  const createMutation = useMutation({
    mutationFn: api.createInstitution,
    onSuccess: () => {
      setLocalMessage("Institución creada correctamente.");
      setForm({ name: "", rbd: "", address: "", phone: "", email: "", logoUrl: "", sede: "", region: "", comuna: "", jornada: "" });
      queryClient.invalidateQueries({ queryKey: ["institutions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (err) =>
      setLocalMessage(err instanceof Error ? err.message : "Error al crear institución."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.updateInstitution(id, data),
    onSuccess: () => {
      setLocalMessage("Institución actualizada correctamente.");
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["institutions"] });
    },
    onError: (err) =>
      setLocalMessage(err instanceof Error ? err.message : "Error al actualizar institución."),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteInstitution,
    onSuccess: () => {
      setLocalMessage("Institución desactivada correctamente.");
      queryClient.invalidateQueries({ queryKey: ["institutions"] });
    },
    onError: (err) =>
      setLocalMessage(err instanceof Error ? err.message : "Error al desactivar institución."),
  });

  function startEdit(inst: Institution) {
    setEditingId(inst.id);
    setForm({
      name: inst.name,
      rbd: inst.rbd || "",
      address: inst.address || "",
      phone: inst.phone || "",
      email: inst.email || "",
      logoUrl: inst.logoUrl || "",
      sede: inst.sede || "",
      region: inst.region || "",
      comuna: inst.comuna || "",
      jornada: inst.jornada || "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ name: "", rbd: "", address: "", phone: "", email: "", logoUrl: "", sede: "", region: "", comuna: "", jornada: "" });
  }

  function handleSave() {
    if (!form.name.trim()) {
      setLocalMessage("El nombre de la institución es obligatorio.");
      return;
    }
    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        data: {
          name: form.name.trim(),
          rbd: form.rbd.trim() || undefined,
          address: form.address.trim() || undefined,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          logoUrl: form.logoUrl.trim() || undefined,
          sede: form.sede.trim() || undefined,
          region: form.region.trim() || undefined,
          comuna: form.comuna.trim() || undefined,
          jornada: form.jornada.trim() || undefined,
        },
      });
    } else {
      createMutation.mutate({
        name: form.name.trim(),
        rbd: form.rbd.trim() || undefined,
        address: form.address.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        logoUrl: form.logoUrl.trim() || undefined,
        sede: form.sede.trim() || undefined,
        region: form.region.trim() || undefined,
        comuna: form.comuna.trim() || undefined,
        jornada: form.jornada.trim() || undefined,
      });
    }
  }

  const list = institutions.data || [];
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <section className="panel">
        <h3>{editingId ? "Editar Institución" : "Crear Nueva Institución"}</h3>
        <div className="form-grid">
          <div className="form-field">
            <label>Nombre *</label>
            <input
              placeholder="Nombre del establecimiento"
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label>RBD</label>
            <input
              placeholder="Rol Base de Datos"
              value={form.rbd}
              onChange={(e) => setForm((s) => ({ ...s, rbd: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label>Dirección</label>
            <input
              placeholder="Dirección física"
              value={form.address}
              onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label>Teléfono</label>
            <input
              placeholder="Teléfono de contacto"
              value={form.phone}
              onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label>Correo institucional</label>
            <input
              placeholder="Correo electrónico"
              value={form.email}
              onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label>URL del logo</label>
            <input
              placeholder="https://..."
              value={form.logoUrl}
              onChange={(e) => setForm((s) => ({ ...s, logoUrl: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label>Sede</label>
            <input
              placeholder="Sede Central"
              value={form.sede}
              onChange={(e) => setForm((s) => ({ ...s, sede: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label>Región</label>
            <input
              placeholder="Metropolitana"
              value={form.region}
              onChange={(e) => setForm((s) => ({ ...s, region: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label>Comuna</label>
            <input
              placeholder="Santiago"
              value={form.comuna}
              onChange={(e) => setForm((s) => ({ ...s, comuna: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label>Jornada</label>
            <select
              value={form.jornada}
              onChange={(e) => setForm((s) => ({ ...s, jornada: e.target.value }))}
            >
              <option value="">Seleccionar...</option>
              <option value="MAÑANA">Mañana</option>
              <option value="TARDE">Tarde</option>
              <option value="COMPLETA">Completa</option>
              <option value="VESPERTINA">Vespertina</option>
            </select>
          </div>
        </div>
        <div className="form-actions">
          <button onClick={handleSave} disabled={isPending || !form.name.trim()}>
            {isPending ? "Guardando..." : editingId ? "Actualizar Institución" : "Crear Institución"}
          </button>
          {editingId ? (
            <button className="btn-secondary" onClick={cancelEdit}>
              Cancelar
            </button>
          ) : null}
        </div>
        {localMessage ? <p className="form-message">{localMessage}</p> : null}
      </section>

      <section className="panel">
        <h3>Instituciones Registradas</h3>
        {institutions.isLoading ? <p>Cargando instituciones...</p> : null}
        {institutions.isError ? <p className="error">Error al cargar instituciones.</p> : null}
        {list.length === 0 && !institutions.isLoading ? (
          <div className="empty-state">
            <strong>No hay instituciones registradas</strong>
            <p>Crea la primera institución usando el formulario superior.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>RBD</th>
                  <th>Sede / Región</th>
                  <th>Contacto</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {list.map((inst) => (
                  <tr key={inst.id}>
                    <td>
                      <strong>{inst.name}</strong>
                      {inst.jornada ? (
                        <div>
                          <span className="badge badge--active">{inst.jornada}</span>
                        </div>
                      ) : null}
                    </td>
                    <td>{inst.rbd || "-"}</td>
                    <td>
                      {inst.sede || "-"}
                      {inst.region ? <div><small>{inst.region}{inst.comuna ? `, ${inst.comuna}` : ""}</small></div> : null}
                    </td>
                    <td>
                      {inst.email ? <div>{inst.email}</div> : null}
                      {inst.phone ? <div>{inst.phone}</div> : null}
                      {!inst.email && !inst.phone ? "-" : null}
                    </td>
                    <td>
                      <span className={`badge ${inst.isActive ? "badge--active" : "badge--inactive"}`}>
                        {inst.isActive ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-small"
                          onClick={() => startEdit(inst)}
                        >
                          Editar
                        </button>
                        <button
                          className="btn-small btn-danger"
                          onClick={() => {
                            if (window.confirm(
                              inst.isActive
                                ? `¿Desactivar "${inst.name}"?`
                                : `¿Reactivar "${inst.name}"?`
                            )) {
                              deleteMutation.mutate(inst.id);
                            }
                          }}
                        >
                          {inst.isActive ? "Desactivar" : "Activar"}
                        </button>
                      </div>
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
