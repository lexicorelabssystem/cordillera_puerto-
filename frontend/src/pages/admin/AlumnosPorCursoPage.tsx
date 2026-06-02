import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { AdminCourseRow } from "../../types/api";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { useToast } from "../../components/common/Toast";
import { useInstitution } from "../../app/InstitutionContext";

interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  rut?: string | null;
  gender?: string | null;
  birthDate?: string | null;
  email?: string | null;
  userActive?: boolean;
  deletedAt?: string | null;
}

interface StudentListResponse {
  data: unknown[];
  meta?: { total: number };
}

function normalizeStudent(row: unknown): StudentRow {
  const item = row as {
    id?: string;
    student_id?: string;
    firstName?: string;
    first_name?: string;
    lastName?: string;
    last_name?: string;
    rut?: string | null;
    gender?: string | null;
    birthDate?: string | Date | null;
    deletedAt?: string | Date | null;
    user?: { email?: string | null; isActive?: boolean };
    student?: {
      id?: string;
      firstName?: string;
      lastName?: string;
      rut?: string | null;
      gender?: string | null;
      birthDate?: string | Date | null;
      deletedAt?: string | Date | null;
      user?: { email?: string | null; isActive?: boolean };
    };
  };
  const source = item.student ?? item;
  const birthDate = source.birthDate ? String(source.birthDate).slice(0, 10) : "";
  const deletedAt = source.deletedAt ? String(source.deletedAt) : null;

  return {
    id: item.student_id ?? source.id ?? "",
    firstName: item.first_name ?? source.firstName ?? "",
    lastName: item.last_name ?? source.lastName ?? "",
    rut: source.rut ?? null,
    gender: source.gender ?? null,
    birthDate,
    deletedAt,
    email: source.user?.email ?? item.user?.email ?? null,
    userActive: source.user?.isActive ?? item.user?.isActive,
  };
}

const emptyStudentForm = {
  firstName: "",
  lastName: "",
  email: "",
  temporaryPassword: "",
  rut: "",
  gender: "",
  birthDate: "",
};

export function AlumnosPorCursoPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedInstitution } = useInstitution();
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [search, setSearch] = useState("");
  const [showRetired, setShowRetired] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentForm, setStudentForm] = useState(emptyStudentForm);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    rut: "",
    gender: "",
    birthDate: "",
  });

  const coursesQuery = useQuery<AdminCourseRow[]>({
    queryKey: ["students-page-courses", selectedInstitution?.id],
    queryFn: () => api.listCourses({ institutionId: selectedInstitution?.id }) as Promise<AdminCourseRow[]>,
    enabled: Boolean(selectedInstitution?.id),
  });

  const courses = coursesQuery.data || [];

  useEffect(() => {
    if (!selectedCourseId && courses.length > 0) setSelectedCourseId(courses[0].course_id);
  }, [courses, selectedCourseId]);

  useEffect(() => {
    setEditingStudentId(null);
  }, [selectedCourseId]);

  const selectedCourse = courses.find((course) => course.course_id === selectedCourseId);
  const willCreateAccess = Boolean(studentForm.email.trim() && studentForm.temporaryPassword.trim());
  const partialAccessData = Boolean(studentForm.email.trim() || studentForm.temporaryPassword.trim()) && !willCreateAccess;

  const studentsQuery = useQuery<StudentListResponse>({
    queryKey: ["students-page-course-students", selectedCourseId, search, showRetired],
    queryFn: () =>
      api.listStudents({
        courseId: selectedCourseId,
        search: search || undefined,
        includeInactive: showRetired,
        limit: 200,
      }) as unknown as Promise<StudentListResponse>,
    enabled: Boolean(selectedCourseId),
  });

  const students = useMemo(
    () => (studentsQuery.data?.data || []).map(normalizeStudent).filter((student) => student.id),
    [studentsQuery.data],
  );
  const activeStudents = students.filter((student) => !student.deletedAt);
  const selectedStudent = students.find((student) => student.id === editingStudentId) ?? null;

  const invalidateStudents = () => {
    queryClient.invalidateQueries({ queryKey: ["students-page-course-students"] });
    queryClient.invalidateQueries({ queryKey: ["students-page-courses"] });
    queryClient.invalidateQueries({ queryKey: ["courses"] });
  };

  const createStudent = useMutation({
    mutationFn: () => api.createStudent({
      firstName: studentForm.firstName,
      lastName: studentForm.lastName,
      courseId: selectedCourseId,
      email: studentForm.email || undefined,
      temporaryPassword: studentForm.temporaryPassword || undefined,
      rut: studentForm.rut || undefined,
      gender: studentForm.gender || undefined,
      birthDate: studentForm.birthDate || undefined,
    }),
    onSuccess: () => {
      toast("Alumno creado y matriculado.", "success");
      setStudentForm(emptyStudentForm);
      invalidateStudents();
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Error al crear alumno.", "error"),
  });

  const updateStudent = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => api.updateStudent(id, payload),
    onSuccess: () => {
      toast("Alumno actualizado.", "success");
      setEditingStudentId(null);
      invalidateStudents();
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Error al actualizar alumno.", "error"),
  });

  const retireStudent = useMutation({
    mutationFn: api.deleteStudent,
    onSuccess: () => {
      toast("Alumno retirado.", "success");
      setEditingStudentId(null);
      invalidateStudents();
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Error al retirar alumno.", "error"),
  });

  const restoreStudent = useMutation({
    mutationFn: api.restoreStudent,
    onSuccess: () => {
      toast("Alumno reactivado.", "success");
      setEditingStudentId(null);
      invalidateStudents();
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Error al reactivar alumno.", "error"),
  });

  function handleCreateStudent() {
    if (!selectedCourseId) {
      toast("Selecciona un curso.", "warning");
      return;
    }
    if (!studentForm.firstName.trim() || !studentForm.lastName.trim()) {
      toast("Nombre y apellido son obligatorios.", "warning");
      return;
    }
    if ((studentForm.email.trim() && !studentForm.temporaryPassword.trim()) || (!studentForm.email.trim() && studentForm.temporaryPassword.trim())) {
      toast("Para crear acceso de alumno debes ingresar email y clave temporal.", "warning");
      return;
    }
    createStudent.mutate();
  }

  function startEditStudent(student: StudentRow) {
    setEditingStudentId(student.id);
    setEditForm({
      firstName: student.firstName,
      lastName: student.lastName,
      rut: student.rut || "",
      gender: student.gender || "",
      birthDate: student.birthDate || "",
    });
  }

  function handleUpdateStudent() {
    if (!editingStudentId) return;
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      toast("Nombre y apellido son obligatorios.", "warning");
      return;
    }
    updateStudent.mutate({
      id: editingStudentId,
      payload: {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        rut: editForm.rut || null,
        gender: editForm.gender || null,
        birthDate: editForm.birthDate || null,
      },
    });
  }

  return (
    <div className="profesores-module">
      <header className="libro-header">
        <div className="libro-header__title">
          <h1>Alumnos por Curso</h1>
          <p>Ingreso, busqueda y mantencion de alumnos por curso institucional.</p>
        </div>
      </header>

      <section className="correccion-stats-grid">
        <div className="libro-card"><span className="libro-card__label">Cursos</span><strong className="libro-card__value">{courses.length}</strong></div>
        <div className="libro-card"><span className="libro-card__label">Curso seleccionado</span><strong className="libro-card__value">{selectedCourse?.course_name || "-"}</strong></div>
        <div className="libro-card"><span className="libro-card__label">Alumnos activos</span><strong className="libro-card__value">{activeStudents.length}</strong></div>
      </section>

      <section className="panel">
        <h3>Seleccionar curso</h3>
        {coursesQuery.isLoading ? <LoadingSpinner label="Cargando cursos..." size="sm" /> : null}
        {courses.length === 0 && !coursesQuery.isLoading ? (
          <div className="empty-state">
            <strong>Sin cursos activos</strong>
            <p>Crea cursos antes de ingresar alumnos.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Curso</th><th>Nivel</th><th>Seccion</th><th>Cupo</th><th>Alumnos</th><th></th></tr></thead>
              <tbody>
                {courses.map((course) => (
                  <tr key={course.course_id}>
                    <td><strong>{course.course_name}</strong></td>
                    <td>{course.grade_level}°</td>
                    <td>{course.section || "A"}</td>
                    <td>{course.max_students ?? 45}</td>
                    <td>{course.students_count}</td>
                    <td>
                      <button className="btn-small" onClick={() => setSelectedCourseId(course.course_id)}>
                        {selectedCourseId === course.course_id ? "Seleccionado" : "Ver alumnos"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedCourse ? (
        <section className="panel">
          <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>{selectedCourse.course_name}: alumnos</h3>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <input
                style={{ minWidth: 260 }}
                placeholder="Buscar por nombre, RUT o email..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                <input type="checkbox" checked={showRetired} onChange={(event) => setShowRetired(event.target.checked)} style={{ width: "auto" }} />
                Mostrar retirados
              </label>
            </div>
          </div>

          {studentsQuery.isLoading ? <LoadingSpinner label="Cargando alumnos..." size="sm" /> : null}
          {students.length === 0 && !studentsQuery.isLoading ? (
            <div className="empty-state">
              <strong>Sin alumnos</strong>
              <p>No hay alumnos que coincidan con el filtro actual.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Alumno</th><th>RUT</th><th>Email</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>
                  {students.map((student) => {
                    const retired = Boolean(student.deletedAt);
                    return (
                      <tr key={student.id}>
                        <td><strong>{student.firstName} {student.lastName}</strong></td>
                        <td>{student.rut || "-"}</td>
                        <td>{student.email || "-"}</td>
                        <td><span className={`badge ${retired ? "badge--inactive" : "badge--active"}`}>{retired ? "Retirado" : student.email ? "Con acceso" : "Activo sin usuario"}</span></td>
                        <td>
                          <div className="action-buttons">
                            <button className="btn-small" onClick={() => startEditStudent(student)} disabled={retired}>Editar</button>
                            {retired ? (
                              <button className="btn-small" onClick={() => restoreStudent.mutate(student.id)}>Reactivar</button>
                            ) : (
                              <button className="btn-small btn-danger" onClick={() => {
                                if (window.confirm(`¿Retirar a ${student.firstName} ${student.lastName}? Su historial se conservara.`)) {
                                  retireStudent.mutate(student.id);
                                }
                              }}>Retirar</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {selectedStudent ? (
        <section className="panel">
          <h3>Editar alumno: {selectedStudent.firstName} {selectedStudent.lastName}</h3>
          <div className="form-grid">
            <div className="form-field">
              <label>Nombre *</label>
              <input value={editForm.firstName} onChange={(event) => setEditForm((state) => ({ ...state, firstName: event.target.value }))} />
            </div>
            <div className="form-field">
              <label>Apellido *</label>
              <input value={editForm.lastName} onChange={(event) => setEditForm((state) => ({ ...state, lastName: event.target.value }))} />
            </div>
            <div className="form-field">
              <label>RUT</label>
              <input value={editForm.rut} onChange={(event) => setEditForm((state) => ({ ...state, rut: event.target.value }))} />
            </div>
            <div className="form-field">
              <label>Genero</label>
              <select value={editForm.gender} onChange={(event) => setEditForm((state) => ({ ...state, gender: event.target.value }))}>
                <option value="">Sin especificar</option>
                <option value="F">F</option>
                <option value="M">M</option>
              </select>
            </div>
            <div className="form-field">
              <label>Fecha nacimiento</label>
              <input type="date" value={editForm.birthDate} onChange={(event) => setEditForm((state) => ({ ...state, birthDate: event.target.value }))} />
            </div>
          </div>
          <div className="form-actions">
            <button onClick={handleUpdateStudent} disabled={updateStudent.isPending}>
              {updateStudent.isPending ? "Guardando..." : "Guardar cambios"}
            </button>
            <button className="btn-secondary" onClick={() => setEditingStudentId(null)}>Cancelar</button>
          </div>
        </section>
      ) : null}

      {selectedCourse ? (
        <section className="panel student-create-panel">
          <h3>Agregar alumno a {selectedCourse.course_name}</h3>
          <div className="empty-state" style={{ marginBottom: 12 }}>
            <strong>{willCreateAccess ? "Alumno con acceso al sistema" : "Alumno solo académico"}</strong>
            <p>
              {willCreateAccess
                ? "Se creará la matrícula y también una cuenta para que el alumno pueda ingresar con email y clave temporal."
                : "Se creará la matrícula del alumno, pero no podrá ingresar al sistema hasta que se registre email y clave temporal."}
            </p>
          </div>
          <div className="form-grid student-create-grid">
            <div className="form-field">
              <label>Nombre *</label>
              <input value={studentForm.firstName} onChange={(event) => setStudentForm((state) => ({ ...state, firstName: event.target.value }))} />
            </div>
            <div className="form-field">
              <label>Apellido *</label>
              <input value={studentForm.lastName} onChange={(event) => setStudentForm((state) => ({ ...state, lastName: event.target.value }))} />
            </div>
            <div className="form-field">
              <label>Email de acceso</label>
              <input value={studentForm.email} onChange={(event) => setStudentForm((state) => ({ ...state, email: event.target.value }))} />
              <small style={{ color: "var(--muted)" }}>Opcional. Necesario solo si el alumno ingresará al sistema.</small>
            </div>
            <div className="form-field">
              <label>Clave temporal</label>
              <input type="password" value={studentForm.temporaryPassword} onChange={(event) => setStudentForm((state) => ({ ...state, temporaryPassword: event.target.value }))} />
              <small style={{ color: "var(--muted)" }}>Debe completarse junto con el email para crear acceso.</small>
            </div>
            <div className="form-field">
              <label>RUT</label>
              <input value={studentForm.rut} onChange={(event) => setStudentForm((state) => ({ ...state, rut: event.target.value }))} />
            </div>
            <div className="form-field">
              <label>Fecha nacimiento</label>
              <input type="date" value={studentForm.birthDate} onChange={(event) => setStudentForm((state) => ({ ...state, birthDate: event.target.value }))} />
            </div>
          </div>
          {partialAccessData ? (
            <p className="form-message" style={{ color: "var(--danger)" }}>
              Para crear acceso al sistema debes completar email y clave temporal. Si dejas ambos vacíos, se creará solo la matrícula académica.
            </p>
          ) : null}
          <div className="form-actions">
            <button onClick={handleCreateStudent} disabled={createStudent.isPending || partialAccessData}>
              {createStudent.isPending ? "Creando..." : willCreateAccess ? "Crear alumno con acceso" : "Crear alumno académico"}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
