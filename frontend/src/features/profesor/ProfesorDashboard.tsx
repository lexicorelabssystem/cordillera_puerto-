import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ShellLayout } from "../../components/common/ShellLayout";
import { KpiCard } from "../../components/common/KpiCard";
import { GradeBarChart } from "../../components/charts/GradeBarChart";
import { VoiceTextarea } from "../../components/voice/VoiceTextarea";
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

  const kpiQuery = useQuery({
    queryKey: ["course-kpi", courseId],
    queryFn: () => api.courseKpi(courseId),
    enabled: Boolean(courseId)
  });
  const alertsQuery = useQuery({ queryKey: ["my-alerts"], queryFn: api.myAlerts });

  const [title, setTitle] = useState("Control unidad 1");
  const [assessmentType, setAssessmentType] = useState("proceso");
  const [semester, setSemester] = useState(1);
  const [appliedAt, setAppliedAt] = useState(new Date().toISOString().slice(0, 10));
  const [grades, setGrades] = useState<Record<string, number>>({});
  const [observation, setObservation] = useState("");
  const [message, setMessage] = useState("");

  const createAssessment = useMutation({
    mutationFn: api.createAssessment,
    onSuccess: () => {
      setGrades({});
      setMessage("Planilla registrada correctamente.");
      kpiQuery.refetch();
      studentsQuery.refetch();
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : "No se pudo registrar la planilla");
    }
  });

  const students = studentsQuery.data || [];

  useEffect(() => {
    if (!students.length) return;
    const next: Record<string, number> = {};
    for (const s of students) next[s.student_id] = 4.0;
    setGrades(next);
  }, [studentsQuery.data]);

  const chartData = useMemo(
    () =>
      students.slice(0, 12).map((s: CourseStudentRow) => ({
        name: `${s.first_name} ${s.last_name.charAt(0)}.`,
        grade: grades[s.student_id] ?? 0
      })),
    [students, grades]
  );

  function submitGradebook() {
    setMessage("");
    if (!title.trim()) {
      setMessage("El nombre de la evaluacion es obligatorio.");
      return;
    }
    if (!students.length) {
      setMessage("No hay alumnos en el curso seleccionado.");
      return;
    }

    const invalid = students.find((s) => {
      const value = Number(grades[s.student_id]);
      return Number.isNaN(value) || value < 0 || value > 7;
    });
    if (invalid) {
      setMessage("Todas las notas deben estar entre 0.0 y 7.0.");
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
        <KpiCard label="Promedio curso" value={kpiQuery.data?.avgGrade ?? "-"} />
        <KpiCard label="Equivalente %" value={kpiQuery.data ? `${kpiQuery.data.avgPercent}%` : "-"} />
        <KpiCard label="Nivel" value={kpiQuery.data?.level ?? "-"} />
        <KpiCard label="Notas registradas" value={kpiQuery.data?.totalGrades ?? 0} />
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
        {message ? <p>{message}</p> : null}

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
