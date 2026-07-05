import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useInstitution } from "../../app/InstitutionContext";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

function formatearNota(n: number | null): string {
  if (n === null || n === undefined) return "\u2014";
  return n.toFixed(1).replace(".", ",");
}

function colorNota(n: number | null): string {
  if (n === null) return "var(--muted)";
  if (n < 4.0) return "var(--danger)";
  if (n >= 6.0) return "var(--success)";
  return "var(--ink)";
}

function fullName(first?: unknown, last?: unknown) {
  return `${String(first || "")} ${String(last || "")}`.trim();
}

export function StudentFullProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedInstitution } = useInstitution();
  const [tab, setTab] = useState<"resumen" | "notas" | "asistencia" | "observaciones">("resumen");

  const studentQuery = useQuery({
    queryKey: ["student", id],
    queryFn: () => api.getStudent(id!),
    enabled: Boolean(id),
  });

  const attendanceStatsQuery = useQuery({
    queryKey: ["attendance-stats", id],
    queryFn: () => api.getAttendanceStats(id!),
    enabled: Boolean(id),
  });

  const observationsQuery = useQuery({
    queryKey: ["observations-student", id],
    queryFn: () => api.listObservations({ studentId: id! }),
    enabled: Boolean(id),
  });

  const attendanceListQuery = useQuery({
    queryKey: ["attendance-list", id],
    queryFn: () => api.getStudentAttendance(id!) as Promise<{ id: string; date: string; status: string; course: { name: string } }[]>,
    enabled: Boolean(id),
  });

  const academicYearsQuery = useQuery({
    queryKey: ["academic-years-profile", selectedInstitution?.id],
    queryFn: () => api.listAcademicYears(selectedInstitution?.id || ""),
    enabled: Boolean(selectedInstitution?.id),
  });

  const [academicYearId, setAcademicYearId] = useState("");

  const yearSummaryQuery = useQuery({
    queryKey: ["student-year-summary", id, academicYearId],
    queryFn: () => api.getStudentYearSummary(id!, academicYearId),
    enabled: Boolean(id) && Boolean(academicYearId),
  });

  const s = studentQuery.data as Record<string, unknown> | undefined;
  const stats = attendanceStatsQuery.data;
  const observations = (observationsQuery.data || []) as { id: string; title: string; type: string; content: string; createdAt: string; course: { name: string }; teacher: { user: { firstName: string; lastName: string } } }[];
  const attendanceList = attendanceListQuery.data || [];
  const years = academicYearsQuery.data || [];
  const summary = yearSummaryQuery.data as { students?: { studentName: string; avgGrade: number; semesters: Record<string, number>; totalGrades: number }[]; avgGrade?: number; totalGrades?: number } | undefined;

  if (studentQuery.isLoading) return <LoadingSpinner label="Cargando perfil del alumno..." />;
  if (!s) return <div className="panel"><p className="error">Alumno no encontrado.</p></div>;

  const enrollments = (s.enrollments as { course: { id: string; name: string; gradeLevel: number } }[]) || [];
  const activeCourse = enrollments.find((e: { course?: { name: string } }) => e.course)?.course;

  const avgGeneral = summary?.avgGrade ?? null;
  const totalGrades = summary?.totalGrades ?? 0;

  const riskAlerts: string[] = [];
  if (avgGeneral !== null && avgGeneral < 4.0) riskAlerts.push("Promedio bajo 4.0 - Riesgo de repitencia");
  else if (avgGeneral !== null && avgGeneral < 4.5) riskAlerts.push("Promedio basico - Necesita refuerzo");
  if (stats?.atRisk) riskAlerts.push(`Asistencia critica: ${stats.attendanceRate}% (bajo 85%)`);
  if (totalGrades < 3) riskAlerts.push("Pocas evaluaciones registradas este año");

  const attendanceStatusColors: Record<string, string> = {
    PRESENT: "var(--success)", ABSENT: "var(--danger)", LATE: "var(--warning)",
    JUSTIFIED: "var(--info)", EXCUSED: "var(--accent)",
  };
  const attendanceLabels: Record<string, string> = {
    PRESENT: "Presente", ABSENT: "Ausente", LATE: "Atraso", JUSTIFIED: "Justificado", EXCUSED: "Excusado",
  };
  const sortedAttendance = [...attendanceList].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const attendanceDays = sortedAttendance.slice(-12);
  const periodLabels = Array.from({ length: 13 }, (_, i) => `P${i + 1}`);

  return (
    <div className="student-profile-page">
      {/* Breadcrumb */}
      <div className="breadcrumbs">
        <span className="breadcrumbs__item"><a href="#" onClick={(e) => { e.preventDefault(); navigate("../gradebook"); }}>Libro de Calificaciones</a></span>
        <span className="breadcrumbs__sep">/</span>
        <span className="breadcrumbs__item">{s.firstName as string} {s.lastName as string}</span>
      </div>

      {/* ═══ HEADER ═══ */}
      <header className="gradebook-header">
        <div className="gradebook-header__inner">
          <div className="gradebook-header__brand">
            <div className="gradebook-header__icon" style={{ width: 56, height: 56, fontSize: "1.2rem", fontWeight: 800 }}>
              {(s.firstName as string)?.charAt(0)}{(s.lastName as string)?.charAt(0)}
            </div>
            <div>
              <h1>{s.firstName as string} {s.lastName as string}</h1>
              <p className="gradebook-header__meta">
                {activeCourse ? `${activeCourse.name} \u00b7 ${activeCourse.gradeLevel}°` : "Sin curso asignado"}
                {s.rut ? ` \u00b7 RUT: ${s.rut}` : ""}
              </p>
            </div>
          </div>
          <span className={`badge ${avgGeneral !== null && avgGeneral >= 4.0 ? "badge--active" : "badge--inactive"}`} style={{ fontSize: ".9rem", padding: "8px 18px" }}>
            {avgGeneral !== null && avgGeneral >= 4.0 ? "Aprobado" : "En Riesgo"}
          </span>
        </div>
      </header>

      {/* ═══ KPI CARDS ═══ */}
      <section className="gradebook-kpi-grid" style={{ marginTop: 16 }}>
        <div className="gradebook-kpi-card">
          <div className="gradebook-kpi-card__icon" style={{ background: (avgGeneral ?? 0) < 4.0 ? "var(--danger-bg)" : "var(--success-bg)", color: (avgGeneral ?? 0) < 4.0 ? "var(--danger)" : "var(--success)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <div><span>Promedio General</span><strong style={{ color: colorNota(avgGeneral) }}>{formatearNota(avgGeneral)}</strong></div>
        </div>
        <div className="gradebook-kpi-card">
          <div className="gradebook-kpi-card__icon" style={{ background: (stats?.attendanceRate ?? 100) < 85 ? "var(--danger-bg)" : "var(--success-bg)", color: (stats?.attendanceRate ?? 100) < 85 ? "var(--danger)" : "var(--success)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div><span>Asistencia</span><strong>{stats?.attendanceRate ?? "\u2014"}%</strong></div>
        </div>
        <div className="gradebook-kpi-card">
          <div className="gradebook-kpi-card__icon" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <div><span>Evaluaciones</span><strong>{totalGrades}</strong></div>
        </div>
        <div className="gradebook-kpi-card">
          <div className="gradebook-kpi-card__icon" style={{ background: stats?.atRisk ? "var(--danger-bg)" : "var(--success-bg)", color: stats?.atRisk ? "var(--danger)" : "var(--success)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div><span>Inasistencias</span><strong style={{ color: stats?.atRisk ? "var(--danger)" : "var(--ink)" }}>{stats?.absent ?? 0}</strong></div>
        </div>
      </section>

      {/* ═══ ALERTS ═══ */}
      {riskAlerts.length > 0 && (
        <section className="gb-drawer-alerts" style={{ marginTop: 12 }}>
          {riskAlerts.map((a, i) => (
            <div key={i} className="gb-drawer-alert"><span>&#9888;</span> {a}</div>
          ))}
        </section>
      )}

      {/* ═══ TABS ═══ */}
      <section className="panel" style={{ padding: 0, overflow: "hidden", marginTop: 16 }}>
        <div className="gb-detail-tabs">
          {(["resumen", "notas", "asistencia", "observaciones"] as const).map((t) => (
            <button key={t} className={`gb-detail-tab ${tab === t ? "gb-detail-tab--active" : ""}`} onClick={() => setTab(t)}>
              {{ resumen: "Resumen", notas: "Notas", asistencia: "Asistencia", observaciones: "Observaciones" }[t]}
            </button>
          ))}
        </div>

        <div className="gb-detail-tab-content">
          {/* ═══ TAB: RESUMEN ═══ */}
          {tab === "resumen" && (
            <div style={{ padding: 24 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
                <h4 style={{ margin: 0 }}>Año Académico:</h4>
                <select value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)}
                  style={{ width: "auto", minWidth: 160 }}>
                  <option value="">Seleccionar año...</option>
                  {years.map((y) => <option key={y.id} value={y.id}>{y.year}</option>)}
                </select>
              </div>

              {yearSummaryQuery.isLoading ? <LoadingSpinner size="sm" /> : summary ? (
                <>
                  <h4>Resumen Anual</h4>
                  <div className="gb-drawer-kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))" }}>
                    <div className="gb-drawer-kpi"><span>Promedio Anual</span><strong style={{ color: colorNota(avgGeneral) }}>{formatearNota(avgGeneral)}</strong></div>
                    {summary.students?.[0]?.semesters && Object.entries(summary.students[0].semesters)
                      .filter(([k]) => k !== "avgGrade" && k !== "totalGrades")
                      .slice(0, 4).map(([sem, val]) => (
                        <div className="gb-drawer-kpi" key={sem}>
                          <span>Sem {sem}</span>
                          <strong style={{ color: colorNota(Number(val)) }}>{formatearNota(Number(val))}</strong>
                        </div>
                      ))}
                  </div>
                </>
              ) : academicYearId ? (
                <p style={{ color: "var(--muted)" }}>Sin datos para el año seleccionado.</p>
              ) : (
                <p style={{ color: "var(--muted)" }}>Selecciona un año académico para ver el resumen.</p>
              )}

              <div className="student-file">
                <div className="student-file__page">
                  <div className="student-file__school">
                    <div className="student-file__avatar">
                      {(s.firstName as string)?.charAt(0)}{(s.lastName as string)?.charAt(0)}
                    </div>
                    <div>
                      <strong>Colegio Cordillera</strong>
                      <span>{selectedInstitution?.name || "Ficha institucional"}</span>
                    </div>
                  </div>

                  <section className="student-file__box">
                    <h4>Ficha estudiante</h4>
                    <div className="student-file__grid">
                      <span>RUN:</span><strong>{(s.rut as string) || "\u2014"}</strong>
                      <span>Apellido paterno:</span><strong>{(s.lastName as string)?.split(" ")[0] || "\u2014"}</strong>
                      <span>Apellido materno:</span><strong>{(s.lastName as string)?.split(" ").slice(1).join(" ") || "\u2014"}</strong>
                      <span>Nombres:</span><strong>{s.firstName as string}</strong>
                      <span>Fecha nacimiento:</span><strong>{s.birthDate ? new Date(s.birthDate as string).toLocaleDateString("es-CL") : "\u2014"}</strong>
                      <span>Genero:</span><strong>{(s.gender as string) || "\u2014"}</strong>
                      <span>Curso actual:</span><strong>{activeCourse?.name || "\u2014"}</strong>
                      <span>Correo electrónico:</span><strong>{(s.user as { email?: string })?.email || "\u2014"}</strong>
                    </div>
                  </section>

                  <section className="student-file__box">
                    <h4>Antecedentes escolares</h4>
                    <div className="student-file__grid">
                      <span>N° matrícula:</span><strong>{String(s.id || "").slice(0, 8) || "\u2014"}</strong>
                      <span>Fecha matrícula:</span><strong>{s.createdAt ? new Date(s.createdAt as string).toLocaleDateString("es-CL") : "\u2014"}</strong>
                      <span>Curso:</span><strong>{activeCourse?.name || "\u2014"}</strong>
                      <span>Promedio general:</span><strong style={{ color: colorNota(avgGeneral) }}>{formatearNota(avgGeneral)}</strong>
                      <span>Asistencia:</span><strong>{stats?.attendanceRate ?? "\u2014"}%</strong>
                    </div>
                  </section>
                </div>

                <nav className="student-file__tabs" aria-label="Documentos del estudiante">
                  <button className="student-file__tab student-file__tab--pink">Identificación</button>
                  <button className="student-file__tab student-file__tab--green">Ant. familiares</button>
                  <button className="student-file__tab student-file__tab--red">Hoja de vida</button>
                  <button className="student-file__tab student-file__tab--yellow">Cert. accidentes</button>
                  <button className="student-file__tab student-file__tab--blue">PIE</button>
                </nav>
              </div>
            </div>
          )}

          {/* ═══ TAB: NOTAS ═══ */}
          {tab === "notas" && (
            <div style={{ padding: 24 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
                <h4 style={{ margin: 0 }}>Año Académico:</h4>
                <select value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)}
                  style={{ width: "auto", minWidth: 160 }}>
                  <option value="">Seleccionar año...</option>
                  {years.map((y) => <option key={y.id} value={y.id}>{y.year}</option>)}
                </select>
              </div>
              {yearSummaryQuery.isLoading ? <LoadingSpinner size="sm" /> : summary?.students?.[0]?.semesters ? (
                <div className="gb-drawer-kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", marginBottom: 16 }}>
                  {Object.entries(summary.students[0].semesters)
                    .filter(([k]) => !isNaN(Number(k)))
                    .map(([sem, val]) => (
                      <div className="gb-drawer-kpi" key={sem}>
                        <span>Semestre {sem}</span>
                        <strong style={{ color: colorNota(Number(val)) }}>{formatearNota(Number(val))}</strong>
                      </div>
                    ))}
                </div>
              ) : academicYearId ? <p style={{ color: "var(--muted)" }}>Sin notas para este año.</p> : <p style={{ color: "var(--muted)" }}>Selecciona un año académico para ver las notas.</p>}

              {activeCourse && (
                <NotasDelCurso studentId={id!} courseId={activeCourse.id} />
              )}
            </div>
          )}

          {/* ═══ TAB: ASISTENCIA ═══ */}
          {tab === "asistencia" && (
            <div style={{ padding: 24 }}>
              <h4>Estadisticas de Asistencia</h4>
              {stats && (
                <div className="gb-drawer-attendance-grid" style={{ marginTop: 12, marginBottom: 20 }}>
                  <div><span>Presente</span><strong style={{ color: "var(--success)" }}>{stats.present}</strong></div>
                  <div><span>Ausente</span><strong style={{ color: "var(--danger)" }}>{stats.absent}</strong></div>
                  <div><span>Atraso</span><strong style={{ color: "var(--warning)" }}>{stats.late}</strong></div>
                  <div><span>Justificado</span><strong style={{ color: "var(--info)" }}>{stats.justified}</strong></div>
                  <div><span>Excusado</span><strong>{stats.excused}</strong></div>
                  <div><span>Total</span><strong>{stats.total}</strong></div>
                </div>
              )}

              <h4>Registro de Asistencia ({attendanceList.length})</h4>
              {attendanceDays.length > 0 && (
                <div className="attendance-book">
                  <div className="attendance-book__sheet attendance-book__sheet--days">
                    <table>
                      <thead>
                        <tr>
                          <th>N°</th>
                          <th>Estudiante</th>
                          {attendanceDays.map((item, index) => (
                            <th key={item.id}>
                              {new Intl.DateTimeFormat("es-CL", { weekday: "short" }).format(new Date(item.date)).slice(0, 1).toUpperCase()}
                              <small>{index + 1}</small>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>1</td>
                          <td>{fullName(s.firstName, s.lastName)}</td>
                          {attendanceDays.map((item) => (
                            <td key={item.id}>
                              <span className={`attendance-dot attendance-dot--${item.status.toLowerCase()}`} />
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="attendance-book__sheet attendance-book__sheet--periods">
                    <table>
                      <thead>
                        <tr>
                          <th>N°</th>
                          <th>Estudiante</th>
                          {periodLabels.map((period) => <th key={period}>{period}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>1</td>
                          <td>{fullName(s.firstName, s.lastName)}</td>
                          {periodLabels.map((period, index) => {
                            const source = attendanceDays[index % attendanceDays.length];
                            const absent = source?.status === "ABSENT";
                            return (
                              <td key={period}>
                                <span className={`attendance-pill ${absent ? "attendance-pill--absent" : ""}`}>
                                  {absent ? "A" : "P"}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {attendanceList.length > 0 ? (
                <div className="table-wrap" style={{ marginTop: 12 }}>
                  <table className="table">
                    <thead><tr><th>Fecha</th><th>Curso</th><th>Estado</th></tr></thead>
                    <tbody>
                      {attendanceList.map((a) => (
                        <tr key={a.id}>
                          <td>{new Date(a.date).toLocaleDateString("es-CL")}</td>
                          <td>{a.course?.name || "\u2014"}</td>
                          <td>
                            <span className="badge" style={{
                              background: attendanceStatusColors[a.status] ? `${attendanceStatusColors[a.status]}15` : "var(--bg-alt)",
                              color: attendanceStatusColors[a.status] || "var(--muted)",
                            }}>
                              {attendanceLabels[a.status] || a.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ color: "var(--muted)" }}>No hay registros de asistencia.</p>
              )}
            </div>
          )}

          {/* ═══ TAB: OBSERVACIONES ═══ */}
          {tab === "observaciones" && (
            <div style={{ padding: 24 }}>
              <h4>Observaciones ({observations.length})</h4>
              {observations.length > 0 ? (
                <div className="gb-drawer-obs-list" style={{ marginTop: 12 }}>
                  {observations.map((obs) => (
                    <div key={obs.id} className="gb-drawer-obs-item">
                      <div className="gb-drawer-obs-header">
                        <span className={`badge ${obs.type === "ACADEMIC" ? "badge--role" : obs.type === "BEHAVIOR" ? "badge--warning" : "badge--inactive"}`}>
                          {{ ACADEMIC: "Academica", BEHAVIOR: "Conductual", GENERAL: "General", POSITIVE: "Positiva", NEGATIVE: "Negativa" }[obs.type] || obs.type}
                        </span>
                        <small style={{ color: "var(--muted)" }}>{new Date(obs.createdAt).toLocaleDateString("es-CL")} &middot; {obs.course?.name}</small>
                      </div>
                      <strong style={{ fontSize: ".9rem", display: "block" }}>{obs.title}</strong>
                      <p style={{ fontSize: ".84rem", color: "var(--muted)", margin: "4px 0 0" }}>{obs.content}</p>
                      {obs.teacher && (
                        <small style={{ color: "var(--muted-light)", fontSize: ".76rem", display: "block", marginTop: 6 }}>
                          Registrado por: {obs.teacher.user?.firstName} {obs.teacher.user?.lastName}
                        </small>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "var(--muted)" }}>No hay observaciones registradas para este alumno.</p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function NotasDelCurso({ studentId, courseId }: { studentId: string; courseId: string }) {
  const gradeBookQuery = useQuery({
    queryKey: ["grade-book", courseId],
    queryFn: () => api.getCourseGradeBook(courseId),
    enabled: Boolean(courseId),
  });

  const book = gradeBookQuery.data;
  const studentGrades = book?.students?.find((s: { studentId: string }) => s.studentId === studentId);
  const allGrades = studentGrades?.grades || [];

  if (gradeBookQuery.isLoading) return <LoadingSpinner size="sm" />;
  if (!allGrades.length) return <p style={{ color: "var(--muted)" }}>Sin evaluaciones en este curso.</p>;

  const gradeBars = [...allGrades]
    .filter((g: { grade: number | null }) => g.grade !== null)
    .map((g: { grade: number | null; assessmentTitle: string }, i: number) => ({
      name: (g as { assessmentTitle: string }).assessmentTitle?.slice(0, 12) || `E${i + 1}`,
      nota: g.grade as number,
    }));

  return (
    <>
      {gradeBars.length > 0 && (
        <div style={{ width: "100%", height: 200, marginTop: 16 }}>
          <ResponsiveContainer>
            <BarChart data={gradeBars}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line-light)" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "var(--muted)" }} />
              <YAxis domain={[0, 7]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="nota" radius={[3, 3, 0, 0]}
                fill={(studentGrades?.average ?? 0) < 4.0 ? "var(--danger)" : "var(--success)"} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="table-wrap" style={{ marginTop: 16 }}>
        <table className="table">
          <thead><tr><th>Evaluacion</th><th>Tipo</th><th>Asignatura</th><th>Pond.</th><th>Nota</th></tr></thead>
          <tbody>
            {allGrades.map((g: { gradeId: string; assessmentTitle: string; assessmentType: string; subjectName: string; weight: number; grade: number | null }, i: number) => (
              <tr key={g.gradeId || i}>
                <td><strong>{g.assessmentTitle}</strong></td>
                <td><span className="badge badge--role" style={{ fontSize: ".68rem" }}>{g.assessmentType}</span></td>
                <td style={{ fontSize: ".84rem" }}>{g.subjectName}</td>
                <td style={{ textAlign: "center" }}>{g.weight}%</td>
                <td style={{ fontWeight: 700, color: colorNota(g.grade), textAlign: "center", fontSize: "1rem" }}>{formatearNota(g.grade)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
