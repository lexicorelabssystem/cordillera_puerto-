import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { LoadingSpinner } from "../common/LoadingSpinner";

interface Props {
  assessmentId: string;
  courseId: string;
  onClose: () => void;
}

function formatearNota(n: number | null): string {
  if (n === null || n === undefined) return "\u2014";
  return n.toFixed(1).replace(".", ",");
}

function colorNota(n: number | null): string {
  if (n === null || n === undefined) return "var(--muted)";
  if (n < 4.0) return "var(--danger)";
  if (n >= 6.0) return "var(--success)";
  return "var(--ink)";
}

export function AssessmentDetailModal({ assessmentId, courseId, onClose }: Props) {
  const assessmentQuery = useQuery({
    queryKey: ["assessment-detail", assessmentId],
    queryFn: () => api.getAssessment(assessmentId),
  });

  const gradeBookQuery = useQuery({
    queryKey: ["grade-book", courseId],
    queryFn: () => api.getCourseGradeBook(courseId),
    enabled: Boolean(courseId),
  });

  const assessment = assessmentQuery.data as {
    id: string; title: string; assessmentType: string; status: string;
    semester: number; maxScore: number;
    course?: { name: string };
    subject?: { name: string };
    teacher?: { user?: { firstName: string; lastName: string } };
    questions?: { questionId: string; points: number; question?: { statement: string; type: string } }[];
  } | undefined;

  const book = gradeBookQuery.data;
  const courseAssessments = book?.assessments || [];
  const fullAssessment = courseAssessments.find((a: { id: string }) => a.id === assessmentId);
  const students = book?.students || [];

  const studentResults = students
    .filter((s: { grades: { assessmentId: string; grade: number | null }[] }) =>
      s.grades.some((g) => g.assessmentId === assessmentId)
    )
    .map((s: { studentId: string; firstName: string; lastName: string; grades: { assessmentId: string; grade: number | null }[] }) => {
      const g = s.grades.find((gr) => gr.assessmentId === assessmentId);
      return { ...s, grade: g?.grade ?? null };
    });

  const gradesList = studentResults
    .filter((s: { grade: number | null }) => s.grade !== null)
    .map((s: { grade: number | null }) => s.grade as number);

  const avgGrade = gradesList.length > 0
    ? Number((gradesList.reduce((a: number, b: number) => a + b, 0) / gradesList.length).toFixed(1))
    : null;

  const approved = gradesList.filter((g: number) => g >= 4.0).length;
  const below4 = gradesList.filter((g: number) => g < 4.0).length;
  const pending = studentResults.filter((s: { grade: number | null }) => s.grade === null).length;
  const approvalRate = gradesList.length > 0 ? Math.round((approved / gradesList.length) * 100) : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container modal--lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{assessment?.title || fullAssessment?.title || "Detalle de Evaluacion"}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {assessmentQuery.isLoading ? <LoadingSpinner size="sm" /> : (
            <>
              <div className="gb-modal-meta">
                <div className="gb-modal-meta__item">
                  <span>Curso</span><strong>{assessment?.course?.name || book?.course?.name || "\u2014"}</strong>
                </div>
                <div className="gb-modal-meta__item">
                  <span>Asignatura</span><strong>{assessment?.subject?.name || fullAssessment?.subjectName || "\u2014"}</strong>
                </div>
                <div className="gb-modal-meta__item">
                  <span>Tipo</span><span className="badge badge--role">{assessment?.assessmentType || fullAssessment?.type || "\u2014"}</span>
                </div>
                <div className="gb-modal-meta__item">
                  <span>Estado</span><span className={`badge ${(assessment?.status || fullAssessment?.status) === "GRADED" ? "badge--active" : "badge--warning"}`}>{assessment?.status || fullAssessment?.status || "\u2014"}</span>
                </div>
                <div className="gb-modal-meta__item">
                  <span>Semestre</span><strong>{assessment?.semester || fullAssessment?.semester || "\u2014"}°</strong>
                </div>
                <div className="gb-modal-meta__item">
                  <span>Puntaje Max</span><strong>{assessment?.maxScore || fullAssessment?.maxScore || "\u2014"}</strong>
                </div>
                <div className="gb-modal-meta__item">
                  <span>Ponderacion</span><strong>{fullAssessment?.weight || "\u2014"}%</strong>
                </div>
                {assessment?.teacher?.user && (
                  <div className="gb-modal-meta__item">
                    <span>Docente</span><strong>{assessment.teacher.user.firstName} {assessment.teacher.user.lastName}</strong>
                  </div>
                )}
              </div>

              <div className="gb-modal-kpis">
                <div className="gb-drawer-kpi"><span>Promedio</span><strong style={{ color: colorNota(avgGrade) }}>{formatearNota(avgGrade)}</strong></div>
                <div className="gb-drawer-kpi"><span>Aprobacion</span><strong>{approvalRate}%</strong></div>
                <div className="gb-drawer-kpi"><span>Aprobados</span><strong style={{ color: "var(--success)" }}>{approved}</strong></div>
                <div className="gb-drawer-kpi"><span>Bajo 4.0</span><strong style={{ color: "var(--danger)" }}>{below4}</strong></div>
                <div className="gb-drawer-kpi"><span>Pendientes</span><strong style={{ color: "var(--warning)" }}>{pending}</strong></div>
              </div>

              <h4 style={{ marginTop: 16, marginBottom: 8 }}>Resultados por Estudiante ({studentResults.length})</h4>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>#</th><th>Estudiante</th><th>Nota</th><th>Estado</th></tr></thead>
                  <tbody>
                    {studentResults.map((s: { studentId: string; firstName: string; lastName: string; grade: number | null }, i: number) => (
                      <tr key={s.studentId}>
                        <td>{i + 1}</td>
                        <td><strong>{s.lastName}, {s.firstName}</strong></td>
                        <td style={{ fontWeight: 700, color: colorNota(s.grade), fontSize: "1rem" }}>{formatearNota(s.grade)}</td>
                        <td>
                          {s.grade === null ? (
                            <span className="badge badge--warning">Pendiente</span>
                          ) : s.grade < 4.0 ? (
                            <span className="badge badge--inactive">En Riesgo</span>
                          ) : (
                            <span className="badge badge--active">Aprobado</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {assessment?.questions && assessment.questions.length > 0 && (
                <>
                  <h4 style={{ marginTop: 16, marginBottom: 8 }}>Preguntas ({assessment.questions.length})</h4>
                  <div className="table-wrap">
                    <table className="table">
                      <thead><tr><th>#</th><th>Enunciado</th><th>Tipo</th><th>Puntos</th></tr></thead>
                      <tbody>
                        {assessment.questions.map((q, i) => (
                          <tr key={q.questionId}>
                            <td>{i + 1}</td>
                            <td style={{ fontSize: ".84rem" }}>{q.question?.statement?.slice(0, 80)}{(q.question?.statement?.length || 0) > 80 ? "..." : ""}</td>
                            <td><span className="badge badge--role">{q.question?.type?.replace("_", " ") || "\u2014"}</span></td>
                            <td style={{ textAlign: "center", fontWeight: 600 }}>{q.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
