import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import type { UserRow, UserRole, PermissionCatalogItem } from "../../types/api";
import { api } from "../../lib/api";
import { Modal } from "../../components/common/Modal";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { useToast } from "../../components/common/Toast";
import { useInstitution } from "../../app/InstitutionContext";
import { StudentBulkImportPanel } from "./StudentBulkImportPanel";

const MANAGED_ROLES: { value: UserRole; label: string }[] = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "DIRECTION", label: "Dirección" },
  { value: "UTP", label: "UTP" },
  { value: "TEACHER", label: "Docente" },
  { value: "STUDENT", label: "Estudiante" },
];

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrador (sin uso)",
  DIRECTION: "Dirección",
  UTP: "UTP",
  TEACHER: "Docente",
  STUDENT: "Estudiante",
  PARENT: "Apoderado (sin uso)",
};

export function UsersView() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const isUtpMode = location.pathname.startsWith("/utp");
  const availableRoles = isUtpMode
    ? MANAGED_ROLES.filter((r) => !["SUPER_ADMIN", "DIRECTION"].includes(r.value))
    : MANAGED_ROLES;
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const { selectedInstitution } = useInstitution();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    temporaryPassword: "",
    role: "TEACHER" as UserRole,
    courseId: "",
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const users = useQuery({
    queryKey: ["users", { page, role: roleFilter, search, institutionId: selectedInstitution?.id }],
    queryFn: () =>
      api.listUsers({
        page,
        limit: 15,
        role: roleFilter || undefined,
        search: search || undefined,
        institutionId: selectedInstitution?.id,
      }),
  });

  const courses = useQuery({
    queryKey: ["courses", { institutionId: selectedInstitution?.id, activeOnly: true }],
    queryFn: () => api.listCourses({ institutionId: selectedInstitution?.id }),
    enabled: form.role === "STUDENT",
  });

  const createMutation = useMutation({
    mutationFn: api.createUser,
    onSuccess: () => {
      toast("Usuario creado correctamente (clave temporal asignada).", "success");
      setForm({ firstName: "", lastName: "", email: "", temporaryPassword: "", role: "TEACHER", courseId: "" });
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) =>
      toast(err instanceof Error ? err.message : "Error al crear usuario.", "error"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.updateUser(id, data),
    onSuccess: () => {
      toast("Usuario actualizado correctamente.", "success");
      setEditingId(null);
      setForm({ firstName: "", lastName: "", email: "", temporaryPassword: "", role: "TEACHER", courseId: "" });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) =>
      toast(err instanceof Error ? err.message : "Error al actualizar usuario.", "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteUser,
    onSuccess: () => {
      toast("Usuario desactivado correctamente.", "success");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) =>
      toast(err instanceof Error ? err.message : "Error al desactivar usuario.", "error"),
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: api.permanentDeleteUser,
    onSuccess: () => {
      toast("Usuario eliminado definitivamente.", "success");
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) =>
      toast(err instanceof Error ? err.message : "Error al eliminar usuario.", "error"),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: api.bulkDeleteUsers,
    onSuccess: (data) => {
      toast(`${data.succeeded} usuario(s) eliminado(s) definitivamente.${data.failed > 0 ? ` ${data.failed} error(es).` : ""}`, data.failed > 0 ? "warning" : "success");
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) =>
      toast(err instanceof Error ? err.message : "Error en eliminacion masiva.", "error"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.updateUser(id, { isActive }),
    onSuccess: () => {
      toast("Estado del usuario actualizado.", "success");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) =>
      toast(err instanceof Error ? err.message : "Error al cambiar estado.", "error"),
  });

  function startEdit(user: UserRow) {
    setEditingId(user.id);
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      temporaryPassword: "",
      role: user.role,
      courseId: user.courseId ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ firstName: "", lastName: "", email: "", temporaryPassword: "", role: "TEACHER", courseId: "" });
  }

  function handleSave() {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      toast("Nombre, apellido y correo son obligatorios.", "warning");
      return;
    }
    if (form.role === "ADMIN") {
      toast("El rol ADMIN esta deshabilitado. Usa SUPER_ADMIN o un rol institucional.", "warning");
      return;
    }
    if (!editingId && !form.temporaryPassword) {
      toast("La clave temporal es obligatoria para nuevos usuarios.", "warning");
      return;
    }
    if (form.role === "STUDENT" && !form.courseId) {
      toast("Selecciona el curso que cursara el estudiante.", "warning");
      return;
    }

    if (editingId) {
      const data: Record<string, unknown> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        role: form.role,
      };
      if (form.role === "STUDENT") data.courseId = form.courseId;
      if (form.temporaryPassword) data.temporaryPassword = form.temporaryPassword;
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        temporaryPassword: form.temporaryPassword,
        role: form.role,
        institutionId: selectedInstitution?.id,
        courseId: form.role === "STUDENT" ? form.courseId : undefined,
      });
    }
  }

  const apiList = users.data?.data || [];
  const courseList = courses.data || [];
  const meta = users.data?.meta;
  const isEditingStudent = editingId !== null && form.role === "STUDENT";
  const requiresCourse = form.role === "STUDENT";

  const isPending = createMutation.isPending || updateMutation.isPending || toggleMutation.isPending;

  const inactiveUsers = apiList.filter((u) => !u.isActive);
  const allInactiveSelected = inactiveUsers.length > 0 && inactiveUsers.every((u) => selectedIds.has(u.id));

  function toggleSelectAllInactive() {
    if (allInactiveSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(inactiveUsers.map((u) => u.id)));
    }
  }

  function toggleSelectUser(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (window.confirm(`\u00bfEliminar definitivamente ${selectedIds.size} usuario(s) inactivo(s)? Esta accion no se puede deshacer.`)) {
      bulkDeleteMutation.mutate(Array.from(selectedIds));
    }
  }

  return (
    <>
      {isUtpMode ? <StudentBulkImportPanel /> : null}

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
              onChange={(e) => setForm((s) => ({ ...s, role: e.target.value as UserRole, courseId: "" }))}
              disabled={isEditingStudent}
            >
              {isEditingStudent ? (
                <option value="STUDENT">Estudiante</option>
              ) : form.role === "ADMIN" ? (
                <option value="ADMIN" disabled>
                  Administrador (sin uso)
                </option>
              ) : (
                availableRoles.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))
              )}
            </select>
          </div>
          {requiresCourse ? (
            <div className="form-field">
              <label>Curso a cursar *</label>
              <select
                value={form.courseId}
                onChange={(e) => setForm((s) => ({ ...s, courseId: e.target.value }))}
                disabled={courses.isLoading}
              >
                <option value="">{courses.isLoading ? "Cargando cursos..." : "Selecciona un curso"}</option>
                {courseList.map((course) => (
                  <option key={course.course_id} value={course.course_id}>
                    {course.course_name}
                  </option>
                ))}
              </select>
              {editingId ? <span style={{ color: "var(--muted)", fontSize: ".78rem" }}>Cambia el curso para trasladar al estudiante.</span> : null}
              {courses.isError ? <span className="error">Error al cargar cursos.</span> : null}
            </div>
          ) : null}
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
              (!editingId && !form.temporaryPassword) ||
              (requiresCourse && !form.courseId)
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
            {availableRoles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        {users.isLoading ? <LoadingSpinner label="Cargando usuarios..." /> : null}
        {users.isError ? <p className="error">Error al cargar usuarios.</p> : null}
        {apiList.length === 0 && !users.isLoading ? (
          <div className="empty-state">
            <strong>No se encontraron usuarios</strong>
            <p>Ajusta los filtros o crea un nuevo usuario.</p>
          </div>
        ) : (
          <>
            {inactiveUsers.length > 0 ? (
              <div className="bulk-actions-bar">
                <label className="bulk-select-all" style={{ gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={allInactiveSelected}
                    onChange={toggleSelectAllInactive}
                  />
                  <span>Seleccionar todos los inactivos ({inactiveUsers.length})</span>
                </label>
                {selectedIds.size > 0 ? (
                  <button
                    className="btn-small btn-danger"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleteMutation.isPending}
                  >
                    {bulkDeleteMutation.isPending ? "Eliminando..." : `Eliminar definitivo (${selectedIds.size})`}
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th></th><th>Nombre</th><th>Email</th><th>Rol</th><th>Curso</th><th>Activo</th><th>Ultimo acceso</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {apiList.map((u) => (
                    <tr key={u.id}>
                      <td>
                        {!u.isActive ? (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(u.id)}
                            onChange={() => toggleSelectUser(u.id)}
                          />
                        ) : null}
                      </td>
                      <td><strong>{u.firstName} {u.lastName}</strong></td>
                      <td>{u.email}</td>
                      <td><span className={`badge badge--role-${u.role.toLowerCase()}`}>{u.role === "STUDENT" ? "Estudiante" : u.role === "TEACHER" ? "Docente" : ROLE_LABELS[u.role] || u.role}</span></td>
                      <td>{u.role === "STUDENT" ? (u.courseName || "Sin curso") : "-"}</td>
                      <td><span className={`badge ${u.isActive ? "badge--active" : "badge--inactive"}`}>{u.isActive ? "Si" : "No"}</span></td>
                      <td>
                        {u.lastLoginAt
                          ? new Date(u.lastLoginAt).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" })
                          : "Nunca"}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button className="btn-small" onClick={() => startEdit(u)}>Editar</button>
                          <PermissionButton userId={u.id} userName={`${u.firstName} ${u.lastName}`} />
                          <button
                            className="btn-small btn-danger"
                            onClick={() => {
                              if (window.confirm(u.isActive ? `\u00bfDesactivar a ${u.firstName} ${u.lastName}?` : `\u00bfReactivar a ${u.firstName} ${u.lastName}?`)) {
                                toggleMutation.mutate({ id: u.id, isActive: !u.isActive });
                              }
                            }}
                          >{u.isActive ? "Desactivar" : "Activar"}</button>
                          {!u.isActive ? (
                            <button
                              className="btn-small btn-danger"
                              style={{ background: "var(--danger-dark, #8b0000)" }}
                              onClick={() => {
                                if (window.confirm(`\u00bfEliminar definitivamente a ${u.firstName} ${u.lastName}? Esta accion no se puede deshacer.`)) {
                                  permanentDeleteMutation.mutate(u.id);
                                }
                              }}
                            >Eliminar Def.</button>
                          ) : null}
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
  const [toggledActions, setToggledActions] = useState<Set<string>>(new Set());
  const { toast } = useToast();

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
      toast("Permisos actualizados.", "success");
      userPermsQuery.refetch();
      setToggledActions(new Set());
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Error al asignar permisos.", "error"),
  });

  const revokeMutation = useMutation({
    mutationFn: (action: string) => api.revokePermission({ userId, permissionAction: action }),
    onSuccess: () => {
      userPermsQuery.refetch();
      setToggledActions(new Set());
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Error al revocar permiso.", "error"),
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
      toast("No hay cambios pendientes.", "info");
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
        onClose={() => { setModalOpen(false); setToggledActions(new Set()); }}
        title={`Permisos de ${userName}`}
        size="lg"
        footer={
          <>
            <button onClick={handleSavePermissions} disabled={isPending || toggledActions.size === 0}>
              {isPending ? "Guardando..." : "Guardar cambios"}
            </button>
            <button className="btn-secondary" onClick={() => { setModalOpen(false); }}>
              Cerrar
            </button>
          </>
        }
      >
        {catalogQuery.isLoading || userPermsQuery.isLoading ? (
          <LoadingSpinner label="Cargando permisos..." />
        ) : (
          <>
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
