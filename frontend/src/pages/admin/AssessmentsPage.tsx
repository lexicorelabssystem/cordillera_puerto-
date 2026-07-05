import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { EmptyState } from "../../components/common/EmptyState";
import { VoiceTextarea } from "../../components/voice/VoiceTextarea";
import { useToast } from "../../components/common/Toast";
import { useInstitution } from "../../app/InstitutionContext";

type AssessmentType = "DIAGNOSTICA" | "PROCESO" | "CIERRE" | "PARCIAL" | "FINAL" | "SIMCE";
const MIN_BOOK_COLUMNS = 10;

type AssessmentListItem = {
  id: string;
  assessment_id?: string;
  title: string;
  assessmentType?: string;
  assessment_type?: string;
  status: string;
  course?: { name?: string };
  subject?: { name?: string };
  teacher?: { user?: { firstName?: string; lastName?: string } };
  course_name?: string;
  subject_name?: string;
  teacher_name?: string;
  createdAt?: string;
  created_at?: string;
};

type CourseGradeBook = Awaited<ReturnType<typeof api.getCourseGradeBook>>;

function formatearNota(nota: number | null | undefined): string {
  if (nota === null || nota === undefined || Number.isNaN(nota)) return "-";
  return nota.toFixed(1).replace(".", ",");
}

function notaColor(nota: number | null | undefined): string {
  if (nota === null || nota === undefined) return "var(--muted)";
  if (nota < 4) return "var(--danger)";
  if (nota >= 6) return "var(--success)";
  return "var(--ink-soft)";
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return text.includes(",") || text.includes('"') || text.includes("\n")
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob(["\uFEFF", content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getAssessmentId(assessment: AssessmentListItem) {
  return assessment.id || assessment.assessment_id || "";
}

function getAssessmentType(assessment: AssessmentListItem) {
  return assessment.assessmentType || assessment.assessment_type || "-";
}

function getCourseName(assessment: AssessmentListItem) {
  return assessment.course?.name || assessment.course_name || "-";
}

function getSubjectName(assessment: AssessmentListItem) {
  return assessment.subject?.name || assessment.subject_name || "-";
}

function getCreatedAt(assessment: AssessmentListItem) {
  return assessment.createdAt || assessment.created_at || "";
}

export function AssessmentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [courseId, setCourseId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [form, setForm] = useState({
    title: "", assessmentType: "PROCESO" as AssessmentType, semester: 1,
    courseId: "", subjectId: "", maxScore: 100, weight: 0,
  });

  const { selectedInstitution } = useInstitution();

  const coursesQuery = useQuery({
    queryKey: ["courses-assess", selectedInstitution?.id],
    queryFn: () => api.listCourses({ institutionId: selectedInstitution?.id }),
    enabled: Boolean(selectedInstitution?.id),
  });

  const subjectsQuery = useQuery({
    queryKey: ["subjects-assess"],
    queryFn: () => api.listSubjects(true),
  });

  const gradeBookQuery = useQuery({
    queryKey: ["evaluaciones-grade-book", courseId, subjectId],
    queryFn: () => api.getCourseGradeBook(courseId, subjectId ? { subjectId } : undefined),
    enabled: Boolean(courseId),
  });

  const assessmentsQuery = useQuery({
    queryKey: ["assessments-list"],
    queryFn: () => api.listAssessments() as Promise<AssessmentListItem[]>,
  });

  const createMutation = useMutation({
    mutationFn: (payload: unknown) => api.createAssessment(payload),
    onSuccess: () => { toast("Evaluacion creada correctamente.", "success"); setShowCreate(false); setForm({ title: "", assessmentType: "PROCESO", semester: 1, courseId: "", subjectId: "", maxScore: 100, weight: 0 }); queryClient.invalidateQueries({ queryKey: ["assessments-list"] }); },
    onError: (e) => toast(e instanceof Error ? e.message : "Error al crear evaluacion.", "error"),
  });

  function handleCreate() {
    if (!form.title || !form.courseId || !form.subjectId) { toast("Titulo, curso y asignatura son obligatorios.", "warning"); return; }
    createMutation.mutate({
      courseId: form.courseId, subjectId: form.subjectId, title: form.title,
      assessmentType: form.assessmentType, semester: form.semester,
      maxScore: form.maxScore, weight: form.weight,
      startDate: new Date().toISOString(),
    });
  }

  const assessments = (assessmentsQuery.data || []).filter((assessment) => getAssessmentId(assessment));
  const courses = coursesQuery.data || [];
  const subjects = useMemo(
    () => (subjectsQuery.data || []).filter((subject) => subject.id && subject.name?.trim()),
    [subjectsQuery.data]
  );
  const book = gradeBookQuery.data as CourseGradeBook | undefined;
  const bookAssessments = book?.assessments || [];
  const bookColumns = useMemo(
    () => Array.from({ length: Math.max(MIN_BOOK_COLUMNS, bookAssessments.length) }, (_, index) => ({
      id: bookAssessments[index]?.id || `empty-${index}`,
      label: `N ${index + 1}`,
      assessment: bookAssessments[index],
    })),
    [bookAssessments]
  );
  const bookStudents = useMemo(() => {
    const term = studentSearch.trim().toLowerCase();
    const students = book?.students || [];
    if (!term) return students;
    return students.filter((student) =>
      `${student.firstName} ${student.lastName}`.toLowerCase().includes(term) ||
      student.rut?.toLowerCase().includes(term)
    );
  }, [book?.students, studentSearch]);

  useEffect(() => {
    if (!courseId && courses.length > 0) {
      setCourseId(courses[0].course_id);
    }
  }, [courseId, courses]);

  useEffect(() => {
    if (subjectId && !subjects.some((subject) => subject.id === subjectId)) {
      setSubjectId("");
    }
  }, [subjectId, subjects]);

  function openCreateAssessment() {
    setForm((state) => ({
      ...state,
      courseId,
      subjectId: subjectId || state.subjectId,
    }));
    setShowCreate(true);
  }

  function exportBookCsv() {
    const headers = ["N", "Estudiante", ...bookColumns.map((column) => column.label.replace(" ", "")), "Promedio"];
    const rows = bookStudents.map((student, index) => {
      const values = bookColumns.map((column) => {
        if (!column.assessment) return "";
        const assessment = column.assessment;
        const grade = student.grades.find((item) => item.assessmentId === assessment.id);
        return formatearNota(grade?.grade);
      });
      return [index + 1, `${student.lastName} ${student.firstName}`, ...values, formatearNota(student.average)];
    });
    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    downloadTextFile("libro_evaluaciones.csv", csv, "text/csv;charset=utf-8");
    setShowOptions(false);
  }

  function exportBookJson() {
    const payload = bookStudents.map((student, index) => ({
      numero: index + 1,
      estudiante: `${student.lastName} ${student.firstName}`,
      promedio: student.average,
      notas: bookColumns.map((column) => ({
        evaluacion: column.assessment?.title || column.label,
        nota: column.assessment
          ? student.grades.find((item) => item.assessmentId === column.assessment?.id)?.grade ?? null
          : null,
      })),
    }));
    downloadTextFile("libro_evaluaciones.json", JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
    setShowOptions(false);
  }

  const assessmentAverages = useMemo(
    () => bookColumns.map((column) => {
      if (!column.assessment) return null;
      const assessment = column.assessment;
      const grades = bookStudents
        .map((student) => student.grades.find((grade) => grade.assessmentId === assessment.id)?.grade)
        .filter((grade): grade is number => typeof grade === "number");
      if (grades.length === 0) return null;
      return grades.reduce((sum, grade) => sum + grade, 0) / grades.length;
    }),
    [bookColumns, bookStudents]
  );

  return (
    <>
      <section className="panel evaluaciones-book">
        <div className="evaluaciones-book__toolbar">
          <select className="evaluaciones-book__mode" defaultValue="vertical" aria-label="Vista del libro">
            <option value="vertical">Tab. Vertical</option>
          </select>
          <span className="evaluaciones-book__count">
            {bookStudents.length} alumnos · {bookAssessments.length} evaluaciones · {bookColumns.length} espacios
          </span>
          <div className="evaluaciones-book__toolbar-actions">
            <div className="evaluaciones-options">
              <button className="btn-secondary" onClick={() => setShowOptions((open) => !open)}>
                Opciones
              </button>
              {showOptions && (
                <div className="evaluaciones-options__menu">
                  <button onClick={() => window.print()}>PDF</button>
                  <button onClick={exportBookCsv} disabled={bookStudents.length === 0}>Excel</button>
                  <button onClick={exportBookJson} disabled={bookStudents.length === 0}>JSON</button>
                  <a href="/api/v1/files/templates/grades/download" download>Importar plantilla</a>
                </div>
              )}
            </div>
            <button className="evaluaciones-book__add" onClick={openCreateAssessment}>
              + Calificación
            </button>
          </div>
        </div>

        <div className="evaluaciones-book__filters">
          <div className="form-field">
            <label>Curso</label>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              {courses.map((course) => (
                <option key={course.course_id} value={course.course_id}>{course.course_name}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Asignatura</label>
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">Todas</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>{subject.name}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Buscar alumno</label>
            <input
              type="search"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Nombre, apellido o RUT..."
            />
          </div>
        </div>

        {gradeBookQuery.isLoading ? (
          <LoadingSpinner label="Cargando libro de evaluaciones..." />
        ) : !courseId || bookStudents.length === 0 ? (
          <EmptyState title="Libro sin alumnos" description="Selecciona un curso con estudiantes para ver la planilla." />
        ) : (
          <div className="table-wrap evaluaciones-book__table-wrap">
            <table className="table evaluaciones-book__table">
              <thead>
                <tr>
                  <th className="evaluaciones-book__num">N°</th>
                  <th className="evaluaciones-book__student">Estudiante</th>
                  {bookColumns.map((column) => (
                    <th
                      key={column.id}
                      className={!column.assessment ? "evaluaciones-book__empty-head" : ""}
                      title={column.assessment?.title || "Espacio disponible"}
                    >
                      <span>{column.label}</span>
                      <button
                        onClick={() => column.assessment ? navigate(column.assessment.id) : openCreateAssessment()}
                        title={column.assessment?.title || "Crear evaluación para este espacio"}
                      >
                        ▾
                      </button>
                    </th>
                  ))}
                  <th>Promedio</th>
                </tr>
              </thead>
              <tbody>
                {bookStudents.map((student, index) => (
                  <tr key={student.studentId}>
                    <td className="evaluaciones-book__num">{index + 1}</td>
                    <td className="evaluaciones-book__student">{student.lastName} {student.firstName}</td>
                    {bookColumns.map((column, assessmentIndex) => {
                      if (!column.assessment) {
                        return (
                          <td
                            key={column.id}
                            className={`${assessmentIndex === 0 ? "evaluaciones-book__highlight" : ""} evaluaciones-book__empty-cell`}
                            onClick={openCreateAssessment}
                            title="Espacio disponible para una nueva calificación"
                          />
                        );
                      }
                      const assessment = column.assessment;
                      const grade = student.grades.find((item) => item.assessmentId === assessment.id);
                      const value = grade?.grade ?? null;
                      return (
                        <td
                          key={assessment.id}
                          className={assessmentIndex === 0 ? "evaluaciones-book__highlight" : ""}
                          style={{ color: notaColor(value) }}
                        >
                          {formatearNota(value)}
                        </td>
                      );
                    })}
                    <td className="evaluaciones-book__average" style={{ color: notaColor(student.average) }}>
                      {formatearNota(student.average)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Promedio</td>
                  {assessmentAverages.map((average, index) => (
                    <td key={bookColumns[index]?.id || index}>{formatearNota(average)}</td>
                  ))}
                  <td className="evaluaciones-book__average">{formatearNota(book?.stats.courseAvg)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h3>Evaluaciones</h3>
        <div className="form-actions">
          <button onClick={() => setShowCreate(!showCreate)}>{showCreate ? "Cancelar" : "+ Nueva evaluación"}</button>
        </div>

        {showCreate && (
          <div style={{ marginTop: 12 }}>
            <div className="form-grid">
              <div className="form-field"><label>Título *</label><input value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} /></div>
              <div className="form-field"><label>Tipo</label>
                <select value={form.assessmentType} onChange={(e) => setForm((s) => ({ ...s, assessmentType: e.target.value as AssessmentType }))}>
                  <option value="DIAGNOSTICA">Diagnóstica</option>
                  <option value="PROCESO">Proceso</option>
                  <option value="CIERRE">Cierre</option>
                  <option value="PARCIAL">Parcial</option>
                  <option value="FINAL">Final</option>
                  <option value="SIMCE">SIMCE</option>
                </select>
              </div>
              <div className="form-field"><label>Semestre</label>
                <select value={form.semester} onChange={(e) => setForm((s) => ({ ...s, semester: Number(e.target.value) }))}>
                  <option value={1}>Semestre 1</option><option value={2}>Semestre 2</option>
                </select>
              </div>
              <div className="form-field"><label>Curso *</label>
                <select value={form.courseId} onChange={(e) => setForm((s) => ({ ...s, courseId: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {(coursesQuery.data || []).map((c) => (<option key={c.course_id} value={c.course_id}>{c.course_name}</option>))}
                </select>
              </div>
              <div className="form-field"><label>Asignatura *</label>
                <select value={form.subjectId} onChange={(e) => setForm((s) => ({ ...s, subjectId: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {(subjectsQuery.data || []).map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </select>
              </div>
              <div className="form-field"><label>Puntaje máx</label><input type="number" value={form.maxScore} onChange={(e) => setForm((s) => ({ ...s, maxScore: Number(e.target.value) }))} /></div>
              <div className="form-field"><label>Ponderación</label><input type="number" value={form.weight} onChange={(e) => setForm((s) => ({ ...s, weight: Number(e.target.value) }))} /></div>
            </div>
            <div className="form-actions">
              <button onClick={handleCreate} disabled={createMutation.isPending}>{createMutation.isPending ? "Creando..." : "Crear"}</button>
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <h3>Listado de evaluaciones ({assessments.length})</h3>
        {assessmentsQuery.isLoading ? <LoadingSpinner size="sm" /> : null}
        {assessments.length === 0 && !assessmentsQuery.isLoading ? (
          <EmptyState title="Sin evaluaciones" description="Crea tu primera evaluación." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Título</th><th>Tipo</th><th>Curso</th><th>Asignatura</th><th>Estado</th><th>Fecha</th></tr></thead>
              <tbody>
                {assessments.map((a) => {
                  const assessmentId = getAssessmentId(a);
                  const createdAt = getCreatedAt(a);
                  return (
                  <tr key={assessmentId} onClick={() => navigate(assessmentId)} style={{ cursor: "pointer" }}>
                    <td><strong>{a.title}</strong></td>
                    <td><span className="badge badge--role">{getAssessmentType(a)}</span></td>
                    <td>{getCourseName(a)}</td>
                    <td>{getSubjectName(a)}</td>
                    <td><span className={`badge ${a.status === "PUBLISHED" || a.status === "ACTIVE" ? "badge--active" : a.status === "CLOSED" ? "badge--inactive" : "badge--warning"}`}>{a.status}</span></td>
                    <td>{createdAt ? new Date(createdAt).toLocaleDateString("es-CL") : "-"}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
