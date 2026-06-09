import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { AdminOverview } from "../../types/api";
import { api } from "../../lib/api";
import { KpiCard } from "../../components/common/KpiCard";
import { VoiceTextarea } from "../../components/voice/VoiceTextarea";
import { useToast } from "../../components/common/Toast";
import { useInstitution } from "../../app/InstitutionContext";

interface Props {
  overview: AdminOverview;
}

type OverviewStudentRow = AdminOverview["students"][number];
type StudentGradeRow = {
  grade_id?: string;
  assessment_id: string;
  title: string;
  subject: string;
  course?: string;
  teacher?: string;
  assessment_type: string;
  status?: string;
  semester?: number;
  applied_at: string;
  grade: number | null;
  comments: string | null;
  period?: string | null;
};

function getStringField(row: unknown, snake: string, camel: string): string {
  const value = (row as Record<string, unknown> | undefined)?.[snake] ?? (row as Record<string, unknown> | undefined)?.[camel];
  return typeof value === "string" ? value : "";
}

function formatGrade(value: number | null): string {
  if (value === null || value === undefined) return "Pendiente";
  return value.toFixed(1).replace(".", ",");
}

export function StudentGradesPage({ overview }: Props) {
  const students = overview.students?.length ? overview.students : [];
  const [studentId, setStudentId] = useState(students[0]?.student_id || "");
  const [semester, setSemester] = useState<"all" | "1" | "2">("all");
  const [drafts, setDrafts] = useState<Record<string, { grade: number; comments: string }>>({});
  const { toast } = useToast();
  const { selectedInstitution } = useInstitution();
  const selectedStudent = students.find((student: OverviewStudentRow) => student.student_id === studentId);
  const selectedCourseId = getStringField(selectedStudent, "course_id", "courseId");

  const gradesQuery = useQuery<StudentGradeRow[]>({
    queryKey: ["admin-student-grades", studentId, selectedCourseId, selectedInstitution?.id],
    queryFn: async (): Promise<StudentGradeRow[]> => {
      if (!studentId || !selectedCourseId) return [];
      const book = await api.getCourseGradeBook(selectedCourseId);
      const student = book.students.find((row) => row.studentId === studentId);
      if (!student) return [];
      return student.grades.map((grade) => ({
        grade_id: grade.gradeId || undefined,
        assessment_id: grade.assessmentId,
        title: grade.assessmentTitle,
        subject: grade.subjectName || "Sin asignatura",
        course: book.course.name,
        assessment_type: grade.assessmentType,
        status: grade.status,
        semester: grade.semester,
        applied_at: "",
        grade: grade.grade,
        comments: "",
      }));
    },
    enabled: Boolean(studentId) && Boolean(selectedCourseId),
  });

  const updateGrade = useMutation({
    mutationFn: ({ gradeId, grade, comments }: { gradeId: string; grade: number; comments?: string }) =>
      api.updateGrade(gradeId, { grade, comments }),
    onSuccess: () => {
      toast("Nota actualizada correctamente.", "success");
      gradesQuery.refetch();
    },
    onError: (error) => toast(error instanceof Error ? error.message : "No fue posible actualizar la nota", "error")
  });

  useEffect(() => {
    if (!gradesQuery.data) return;
    const next: Record<string, { grade: number; comments: string }> = {};
    gradesQuery.data.forEach((row) => {
      if (row.grade_id && row.grade !== null) next[row.grade_id] = { grade: row.grade, comments: row.comments || "" };
    });
    setDrafts(next);
  }, [gradesQuery.data]);

  const filteredGrades = (gradesQuery.data || []).filter((row) => {
    if (semester === "all") return true;
    return String(row.semester || "") === semester;
  });

  const semesterSummary = [1, 2].map((item) => {
    const rows = (gradesQuery.data || []).filter((row) => row.semester === item);
    const avg = rows.length ? rows.reduce((sum, row) => sum + Number(row.grade), 0) / rows.length : 0;
    return { semester: item, total: rows.length, avg: Number(avg.toFixed(2)) };
  });

  function saveGrade(row: StudentGradeRow) {
    if (!row.grade_id) {
      toast("Esta nota no tiene identificador editable.", "warning");
      return;
    }
    const draft = drafts[row.grade_id];
    if (!draft || Number.isNaN(Number(draft.grade)) || draft.grade < 1 || draft.grade > 7) {
      toast("La nota debe estar entre 1.0 y 7.0.", "warning");
      return;
    }
    updateGrade.mutate({
      gradeId: row.grade_id,
      grade: Number(draft.grade),
      comments: draft.comments
    });
  }

  return (
    <>
      <section className="panel">
        <h3>Detalle de notas por alumno y semestre</h3>
        <div className="form-row">
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            {students.map((student: OverviewStudentRow) => (
              <option key={student.student_id} value={student.student_id}>
                {student.first_name} {student.last_name} - {student.course_name || "Sin curso"}
              </option>
            ))}
          </select>
          <select value={semester} onChange={(e) => setSemester(e.target.value as "all" | "1" | "2")}>
            <option value="all">Todos los semestres</option>
            <option value="1">Semestre 1</option>
            <option value="2">Semestre 2</option>
          </select>
        </div>
      </section>
      <section className="kpi-grid">
        {semesterSummary.map((item) => (
          <KpiCard
            key={item.semester}
            label={`Semestre ${item.semester}`}
            value={item.total ? `${item.avg} (${item.total} notas)` : "Sin notas"}
          />
        ))}
      </section>
      <section className="panel">
        <h3>Evaluaciones del alumno</h3>
        {gradesQuery.isLoading ? <p>Cargando notas...</p> : null}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>N&deg;</th>
                <th>Fecha</th>
                <th>Semestre</th>
                <th>Asignatura</th>
                <th>Evaluacion</th>
                <th>Tipo</th>
                <th>Nota</th>
                <th>Comentario</th>
                <th>Accion</th>
              </tr>
            </thead>
            <tbody>
              {filteredGrades.map((row, index) => (
                <tr key={row.grade_id || row.assessment_id}>
                  <td>{index + 1}</td>
                  <td>{row.applied_at || "—"}</td>
                  <td>{row.semester ?? "-"}</td>
                  <td>{row.subject}</td>
                  <td>{row.title}</td>
                  <td>{row.assessment_type}</td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      max="7"
                      step="0.1"
                      value={row.grade_id ? drafts[row.grade_id]?.grade ?? row.grade ?? "" : ""}
                      placeholder={formatGrade(row.grade)}
                      onChange={(e) => {
                        if (!row.grade_id) return;
                        setDrafts((prev) => ({
                          ...prev,
                          [row.grade_id!]: {
                            grade: Number(e.target.value),
                            comments: prev[row.grade_id!]?.comments || row.comments || ""
                          }
                        }));
                      }}
                      disabled={!row.grade_id}
                    />
                  </td>
                  <td style={{ minWidth: 200 }}>
                    <VoiceTextarea
                      value={row.grade_id ? drafts[row.grade_id]?.comments ?? "" : row.comments || ""}
                      onChange={(text) => {
                        if (!row.grade_id) return;
                        setDrafts((prev) => ({
                          ...prev,
                          [row.grade_id!]: {
                            grade: prev[row.grade_id!]?.grade ?? row.grade,
                            comments: text
                          }
                        }));
                      }}
                      placeholder="Comentario..."
                      rows={1}
                      label="Comentario de nota"
                    />
                  </td>
                  <td>
                    <button onClick={() => saveGrade(row)} disabled={updateGrade.isPending || !row.grade_id}>
                      Guardar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
