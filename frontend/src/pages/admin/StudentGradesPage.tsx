import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { AdminOverview, GradeRecordRow } from "../../types/api";
import { api } from "../../lib/api";
import { KpiCard } from "../../components/common/KpiCard";
import { VoiceTextarea } from "../../components/voice/VoiceTextarea";

interface Props {
  overview: AdminOverview;
}

export function StudentGradesPage({ overview }: Props) {
  const [studentId, setStudentId] = useState(overview.students[0]?.student_id || "");
  const [semester, setSemester] = useState<"all" | "1" | "2">("all");
  const [drafts, setDrafts] = useState<Record<string, { grade: number; comments: string }>>({});
  const [message, setMessage] = useState("");

  const gradesQuery = useQuery({
    queryKey: ["admin-student-grades", studentId],
    queryFn: () => api.studentGrades(studentId),
    enabled: Boolean(studentId)
  });

  const updateGrade = useMutation({
    mutationFn: ({ gradeId, grade, comments }: { gradeId: string; grade: number; comments?: string }) =>
      api.updateGrade(gradeId, { grade, comments }),
    onSuccess: () => {
      setMessage("Nota actualizada correctamente.");
      gradesQuery.refetch();
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "No fue posible actualizar la nota")
  });

  useEffect(() => {
    if (!gradesQuery.data) return;
    const next: Record<string, { grade: number; comments: string }> = {};
    gradesQuery.data.forEach((row) => {
      if (row.grade_id) next[row.grade_id] = { grade: row.grade, comments: row.comments || "" };
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

  function saveGrade(row: GradeRecordRow) {
    if (!row.grade_id) {
      setMessage("Esta nota no tiene identificador editable.");
      return;
    }
    const draft = drafts[row.grade_id];
    if (!draft || Number.isNaN(Number(draft.grade)) || draft.grade < 0 || draft.grade > 7) {
      setMessage("La nota debe estar entre 0.0 y 7.0.");
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
            {overview.students.map((student) => (
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
        {message ? <p>{message}</p> : null}
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
              {filteredGrades.map((row) => (
                <tr key={row.grade_id || row.assessment_id}>
                  <td>{row.applied_at}</td>
                  <td>{row.semester ?? "-"}</td>
                  <td>{row.subject}</td>
                  <td>{row.title}</td>
                  <td>{row.assessment_type}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      max="7"
                      step="0.1"
                      value={row.grade_id ? drafts[row.grade_id]?.grade ?? row.grade : row.grade}
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
