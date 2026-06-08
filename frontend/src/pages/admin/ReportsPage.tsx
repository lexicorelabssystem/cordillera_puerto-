import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { api } from "../../lib/api";
import { useInstitution } from "../../app/InstitutionContext";
import { useToast } from "../../components/common/Toast";
import type { AdminCourseRow, AdminSubject, AcademicYear, CourseStudentRow } from "../../types/api";

type ReportType = "INSTITUTIONAL" | "COURSE" | "STUDENT" | "OA" | "RISK";

type ReportStudentOption = CourseStudentRow & {
  id?: string;
  firstName?: string;
  lastName?: string;
};

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
  course?: Record<string, unknown>;
  student?: Record<string, unknown>;
  institution?: Record<string, unknown>;
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
  subjects?: unknown[];
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

function getStudentId(student: ReportStudentOption) {
  return student.student_id ?? student.id ?? "";
}

function getStudentFirstName(student: ReportStudentOption) {
  return student.first_name ?? student.firstName ?? "";
}

function getStudentLastName(student: ReportStudentOption) {
  return student.last_name ?? student.lastName ?? "";
}

function getStudentLabel(student: ReportStudentOption) {
  const firstName = getStudentFirstName(student);
  const lastName = getStudentLastName(student);
  return [lastName, firstName].filter(Boolean).join(", ") || "Alumno sin nombre";
}

function compactFilters(filters: Record<string, unknown> | null) {
  if (!filters) return "-";
  const entries = Object.entries(filters).filter(([key, value]) => key !== "summary" && value != null && value !== "");
  return entries.length ? entries.map(([key, value]) => `${key}: ${String(value)}`).join(" | ") : "-";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function reportSummary(report: GeneratedReport): ReportResult | null {
  const filters = asRecord(report.filters);
  const summary = asRecord(filters.summary);
  const legacy = filters.type ? filters : null;
  const data = Object.keys(summary).length ? summary : legacy;
  return data ? { reportId: report.id, ...data } as ReportResult : null;
}

function text(value: unknown) {
  if (value == null || value === "") return "";
  return String(value);
}

function csvValue(value: unknown) {
  const raw = text(value).replace(/\r?\n/g, " ");
  return /[",;]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

function downloadFile(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildCsvRows(report: ReportResult): Record<string, unknown>[] {
  if (report.type === "COURSE") {
    const course = asRecord(report.course);
    const rows: Record<string, unknown>[] = [];
    for (const student of asArray(report.students)) {
      const grades = asArray(student.grades);
      if (!grades.length) {
        rows.push({
          curso: course.name,
          alumno: student.name,
          promedio_alumno: student.average,
          nivel: student.level,
          evaluacion: "",
          asignatura: "",
          nota: "",
          porcentaje: "",
          puntaje: "",
          comentarios: "",
          fecha_registro: "",
        });
      }
      for (const grade of grades) {
        rows.push({
          curso: course.name,
          alumno: student.name,
          promedio_alumno: student.average,
          nivel: student.level,
          evaluacion: grade.assessmentTitle,
          asignatura: grade.subjectName,
          nota: grade.grade,
          porcentaje: grade.percentage,
          puntaje: grade.score,
          comentarios: grade.comments,
          fecha_registro: grade.recordedAt,
        });
      }
    }
    return rows;
  }

  if (report.type === "STUDENT") {
    const student = asRecord(report.student);
    const course = asRecord(report.course);
    const rows: Record<string, unknown>[] = [];
    for (const subject of asArray(report.subjects)) {
      for (const grade of asArray(subject.grades)) {
        rows.push({
          alumno: student.name,
          curso: course.name,
          asignatura: subject.subjectName,
          promedio_asignatura: subject.average,
          evaluacion: grade.title,
          periodo: grade.periodName,
          nota: grade.grade,
          porcentaje: grade.percentage,
        });
      }
    }
    return rows;
  }

  if (report.type === "INSTITUTIONAL") {
    return asArray(report.courses).map((course) => ({
      curso: course.courseName,
      nivel: course.gradeLevel,
      ano: course.year,
      alumnos: course.students,
      evaluaciones: course.assessments,
      promedio: course.average,
      nivel_logro: course.level,
      alumnos_riesgo: course.atRiskCount,
    }));
  }

  if (report.type === "RISK") {
    return asArray(report.students).map((student) => ({
      alumno: student.studentName,
      curso: student.courseName,
      promedio: student.average,
      nivel: student.level,
      notas: student.gradeCount,
      asignaturas: asArray(student.subjects).map((subject) => `${text(subject.subjectName)} ${text(subject.average)}`).join(" | "),
    }));
  }

  if (report.type === "OA") {
    return asArray(report.objectives).map((objective) => ({
      oa: objective.code,
      descripcion: objective.description,
      nivel: objective.gradeLevel,
      respuestas: objective.totalAnswers,
      correctas: objective.correctAnswers,
      logro: objective.achievement,
      cursos: asArray(objective.courses).map((course) => `${text(course.courseName)} ${text(course.achievement)}%`).join(" | "),
    }));
  }

  return [];
}

function downloadCsv(report: ReportResult) {
  const rows = buildCsvRows(report);
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(";"),
    ...rows.map((row) => headers.map((header) => csvValue(row[header])).join(";")),
  ].join("\n");
  downloadFile(`reporte-${report.type.toLowerCase()}-${report.reportId}.csv`, csv, "text/csv;charset=utf-8");
}

function downloadJson(report: ReportResult) {
  downloadFile(
    `reporte-${report.type.toLowerCase()}-${report.reportId}.json`,
    JSON.stringify(report, null, 2),
    "application/json;charset=utf-8",
  );
}

function reportTitle(type: ReportType | string) {
  return REPORT_TYPES.find((item) => item.type === type)?.label || `Reporte ${type}`;
}

function reportSummaryRows(report: ReportResult): Record<string, string>[] {
  const course = asRecord(report.course);
  const student = asRecord(report.student);
  const institution = asRecord(report.institution);
  const rows = [
    { indicador: "Tipo", valor: reportTitle(report.type) },
    { indicador: "Institucion", valor: text(institution.name) || "-" },
    { indicador: "Curso", valor: text(course.name) || "-" },
    { indicador: "Alumno", valor: text(student.name) || "-" },
    { indicador: "Promedio", valor: text(report.courseAverage ?? report.institutionalAverage ?? report.overallAverage) || "-" },
    { indicador: "Alumnos", valor: text(report.totalStudents ?? asArray(report.students).length) || "-" },
    { indicador: "Riesgo", valor: text(report.totalAtRisk ?? report.atRiskCount ?? report.lowAchievementCount) || "-" },
    { indicador: "Evaluaciones", valor: text(report.assessmentCount) || "-" },
    { indicador: "Generado", valor: report.generatedAt ? new Date(report.generatedAt).toLocaleString("es-CL") : "-" },
  ];
  return rows.filter((row) => row.valor !== "-");
}

function labelFromKey(key: string) {
  const labels: Record<string, string> = {
    alumno: "Alumno",
    curso: "Curso",
    nivel: "Nivel",
    evaluacion: "Evaluacion",
    asignatura: "Asignatura",
    nota: "Nota",
    porcentaje: "%",
    puntaje: "Puntaje",
    comentarios: "Comentarios",
    fecha_registro: "Fecha",
    promedio_alumno: "Promedio alumno",
    promedio_asignatura: "Promedio asignatura",
    periodo: "Periodo",
    alumnos: "Alumnos",
    evaluaciones: "Evaluaciones",
    promedio: "Promedio",
    nivel_logro: "Nivel logro",
    alumnos_riesgo: "Alumnos riesgo",
    notas: "Notas",
    asignaturas: "Asignaturas",
    oa: "OA",
    descripcion: "Descripcion",
    respuestas: "Respuestas",
    correctas: "Correctas",
    logro: "Logro",
    cursos: "Cursos",
    ano: "Ano",
  };
  return labels[key] || key.replace(/_/g, " ");
}

function safeFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "reporte";
}

function downloadPdf(report: ReportResult) {
  const rows = buildCsvRows(report);
  const doc = new jsPDF("landscape", "mm", "a4");
  const title = reportTitle(report.type);
  const generatedAt = report.generatedAt ? new Date(report.generatedAt).toLocaleString("es-CL") : new Date().toLocaleString("es-CL");
  const pageWidth = doc.internal.pageSize.width;

  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(title, 14, 17);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Generado: ${generatedAt}`, 14, 24);

  doc.setTextColor(30, 64, 175);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Resumen", 14, 38);

  autoTable(doc, {
    columns: [
      { header: "Indicador", dataKey: "indicador" },
      { header: "Valor", dataKey: "valor" },
    ],
    body: reportSummaryRows(report),
    startY: 42,
    styles: { fontSize: 7.5, cellPadding: 2, lineColor: [220, 220, 220], lineWidth: 0.1 },
    headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      indicador: { cellWidth: 45, fontStyle: "bold" },
      valor: { cellWidth: 90 },
    },
    margin: { left: 14, right: 14 },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60;
  doc.setTextColor(30, 64, 175);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Detalle", 14, finalY + 10);

  if (rows.length) {
    const headers = Object.keys(rows[0]);
    autoTable(doc, {
      columns: headers.map((key) => ({ header: labelFromKey(key), dataKey: key })),
      body: rows.map((row) => Object.fromEntries(headers.map((key) => [key, text(row[key])]))),
      startY: finalY + 14,
      styles: { fontSize: headers.length > 7 ? 6.2 : 7, cellPadding: 1.8, lineColor: [220, 220, 220], lineWidth: 0.1, overflow: "linebreak" },
      headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontStyle: "bold", fontSize: headers.length > 7 ? 6 : 7 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
    });
  } else {
    doc.setTextColor(80, 80, 80);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("No hay filas de detalle para este informe.", 14, finalY + 18);
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);
    doc.text(`Cordillera SaaS - Pagina ${page} de ${pageCount}`, pageWidth / 2, doc.internal.pageSize.height - 8, { align: "center" });
  }

  doc.save(`${safeFileName(title)}-${report.reportId}.pdf`);
}

function ReportDetail({ report, onCsv, onJson, onPdf }: { report: ReportResult; onCsv: () => void; onJson: () => void; onPdf: () => void }) {
  const course = asRecord(report.course);
  const student = asRecord(report.student);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h3>Detalle del informe</h3>
          <p>
            {report.type === "COURSE" ? `Curso ${text(course.name)} | Promedio ${text(report.courseAverage)}` : null}
            {report.type === "STUDENT" ? `${text(student.name)} | Promedio ${text(report.overallAverage)}` : null}
            {report.type === "INSTITUTIONAL" ? `Promedio institucional ${text(report.institutionalAverage)}` : null}
            {report.type === "RISK" ? `${text(report.atRiskCount)} alumnos bajo el corte` : null}
            {report.type === "OA" ? `${text(report.objectiveCount)} objetivos analizados` : null}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn-small" onClick={onPdf}>Descargar PDF</button>
          <button type="button" className="btn-small" onClick={onCsv}>Descargar CSV</button>
          <button type="button" className="btn-small btn-secondary" onClick={onJson}>Descargar JSON</button>
        </div>
      </div>

      {report.type === "COURSE" ? <CourseReportTable report={report} /> : null}
      {report.type === "STUDENT" ? <StudentReportTable report={report} /> : null}
      {report.type === "INSTITUTIONAL" ? <InstitutionReportTable report={report} /> : null}
      {report.type === "RISK" ? <RiskReportTable report={report} /> : null}
      {report.type === "OA" ? <OaReportTable report={report} /> : null}
    </section>
  );
}

function CourseReportTable({ report }: { report: ReportResult }) {
  const rows = buildCsvRows(report);
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Alumno</th><th>Promedio</th><th>Evaluacion</th><th>Asignatura</th><th>Nota</th><th>%</th><th>Puntaje</th><th>Fecha</th></tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td><strong>{text(row.alumno)}</strong></td>
              <td>{text(row.promedio_alumno)}</td>
              <td>{text(row.evaluacion) || "Sin notas"}</td>
              <td>{text(row.asignatura)}</td>
              <td>{text(row.nota)}</td>
              <td>{text(row.porcentaje)}</td>
              <td>{text(row.puntaje)}</td>
              <td>{row.fecha_registro ? new Date(text(row.fecha_registro)).toLocaleDateString("es-CL") : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StudentReportTable({ report }: { report: ReportResult }) {
  const rows = buildCsvRows(report);
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Asignatura</th><th>Promedio</th><th>Evaluacion</th><th>Periodo</th><th>Nota</th><th>%</th></tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td><strong>{text(row.asignatura)}</strong></td>
              <td>{text(row.promedio_asignatura)}</td>
              <td>{text(row.evaluacion)}</td>
              <td>{text(row.periodo)}</td>
              <td>{text(row.nota)}</td>
              <td>{text(row.porcentaje)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InstitutionReportTable({ report }: { report: ReportResult }) {
  const rows = buildCsvRows(report);
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Curso</th><th>Alumnos</th><th>Evaluaciones</th><th>Promedio</th><th>Nivel</th><th>Riesgo</th></tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td><strong>{text(row.curso)}</strong></td>
              <td>{text(row.alumnos)}</td>
              <td>{text(row.evaluaciones)}</td>
              <td>{text(row.promedio)}</td>
              <td>{text(row.nivel_logro)}</td>
              <td>{text(row.alumnos_riesgo)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RiskReportTable({ report }: { report: ReportResult }) {
  const rows = buildCsvRows(report);
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Alumno</th><th>Curso</th><th>Promedio</th><th>Nivel</th><th>Notas</th><th>Asignaturas</th></tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td><strong>{text(row.alumno)}</strong></td>
              <td>{text(row.curso)}</td>
              <td>{text(row.promedio)}</td>
              <td>{text(row.nivel)}</td>
              <td>{text(row.notas)}</td>
              <td>{text(row.asignaturas)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OaReportTable({ report }: { report: ReportResult }) {
  const rows = buildCsvRows(report);
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>OA</th><th>Descripcion</th><th>Respuestas</th><th>Correctas</th><th>Logro</th><th>Cursos</th></tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td><strong>{text(row.oa)}</strong></td>
              <td>{text(row.descripcion)}</td>
              <td>{text(row.respuestas)}</td>
              <td>{text(row.correctas)}</td>
              <td>{text(row.logro)}%</td>
              <td>{text(row.cursos)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
  const [selectedReport, setSelectedReport] = useState<ReportResult | null>(null);

  const coursesQuery = useQuery({
    queryKey: ["reports-courses", selectedInstitution?.id, academicYearId],
    queryFn: () => api.listCourses({
      institutionId: selectedInstitution?.id || undefined,
      academicYearId: academicYearId || undefined,
    }) as Promise<AdminCourseRow[]>,
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
    queryFn: () => api.listStudents({ courseId, limit: 200 }).then((r) => r.data as ReportStudentOption[]),
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
    if (type === "INSTITUTIONAL" && !selectedInstitution?.id) return "Selecciona una institucion.";
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
      setSelectedReport(result);
      toast("Reporte generado correctamente.", "success");
      queryClient.invalidateQueries({ queryKey: ["reports-list"] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Error al generar reporte.", "error"),
  });

  const reports = reportsQuery.data || [];
  const formatFilters = (filters: Record<string, unknown> | null) => {
    const raw = asRecord(filters);
    const parts: string[] = [];
    if (raw.institutionId) parts.push(`Institucion: ${selectedInstitution?.name || text(raw.institutionId)}`);
    if (raw.academicYearId) {
      const year = (yearsQuery.data || []).find((item) => item.id === raw.academicYearId);
      parts.push(`Ano: ${year?.year || text(raw.academicYearId)}`);
    }
    if (raw.courseId) {
      const course = (coursesQuery.data || []).find((item) => getCourseId(item) === raw.courseId);
      parts.push(`Curso: ${course ? getCourseName(course) : text(raw.courseId)}`);
    }
    if (raw.subjectId) {
      const subject = (subjectsQuery.data || []).find((item) => item.id === raw.subjectId);
      parts.push(`Asignatura: ${subject?.name || text(raw.subjectId)}`);
    }
    if (raw.studentId) {
      const student = (studentsQuery.data || []).find((item) => getStudentId(item) === raw.studentId);
      parts.push(`Alumno: ${student ? getStudentLabel(student) : text(raw.studentId)}`);
    }
    if (raw.learningObjectiveId) {
      const objective = (objectivesQuery.data || []).find((item) => item.id === raw.learningObjectiveId);
      parts.push(`OA: ${objective?.code || text(raw.learningObjectiveId)}`);
    }
    if (raw.threshold) parts.push(`Corte: ${text(raw.threshold)}`);
    return parts.length ? parts.join(" | ") : compactFilters(filters);
  };

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
                setSelectedReport(null);
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
                  <option key={getStudentId(student)} value={getStudentId(student)}>
                    {getStudentLabel(student)}
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

      {selectedReport ? (
        <ReportDetail
          report={selectedReport}
          onCsv={() => downloadCsv(selectedReport)}
          onJson={() => downloadJson(selectedReport)}
          onPdf={() => downloadPdf(selectedReport)}
        />
      ) : null}

      <section className="panel">
        <h3>Reportes generados ({reports.length})</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Tipo</th><th>Formato</th><th>Filtros</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {reports.map((report) => {
                const summary = reportSummary(report);
                return (
                  <tr key={report.id}>
                    <td><strong>{REPORT_TYPES.find((item) => item.type === report.type)?.label || report.type}</strong></td>
                    <td><span className="badge badge--role">{report.format}</span></td>
                    <td style={{ fontSize: ".78rem" }}>{formatFilters(report.filters)}</td>
                    <td><span className={`badge ${report.status === "GENERATED" ? "badge--active" : "badge--warning"}`}>{report.status}</span></td>
                    <td style={{ whiteSpace: "nowrap" }}>{report.generatedAt ? new Date(report.generatedAt).toLocaleDateString("es-CL") : "-"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button type="button" className="btn-small" disabled={!summary} onClick={() => summary && setSelectedReport(summary)}>
                          Ver
                        </button>
                        <button type="button" className="btn-small" disabled={!summary} onClick={() => summary && downloadPdf(summary)}>
                          PDF
                        </button>
                        <button type="button" className="btn-small btn-secondary" disabled={!summary} onClick={() => summary && downloadCsv(summary)}>
                          CSV
                        </button>
                        <button type="button" className="btn-small btn-secondary" disabled={!summary} onClick={() => summary && downloadJson(summary)}>
                          JSON
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!reports.length ? (
                <tr><td colSpan={6}>No hay reportes generados para este tipo.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
