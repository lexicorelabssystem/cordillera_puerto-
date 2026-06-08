import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useInstitution } from "../../app/InstitutionContext";
import { useToast } from "../../components/common/Toast";
import type { AdminCourseRow, AdminSubject, AcademicYear, CourseStudentRow } from "../../types/api";

type ReportType = "INSTITUTIONAL" | "COURSE" | "STUDENT" | "OA" | "RISK";

type GeneratedReport = {
  id: string;
  type: ReportType | string;
  status: string;
  format: string;
  generatedAt: string | null;
  filters: Record<string, unknown> | null;
};

type ReportResult = {
  reportId: string;
  type: ReportType;
  generatedAt: string;
  courseAverage?: number;
  institutionalAverage?: number;
  overallAverage?: number;
  totalStudents?: number;
  totalAtRisk?: number;
  atRiskCount?: number;
  objectiveCount?: number;
  lowAchievementCount?: number;
  assessmentCount?: number;
  students?: unknown[];
  courses?: unknown[];
  objectives?: unknown[];
};

const REPORT_TYPES: {
  type: ReportType;
  label: string;
  description: string;
  scope: string;
}[] = [
  {
    type: "INSTITUTIONAL",
    label: "Global institucional",
    description: "Promedios, cursos, estudiantes y riesgo de toda la institucion.",
    scope: "Super admin, UTP y direccion",
  },
  {
    type: "COURSE",
    label: "Notas por curso",
    description: "Consolidado de notas, promedios y estudiantes en riesgo por curso.",
    scope: "Directivos, UTP y docentes asignados",
  },
  {
    type: "STUDENT",
    label: "Ficha por alumno",
    description: "Historial individual de notas, asignaturas, OA y recomendaciones.",
    scope: "Directivos, UTP y docentes con acceso",
  },
  {
    type: "OA",
    label: "Logro por OA",
    description: "Logro por objetivo de aprendizaje, curso, asignatura y alumno.",
    scope: "Directivos, UTP y docentes asignados",
  },
  {
    type: "RISK",
    label: "Alumnos en riesgo",
    description: "Listado filtrado de alumnos bajo la nota de corte seleccionada.",
    scope: "Directivos, UTP y docentes asignados",
  },
];

function getCourseId(course: AdminCourseRow) {
  return course.course_id;
}

function getCourseName(course: AdminCourseRow) {
  return course.course_name;
}

function compactFilters(filters: Record<string, unknown> | null) {
  if (!filters) return "-";
  const entries = Object.entries(filters).filter(([key, value]) => key !== "summary" && value != null && value !== "");
  return entries.length ? entries.map(([key, value]) => `${key}: ${String(value)}`).join(" | ") : "-";
}

export function ReportsPage() {
  const queryClient = useQueryClient();
  const { selectedInstitution } = useInstitution();
  const { toast } = useToast();
  const [type, setType] = useState<ReportType>("INSTITUTIONAL");
  const [academicYearId, setAcademicYearId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [learningObjectiveId, setLearningObjectiveId] = useState("");
  const [threshold, setThreshold] = useState("4.0");
  const [lastResult, setLastResult] = useState<ReportResult | null>(null);

  const coursesQuery = useQuery({
    queryKey: ["reports-courses", selectedInstitution?.id, academicYearId],
    queryFn: () => api.listCourses({
      institutionId: selectedInstitution?.id,
      academicYearId: academicYearId || undefined,
    }) as Promise<AdminCourseRow[]>,
    enabled: Boolean(selectedInstitution?.id),
  });

  const subjectsQuery = useQuery({
    queryKey: ["reports-subjects"],
    queryFn: () => api.listSubjects() as Promise<AdminSubject[]>,
  });

  const yearsQuery = useQuery({
    queryKey: ["reports-academic-years", selectedInstitution?.id],
    queryFn: () => api.listAcademicYears(selectedInstitution?.id || "") as Promise<AcademicYear[]>,
    enabled: Boolean(selectedInstitution?.id),
  });

  const studentsQuery = useQuery({
    queryKey: ["reports-students", courseId],
    queryFn: () => api.listStudents({ courseId, limit: 200 }).then((r) => r.data as CourseStudentRow[]),
    enabled: Boolean(courseId),
  });

  const selectedCourse = coursesQuery.data?.find((course) => getCourseId(course) === courseId);
  const selectedGradeLevel = selectedCourse?.grade_level;

  const objectivesQuery = useQuery({
    queryKey: ["reports-objectives", subjectId, selectedGradeLevel],
    queryFn: () => api.listLearningObjectives({
      subjectId: subjectId || undefined,
      gradeLevel: selectedGradeLevel,
    }),
    enabled: type === "OA" && Boolean(subjectId || selectedGradeLevel),
  });

  const reportsQuery = useQuery({
    queryKey: ["reports-list", type],
    queryFn: () => api.listReports({ limit: 20, type }) as Promise<GeneratedReport[]>,
  });

  const selectedConfig = REPORT_TYPES.find((item) => item.type === type) ?? REPORT_TYPES[0];
  const requiresCourse = type === "COURSE" || type === "STUDENT";
  const requiresStudent = type === "STUDENT";
  const canUseSubject = type === "COURSE" || type === "OA" || type === "RISK";
  const canUseCourse = type !== "INSTITUTIONAL";
  const canUseObjective = type === "OA";
  const canUseThreshold = type === "RISK";

  const validationMessage = useMemo(() => {
    if (!selectedInstitution?.id && (type === "INSTITUTIONAL" || !courseId)) return "Selecciona una institucion.";
    if (requiresCourse && !courseId) return "Selecciona un curso.";
    if (requiresStudent && !studentId) return "Selecciona un alumno.";
    return "";
  }, [courseId, requiresCourse, requiresStudent, selectedInstitution?.id, studentId, type]);

  const generateReport = useMutation({
    mutationFn: () => api.generateReport({
      type,
      institutionId: selectedInstitution?.id,
      academicYearId: academicYearId || undefined,
      courseId: courseId || undefined,
      subjectId: subjectId || undefined,
      studentId: studentId || undefined,
      learningObjectiveId: learningObjectiveId || undefined,
      threshold: canUseThreshold ? Number(threshold.replace(",", ".")) : undefined,
      format: "JSON",
    }) as Promise<ReportResult>,
    onSuccess: (result) => {
      setLastResult(result);
      toast("Reporte generado correctamente.", "success");
      queryClient.invalidateQueries({ queryKey: ["reports-list"] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Error al generar reporte.", "error"),
  });

  const reports = reportsQuery.data || [];

  return (
    <>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Reportes pedagogicos</h3>
            <p>Genera informes globales y filtrados por curso, alumno, asignatura, OA y riesgo academico.</p>
          </div>
        </div>

        <div className="module-grid">
          {REPORT_TYPES.map((report) => (
            <button
              key={report.type}
              type="button"
              className={`module-card ${type === report.type ? "module-card--selected" : ""}`}
              onClick={() => {
                setType(report.type);
                setLastResult(null);
                if (report.type === "INSTITUTIONAL") {
                  setCourseId("");
                  setStudentId("");
                  setLearningObjectiveId("");
                }
              }}
              style={{ textAlign: "left" }}
            >
              <strong>{report.label}</strong>
              <small>{report.description}</small>
              <span className="badge badge--role">{report.scope}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>{selectedConfig.label}</h3>
            <p>{selectedConfig.description}</p>
          </div>
          <button
            type="button"
            className="btn-small"
            onClick={() => generateReport.mutate()}
            disabled={Boolean(validationMessage) || generateReport.isPending}
          >
            {generateReport.isPending ? "Generando..." : "Generar informe"}
          </button>
        </div>

        <div className="form-grid">
          <label className="form-field">
            Ano academico
            <select value={academicYearId} onChange={(event) => setAcademicYearId(event.target.value)}>
              <option value="">Todos</option>
              {(yearsQuery.data || []).map((year) => (
                <option key={year.id} value={year.id}>{year.year}{year.isActive ? " (activo)" : ""}</option>
              ))}
            </select>
          </label>

          {canUseCourse ? (
            <label className="form-field">
              Curso
              <select
                value={courseId}
                onChange={(event) => {
                  setCourseId(event.target.value);
                  setStudentId("");
                  setLearningObjectiveId("");
                }}
              >
                <option value="">{type === "OA" || type === "RISK" ? "Todos los cursos" : "Seleccionar curso"}</option>
                {(coursesQuery.data || []).map((course) => (
                  <option key={getCourseId(course)} value={getCourseId(course)}>{getCourseName(course)}</option>
                ))}
              </select>
            </label>
          ) : null}

          {canUseSubject ? (
            <label className="form-field">
              Asignatura
              <select
                value={subjectId}
                onChange={(event) => {
                  setSubjectId(event.target.value);
                  setLearningObjectiveId("");
                }}
              >
                <option value="">Todas</option>
                {(subjectsQuery.data || []).map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
            </label>
          ) : null}

          {requiresStudent ? (
            <label className="form-field">
              Alumno
              <select value={studentId} onChange={(event) => setStudentId(event.target.value)} disabled={!courseId}>
                <option value="">Seleccionar alumno</option>
                {(studentsQuery.data || []).map((student) => (
                  <option key={student.student_id} value={student.student_id}>
                    {student.last_name}, {student.first_name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {canUseObjective ? (
            <label className="form-field">
              Objetivo de aprendizaje
              <select value={learningObjectiveId} onChange={(event) => setLearningObjectiveId(event.target.value)}>
                <option value="">Todos los OA disponibles</option>
                {(objectivesQuery.data || []).map((objective) => (
                  <option key={objective.id} value={objective.id}>{objective.code} - {objective.description}</option>
                ))}
              </select>
            </label>
          ) : null}

          {canUseThreshold ? (
            <label className="form-field">
              Corte de riesgo
              <input value={threshold} onChange={(event) => setThreshold(event.target.value)} />
            </label>
          ) : null}
        </div>

        {validationMessage ? <p className="panel-error" style={{ marginTop: 12 }}>{validationMessage}</p> : null}
      </section>

      {lastResult ? (
        <section className="panel">
          <h3>Resultado generado</h3>
          <div className="kpi-grid">
            <div className="kpi-card"><span>Promedio</span><strong>{lastResult.courseAverage ?? lastResult.institutionalAverage ?? lastResult.overallAverage ?? "-"}</strong></div>
            <div className="kpi-card"><span>Alumnos</span><strong>{lastResult.totalStudents ?? lastResult.students?.length ?? "-"}</strong></div>
            <div className="kpi-card"><span>Riesgo</span><strong>{lastResult.totalAtRisk ?? lastResult.atRiskCount ?? lastResult.lowAchievementCount ?? "-"}</strong></div>
            <div className="kpi-card"><span>Evaluaciones</span><strong>{lastResult.assessmentCount ?? "-"}</strong></div>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <h3>Reportes generados ({reports.length})</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Tipo</th><th>Formato</th><th>Filtros</th><th>Estado</th><th>Fecha</th></tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td><strong>{REPORT_TYPES.find((item) => item.type === report.type)?.label || report.type}</strong></td>
                  <td><span className="badge badge--role">{report.format}</span></td>
                  <td style={{ fontSize: ".78rem" }}>{compactFilters(report.filters)}</td>
                  <td><span className={`badge ${report.status === "GENERATED" ? "badge--active" : "badge--warning"}`}>{report.status}</span></td>
                  <td style={{ whiteSpace: "nowrap" }}>{report.generatedAt ? new Date(report.generatedAt).toLocaleDateString("es-CL") : "-"}</td>
                </tr>
              ))}
              {!reports.length ? (
                <tr><td colSpan={5}>No hay reportes generados para este tipo.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
