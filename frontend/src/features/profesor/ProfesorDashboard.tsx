import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ShellLayout } from "../../components/common/ShellLayout";
import { KpiCard } from "../../components/common/KpiCard";
import { GradeBarChart } from "../../components/charts/GradeBarChart";
import { VoiceTextarea } from "../../components/voice/VoiceTextarea";
import { useToast } from "../../components/common/Toast";
import { Modal } from "../../components/common/Modal";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { api } from "../../lib/api";
import type { AuthUser, CourseStudentRow } from "../../types/api";

interface Props {
  user: AuthUser;
  onLogout: () => void;
}

export function ProfesorDashboard({ user, onLogout }: Props) {
  const assignmentsQuery = useQuery({
    queryKey: ["teacher-assignments"],
    queryFn: () => api.myAssignments(),
  });
  const firstAssignment = assignmentsQuery.data?.[0];
  const [assignmentId, setAssignmentId] = useState<string>("");
  const selectedAssignment = assignmentsQuery.data?.find((assignment) => assignment.assignment_id === assignmentId);
  const courseId = selectedAssignment?.course_id || "";
  const subjectId = selectedAssignment?.subject_id || "";

  useEffect(() => {
    if (firstAssignment && !assignmentId) {
      setAssignmentId(firstAssignment.assignment_id);
    }
  }, [firstAssignment, assignmentId]);

  const studentsQuery = useQuery({
    queryKey: ["course-students", courseId],
    queryFn: () => api.getCourseStudents(courseId),
    enabled: Boolean(courseId)
  });

  const alertsQuery = useQuery({ queryKey: ["my-alerts"], queryFn: api.myAlerts });

  const [title, setTitle] = useState("Control unidad 1");
  const [assessmentType, setAssessmentType] = useState("proceso");
  const [semester, setSemester] = useState(1);
  const [appliedAt, setAppliedAt] = useState(new Date().toISOString().slice(0, 10));
  const [grades, setGrades] = useState<Record<string, number>>({});
  const [observation, setObservation] = useState("");
  const gradesEditedRef = useRef(false);
  const prevCourseIdRef = useRef(courseId);
  const { toast } = useToast();

  const createAssessment = useMutation({
    mutationFn: api.createAssessment,
    onSuccess: () => {
      setGrades({});
      gradesEditedRef.current = false;
      toast("Planilla registrada correctamente.", "success");
      studentsQuery.refetch();
    },
    onError: (error) => {
      toast(error instanceof Error ? error.message : "No se pudo registrar la planilla", "error");
    }
  });

  const students = studentsQuery.data || [];

  const kpiData = useMemo(() => {
    const total = students.length;
    if (!total) return { avgGrade: "-", avgPercent: "-", level: "-", totalGrades: 0 };
    const validGrades = Object.values(grades).filter(v => typeof v === 'number' && !isNaN(v) && v > 0);
    const totalGrades = validGrades.length;
    if (!totalGrades) return { avgGrade: "-", avgPercent: "-", level: "-", totalGrades: 0 };
    const avg = validGrades.reduce((s, g) => s + g, 0) / totalGrades;
    const pct = ((avg / 7) * 100).toFixed(0);
    let level = "Sin datos";
    if (avg >= 5.5) level = "Alto";
    else if (avg >= 4.0) level = "Medio";
    else level = "Bajo";
    return { avgGrade: avg.toFixed(2), avgPercent: `${pct}%`, level, totalGrades };
  }, [students, grades]);

  useEffect(() => {
    if (!studentsQuery.data?.length) return;

    if (courseId !== prevCourseIdRef.current) {
      if (gradesEditedRef.current) {
        const confirmed = window.confirm(
          "Has editado notas en este curso. Al cambiar de curso perderas los cambios no guardados. ¿Deseas continuar?"
        );
        if (!confirmed) {
          setAssignmentId(prevCourseIdRef.current ? assignmentId : "");
          return;
        }
      }
      prevCourseIdRef.current = courseId;
      gradesEditedRef.current = false;
    }

    if (!gradesEditedRef.current) {
      const next: Record<string, number> = {};
      for (const s of studentsQuery.data) next[s.student_id] = 4.0;
      setGrades(next);
    }
  }, [studentsQuery.data, courseId]);

  const chartData = useMemo(
    () =>
      students.slice(0, 12).map((s: CourseStudentRow) => ({
        name: `${s.first_name} ${s.last_name.charAt(0)}.`,
        grade: grades[s.student_id] ?? 0
      })),
    [students, grades]
  );

  function submitGradebook() {
    
    if (!title.trim()) {
      toast("El nombre de la evaluacion es obligatorio.", "warning");
      return;
    }
    if (!students.length) {
      toast("No hay alumnos en el curso seleccionado.", "warning");
      return;
    }

    const invalid = students.find((s) => {
      const value = Number(grades[s.student_id]);
      return Number.isNaN(value) || value < 0 || value > 7;
    });
    if (invalid) {
      toast("Todas las notas deben estar entre 0.0 y 7.0.", "warning");
      return;
    }

    createAssessment.mutate({
      courseId,
      subjectId,
      title,
      assessmentType,
      semester,
      description: observation,
      appliedAt,
      grades: students.map((s) => ({
        studentId: s.student_id,
        grade: Number(grades[s.student_id] ?? 0),
        comments: observation
      }))
    });
  }

  return (
    <ShellLayout
      title="Pantalla Profesor"
      subtitle={`Bienvenido ${user.name}. Gestiona planillas por curso y notas de 0.0 a 7.0.`}
      right={<button onClick={onLogout}>Cerrar sesion</button>}
    >
      {assignmentsQuery.isLoading ? <section className="panel"><p>Cargando asignaciones...</p></section> : null}
      {assignmentsQuery.isError ? <section className="panel"><p>No se pudieron cargar las asignaciones.</p></section> : null}

      <section className="kpi-grid">
        <KpiCard label="Promedio curso" value={kpiData.avgGrade} />
        <KpiCard label="Equivalente %" value={kpiData.avgPercent} />
        <KpiCard label="Nivel" value={kpiData.level} />
        <KpiCard label="Notas registradas" value={kpiData.totalGrades} />
      </section>

      <section className="panel">
        <h3>Asignaciones del profesor</h3>
        {!assignmentsQuery.data?.length ? <p>Sin asignaciones activas. Solicita configuracion al equipo directivo.</p> : null}
        <select
          value={assignmentId}
          onChange={(event) => {
            setAssignmentId(event.target.value);
          }}
        >
          {assignmentsQuery.data?.map((a) => (
            <option key={a.assignment_id} value={a.assignment_id}>
              {a.course_name} - {a.subject_name}
            </option>
          ))}
        </select>
      </section>

      <section className="panel">
        <h3>Planilla de notas por curso</h3>
        <div className="form-row">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nombre de evaluacion" />
          <select value={assessmentType} onChange={(e) => setAssessmentType(e.target.value)}>
            <option value="diagnostica">Diagnostica</option>
            <option value="proceso">Proceso</option>
            <option value="cierre">Cierre</option>
            <option value="parcial">Parcial</option>
            <option value="final">Final</option>
          </select>
          <select value={semester} onChange={(e) => setSemester(Number(e.target.value))}>
            <option value={1}>Semestre 1</option>
            <option value={2}>Semestre 2</option>
          </select>
          <input type="date" value={appliedAt} onChange={(e) => setAppliedAt(e.target.value)} />
          <button onClick={submitGradebook} disabled={createAssessment.isPending}>
            {createAssessment.isPending ? "Guardando..." : "Registrar planilla"}
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          <VoiceTextarea
            value={observation}
            onChange={setObservation}
            label="Observaciones de la evaluacion"
            placeholder="Dicta o escribe observaciones generales..."
            rows={2}
          />
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Alumno</th>
                <th>Curso</th>
                <th>Nota (0.0 - 7.0)</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.student_id}>
                  <td>{s.first_name} {s.last_name}</td>
                  <td>{s.course_name}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      max="7"
                      step="0.1"
                      value={grades[s.student_id] ?? 0}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        gradesEditedRef.current = true;
                        setGrades((prev) => ({ ...prev, [s.student_id]: value }));
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h3>Vista grafica de notas</h3>
        <GradeBarChart data={chartData} />
      </section>

      <EvaluacionesProfesorPanel courseId={courseId} subjectId={subjectId} />

      <AnswersInspectionPanel courseId={courseId} subjectId={subjectId} />

      <section className="panel">
        <h3>Notificaciones y alertas del curso</h3>
        {!alertsQuery.data?.alerts.length ? (
          <p>Sin alertas de riesgo en tus cursos asignados.</p>
        ) : (
          <div className="alert-list">
            {alertsQuery.data.alerts.slice(0, 12).map((a) => (
              <article key={`${a.studentId}-${a.semester}`} className="alert-card">
                <strong>{a.courseName} - {a.studentName} (Sem {a.semester})</strong>
                <p>Promedio {a.avgGrade} | Riesgo {a.level}. {a.message}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </ShellLayout>
  );
}

function EvaluacionesProfesorPanel({ courseId, subjectId }: { courseId: string; subjectId: string }) {
  const assessmentsQuery = useQuery({
    queryKey: ["teacher-course-assessments", courseId, subjectId],
    queryFn: () => api.listAssessments({ courseId, subjectId }) as Promise<{ assessment_id: string; title: string; assessment_type: string; status: string; course_name: string; subject_name: string; attempts_count: number; grades_count: number; created_at: string }[]>,
    enabled: Boolean(courseId) && Boolean(subjectId),
  });

  const assessments = assessmentsQuery.data || [];

  const porEstado = useMemo(() => {
    const map: Record<string, number> = {};
    assessments.forEach((a) => { map[a.status] = (map[a.status] || 0) + 1; });
    return map;
  }, [assessments]);

  if (!courseId || !subjectId) return null;

  return (
    <section className="panel">
      <h3>Mis Evaluaciones del Curso</h3>
      <p style={{ color: "var(--muted)", fontSize: ".84rem", marginBottom: 12 }}>
        Evaluaciones creadas para este curso y asignatura. Puedes crear, revisar y monitorear el progreso de tus estudiantes.
      </p>

      {assessmentsQuery.isLoading ? <LoadingSpinner size="sm" /> : null}

      {!assessmentsQuery.isLoading && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {Object.entries(porEstado).map(([estado, count]) => (
            <span key={estado} className={`badge ${estado === "PUBLISHED" || estado === "ACTIVE" ? "badge--active" : estado === "CLOSED" || estado === "IN_GRADING" ? "badge--warning" : estado === "GRADED" || estado === "REPORTED" ? "badge--active" : "badge--inactive"}`}>
              {estado}: {count}
            </span>
          ))}
          {assessments.length === 0 && <span style={{ color: "var(--muted)", fontSize: ".84rem" }}>Sin evaluaciones aún. Crea una planilla arriba.</span>}
        </div>
      )}

      {assessments.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Evaluación</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Intentos</th>
                <th>Notas</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((a) => (
                <tr key={a.assessment_id}>
                  <td><strong>{a.title}</strong></td>
                  <td><span className="badge badge--role">{a.assessment_type}</span></td>
                  <td>
                    <span className={`badge ${a.status === "PUBLISHED" || a.status === "ACTIVE" || a.status === "GRADED" ? "badge--active" : a.status === "CLOSED" || a.status === "IN_GRADING" ? "badge--warning" : "badge--inactive"}`}>
                      {a.status}
                    </span>
                  </td>
                  <td style={{ textAlign: "center" }}>{a.attempts_count}</td>
                  <td style={{ textAlign: "center" }}>{a.grades_count}</td>
                  <td style={{ fontSize: ".78rem", whiteSpace: "nowrap" }}>{new Date(a.created_at).toLocaleDateString("es-CL")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AnswersInspectionPanel({ courseId, subjectId }: { courseId: string; subjectId: string }) {
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");
  const [showModal, setShowModal] = useState(false);

  const assessmentsQuery = useQuery({
    queryKey: ["teacher-assessments", courseId, subjectId],
    queryFn: () => api.listAssessments({ courseId, subjectId, status: "CLOSED" }) as Promise<{ assessment_id: string; title: string; assessment_type: string; status: string; attempts_count: number }[]>,
    enabled: Boolean(courseId) && Boolean(subjectId),
  });

  const summaryQuery = useQuery({
    queryKey: ["grading-summary", selectedAssessmentId],
    queryFn: () => api.getGradingSummary(selectedAssessmentId),
    enabled: Boolean(selectedAssessmentId) && showModal,
  });

  const pendingQuery = useQuery({
    queryKey: ["pending-grading-teacher", selectedAssessmentId],
    queryFn: () => api.getPendingGrading(selectedAssessmentId),
    enabled: Boolean(selectedAssessmentId) && showModal,
  });

  const assessments = (assessmentsQuery.data || []) as { assessment_id: string; title: string; assessment_type: string; status: string; attempts_count: number }[];
  const summary = summaryQuery.data;
  const pending = pendingQuery.data;

  return (
    <section className="panel">
      <h3>Respuestas por alumno</h3>
      <p style={{ color: "var(--muted)", marginBottom: 8 }}>
        Selecciona una evaluación cerrada para ver el detalle de respuestas y puntajes por alumno.
      </p>
      <div className="form-row" style={{ marginBottom: 8 }}>
        <select value={selectedAssessmentId} onChange={(e) => setSelectedAssessmentId(e.target.value)}>
          <option value="">Seleccionar evaluación...</option>
          {assessments.map((a) => (
            <option key={a.assessment_id} value={a.assessment_id}>
              {a.title} ({a.assessment_type}) — {a.attempts_count} intentos
            </option>
          ))}
        </select>
        <button onClick={() => setShowModal(true)} disabled={!selectedAssessmentId}>
          Ver detalle
        </button>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={`Detalle: ${assessments.find((a) => a.assessment_id === selectedAssessmentId)?.title || "Evaluación"}`}
        size="lg"
        footer={<button className="btn-secondary" onClick={() => setShowModal(false)}>Cerrar</button>}
      >
        {summaryQuery.isLoading ? <LoadingSpinner size="sm" /> : summary ? (
          <div style={{ display: "grid", gap: 16 }}>
            <div className="kpi-grid">
              <div className="kpi-card"><span>Total intentos</span><strong>{summary.totalAttempts}</strong></div>
              <div className="kpi-card"><span>Preguntas</span><strong>{summary.totalQuestions}</strong></div>
              <div className="kpi-card"><span>Promedio general</span><strong>{summary.grades.length > 0 ? (summary.grades.reduce((s: number, g: { grade: number }) => s + g.grade, 0) / summary.grades.length).toFixed(2) : "-"}</strong></div>
            </div>

            <div>
              <h4>Estados de respuesta</h4>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {Object.entries(summary.answersByStatus as Record<string, number>).map(([status, count]) => (
                  <span key={status} className={`badge ${status === "CORRECT" ? "badge--active" : status === "INCORRECT" ? "badge--inactive" : status === "PENDING" || status === "MANUAL_REVIEW" ? "badge--warning" : "badge--role"}`}>
                    {status}: {count}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4>Notas por alumno</h4>
              <div className="table-wrap" style={{ maxHeight: 400, overflowY: "auto" }}>
                <table className="table">
                  <thead><tr><th>Alumno</th><th>Puntaje</th><th>%</th><th>Nota</th></tr></thead>
                  <tbody>
                    {summary.grades.map((g: { studentId: string; studentName: string; score: number | null; percentage: number | null; grade: number }) => (
                      <tr key={g.studentId}>
                        <td><strong>{g.studentName}</strong></td>
                        <td>{g.score ?? "-"}</td>
                        <td>{g.percentage != null ? `${g.percentage}%` : "-"}</td>
                        <td><span className={`badge ${g.grade >= 4.0 ? "badge--active" : "badge--inactive"}`}>{g.grade}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {pending && pending.totalPending > 0 && (
              <div>
                <h4>Pendientes de corrección manual</h4>
                <div className="kpi-grid">
                  <div className="kpi-card"><span>Total pendientes</span><strong>{pending.totalPending}</strong></div>
                  <div className="kpi-card"><span>Alumnos</span><strong>{pending.byStudent.length}</strong></div>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
