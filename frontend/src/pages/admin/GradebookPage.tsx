import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useInstitution } from "../../app/InstitutionContext";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { useToast } from "../../components/common/Toast";
import { StudentDetailDrawer } from "../../components/gradebook/StudentDetailDrawer";
import { AssessmentDetailModal } from "../../components/gradebook/AssessmentDetailModal";
import { exportGradebookToPdf } from "../../lib/pdf";

interface CourseRow { course_id: string; course_name: string; grade_level?: number; }
interface SubjectRow { subject_id: string; subject_name: string; }

type CeldaEditando = { estudianteId: string; evaluacionId: string } | null;

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

function nivelLabel(avg: number | null): string {
  if (avg === null || avg === undefined) return "Sin datos";
  if (avg >= 6.0) return "Avanzado";
  if (avg >= 5.0) return "Adecuado";
  if (avg >= 4.0) return "Basico";
  return "Critico";
}

export function GradebookPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedInstitution } = useInstitution();

  const [courseId, setCourseId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [search, setSearch] = useState("");
  const [soloRiesgo, setSoloRiesgo] = useState(false);
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [soloBajo4, setSoloBajo4] = useState(false);

  const [celdaEditando, setCeldaEditando] = useState<CeldaEditando>(null);
  const [editingValue, setEditingValue] = useState("");
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set());

  const [showNewAssessment, setShowNewAssessment] = useState(false);
  const [newEvalTitle, setNewEvalTitle] = useState("");
  const [newEvalType, setNewEvalType] = useState("PROCESO");
  const [newEvalWeight, setNewEvalWeight] = useState(25);
  const [newEvalSemester, setNewEvalSemester] = useState(1);

  const [estudianteDrawer, setEstudianteDrawer] = useState<string | null>(null);
  const [evaluacionModal, setEvaluacionModal] = useState<string | null>(null);

  const coursesQuery = useQuery<CourseRow[]>({
    queryKey: ["courses-gradebook", selectedInstitution?.id],
    queryFn: () => api.listCourses({ institutionId: selectedInstitution?.id }) as unknown as Promise<CourseRow[]>,
    enabled: Boolean(selectedInstitution?.id),
  });

  const subjectsQuery = useQuery<SubjectRow[]>({
    queryKey: ["subjects-gradebook"],
    queryFn: () => api.listSubjects(true) as unknown as Promise<SubjectRow[]>,
  });

  const gradeBookQuery = useQuery({
    queryKey: ["grade-book", courseId, subjectId],
    queryFn: () => api.getCourseGradeBook(courseId, subjectId ? { subjectId } : undefined),
    enabled: Boolean(courseId),
  });

  const updateGradeMutation = useMutation({
    mutationFn: ({ gradeId, grade }: { gradeId: string; grade: number }) =>
      api.updateGrade(gradeId, { grade }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grade-book", courseId, subjectId] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Error al guardar.", "error"),
  });

  const directGradeMutation = useMutation({
    mutationFn: (payload: { assessmentId: string; studentId: string; grade: number }) =>
      api.createDirectGrade(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grade-book", courseId, subjectId] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Error al crear nota.", "error"),
  });

  const createAssessmentMutation = useMutation({
    mutationFn: (payload: unknown) => api.createAssessment(payload),
    onSuccess: () => {
      toast("Evaluacion creada. Ya puedes ingresar notas.", "success");
      setShowNewAssessment(false);
      setNewEvalTitle("");
      queryClient.invalidateQueries({ queryKey: ["grade-book", courseId, subjectId] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Error al crear evaluacion.", "error"),
  });

  const courses = coursesQuery.data || [];
  const subjects = subjectsQuery.data || [];
  const book = gradeBookQuery.data;

  const allStudents = book?.students || [];
  const allAssessments = book?.assessments || [];
  const stats = book?.stats;
  const selectedCourse = courses.find((c) => c.course_id === courseId);
  const selectedSubject = subjects.find((s) => s.subject_id === subjectId);

  const searchLower = search.toLowerCase();
  const filteredStudents = useMemo(() => {
    let pool = allStudents;
    if (searchLower) {
      pool = pool.filter((s) => `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchLower) || (s.rut && s.rut.includes(searchLower)));
    }
    if (soloRiesgo) pool = pool.filter((s) => s.atRisk);
    if (soloPendientes) pool = pool.filter((s) => s.hasPending);
    if (soloBajo4) pool = pool.filter((s) => s.grades.some((g) => g.grade !== null && g.grade < 4.0));
    return pool;
  }, [allStudents, searchLower, soloRiesgo, soloPendientes, soloBajo4]);

  const hayDatos = filteredStudents.length > 0 && allAssessments.length > 0;

  const handleCeldaClick = useCallback((estudianteId: string, evaluacionId: string, notaActual: number | null) => {
    setCeldaEditando({ estudianteId, evaluacionId });
    setEditingValue(notaActual !== null ? notaActual.toFixed(1).replace(".", ",") : "");
  }, []);

  const handleSaveNota = useCallback((estudianteId: string, evaluacionId: string) => {
    const trimmed = editingValue.trim().replace(",", ".");
    const cellKey = `${estudianteId}|${evaluacionId}`;

    if (trimmed === "" || trimmed === "-") {
      setCeldaEditando(null);
      return;
    }

    const parsed = parseFloat(trimmed);
    if (isNaN(parsed) || parsed < 1.0 || parsed > 7.0) {
      setCeldaEditando(null);
      return;
    }

    const nota = Math.round(parsed * 10) / 10;
    const student = allStudents.find((s) => s.studentId === estudianteId);
    const gradeEntry = student?.grades.find((g) => g.assessmentId === evaluacionId);
    const gradeId = gradeEntry?.gradeId;

    setSavingCells((prev) => new Set(prev).add(cellKey));

    if (gradeId) {
      updateGradeMutation.mutate(
        { gradeId, grade: nota },
        { onSettled: () => setSavingCells((prev) => { const n = new Set(prev); n.delete(cellKey); return n; }) },
      );
    } else {
      directGradeMutation.mutate(
        { assessmentId: evaluacionId, studentId: estudianteId, grade: nota },
        { onSettled: () => setSavingCells((prev) => { const n = new Set(prev); n.delete(cellKey); return n; }) },
      );
    }
    setCeldaEditando(null);
  }, [editingValue, allStudents, updateGradeMutation, directGradeMutation]);

  const handleCreateAssessment = useCallback(() => {
    if (!courseId || !newEvalTitle.trim()) return;
    const activeSubjectId = subjectId || (subjects.length > 0 ? subjects[0].subject_id : "");
    if (!activeSubjectId) { toast("No hay asignaturas.", "error"); return; }
    createAssessmentMutation.mutate({
      courseId, subjectId: activeSubjectId,
      title: newEvalTitle.trim(), assessmentType: newEvalType,
      weight: newEvalWeight, semester: newEvalSemester,
      startDate: new Date().toISOString(),
    });
  }, [courseId, subjectId, newEvalTitle, newEvalType, newEvalWeight, newEvalSemester, subjects, createAssessmentMutation, toast]);

  return (
    <div className="gradebook-page">
      {/* ═══ HEADER ═══ */}
      <header className="gradebook-header">
        <div className="gradebook-header__inner">
          <div className="gradebook-header__brand">
            <div className="gradebook-header__icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                <line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
            </div>
            <div>
              <h1>Libro de Calificaciones</h1>
              {selectedCourse && (
                <p className="gradebook-header__meta">
                  {selectedCourse.course_name} {selectedSubject ? `\u00b7 ${selectedSubject.subject_name}` : ""}
                  {book?.course?.gradeLevel ? ` \u00b7 ${book.course.gradeLevel}\u00b0` : ""}
                </p>
              )}
            </div>
          </div>
          <div className="gradebook-header__actions">
            <button className="btn btn--primary" onClick={() => setShowNewAssessment(true)} disabled={!courseId}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nueva Evaluacion
            </button>
          </div>
        </div>
      </header>

      {/* ═══ FILTROS ═══ */}
      <section className="gradebook-filters panel">
        <div className="form-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <div className="form-field">
            <label>Curso</label>
            <select value={courseId} onChange={(e) => { setCourseId(e.target.value); setEstudianteDrawer(null); }}>
              <option value="">Seleccionar curso...</option>
              {courses.map((c) => <option key={c.course_id} value={c.course_id}>{c.course_name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Asignatura</label>
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">Todas</option>
              {subjects.map((s) => <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Buscar alumno</label>
            <input type="text" placeholder="Nombre, apellido o RUT..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="gradebook-filter-tags">
          <label className={`gradebook-filter-tag ${soloRiesgo ? "gradebook-filter-tag--active" : ""}`}>
            <input type="checkbox" checked={soloRiesgo} onChange={(e) => setSoloRiesgo(e.target.checked)} hidden />
            <span className="gradebook-filter-tag__dot" style={{ background: "var(--danger)" }} />
            En Riesgo
          </label>
          <label className={`gradebook-filter-tag ${soloPendientes ? "gradebook-filter-tag--active" : ""}`}>
            <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} hidden />
            <span className="gradebook-filter-tag__dot" style={{ background: "var(--warning)" }} />
            Pendientes
          </label>
          <label className={`gradebook-filter-tag ${soloBajo4 ? "gradebook-filter-tag--active" : ""}`}>
            <input type="checkbox" checked={soloBajo4} onChange={(e) => setSoloBajo4(e.target.checked)} hidden />
            <span className="gradebook-filter-tag__dot" style={{ background: "var(--danger)" }} />
            Notas &lt; 4,0
          </label>
        </div>
      </section>

      {/* ═══ KPI CARDS ═══ */}
      {stats && (
        <section className="gradebook-kpi-grid">
          <div className="gradebook-kpi-card">
            <div className="gradebook-kpi-card__icon" style={{ background: stats.courseAvg < 4.0 ? "var(--danger-bg)" : stats.courseAvg >= 5.0 ? "var(--success-bg)" : "var(--accent-light)", color: stats.courseAvg < 4.0 ? "var(--danger)" : stats.courseAvg >= 5.0 ? "var(--success)" : "var(--accent)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <div>
              <span>Promedio Curso</span>
              <strong style={{ color: colorNota(stats.courseAvg) }}>{formatearNota(stats.courseAvg)}</strong>
            </div>
          </div>
          <div className="gradebook-kpi-card">
            <div className="gradebook-kpi-card__icon" style={{ background: stats.approvalRate >= 70 ? "var(--success-bg)" : "var(--warning-bg)", color: stats.approvalRate >= 70 ? "var(--success)" : "var(--warning)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div><span>% Aprobacion</span><strong>{stats.approvalRate}%</strong></div>
          </div>
          <div className="gradebook-kpi-card gradebook-kpi-card--danger">
            <div className="gradebook-kpi-card__icon" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div><span>En Riesgo</span><strong style={{ color: "var(--danger)" }}>{stats.atRiskCount}</strong></div>
          </div>
          <div className="gradebook-kpi-card">
            <div className="gradebook-kpi-card__icon" style={{ background: "var(--gold-light)", color: "var(--gold)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div><span>Pendientes</span><strong style={{ color: "var(--warning)" }}>{stats.pendingsCount}</strong></div>
          </div>
          <div className="gradebook-kpi-card">
            <div className="gradebook-kpi-card__icon" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </div>
            <div><span>Notas Registradas</span><strong>{stats.totalNotes}</strong></div>
          </div>
          <div className="gradebook-kpi-card">
            <div className="gradebook-kpi-card__icon" style={{ background: "var(--info-bg)", color: "var(--info)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            </div>
            <div><span>Evaluaciones</span><strong>{stats.appliedCount}/{stats.totalAssessments}</strong></div>
          </div>
        </section>
      )}

      {/* ═══ ESTADOS VACÍO / CARGA / ERROR ═══ */}
      {!courseId && (
        <section className="panel">
          <div className="empty-state">
            <div className="empty-state__icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--muted-light)" strokeWidth="1.2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            </div>
            <strong>Selecciona un curso para comenzar</strong>
            <p>Elige un curso y opcionalmente una asignatura para ver el libro de calificaciones con notas, promedios y estados academicos.</p>
          </div>
        </section>
      )}

      {courseId && gradeBookQuery.isLoading && <LoadingSpinner label="Cargando libro de calificaciones..." />}

      {courseId && gradeBookQuery.isError && (
        <section className="panel"><p className="error">Error al cargar. Verifica que el curso tenga estudiantes y evaluaciones registradas.</p></section>
      )}

      {/* ═══ TABLA PRINCIPAL ═══ */}
      {hayDatos && (
        <section className="panel gradebook-table-panel">
          <div className="gradebook-table-header">
            <div>
              <h3>
                {book?.course?.name || ""}
                {subjectId && ` \u00b7 ${selectedSubject?.subject_name || ""}`}
              </h3>
              <span className="gradebook-table-header__meta">
                {filteredStudents.length} estudiantes &middot; {allAssessments.length} evaluaciones
              </span>
            </div>
            <div className="gradebook-table-header__actions">
              <button className="btn btn--ghost gradebook-action-btn" onClick={() => setShowNewAssessment(true)} title="Agregar evaluacion">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Agregar
              </button>
              <button className="btn btn--ghost gradebook-action-btn" title="Exportar Excel - Proximamente"
                onClick={() => toast("Exportacion en desarrollo.", "info")}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Excel
              </button>
              <button className="btn btn--ghost gradebook-action-btn" title="Exportar PDF"
                onClick={() => {
                  if (!selectedCourse) return;
                  exportGradebookToPdf(
                    selectedCourse.course_name,
                    selectedSubject?.subject_name,
                    filteredStudents as { studentId: string; firstName: string; lastName: string; average: number | null; hasPending: boolean; grades: { assessmentId: string; grade: number | null }[] }[],
                    allAssessments as { id: string; title: string; type: string; weight: number }[],
                    stats as { courseAvg: number | null; approvalRate: number; atRiskCount: number; pendingsCount: number; totalNotes: number; appliedCount: number; totalAssessments: number } | null,
                  );
                }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                PDF
              </button>
            </div>
          </div>

          <div className="gradebook-table-scroll">
            <table className="gradebook-table">
              <thead>
                <tr>
                  <th className="gb-col-nro">N&deg;</th>
                  <th className="gb-col-nombre">Estudiante</th>
                  {allAssessments.map((ev) => (
                    <th key={ev.id} className="gb-col-eval" onClick={() => setEvaluacionModal(ev.id)} title={`Click para ver detalle de "${ev.title}"`}>
                      <div className="gb-eval-header">
                        <span className="gb-eval-title">{ev.title.length > 10 ? ev.title.slice(0, 10) + "..." : ev.title}</span>
                        <span className="gb-eval-type">{ev.type}</span>
                        <span className="gb-eval-weight">{ev.weight}%</span>
                      </div>
                    </th>
                  ))}
                  <th className="gb-col-prom">Promedio</th>
                  <th className="gb-col-nivel">Nivel</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((est, idx) => {
                  const avg = est.average;
                  const nivel = nivelLabel(avg);
                  const notaRoja = est.grades.some((g) => g.grade !== null && g.grade < 4.0);
                  const pendiente = est.hasPending;

                  return (
                    <tr key={est.studentId} className={`gb-row ${notaRoja ? "gb-row--danger" : ""} ${pendiente ? "gb-row--pending" : ""}`}>
                      <td className="gb-col-nro">{idx + 1}</td>
                      <td className="gb-col-nombre">
                        <button className="gb-student-link" onClick={() => setEstudianteDrawer(est.studentId)} title="Ver perfil completo">
                          <span className="gb-student-avatar">
                            {est.firstName.charAt(0)}{est.lastName.charAt(0)}
                          </span>
                          <strong>{est.lastName}, {est.firstName}</strong>
                        </button>
                      </td>
                      {allAssessments.map((ev) => {
                        const g = est.grades.find((n) => n.assessmentId === ev.id);
                        const isEditing = celdaEditando?.estudianteId === est.studentId && celdaEditando?.evaluacionId === ev.id;
                        const cellKey = `${est.studentId}|${ev.id}`;
                        const isSaving = savingCells.has(cellKey);
                        return (
                          <td key={ev.id} className={`gb-col-eval gb-cell ${isEditing ? "gb-cell--editing" : ""} ${g?.grade === null || g?.grade === undefined ? "gb-cell--empty" : ""}`}>
                            {isEditing ? (
                              <input className="gb-cell-input" type="text" inputMode="decimal" value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                onBlur={() => handleSaveNota(est.studentId, ev.id)}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSaveNota(est.studentId, ev.id); } if (e.key === "Escape") setCeldaEditando(null); }}
                                autoFocus onFocus={(e) => e.target.select()} />
                            ) : (
                              <span className={`gb-cell-value ${isSaving ? "gb-cell-value--saving" : ""}`}
                                style={{ color: colorNota(g?.grade ?? null), fontWeight: g?.grade !== null ? 700 : 400 }}
              title={g?.grade !== null ? `Nota: ${formatearNota(g?.grade ?? null)}\nClick para editar` : "Click para ingresar nota"}
              onClick={() => handleCeldaClick(est.studentId, ev.id, g?.grade ?? null)}>
                                {formatearNota(g?.grade ?? null)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="gb-col-prom" style={{ fontWeight: 700, color: colorNota(avg) }}>{formatearNota(avg)}</td>
                      <td className="gb-col-nivel">
                        <span className={`gb-nivel-badge ${nivel === "Avanzado" ? "gb-nivel--alto" : nivel === "Adecuado" ? "gb-nivel--medio" : nivel === "Basico" ? "gb-nivel--bajo" : "gb-nivel--critico"}`}>
                          {nivel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="gradebook-leyenda">
            <span><span className="gradebook-leyenda-dot" style={{ background: "var(--danger)" }}/> Nota &lt; 4,0</span>
            <span><span className="gradebook-leyenda-dot" style={{ background: "var(--success)" }}/> Nota &ge; 6,0</span>
            <span><span className="gradebook-leyenda-dot" style={{ background: "var(--warning)" }}/> Pendiente</span>
            <span className="gradebook-leyenda-hint">Click en nota para editar &middot; Click en alumno para perfil &middot; Click en columna para detalle</span>
          </div>
        </section>
      )}

      {/* ═══ OA DESCENDIDOS ═══ */}
      {hayDatos && (book?.oaDescendidos?.length || 0) > 0 && (
        <section className="panel">
          <h3>OA con Rendimiento Bajo 4.0</h3>
          <div className="gradebook-alert-box">
            <strong>Se detectaron {book?.oaDescendidos?.length} OA con promedio bajo 4.0</strong>
            <p>Se recomienda implementar planes remediales enfocados en estos objetivos.</p>
          </div>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table">
              <thead><tr><th>OA</th><th>Descripcion</th><th>Promedio</th><th>Registros</th></tr></thead>
              <tbody>
                {(book?.oaDescendidos || []).map((oa) => (
                  <tr key={oa.code}>
                    <td><span className="badge badge--inactive">{oa.code}</span></td>
                    <td style={{ fontSize: ".84rem" }}>{oa.description}</td>
                    <td style={{ fontWeight: 700, color: "var(--danger)" }}>{formatearNota(oa.average)}</td>
                    <td style={{ textAlign: "center" }}>{oa.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ═══ MODAL: NUEVA EVALUACION ═══ */}
      {showNewAssessment && (
        <div className="modal-overlay" onClick={() => setShowNewAssessment(false)}>
          <div className="modal-container assessment-create-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header assessment-create-modal__header">
              <div>
                <span>Nueva columna</span>
                <h2>Nueva Evaluación</h2>
              </div>
              <button className="modal-close" onClick={() => setShowNewAssessment(false)}>&times;</button>
            </div>
            <div className="modal-body assessment-create-modal__body">
              <div className="assessment-create-modal__summary">
                <strong>{selectedCourse?.course_name || "Curso sin seleccionar"}</strong>
                <span>{subjectId ? selectedSubject?.subject_name || "Asignatura" : "Todas las asignaturas"}</span>
              </div>
              <div className="form-field assessment-create-field assessment-create-field--full">
                <label>Nombre de evaluación <span>*</span></label>
                <input type="text" placeholder="Ej: Prueba Unidad 1..." value={newEvalTitle}
                  onChange={(e) => setNewEvalTitle(e.target.value)} autoFocus />
              </div>
              <div className="assessment-create-grid">
                <div className="form-field assessment-create-field">
                  <label>Fase de evaluación</label>
                  <select value={newEvalType} onChange={(e) => setNewEvalType(e.target.value)}>
                    <option value="DIAGNOSTICA">Diagnóstica</option>
                    <option value="PROCESO">Proceso</option>
                    <option value="CIERRE">Cierre</option>
                    <option value="PARCIAL">Parcial</option>
                    <option value="FINAL">Final</option>
                    <option value="SIMCE">SIMCE</option>
                  </select>
                </div>
                <div className="form-field assessment-create-field">
                  <label>Semestre</label>
                  <select value={newEvalSemester} onChange={(e) => setNewEvalSemester(Number(e.target.value))}>
                    <option value={1}>1er Semestre</option>
                    <option value={2}>2do Semestre</option>
                  </select>
                </div>
                <div className="form-field assessment-create-field">
                  <label>Ponderación (%)</label>
                  <input type="number" min={0} max={100} value={newEvalWeight}
                    onChange={(e) => setNewEvalWeight(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} />
                </div>
              </div>
              <p className="assessment-create-modal__hint">La evaluación se creará como borrador. Luego podrás ingresar las notas directamente desde el libro.</p>
            </div>
            <div className="modal-footer assessment-create-modal__footer">
              <button className="btn-secondary" onClick={() => setShowNewAssessment(false)}>Cancelar</button>
              <button onClick={handleCreateAssessment} disabled={createAssessmentMutation.isPending || !newEvalTitle.trim()}>
                {createAssessmentMutation.isPending ? "Creando..." : "Crear Evaluación"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DRAWER: PERFIL DE ESTUDIANTE ═══ */}
      {estudianteDrawer && (
        <StudentDetailDrawer
          studentId={estudianteDrawer}
          courseId={courseId}
          onClose={() => setEstudianteDrawer(null)}
        />
      )}

      {/* ═══ MODAL: DETALLE DE EVALUACION ═══ */}
      {evaluacionModal && (
        <AssessmentDetailModal
          assessmentId={evaluacionModal}
          courseId={courseId}
          onClose={() => setEvaluacionModal(null)}
        />
      )}
    </div>
  );
}
