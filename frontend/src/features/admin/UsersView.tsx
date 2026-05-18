import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserRow, UserRole, PermissionCatalogItem } from "../../types/api";
import { api } from "../../lib/api";
import { Modal } from "../../components/common/Modal";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";

const ROLES: { value: UserRole; label: string }[] = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "ADMIN", label: "Administrador" },
  { value: "DIRECTION", label: "Dirección" },
  { value: "UTP", label: "UTP" },
  { value: "TEACHER", label: "Docente" },
  { value: "STUDENT", label: "Estudiante" },
];

const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  ROLES.map((r) => [r.value, r.label])
);

export function UsersView() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [localMessage, setLocalMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    temporaryPassword: "",
    role: "TEACHER" as UserRole,
  });

  const users = useQuery({
    queryKey: ["users", { page, role: roleFilter, search }],
    queryFn: () =>
      api.listUsers({
        page,
        limit: 15,
        role: roleFilter || undefined,
        search: search || undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: api.createUser,
    onSuccess: () => {
      setLocalMessage("Usuario creado correctamente (clave temporal asignada).");
      setForm({ firstName: "", lastName: "", email: "", temporaryPassword: "", role: "TEACHER" });
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) =>
      setLocalMessage(err instanceof Error ? err.message : "Error al crear usuario."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.updateUser(id, data),
    onSuccess: () => {
      setLocalMessage("Usuario actualizado correctamente.");
      setEditingId(null);
      setForm({ firstName: "", lastName: "", email: "", temporaryPassword: "", role: "TEACHER" });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) =>
      setLocalMessage(err instanceof Error ? err.message : "Error al actualizar usuario."),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteUser,
    onSuccess: () => {
      setLocalMessage("Usuario desactivado correctamente.");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) =>
      setLocalMessage(err instanceof Error ? err.message : "Error al desactivar usuario."),
  });

  function startEdit(user: UserRow) {
    setEditingId(user.id);
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      temporaryPassword: "",
      role: user.role,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ firstName: "", lastName: "", email: "", temporaryPassword: "", role: "TEACHER" });
    setLocalMessage("");
  }

  function handleSave() {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      setLocalMessage("Nombre, apellido y correo son obligatorios.");
      return;
    }
    if (!editingId && !form.temporaryPassword) {
      setLocalMessage("La clave temporal es obligatoria para nuevos usuarios.");
      return;
    }

    if (editingId) {
      const data: Record<string, unknown> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        role: form.role,
      };
      if (form.temporaryPassword) data.temporaryPassword = form.temporaryPassword;
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        temporaryPassword: form.temporaryPassword,
        role: form.role,
      });
    }
  }

  const list = users.data?.data || [];
  const meta = users.data?.meta;
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <section className="panel">
        <h3>{editingId ? "Editar Usuario" : "Crear Nuevo Usuario"}</h3>
        <div className="form-grid">
          <div className="form-field">
            <label>Nombre *</label>
            <input
              placeholder="Nombre"
              value={form.firstName}
              onChange={(e) => setForm((s) => ({ ...s, firstName: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label>Apellido *</label>
            <input
              placeholder="Apellido"
              value={form.lastName}
              onChange={(e) => setForm((s) => ({ ...s, lastName: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label>Correo electrónico *</label>
            <input
              placeholder="usuario@colegio.cl"
              value={form.email}
              onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label>Rol *</label>
            <select
              value={form.role}
              onChange={(e) => setForm((s) => ({ ...s, role: e.target.value as UserRole }))}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>{editingId ? "Nueva clave (opcional)" : "Clave temporal *"}</label>
            <input
              type="password"
              placeholder={editingId ? "Dejar vacío para no cambiar" : "Clave temporal"}
              value={form.temporaryPassword}
              onChange={(e) => setForm((s) => ({ ...s, temporaryPassword: e.target.value }))}
            />
          </div>
        </div>
        <div className="form-actions">
          <button
            onClick={handleSave}
            disabled={
              isPending ||
              !form.firstName.trim() ||
              !form.lastName.trim() ||
              !form.email.trim() ||
              (!editingId && !form.temporaryPassword)
            }
          >
            {isPending ? "Guardando..." : editingId ? "Actualizar Usuario" : "Crear Usuario"}
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
        <h3>Usuarios del Sistema</h3>
        <div className="form-row">
          <input
            placeholder="Buscar por nombre o correo..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos los roles</option>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        {users.isLoading ? <p>Cargando usuarios...</p> : null}
        {users.isError ? <p className="error">Error al cargar usuarios.</p> : null}
        {list.length === 0 && !users.isLoading ? (
          <div className="empty-state">
            <strong>No se encontraron usuarios</strong>
            <p>Ajusta los filtros o crea un nuevo usuario.</p>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Correo</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Último acceso</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <strong>
                          {u.firstName} {u.lastName}
                        </strong>
                      </td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`badge badge--role badge--role-${u.role.toLowerCase()}`}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${u.isActive ? "badge--active" : "badge--inactive"}`}>
                          {u.isActive ? "Activo" : "Inactivo"}
                        </span>
                        {u.mustChangePassword ? (
                          <span className="badge badge--warning">Debe cambiar clave</span>
                        ) : null}
                      </td>
                      <td>
                        {u.lastLoginAt
                          ? new Date(u.lastLoginAt).toLocaleDateString("es-CL", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })
                          : "Nunca"}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button className="btn-small" onClick={() => startEdit(u)}>
                            Editar
                          </button>
                          <PermissionButton userId={u.id} userName={`${u.firstName} ${u.lastName}`} />
                          <button
                            className="btn-small btn-danger"
                            onClick={() => {
                              if (window.confirm(
                                u.isActive
                                  ? `¿Desactivar a ${u.firstName} ${u.lastName}?`
                                  : `¿Reactivar a ${u.firstName} ${u.lastName}?`
                              )) {
                                deleteMutation.mutate(u.id);
                              }
                            }}
                          >
                            {u.isActive ? "Desactivar" : "Activar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {meta ? (
              <div className="pagination">
                <span>
                  Página {meta.page} de {meta.totalPages} ({meta.total} usuarios)
                </span>
                <div className="pagination-buttons">
                  <button
                    disabled={!meta.hasPrevious}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </button>
                  <button
                    disabled={!meta.hasNext}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </>
  );
}

function PermissionButton({ userId, userName }: { userId: string; userName: string }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [localMessage, setLocalMessage] = useState("");
  const [toggledActions, setToggledActions] = useState<Set<string>>(new Set());

  const catalogQuery = useQuery<PermissionCatalogItem[]>({
    queryKey: ["permissions-catalog"],
    queryFn: api.getPermissionsCatalog,
    enabled: modalOpen,
  });

  const userPermsQuery = useQuery<{ permissions: string[] }>({
    queryKey: ["user-permissions", userId],
    queryFn: () => api.getUserPermissions(userId),
    enabled: modalOpen,
  });

  const assignedSet = new Set(userPermsQuery.data?.permissions || []);
  const catalog = catalogQuery.data || [];

  const grouped = new Map<string, { action: string; description: string }[]>();
  for (const item of catalog) {
    const group = grouped.get(item.module) || [];
    group.push({ action: item.action, description: item.description });
    grouped.set(item.module, group);
  }

  const assignMutation = useMutation({
    mutationFn: (actions: string[]) => api.assignPermissions({ userId, permissionActions: actions }),
    onSuccess: () => {
      setLocalMessage("Permisos actualizados.");
      userPermsQuery.refetch();
      setToggledActions(new Set());
    },
    onError: (err) => setLocalMessage(err instanceof Error ? err.message : "Error al asignar permisos."),
  });

  const revokeMutation = useMutation({
    mutationFn: (action: string) => api.revokePermission({ userId, permissionAction: action }),
    onSuccess: () => {
      userPermsQuery.refetch();
      setToggledActions(new Set());
    },
    onError: (err) => setLocalMessage(err instanceof Error ? err.message : "Error al revocar permiso."),
  });

  const handleToggle = (action: string) => {
    setToggledActions((prev) => {
      const next = new Set(prev);
      if (next.has(action)) {
        next.delete(action);
      } else {
        next.add(action);
      }
      return next;
    });
  };

  const handleSavePermissions = () => {
    const toAssign: string[] = [];
    const toRevoke: string[] = [];

    for (const action of toggledActions) {
      if (assignedSet.has(action)) {
        toRevoke.push(action);
      } else {
        toAssign.push(action);
      }
    }

    if (toAssign.length > 0) {
      assignMutation.mutate(toAssign);
    }
    for (const action of toRevoke) {
      revokeMutation.mutate(action);
    }

    if (toAssign.length === 0 && toRevoke.length === 0) {
      setLocalMessage("No hay cambios pendientes.");
    }
  };

  const isPending = assignMutation.isPending || revokeMutation.isPending;

  return (
    <>
      <button className="btn-small btn-secondary" onClick={() => setModalOpen(true)}>
        Permisos
      </button>
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setLocalMessage(""); setToggledActions(new Set()); }}
        title={`Permisos de ${userName}`}
        size="lg"
        footer={
          <>
            <button onClick={handleSavePermissions} disabled={isPending || toggledActions.size === 0}>
              {isPending ? "Guardando..." : "Guardar cambios"}
            </button>
            <button className="btn-secondary" onClick={() => { setModalOpen(false); setLocalMessage(""); }}>
              Cerrar
            </button>
          </>
        }
      >
        {catalogQuery.isLoading || userPermsQuery.isLoading ? (
          <LoadingSpinner label="Cargando permisos..." />
        ) : (
          <>
            {localMessage ? <p className="form-message">{localMessage}</p> : null}
            <p style={{ color: "var(--muted)", marginBottom: 12 }}>
              {assignedSet.size} de {catalog.length} permisos asignados.
              Marca/desmarca para modificar. Verdes = asignados, rojos = serán revocados, azules = serán asignados.
            </p>
            <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
              {Array.from(grouped.entries()).map(([module, items]) => (
                <div key={module} style={{ marginBottom: 16 }}>
                  <h4 style={{ margin: "0 0 8px", fontSize: "0.9rem", color: "var(--accent)", textTransform: "uppercase" }}>
                    {module}
                  </h4>
                  <div style={{ display: "grid", gap: 4 }}>
                    {items.map((item) => {
                      const isAssigned = assignedSet.has(item.action);
                      const isToggled = toggledActions.has(item.action);
                      const effectiveState = isToggled ? !isAssigned : isAssigned;

                      return (
                        <label
                          key={item.action}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "6px 8px",
                            borderRadius: 6,
                            cursor: "pointer",
                            background: isToggled
                              ? (isAssigned ? "#ffe5e5" : "#e3f2fd")
                              : (isAssigned ? "#eafaf1" : "transparent"),
                            border: `1px solid ${
                              isToggled
                                ? (isAssigned ? "#e5b5b5" : "#b5d5e5")
                                : (isAssigned ? "#a3d9b1" : "transparent")
                            }`,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={effectiveState}
                            onChange={() => handleToggle(item.action)}
                          />
                          <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>{item.description}</span>
                          <span style={{ fontSize: "0.72rem", color: "var(--muted)", marginLeft: "auto" }}>
                            {item.action}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
