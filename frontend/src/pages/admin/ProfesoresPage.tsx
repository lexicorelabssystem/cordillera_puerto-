import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { useToast } from "../../components/common/Toast";
import { useInstitution } from "../../app/InstitutionContext";

interface TeacherRow {
  id: string;
  userId: string;
  rut?: string | null;
  title?: string | null;
  user: { id: string; email: string; firstName: string; lastName: string; isActive: boolean; role: string };
  courseAssignments: { id: string; course: { id: string; name: string; gradeLevel: number }; subject: { id: string; name: string } }[];
  _count: { courseAssignments: number; assessments: number };
}

interface CourseRow {
  course_id: string;
  course_name: string;
  grade_level?: number;
}

interface SubjectRow {
  subject_id: string;
  subject_name: string;
  code?: string | null;
}

export function ProfesoresPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedInstitution } = useInstitution();
  const [search, setSearch] = useState("");
  const [profesorSeleccionado, setProfesorSeleccionado] = useState<TeacherRow | null>(null);
  const [nuevaAsignacion, setNuevaAsignacion] = useState({ courseId: "", subjectId: "" });
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ firstName: "", lastName: "", email: "", temporaryPassword: "", rut: "", title: "" });

  const teachersQuery = useQuery<TeacherRow[]>({
    queryKey: ["teachers", search],
    queryFn: () => api.listTeachers(search || undefined) as unknown as Promise<TeacherRow[]>,
  });

  const coursesQuery = useQuery<CourseRow[]>({
    queryKey: ["courses-teachers", selectedInstitution?.id],
    queryFn: () => api.listCourses({ institutionId: selectedInstitution?.id }) as unknown as Promise<CourseRow[]>,
    enabled: Boolean(selectedInstitution?.id),
  });

  const subjectsQuery = useQuery<SubjectRow[]>({
    queryKey: ["subjects-teachers"],
    queryFn: () => api.listSubjects(true) as unknown as Promise<SubjectRow[]>,
  });

  const createTeacher = useMutation({
    mutationFn: () => api.createTeacher({
      firstName: createForm.firstName,
      lastName: createForm.lastName,
      email: createForm.email,
      temporaryPassword: createForm.temporaryPassword,
      rut: createForm.rut || undefined,
      title: createForm.title || undefined,
      institutionId: selectedInstitution?.id,
    }),
    onSuccess: () => {
      toast("Profesor creado correctamente.", "success");
      setShowCreate(false);
      setCreateForm({ firstName: "", lastName: "", email: "", temporaryPassword: "", rut: "", title: "" });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Error al crear profesor.", "error"),
  });

  const assignTeacher = useMutation({
    mutationFn: (payload: { userId: string; courseId: string; subjectId: string }) => api.assignTeacher(payload),
    onSuccess: () => {
      toast("Asignacion creada.", "success");
      setNuevaAsignacion({ courseId: "", subjectId: "" });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Error al asignar.", "error"),
  });

  const removeAssignment = useMutation({
    mutationFn: (assignmentId: string) => api.removeAssignment(assignmentId),
    onSuccess: () => {
      toast("Asignacion removida.", "success");
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Error al quitar asignacion.", "error"),
  });

  const teachers: TeacherRow[] = teachersQuery.data || [];
  const courses: CourseRow[] = coursesQuery.data || [];
  const subjects: SubjectRow[] = subjectsQuery.data || [];

  const totalAsignaciones = teachers.reduce((s, t) => s + t.courseAssignments.length, 0);
  const totalEvaluaciones = teachers.reduce((s, t) => s + (t._count?.assessments || 0), 0);

  function handleAsignar() {
    if (!profesorSeleccionado || !nuevaAsignacion.courseId || !nuevaAsignacion.subjectId) {
      toast("Selecciona curso y asignatura.", "warning"); return;
    }
    assignTeacher.mutate({
      userId: profesorSeleccionado.userId,
      courseId: nuevaAsignacion.courseId,
      subjectId: nuevaAsignacion.subjectId,
    });
  }

  return (
    <div className="profesores-module">
      <header className="libro-header">
        <div className="libro-header__title">
          <h1>Gestion de Profesores</h1>
          <p>Administra los docentes del establecimiento, sus asignaciones a cursos y asignaturas.</p>
        </div>
      </header>

      <section className="correccion-stats-grid">
        <div className="libro-card"><span className="libro-card__label">Total profesores</span><strong className="libro-card__value">{teachers.length}</strong></div>
        <div className="libro-card"><span className="libro-card__label">Asignaciones activas</span><strong className="libro-card__value">{totalAsignaciones}</strong></div>
        <div className="libro-card"><span className="libro-card__label">Evaluaciones creadas</span><strong className="libro-card__value">{totalEvaluaciones}</strong></div>
        <div className="libro-card"><span className="libro-card__label">Promedio eval/prof</span><strong className="libro-card__value">{teachers.length > 0 ? (totalEvaluaciones / teachers.length).toFixed(1) : "—"}</strong></div>
      </section>

      <section className="panel">
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div className="form-field" style={{ maxWidth: 400, flex: 1 }}>
              <label>Buscar profesor</label>
              <input type="text" placeholder="Nombre, email o RUT..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <span style={{ fontSize: ".84rem", color: "var(--muted)", marginTop: 18 }}>{teachers.length} profesor(es)</span>
          </div>
          <button onClick={() => setShowCreate(!showCreate)} style={{ marginTop: 18 }}>{showCreate ? "Cancelar" : "+ Nuevo profesor"}</button>
        </div>

        {showCreate && (
          <div style={{ marginTop: 12 }}>
            <div className="form-grid">
              <div className="form-field"><label>Nombre *</label><input value={createForm.firstName} onChange={(e) => setCreateForm((s) => ({ ...s, firstName: e.target.value }))} placeholder="Nombre" /></div>
              <div className="form-field"><label>Apellido *</label><input value={createForm.lastName} onChange={(e) => setCreateForm((s) => ({ ...s, lastName: e.target.value }))} placeholder="Apellido" /></div>
              <div className="form-field"><label>Email *</label><input value={createForm.email} onChange={(e) => setCreateForm((s) => ({ ...s, email: e.target.value }))} placeholder="profesor@colegio.cl" /></div>
              <div className="form-field"><label>Clave temporal *</label><input type="password" value={createForm.temporaryPassword} onChange={(e) => setCreateForm((s) => ({ ...s, temporaryPassword: e.target.value }))} placeholder="Clave" /></div>
              <div className="form-field"><label>RUT</label><input value={createForm.rut} onChange={(e) => setCreateForm((s) => ({ ...s, rut: e.target.value }))} placeholder="Ej: 12345678-9" /></div>
              <div className="form-field"><label>Titulo</label><input value={createForm.title} onChange={(e) => setCreateForm((s) => ({ ...s, title: e.target.value }))} placeholder="Ej: Profesor de Matematica" /></div>
            </div>
            <div className="form-actions">
              <button onClick={() => createTeacher.mutate()} disabled={createTeacher.isPending || !createForm.firstName.trim() || !createForm.lastName.trim() || !createForm.email.trim() || !createForm.temporaryPassword}>
                {createTeacher.isPending ? "Creando..." : "Crear profesor"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <h3>Listado de Profesores</h3>
        {teachersQuery.isLoading ? <LoadingSpinner label="Cargando profesores..." /> : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Profesor</th><th>Email</th><th>Titulo</th><th>Cursos asignados</th><th>Eval.</th><th>Activo</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t.userId}>
                  <td><strong>{t.user.firstName} {t.user.lastName}</strong></td>
                  <td style={{ fontSize: ".82rem" }}>{t.user.email}</td>
                  <td style={{ fontSize: ".82rem" }}>{t.title || "—"}</td>
                  <td>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {t.courseAssignments.map((a) => (
                        <span key={a.id} className="badge badge--role">{a.course.name} · {a.subject.name}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ textAlign: "center", fontWeight: 600 }}>{t._count?.assessments || 0}</td>
                  <td><span className={`badge ${t.user.isActive ? "badge--active" : "badge--inactive"}`}>{t.user.isActive ? "Si" : "No"}</span></td>
                  <td>
                    <button className="btn-small" onClick={() => setProfesorSeleccionado(profesorSeleccionado?.userId === t.userId ? null : t)}>
                      {profesorSeleccionado?.userId === t.userId ? "Cerrar" : "Gestionar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </section>

      {profesorSeleccionado && (
        <section className="panel">
          <h3>Gestionar: {profesorSeleccionado.user.firstName} {profesorSeleccionado.user.lastName}</h3>
          <div style={{ display: "grid", gap: 12 }}>
            <div className="form-grid">
              <div className="form-field"><label>Profesor</label><span style={{ fontWeight: 700 }}>{profesorSeleccionado.user.firstName} {profesorSeleccionado.user.lastName}</span></div>
              <div className="form-field"><label>Email</label><span>{profesorSeleccionado.user.email}</span></div>
              <div className="form-field"><label>Rol</label><span>{profesorSeleccionado.user.role}</span></div>
            </div>

            <h4 style={{ marginTop: 8 }}>Asignaciones actuales ({profesorSeleccionado.courseAssignments.length})</h4>
            {profesorSeleccionado.courseAssignments.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: ".88rem" }}>Sin asignaciones.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Curso</th><th>Nivel</th><th>Asignatura</th><th>Accion</th></tr></thead>
                  <tbody>
                    {profesorSeleccionado.courseAssignments.map((a) => (
                      <tr key={a.id}>
                        <td><strong>{a.course.name}</strong></td>
                        <td>{a.course.gradeLevel}°</td>
                        <td>{a.subject.name}</td>
                        <td>
                          <button className="btn-small btn-danger" onClick={() => removeAssignment.mutate(a.id)} disabled={removeAssignment.isPending}>Quitar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h4 style={{ marginTop: 8 }}>Nueva asignacion</h4>
            <div className="form-row">
              <div className="form-field">
                <label>Curso</label>
                <select value={nuevaAsignacion.courseId} onChange={(e) => setNuevaAsignacion((s) => ({ ...s, courseId: e.target.value }))}>
                  <option value="">Seleccionar curso...</option>
                  {courses.map((c) => (
                    <option key={c.course_id} value={c.course_id}>{c.course_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Asignatura</label>
                <select value={nuevaAsignacion.subjectId} onChange={(e) => setNuevaAsignacion((s) => ({ ...s, subjectId: e.target.value }))}>
                  <option value="">Seleccionar asignatura...</option>
                  {subjects.map((s) => (
                    <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "end" }}>
                <button onClick={handleAsignar} disabled={assignTeacher.isPending}>Asignar profesor</button>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
