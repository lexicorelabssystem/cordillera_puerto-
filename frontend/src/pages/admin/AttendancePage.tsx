import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useOutletContext } from "react-router-dom";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { useToast } from "../../components/common/Toast";
import type { AdminOverview, AuthUser } from "../../types/api";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "JUSTIFIED" | "EXCUSED";

interface StudentRow {
  studentId: string;
  name: string;
  rut: string | null;
  status: AttendanceStatus;
  saved: boolean;
}

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; className: string }> = {
  PRESENT:   { label: "Presente",   className: "att-status--present" },
  ABSENT:    { label: "Ausente",    className: "att-status--absent" },
  LATE:      { label: "Atrasado",   className: "att-status--late" },
  JUSTIFIED: { label: "Justificado",className: "att-status--justified" },
  EXCUSED:   { label: "Exonerado",  className: "att-status--excused" },
};

const STATUSES: AttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "JUSTIFIED", "EXCUSED"];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AttendancePage() {
  const { overview } = useOutletContext<{ overview: AdminOverview; user: AuthUser }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [courseId, setCourseId] = useState<string>("");
  const [date, setDate] = useState<string>(todayStr());
  const [studentRows, setStudentRows] = useState<StudentRow[]>([]);
  const [dirty, setDirty] = useState(false);

  const courses = useMemo(() => overview.courses ?? [], [overview.courses]);

  const studentsQuery = useQuery({
    queryKey: ["course-students", courseId],
    queryFn: () => api.getCourseStudents(courseId),
    enabled: Boolean(courseId),
  });

  const attendanceQuery = useQuery({
    queryKey: ["attendance", courseId, date],
    queryFn: () => api.listAttendance({ courseId, date }),
    enabled: Boolean(courseId),
  });

  const bulkMutation = useMutation({
    mutationFn: (items: { studentId: string; status: string }[]) =>
      api.bulkAttendance({ courseId, date, items }),
    onSuccess: (data) => {
      toast(`Asistencia guardada: ${data.succeeded} OK${data.failed > 0 ? `, ${data.failed} errores` : ""}`, data.failed > 0 ? "warning" : "success");
      queryClient.invalidateQueries({ queryKey: ["attendance", courseId, date] });
      setDirty(false);
      setStudentRows((prev) => prev.map((r) => ({ ...r, saved: true })));
    },
    onError: () => toast("Error al guardar asistencia", "error"),
  });

  // Merge students + existing attendance when data loads
  const merged = useMemo(() => {
    const students: any[] = studentsQuery.data ?? [];
    const records: any[] = attendanceQuery.data ?? [];
    const recordMap = new Map(records.map((r: any) => [r.studentId ?? r.student?.id, r]));

    return students.map((s: any) => {
      const studentId = s.studentId ?? s.student?.id ?? s.id;
      const name = s.student
        ? `${s.student.firstName} ${s.student.lastName}`
        : `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim();
      const rut = s.student?.rut ?? s.rut ?? null;
      const existing = recordMap.get(studentId);
      return {
        studentId,
        name,
        rut,
        status: (existing?.status as AttendanceStatus) ?? "PRESENT",
        saved: Boolean(existing),
      } as StudentRow;
    });
  }, [studentsQuery.data, attendanceQuery.data]);

  // Sync merged to state when it changes and we're not dirty
  const mergedKey = JSON.stringify(merged.map((r) => `${r.studentId}:${r.status}`));
  const [lastMergedKey, setLastMergedKey] = useState("");
  if (mergedKey !== lastMergedKey && !dirty && merged.length > 0) {
    setLastMergedKey(mergedKey);
    setStudentRows(merged);
  }

  function setStatus(studentId: string, status: AttendanceStatus) {
    setStudentRows((prev) =>
      prev.map((r) => (r.studentId === studentId ? { ...r, status, saved: false } : r)),
    );
    setDirty(true);
  }

  function setAll(status: AttendanceStatus) {
    setStudentRows((prev) => prev.map((r) => ({ ...r, status, saved: false })));
    setDirty(true);
  }

  function handleSave() {
    const items = studentRows.map((r) => ({ studentId: r.studentId, status: r.status }));
    bulkMutation.mutate(items);
  }

  const stats = useMemo(() => {
    const total = studentRows.length;
    if (!total) return null;
    const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, JUSTIFIED: 0, EXCUSED: 0 };
    studentRows.forEach((r) => counts[r.status]++);
    return { total, ...counts };
  }, [studentRows]);

  if (!overview) return <LoadingSpinner />;

  return (
    <div className="attendance-page">
      <header className="libro-header-v2">
        <div className="libro-header-v2__inner">
          <div className="libro-header-v2__title">
            <div className="libro-header-v2__icon">📋</div>
            <div>
              <h1 className="libro-header-v2__heading">Asistencia</h1>
              <p className="libro-header-v2__sub">Registro diario por curso</p>
            </div>
          </div>
        </div>
      </header>

      <div className="att-controls">
        <select
          className="att-select"
          value={courseId}
          onChange={(e) => { setCourseId(e.target.value); setDirty(false); }}
        >
          <option value="">Seleccionar curso...</option>
          {courses.map((c: any) => (
            <option key={c.id} value={c.id}>
              {c.name ?? `${c.gradeLevel}° ${c.section ?? ""}`.trim()}
            </option>
          ))}
        </select>

        <input
          className="att-date"
          type="date"
          value={date}
          onChange={(e) => { setDate(e.target.value); setDirty(false); }}
        />

        {courseId && studentRows.length > 0 && (
          <div className="att-actions">
            <button className="att-btn att-btn--present" onClick={() => setAll("PRESENT")}>
              Todos Presentes
            </button>
            <button className="att-btn att-btn--absent" onClick={() => setAll("ABSENT")}>
              Todos Ausentes
            </button>
            <button
              className="att-btn att-btn--save"
              disabled={!dirty || bulkMutation.isPending}
              onClick={handleSave}
            >
              {bulkMutation.isPending ? "Guardando..." : "Guardar"}
            </button>
          </div>
        )}
      </div>

      {courseId && (
        <>
          {studentsQuery.isLoading ? (
            <LoadingSpinner label="Cargando alumnos..." />
          ) : studentRows.length === 0 ? (
            <div className="att-empty">No hay alumnos matriculados en este curso.</div>
          ) : (
            <>
              {stats && (
                <div className="att-stats">
                  {STATUSES.map((s) => (
                    <span key={s} className={`att-stat-badge ${STATUS_CONFIG[s].className}`}>
                      {STATUS_CONFIG[s].label}: {(stats as any)[s]}
                    </span>
                  ))}
                </div>
              )}

              <div className="att-table-wrap">
                <table className="att-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Alumno</th>
                      <th>RUT</th>
                      {STATUSES.map((s) => (
                        <th key={s} className={STATUS_CONFIG[s].className}>{STATUS_CONFIG[s].label[0]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {studentRows.map((row, idx) => (
                      <tr key={row.studentId} className={row.saved ? "" : "att-row--dirty"}>
                        <td>{idx + 1}</td>
                        <td>{row.name}</td>
                        <td className="att-rut">{row.rut ?? "—"}</td>
                        {STATUSES.map((s) => (
                          <td key={s} className="att-radio-cell">
                            <input
                              type="radio"
                              name={`student-${row.studentId}`}
                              checked={row.status === s}
                              onChange={() => setStatus(row.studentId, s)}
                              className={`att-radio ${STATUS_CONFIG[s].className}`}
                            />
                          </td>
                        ))}
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
  );
}
