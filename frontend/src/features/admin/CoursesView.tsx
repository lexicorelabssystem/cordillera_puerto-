import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminCourseRow, AdminSubject, CourseStudentRow, AdminTeacher } from "../../types/api";
import { api } from "../../lib/api";
import { Modal } from "../../components/common/Modal";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";

const GRADE_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8];

export function CoursesView() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [courseForm, setCourseForm] = useState({ name: "", gradeLevel: 1, section: "", maxStudents: 45 });
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);

  const [subjectForm, setSubjectForm] = useState({ name: "", code: "" });
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);

  const institutions = useQuery({
    queryKey: ["institutions-for-courses"],
    queryFn: () => api.listInstitutions(),
  });
  const institutionId = institutions.data?.[0]?.id || "";

  const years = useQuery({
    queryKey: ["active-year-for-courses", institutionId],
    queryFn: () => api.listAcademicYears(institutionId),
    enabled: Boolean(institutionId),
  });
  const academicYearId = years.data?.find((y) => y.isActive)?.id || "";

  const coursesQuery = useQuery({
    queryKey: ["courses", { institutionId, academicYearId }],
    queryFn: () => api.listCourses({ institutionId: institutionId || undefined, academicYearId: academicYearId || undefined }),
    enabled: Boolean(institutionId) && Boolean(academicYearId),
  });

  const subjectsQuery = useQuery({
    queryKey: ["subjects", showInactive],
    queryFn: () => api.listSubjects(showInactive),
  });

  // ─── Course CRUD mutations ───
  const createCourse = useMutation({
    mutationFn: api.createCourse,
    onSuccess: () => {
      setMessage("Curso creado.");
      setCourseForm({ name: "", gradeLevel: 1, section: "", maxStudents: 45 });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e) => setMessage(e instanceof Error ? e.message : "Error al crear curso"),
  });

  const updateCourse = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.updateCourse(id, data),
    onSuccess: () => {
      setMessage("Curso actualizado.");
      setEditingCourseId(null);
      queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
    onError: (e) => setMessage(e instanceof Error ? e.message : "Error al actualizar curso"),
  });

  const deleteCourse = useMutation({
    mutationFn: api.deleteCourse,
    onSuccess: () => { setMessage("Curso desactivado."); queryClient.invalidateQueries({ queryKey: ["courses"] }); },
    onError: (e) => setMessage(e instanceof Error ? e.message : "Error al desactivar curso"),
  });

  const createSubject = useMutation({
    mutationFn: api.createSubject,
    onSuccess: () => {
      setMessage("Asignatura creada.");
      setSubjectForm({ name: "", code: "" });
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
    },
    onError: (e) => setMessage(e instanceof Error ? e.message : "Error al crear asignatura"),
  });

  const updateSubject = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.updateSubject(id, data),
    onSuccess: () => {
      setMessage("Asignatura actualizada.");
      setEditingSubjectId(null);
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
    },
    onError: (e) => setMessage(e instanceof Error ? e.message : "Error al actualizar asignatura"),
  });

  const deleteSubject = useMutation({
    mutationFn: api.deleteSubject,
    onSuccess: () => { setMessage("Asignatura desactivada."); queryClient.invalidateQueries({ queryKey: ["subjects"] }); },
    onError: (e) => setMessage(e instanceof Error ? e.message : "Error al desactivar asignatura"),
  });

  function handleCreateCourse() {
    if (!institutionId || !academicYearId) { setMessage("Se requiere institución y año académico activo."); return; }
    if (!courseForm.name) { setMessage("El nombre del curso es obligatorio."); return; }
    createCourse.mutate({ institutionId, academicYearId, name: courseForm.name, gradeLevel: Number(courseForm.gradeLevel), section: courseForm.section || undefined, maxStudents: Number(courseForm.maxStudents) });
  }

  function handleUpdateCourse(courseId: string) {
    if (!courseForm.name) { setMessage("El nombre del curso es obligatorio."); return; }
    updateCourse.mutate({ id: courseId, data: { name: courseForm.name, gradeLevel: Number(courseForm.gradeLevel), section: courseForm.section || undefined, maxStudents: Number(courseForm.maxStudents) } });
  }

  function startEditCourse(c: AdminCourseRow) {
    setEditingCourseId(c.course_id);
    setCourseForm({ name: c.course_name, gradeLevel: c.grade_level, section: c.section || "", maxStudents: 45 });
  }

  function handleCreateSubject() {
    if (!subjectForm.name) { setMessage("El nombre de la asignatura es obligatorio."); return; }
    createSubject.mutate({ name: subjectForm.name, code: subjectForm.code || undefined });
  }

  function handleUpdateSubject(subjectId: string) {
    if (!subjectForm.name) { setMessage("El nombre de la asignatura es obligatorio."); return; }
    updateSubject.mutate({ id: subjectId, data: { name: subjectForm.name, code: subjectForm.code || undefined } });
  }

  function startEditSubject(s: AdminSubject) {
    setEditingSubjectId(s.id);
    setSubjectForm({ name: s.name, code: s.code || "" });
  }

  const courseList = coursesQuery.data || [];
  const subjectList = subjectsQuery.data || [];

  return (
    <>
      {message ? <p className="form-message">{message}</p> : null}

      {/* ═══════ CURSOS ═══════ */}
      <section className="panel">
        <h3>Cursos ({courseList.length})</h3>
        {coursesQuery.isLoading ? <LoadingSpinner label="Cargando cursos..." size="sm" /> : null}
        {courseList.length === 0 && !coursesQuery.isLoading ? (
          <div className="empty-state"><strong>No hay cursos creados</strong><p>Crea tu primer curso abajo.</p></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Curso</th><th>Nivel</th><th>Sección</th><th>Alumnos</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {courseList.map((c) => (
                  <tr key={c.course_id}>
                    <td><strong>{c.course_name}</strong></td>
                    <td>{c.grade_level}°</td>
                    <td>{c.section || "A"}</td>
                    <td>{c.students_count}</td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn-small" onClick={() => startEditCourse(c)}>Editar</button>
                        <CourseDetailButton courseId={c.course_id} courseName={c.course_name} />
                        <button className="btn-small btn-danger" onClick={() => {
                          if (window.confirm(`¿Desactivar ${c.course_name}?`)) deleteCourse.mutate(c.course_id);
                        }}>Desactivar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h4 style={{ marginTop: 16 }}>{editingCourseId ? "Editar curso" : "Crear nuevo curso"}</h4>
        <div className="form-grid">
          <div className="form-field">
            <label>Nombre *</label>
            <input placeholder="1° A..." value={courseForm.name} onChange={(e) => setCourseForm((s) => ({ ...s, name: e.target.value }))} />
          </div>
          <div className="form-field">
            <label>Nivel</label>
            <select value={courseForm.gradeLevel} onChange={(e) => setCourseForm((s) => ({ ...s, gradeLevel: Number(e.target.value) }))}>
              {GRADE_LEVELS.map((l) => <option key={l} value={l}>{l}° básico</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Sección</label>
            <input placeholder="A, B, C..." value={courseForm.section} onChange={(e) => setCourseForm((s) => ({ ...s, section: e.target.value }))} />
          </div>
          <div className="form-field">
            <label>Cupo máximo</label>
            <input type="number" min={1} max={60} value={courseForm.maxStudents} onChange={(e) => setCourseForm((s) => ({ ...s, maxStudents: Number(e.target.value) }))} />
          </div>
        </div>
        <div className="form-actions">
          {editingCourseId ? (
            <>
              <button onClick={() => handleUpdateCourse(editingCourseId)} disabled={updateCourse.isPending}>
                {updateCourse.isPending ? "Guardando..." : "Guardar cambios"}
              </button>
              <button className="btn-secondary" onClick={() => { setEditingCourseId(null); setCourseForm({ name: "", gradeLevel: 1, section: "", maxStudents: 45 }); }}>Cancelar</button>
            </>
          ) : (
            <button onClick={handleCreateCourse} disabled={createCourse.isPending}>
              {createCourse.isPending ? "Creando..." : "Crear curso"}
            </button>
          )}
        </div>
      </section>

      {/* ═══════ ASIGNATURAS ═══════ */}
      <section className="panel">
        <h3>Asignaturas ({subjectList.length})</h3>
        <div className="form-actions" style={{ marginBottom: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} style={{ width: "auto" }} />
            Mostrar inactivas
          </label>
        </div>
        {subjectsQuery.isLoading ? <LoadingSpinner size="sm" /> : null}
        {subjectList.length === 0 && !subjectsQuery.isLoading ? (
          <div className="empty-state"><strong>No hay asignaturas</strong><p>Crea asignaturas para organizar el currículum.</p></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Nombre</th><th>Código</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                {subjectList.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong></td>
                    <td>{s.code || "-"}</td>
                    <td><span className={`badge ${(s as { isActive?: boolean }).isActive !== false ? "badge--active" : "badge--inactive"}`}>{(s as { isActive?: boolean }).isActive !== false ? "Activo" : "Inactivo"}</span></td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn-small" onClick={() => startEditSubject(s)}>Editar</button>
                        <button className="btn-small btn-danger" onClick={() => {
                          if (window.confirm(`¿Desactivar ${s.name}?`)) deleteSubject.mutate(s.id);
                        }}>Desactivar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h4 style={{ marginTop: 16 }}>{editingSubjectId ? "Editar asignatura" : "Crear nueva asignatura"}</h4>
        <div className="form-grid">
          <div className="form-field">
            <label>Nombre *</label>
            <input placeholder="Lenguaje, Matemática..." value={subjectForm.name} onChange={(e) => setSubjectForm((s) => ({ ...s, name: e.target.value }))} />
          </div>
          <div className="form-field">
            <label>Código</label>
            <input placeholder="LEN, MAT..." value={subjectForm.code} onChange={(e) => setSubjectForm((s) => ({ ...s, code: e.target.value }))} />
          </div>
        </div>
        <div className="form-actions">
          {editingSubjectId ? (
            <>
              <button onClick={() => handleUpdateSubject(editingSubjectId)} disabled={updateSubject.isPending}>
                {updateSubject.isPending ? "Guardando..." : "Guardar cambios"}
              </button>
              <button className="btn-secondary" onClick={() => { setEditingSubjectId(null); setSubjectForm({ name: "", code: "" }); }}>Cancelar</button>
            </>
          ) : (
            <button onClick={handleCreateSubject} disabled={createSubject.isPending}>
              {createSubject.isPending ? "Creando..." : "Crear asignatura"}
            </button>
          )}
        </div>
      </section>
    </>
  );
}

function CourseDetailButton({ courseId, courseName }: { courseId: string; courseName: string }) {
  const [open, setOpen] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["course-detail", courseId],
    queryFn: () => api.getCourse(courseId),
    enabled: open,
  });

  const teachersQuery = useQuery<AdminTeacher[]>({
    queryKey: ["teachers-list"],
    queryFn: () => api.listTeachers() as unknown as Promise<AdminTeacher[]>,
    enabled: open,
  });

  const subjectsQuery = useQuery<AdminSubject[]>({
    queryKey: ["subjects-list"],
    queryFn: () => api.listSubjects(),
    enabled: open,
  });

  const [assignMsg, setAssignMsg] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");

  const assignMutation = useMutation({
    mutationFn: api.assignTeacher,
    onSuccess: () => { setAssignMsg("Profesor asignado."); detailQuery.refetch(); },
    onError: (e) => setAssignMsg(e instanceof Error ? e.message : "Error al asignar profesor"),
  });

  const removeAssignMutation = useMutation({
    mutationFn: api.removeAssignment,
    onSuccess: () => { setAssignMsg("Asignación removida."); detailQuery.refetch(); },
    onError: (e) => setAssignMsg(e instanceof Error ? e.message : "Error al remover asignación"),
  });

  const data = detailQuery.data;
  const teachers: { assignment_id: string; teacher_name: string; course_name: string; subject_name: string }[] = 
    ((data as unknown as { teachers?: { assignment_id: string; teacher_name: string; course_name: string; subject_name: string }[] })?.teachers || []);
  const students: CourseStudentRow[] = ((data as unknown as { students?: CourseStudentRow[] })?.students || []);

  return (
    <>
      <button className="btn-small btn-secondary" onClick={() => setOpen(true)}>Detalle</button>
      <Modal
        isOpen={open}
        onClose={() => { setOpen(false); setAssignMsg(""); }}
        title={`Detalle: ${courseName}`}
        size="lg"
        footer={<button className="btn-secondary" onClick={() => setOpen(false)}>Cerrar</button>}
      >
        {detailQuery.isLoading ? <LoadingSpinner size="sm" /> : (
          <div style={{ display: "grid", gap: 16 }}>
            {assignMsg ? <p className="form-message">{assignMsg}</p> : null}

            <div>
              <h4 style={{ margin: "0 0 8px" }}>Profesores asignados</h4>
              {teachers.length === 0 ? <p style={{ color: "var(--muted)" }}>Sin profesores asignados.</p> : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Profesor</th><th>Asignatura</th><th></th></tr></thead>
                    <tbody>
                      {teachers.map((t) => (
                        <tr key={t.assignment_id}>
                          <td><strong>{t.teacher_name || "N/A"}</strong></td>
                          <td>{t.subject_name}</td>
                          <td>
                            <button className="btn-small btn-danger" onClick={() => removeAssignMutation.mutate(t.assignment_id)} disabled={removeAssignMutation.isPending}>Quitar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="form-row" style={{ marginTop: 8 }}>
                <select value={selectedTeacherId} onChange={(e) => setSelectedTeacherId(e.target.value)}>
                  <option value="">Seleccionar profesor...</option>
                  {(teachersQuery.data || []).map((t: AdminTeacher) => (
                    <option key={t.user_id} value={t.user_id}>{t.teacher_name}</option>
                  ))}
                </select>
                <select value={selectedSubjectId} onChange={(e) => setSelectedSubjectId(e.target.value)}>
                  <option value="">Seleccionar asignatura...</option>
                  {(subjectsQuery.data || []).map((s: AdminSubject) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (!selectedTeacherId || !selectedSubjectId) { setAssignMsg("Selecciona profesor y asignatura."); return; }
                    assignMutation.mutate({ userId: selectedTeacherId, courseId, subjectId: selectedSubjectId });
                  }}
                  disabled={assignMutation.isPending}
                >Asignar</button>
              </div>
            </div>

            <div>
              <h4 style={{ margin: "0 0 8px" }}>Alumnos ({students.length})</h4>
              {students.length === 0 ? (
                <p style={{ color: "var(--muted)" }}>Sin alumnos matriculados en este curso.</p>
              ) : (
                <div className="table-wrap" style={{ maxHeight: 300, overflowY: "auto" }}>
                  <table className="table">
                    <thead><tr><th>Alumno</th></tr></thead>
                    <tbody>
                      {students.map((s) => (
                        <tr key={s.student_id}>
                          <td>{s.first_name} {s.last_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
