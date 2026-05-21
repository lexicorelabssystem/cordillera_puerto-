import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { LoadingSpinner } from "../common/LoadingSpinner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from "recharts";

interface Props {
  studentId: string;
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

export function StudentDetailDrawer({ studentId, courseId, onClose }: Props) {
  const studentQuery = useQuery({
    queryKey: ["student-detail", studentId],
    queryFn: () => api.getStudent(studentId),
  });

  const attendanceStatsQuery = useQuery({
    queryKey: ["attendance-stats", studentId],
    queryFn: () => api.getAttendanceStats(studentId),
  });

  const observationsQuery = useQuery({
    queryKey: ["observations-student", studentId],
    queryFn: () => api.listObservations({ studentId }),
  });

  const gradesQuery = useQuery({
    queryKey: ["grade-book", courseId],
    queryFn: () => api.getCourseGradeBook(courseId),
    enabled: Boolean(courseId),
  });

  const student = studentQuery.data as Record<string, unknown> | undefined;
  const attendanceStats = attendanceStatsQuery.data;
  const observations = (observationsQuery.data || []) as { id: string; title: string; type: string; content: string; createdAt: string; course: { name: string } }[];
  const book = gradesQuery.data;

  const studentGrades = book?.students?.find((s: { studentId: string }) => s.studentId === studentId);
  const avg = studentGrades?.average ?? null;
  const allGrades = studentGrades?.grades || [];

  const gradeHistory = [...allGrades]
    .filter((g: { grade: number | null }) => g.grade !== null)
    .sort((a, b) => 0)
    .map((g: { grade: number | null; assessmentTitle: string; assessmentType: string }, i: number) => ({
      index: i + 1,
      name: g.assessmentTitle?.slice(0, 15) || `Eval ${i + 1}`,
      nota: g.grade as number,
      tipo: g.assessmentType,
    }));

  const avgHistory = gradeHistory.reduce((acc: { index: number; promedio: number }[], _: { nota: number }, i: number) => {
    const slice = gradeHistory.slice(0, i + 1);
    const avg = slice.reduce((s: number, g: { nota: number }) => s + g.nota, 0) / slice.length;
    acc.push({ index: i + 1, promedio: Number(avg.toFixed(1)) });
    return acc;
  }, [] as { index: number; promedio: number }[]);

  const riskAlerts: string[] = [];
  if (avg !== null && avg < 4.0) riskAlerts.push("Promedio bajo 4.0 - Riesgo de repitencia");
  else if (avg !== null && avg < 4.5) riskAlerts.push("Promedio basico - Necesita refuerzo");
  if (attendanceStats?.atRisk) riskAlerts.push(`Asistencia bajo 85% (${attendanceStats.attendanceRate}%) - Alerta de inasistencia`);
  const pendientes = allGrades.filter((g) => g.grade === null).length;
  if (pendientes >= 3) riskAlerts.push(`${pendientes} evaluaciones pendientes`);
  if (gradeHistory.length >= 3) {
    const last3 = gradeHistory.slice(-3).map((g: { nota: number }) => g.nota);
    if (last3.length === 3 && last3[0]! > last3[1]! && last3[1]! > last3[2]!) {
      riskAlerts.push("Tendencia descendente en ultimas 3 evaluaciones");
    }
  }

  const courseAvg = book?.stats?.courseAvg ?? null;

  return (
    <div className="gb-drawer-overlay" onClick={onClose}>
      <div className="gb-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="gb-drawer__header">
          <div>
            <h2>{student ? `${student.firstName || ""} ${student.lastName || ""}` : "Cargando..."}</h2>
            {studentGrades && <p style={{ color: "var(--muted)", fontSize: ".84rem" }}>Promedio general: <strong style={{ color: colorNota(avg) }}>{formatearNota(avg)}</strong></p>}
          </div>
          <button className="gb-drawer__close" onClick={onClose}>&times;</button>
        </div>

        <div className="gb-drawer__body">
          {studentQuery.isLoading ? <LoadingSpinner size="sm" /> : (
            <>
              {/* ═══ RESUMEN KPIs ═══ */}
              <div className="gb-drawer-kpis">
                <div className="gb-drawer-kpi">
                  <span>Promedio</span>
                  <strong style={{ color: colorNota(avg) }}>{formatearNota(avg)}</strong>
                </div>
                <div className="gb-drawer-kpi">
                  <span>Asistencia</span>
                  <strong style={{ color: (attendanceStats?.attendanceRate ?? 100) < 85 ? "var(--danger)" : "var(--success)" }}>
                    {attendanceStats?.attendanceRate ?? "\u2014"}%
                  </strong>
                </div>
                <div className="gb-drawer-kpi">
                  <span>Curso Prom.</span>
                  <strong>{formatearNota(courseAvg)}</strong>
                </div>
                <div className="gb-drawer-kpi">
                  <span>Rendidas</span>
                  <strong>{allGrades.filter((g) => g.grade !== null).length}/{allGrades.length}</strong>
                </div>
              </div>

              {/* ═══ ALERTAS ═══ */}
              {riskAlerts.length > 0 && (
                <div className="gb-drawer-alerts">
                  {riskAlerts.map((a, i) => (
                    <div key={i} className="gb-drawer-alert">
                      <span>&#9888;</span> {a}
                    </div>
                  ))}
                </div>
              )}

              {/* ═══ GRAFICO DE EVOLUCION ═══ */}
              <div className="gb-drawer-section">
                <h4>Evolucion de Notas</h4>
                {gradeHistory.length > 0 ? (
                  <div style={{ width: "100%", height: 200 }}>
                    <ResponsiveContainer>
                      <BarChart data={gradeHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--line-light)" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted)" }} />
                        <YAxis domain={[0, 7]} tick={{ fontSize: 11, fill: "var(--muted)" }} />
                        <Tooltip />
                        <Bar dataKey="nota" radius={[4, 4, 0, 0]}
                          fill={(avg ?? 0) < 4.0 ? "var(--danger)" : (avg ?? 0) >= 5.5 ? "var(--success)" : "var(--accent)"}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p style={{ color: "var(--muted)", fontSize: ".84rem" }}>Sin evaluaciones registradas.</p>
                )}
              </div>

              {/* ═══ TENDENCIA ═══ */}
              {avgHistory.length >= 2 && (
                <div className="gb-drawer-section">
                  <h4>Tendencia de Promedio</h4>
                  <div style={{ width: "100%", height: 160 }}>
                    <ResponsiveContainer>
                      <LineChart data={avgHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--line-light)" />
                        <XAxis dataKey="index" tick={{ fontSize: 10, fill: "var(--muted)" }} />
                        <YAxis domain={[0, 7]} tick={{ fontSize: 11, fill: "var(--muted)" }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="promedio" stroke="var(--accent)" strokeWidth={2} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* ═══ ASISTENCIA ═══ */}
              {attendanceStats && (
                <div className="gb-drawer-section">
                  <h4>Asistencia</h4>
                  <div className="gb-drawer-attendance-grid">
                    <div><span>Presente</span><strong style={{ color: "var(--success)" }}>{attendanceStats.present}</strong></div>
                    <div><span>Ausente</span><strong style={{ color: "var(--danger)" }}>{attendanceStats.absent}</strong></div>
                    <div><span>Atraso</span><strong style={{ color: "var(--warning)" }}>{attendanceStats.late}</strong></div>
                    <div><span>Justificado</span><strong>{attendanceStats.justified}</strong></div>
                  </div>
                </div>
              )}

              {/* ═══ ULTIMAS NOTAS ═══ */}
              <div className="gb-drawer-section">
                <h4>Ultimas Evaluaciones</h4>
                {allGrades.length > 0 ? (
                  <div className="gb-drawer-notes-list">
                    {allGrades.slice(-8).reverse().map((g, i) => (
                      <div key={i} className="gb-drawer-note-row">
                        <div>
                          <strong>{g.assessmentTitle}</strong>
                          <small style={{ color: "var(--muted)" }}>{g.assessmentType} &middot; {g.subjectName}</small>
                        </div>
                        <span style={{ fontWeight: 700, color: colorNota(g.grade), fontSize: "1rem" }}>
                          {formatearNota(g.grade)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: "var(--muted)", fontSize: ".84rem" }}>Sin evaluaciones registradas.</p>
                )}
              </div>

              {/* ═══ OBSERVACIONES ═══ */}
              <div className="gb-drawer-section">
                <h4>Observaciones ({observations.length})</h4>
                {observations.length > 0 ? (
                  <div className="gb-drawer-obs-list">
                    {observations.slice(0, 5).map((obs) => (
                      <div key={obs.id} className="gb-drawer-obs-item">
                        <div className="gb-drawer-obs-header">
                          <span className={`badge ${obs.type === "ACADEMIC" ? "badge--role" : obs.type === "BEHAVIOR" ? "badge--warning" : "badge--inactive"}`}>
                            {obs.type === "ACADEMIC" ? "Academica" : obs.type === "BEHAVIOR" ? "Conductual" : obs.type}
                          </span>
                          <small style={{ color: "var(--muted)" }}>{obs.course?.name}</small>
                        </div>
                        <strong style={{ fontSize: ".86rem" }}>{obs.title}</strong>
                        <p style={{ fontSize: ".82rem", color: "var(--muted)", marginTop: 2 }}>{obs.content?.slice(0, 120)}{obs.content?.length > 120 ? "..." : ""}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: "var(--muted)", fontSize: ".84rem" }}>Sin observaciones registradas.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
