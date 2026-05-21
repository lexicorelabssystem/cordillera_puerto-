import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useInstitution } from "../../app/InstitutionContext";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { useToast } from "../../components/common/Toast";

type NotificationFunction = ReturnType<typeof useToast>["toast"];

const ASSESSMENT_TYPES = [
  { value: "DIAGNOSTICA", label: "Diagnostica" },
  { value: "PROCESO", label: "Proceso" },
  { value: "CIERRE", label: "Cierre" },
  { value: "PARCIAL", label: "Parcial" },
  { value: "FINAL", label: "Final" },
  { value: "SIMCE", label: "Ensayo SIMCE" },
];

function formatearNota(nota: number | null): string {
  if (nota === null || nota === undefined) return "\u2014";
  return nota.toFixed(1).replace(".", ",");
}

function colorNota(nota: number | null): string {
  if (nota === null || nota === undefined) return "var(--muted)";
  if (nota < 4.0) return "var(--danger)";
  if (nota >= 6.0) return "var(--success)";
  return "var(--ink)";
}

function getNivelLogro(promedio: number | null): string {
  if (promedio === null || promedio === undefined) return "Sin datos";
  if (promedio >= 6.0) return "Avanzado";
  if (promedio >= 5.0) return "Adecuado";
  if (promedio >= 4.0) return "Basico";
  return "Critico";
}

interface CourseRow { course_id: string; course_name: string; grade_level?: number; }
interface SubjectRow { subject_id: string; subject_name: string; }

type CeldaEditando = { estudianteId: string; evaluacionId: string } | null;

export function LibroEvaluacionesPage() {
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
  const [showPonderaciones, setShowPonderaciones] = useState(false);
  const [showOaDescendidos, setShowOaDescendidos] = useState(false);
  const [showNewAssessment, setShowNewAssessment] = useState(false);
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set());

  // New assessment form state
  const [newEvalTitle, setNewEvalTitle] = useState("");
  const [newEvalType, setNewEvalType] = useState("PROCESO");
  const [newEvalWeight, setNewEvalWeight] = useState(25);
  const [newEvalSemester, setNewEvalSemester] = useState(1);
  const newEvalFormRef = useRef<HTMLDivElement>(null);

  const coursesQuery = useQuery<CourseRow[]>({
    queryKey: ["courses-libro", selectedInstitution?.id],
    queryFn: () => api.listCourses({ institutionId: selectedInstitution?.id }) as unknown as Promise<CourseRow[]>,
    enabled: Boolean(selectedInstitution?.id),
  });

  const subjectsQuery = useQuery<SubjectRow[]>({
    queryKey: ["subjects-libro"],
    queryFn: () => api.listSubjects(true) as unknown as Promise<SubjectRow[]>,
  });

  const gradeBookQuery = useQuery({
    queryKey: ["grade-book", courseId, subjectId],
    queryFn: () => api.getCourseGradeBook(courseId, subjectId ? { subjectId } : undefined),
    enabled: Boolean(courseId),
  });

  const updateGradeMutation = useMutation({
    mutationFn: ({ gradeId, grade, comments }: { gradeId: string; grade: number; comments?: string }) =>
      api.updateGrade(gradeId, { grade, comments }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grade-book", courseId, subjectId] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Error al guardar.", "error"),
  });

  const directGradeMutation = useMutation({
    mutationFn: (payload: { assessmentId: string; studentId: string; grade: number; comments?: string }) =>
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
      setNewEvalType("PROCESO");
      setNewEvalWeight(25);
      setNewEvalSemester(1);
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

  const searchLower = search.toLowerCase();
  const filteredStudents = useMemo(() => {
    let pool = allStudents;
    if (searchLower) {
      pool = pool.filter((s) => `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchLower) || s.rut.includes(searchLower));
    }
    if (soloRiesgo) pool = pool.filter((s) => s.atRisk);
    if (soloPendientes) pool = pool.filter((s) => s.hasPending);
    if (soloBajo4) pool = pool.filter((s) => s.grades.some((g) => g.grade !== null && g.grade < 4.0));
    return pool;
  }, [allStudents, searchLower, soloRiesgo, soloPendientes, soloBajo4]);

  const evSimce = allAssessments.filter((a) => a.type === "SIMCE");
  const evRegulares = allAssessments.filter((a) => a.type !== "SIMCE");
  const evTodas = [...evRegulares, ...evSimce];
  const hayDatos = filteredStudents.length > 0 && evTodas.length > 0;

  useEffect(() => {
    if (courses.length > 0 && !courseId) {
      setCourseId(courses[0].course_id);
    }
  }, [courses, courseId]);

  const handleCeldaClick = useCallback((estudianteId: string, evaluacionId: string, notaActual: number | null) => {
    setCeldaEditando({ estudianteId, evaluacionId });
    setEditingValue(notaActual !== null && notaActual !== undefined ? notaActual.toFixed(1).replace(".", ",") : "");
  }, []);

  const handleSaveNota = useCallback((estudianteId: string, evaluacionId: string) => {
    const trimmed = editingValue.trim().replace(",", ".");
    const cellKey = `${estudianteId}|${evaluacionId}`;

    if (trimmed === "" || trimmed === "-") {
      // Clear = ignore (backend doesn't support clearing via this flow)
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
    if (!activeSubjectId) {
      toast("No hay asignaturas disponibles.", "error");
      return;
    }

    createAssessmentMutation.mutate({
      courseId,
      subjectId: activeSubjectId,
      title: newEvalTitle.trim(),
      assessmentType: newEvalType,
      weight: newEvalWeight,
      semester: newEvalSemester,
      deliveryMode: "PAPER",
    });
  }, [courseId, subjectId, newEvalTitle, newEvalType, newEvalWeight, newEvalSemester, subjects, createAssessmentMutation, toast]);

  // Keyboard navigation between cells
  const handleCellKeyDown = useCallback((e: React.KeyboardEvent, estudianteId: string, evaluacionId: string) => {
    if (e.key === "Escape") {
      setCeldaEditando(null);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveNota(estudianteId, evaluacionId);
      return;
    }

    // Arrow keys navigation (only if not editing or after saving)
    if (celdaEditando && (e.key === "Tab" || e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      const currentEvalIdx = evTodas.findIndex((ev) => ev.id === evaluacionId);
      const currentStudentIdx = filteredStudents.findIndex((s) => s.studentId === estudianteId);

      let nextStudentIdx = currentStudentIdx;
      let nextEvalIdx = currentEvalIdx;

      if (e.key === "ArrowRight" || (e.key === "Tab" && !e.shiftKey)) {
        nextEvalIdx = currentEvalIdx + 1;
      } else if (e.key === "ArrowLeft" || (e.key === "Tab" && e.shiftKey)) {
        nextEvalIdx = currentEvalIdx - 1;
      } else if (e.key === "ArrowDown") {
        nextStudentIdx = currentStudentIdx + 1;
      } else if (e.key === "ArrowUp") {
        nextStudentIdx = currentStudentIdx - 1;
      }

      if (nextEvalIdx < 0) nextEvalIdx = evTodas.length - 1;
      if (nextEvalIdx >= evTodas.length) nextEvalIdx = 0;
      if (nextStudentIdx < 0) nextStudentIdx = filteredStudents.length - 1;
      if (nextStudentIdx >= filteredStudents.length) nextStudentIdx = 0;

      const nextStudent = filteredStudents[nextStudentIdx];
      const nextEval = evTodas[nextEvalIdx];
      if (nextStudent && nextEval) {
        // Save current first
        handleSaveNota(estudianteId, evaluacionId);
        const g = nextStudent.grades.find((n) => n.assessmentId === nextEval.id);
        setTimeout(() => {
          handleCeldaClick(nextStudent.studentId, nextEval.id, g?.grade ?? null);
        }, 50);
      }
    }
  }, [celdaEditando, evTodas, filteredStudents, handleSaveNota, handleCeldaClick]);

  // Close modal on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (newEvalFormRef.current && !newEvalFormRef.current.contains(e.target as Node)) {
        setShowNewAssessment(false);
      }
    };
    if (showNewAssessment) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showNewAssessment]);

  return (
    <div className="libro-evaluaciones">
      {/* ─── MODERN HEADER ─── */}
      <header className="libro-header-v2">
        <div className="libro-header-v2__inner">
          <div className="libro-header-v2__title">
            <div className="libro-header-v2__icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                <line x1="8" y1="7" x2="16" y2="7"/>
                <line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
            </div>
            <div>
              <h1>Libro de Evaluaciones</h1>
              <p>Libro de clases digital &middot; Monitoreo en tiempo real de aprendizajes</p>
            </div>
          </div>
          {hayDatos && (
            <button className="btn btn--primary libro-header-v2__action" onClick={() => setShowNewAssessment(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nueva Evaluacion
            </button>
          )}
        </div>
      </header>

      {/* ─── KPI CARDS ─── */}
      {stats && (
        <section className="libro-kpi-grid-v2">
          <div className="libro-kpi-card-v2">
            <div className="libro-kpi-card-v2__icon" style={{ background: stats.courseAvg < 4.0 ? "var(--danger-bg)" : stats.courseAvg >= 5.0 ? "var(--success-bg)" : "var(--accent-light)", color: stats.courseAvg < 4.0 ? "var(--danger)" : stats.courseAvg >= 5.0 ? "var(--success)" : "var(--accent)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <div>
              <span className="libro-kpi-card-v2__label">Promedio Curso</span>
              <strong className="libro-kpi-card-v2__value" style={{ color: colorNota(stats.courseAvg) }}>{formatearNota(stats.courseAvg)}</strong>
            </div>
          </div>
          <div className="libro-kpi-card-v2">
            <div className="libro-kpi-card-v2__icon" style={{ background: stats.approvalRate >= 70 ? "var(--success-bg)" : "var(--warning-bg)", color: stats.approvalRate >= 70 ? "var(--success)" : "var(--warning)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div>
              <span className="libro-kpi-card-v2__label">% Aprobacion</span>
              <strong className="libro-kpi-card-v2__value">{stats.approvalRate}%</strong>
            </div>
          </div>
          <div className="libro-kpi-card-v2">
            <div className="libro-kpi-card-v2__icon" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div>
              <span className="libro-kpi-card-v2__label">En Riesgo</span>
              <strong className="libro-kpi-card-v2__value" style={{ color: "var(--danger)" }}>{stats.atRiskCount}</strong>
            </div>
          </div>
          <div className="libro-kpi-card-v2">
            <div className="libro-kpi-card-v2__icon" style={{ background: "var(--gold-light)", color: "var(--gold)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div>
              <span className="libro-kpi-card-v2__label">Pendientes</span>
              <strong className="libro-kpi-card-v2__value" style={{ color: "var(--warning)" }}>{stats.pendingsCount}</strong>
            </div>
          </div>
          <div className="libro-kpi-card-v2">
            <div className="libro-kpi-card-v2__icon" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </div>
            <div>
              <span className="libro-kpi-card-v2__label">Notas Registradas</span>
              <strong className="libro-kpi-card-v2__value">{stats.totalNotes}</strong>
            </div>
          </div>
          <div className="libro-kpi-card-v2">
            <div className="libro-kpi-card-v2__icon" style={{ background: "var(--info-bg)", color: "var(--info)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            </div>
            <div>
              <span className="libro-kpi-card-v2__label">Eval. Aplicadas</span>
              <strong className="libro-kpi-card-v2__value">{stats.appliedCount}/{stats.totalAssessments}</strong>
            </div>
          </div>
        </section>
      )}

      {/* ─── FILTERS ─── */}
      <section className="panel libro-filtros-v2">
        <div className="libro-filtros-v2__row">
          <div className="form-field" style={{ flex: 2 }}>
            <label>Curso</label>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">Seleccionar curso...</option>
              {courses.map((c) => <option key={c.course_id} value={c.course_id}>{c.course_name}</option>)}
            </select>
          </div>
          <div className="form-field" style={{ flex: 1.5 }}>
            <label>Asignatura</label>
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">Todas</option>
              {subjects.map((s) => <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>)}
            </select>
          </div>
          <div className="form-field" style={{ flex: 2 }}>
            <label>Buscar</label>
            <input type="text" placeholder="Nombre, apellido o RUT..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="libro-filtros-v2__tags">
          <label className={`libro-filtro-tag ${soloRiesgo ? "libro-filtro-tag--active" : ""}`}>
            <input type="checkbox" checked={soloRiesgo} onChange={(e) => setSoloRiesgo(e.target.checked)} />
            <span className="libro-filtro-tag__dot" style={{ background: "var(--danger)" }}/>
            En Riesgo
          </label>
          <label className={`libro-filtro-tag ${soloPendientes ? "libro-filtro-tag--active" : ""}`}>
            <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} />
            <span className="libro-filtro-tag__dot" style={{ background: "var(--warning)" }}/>
            Pendientes
          </label>
          <label className={`libro-filtro-tag ${soloBajo4 ? "libro-filtro-tag--active" : ""}`}>
            <input type="checkbox" checked={soloBajo4} onChange={(e) => setSoloBajo4(e.target.checked)} />
            <span className="libro-filtro-tag__dot" style={{ background: "var(--danger)" }}/>
            Notas &lt; 4,0
          </label>
        </div>
      </section>

      {/* ─── EMPTY / LOADING / ERROR ─── */}
      {!courseId && (
        <section className="panel">
          <div className="empty-state">
            <strong>Selecciona un curso para ver el libro de evaluaciones</strong>
            <p>Elige un curso y opcionalmente una asignatura para ver las notas registradas.</p>
          </div>
        </section>
      )}

      {courseId && gradeBookQuery.isLoading && <LoadingSpinner label="Cargando libro de evaluaciones..." />}

      {courseId && gradeBookQuery.isError && (
        <section className="panel">
          <p className="error">Error al cargar el libro de evaluaciones. Verifica que el curso tenga estudiantes y evaluaciones registradas.</p>
        </section>
      )}

      {/* ─── MAIN TABLE ─── */}
      {hayDatos && (
        <section className="panel libro-tabla-panel-v2">
          <div className="libro-tabla-header-v2">
            <div>
              <h3>Libro de Clases &mdash; {book?.course?.name}{subjectId ? ` | ${subjects.find((s) => s.subject_id === subjectId)?.subject_name || ""}` : ""}</h3>
              <span className="libro-tabla-header-v2__meta">{filteredStudents.length} estudiantes &middot; {evTodas.length} evaluaciones</span>
            </div>
            <button className="btn btn--ghost libro-add-col-btn" onClick={() => setShowNewAssessment(true)} title="Agregar columna de evaluacion">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Agregar Evaluacion
            </button>
          </div>

          <div className="table-wrap libro-table-wrap-v2">
            <table className="table libro-table-v2">
              <thead>
                <tr>
                  <th className="libro-col-nro">N&deg;</th>
                  <th className="libro-col-nombre">Estudiante</th>
                  <th className="libro-col-rut">RUT</th>
                  {evRegulares.map((ev) => (
                    <th key={ev.id} className="libro-col-eval" title={`${ev.title}\nTipo: ${ev.type}\nPond: ${ev.weight}%\nOA: ${ev.oaCode || "\u2014"}`}>
                      <div className="libro-eval-header-v2">
                        <span className="libro-eval-nombre-v2">{ev.title.length > 12 ? ev.title.slice(0, 12) + "..." : ev.title}</span>
                        <span className="libro-eval-tipo-v2">{ev.type}</span>
                        <span className="libro-eval-pond-v2">{ev.weight}%</span>
                      </div>
                    </th>
                  ))}
                  {evSimce.length > 0 && <th colSpan={evSimce.length} className="libro-col-simce-group-v2">SIMCE</th>}
                  {evSimce.map((ev) => (
                    <th key={ev.id} className="libro-col-eval libro-col-eval--simce" title={`${ev.title}\nPond: ${ev.weight}%`}>
                      <div className="libro-eval-header-v2">
                        <span className="libro-eval-nombre-v2">{ev.title.length > 10 ? ev.title.slice(0, 10) + "..." : ev.title}</span>
                        <span className="libro-eval-tipo-v2">SIMCE</span>
                        <span className="libro-eval-pond-v2">{ev.weight}%</span>
                      </div>
                    </th>
                  ))}
                  {/* Add column button as last header */}
                  <th className="libro-col-add">
                    <button className="libro-add-col-btn-inline" onClick={() => setShowNewAssessment(true)} title="Nueva evaluacion">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                    </button>
                  </th>
                  <th className="libro-col-prom">Promedio</th>
                  <th className="libro-col-nivel">Nivel</th>
                  <th className="libro-col-obs">Observacion</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((est, idx) => {
                  const avg = est.average;
                  const nivelLogro = getNivelLogro(avg);
                  const notaRoja = est.grades.some((g) => g.grade !== null && g.grade < 4.0);
                  const pendiente = est.hasPending;

                  return (
                    <tr key={est.studentId} className={`libro-row-v2 ${notaRoja ? "libro-row--riesgo" : ""} ${pendiente ? "libro-row--pendiente" : ""}`}>
                      <td className="libro-col-nro">{idx + 1}</td>
                      <td className="libro-col-nombre"><strong>{est.lastName}, {est.firstName}</strong></td>
                      <td className="libro-col-rut" style={{ fontFamily: "var(--font-mono)", fontSize: ".8rem" }}>{est.rut || "\u2014"}</td>
                      {evRegulares.map((ev) => {
                        const g = est.grades.find((n) => n.assessmentId === ev.id);
                        const isEditing = celdaEditando?.estudianteId === est.studentId && celdaEditando?.evaluacionId === ev.id;
                        const cellKey = `${est.studentId}|${ev.id}`;
                        const isSaving = savingCells.has(cellKey);
                        return (
                          <td key={ev.id} className={`libro-col-eval libro-col-editable-v2 ${isEditing ? "libro-col-editable-v2--active" : ""}`}>
                            {isEditing ? (
                              <input className="libro-edit-input-v2" type="text" inputMode="decimal" value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                onBlur={() => handleSaveNota(est.studentId, ev.id)}
                                onKeyDown={(e) => handleCellKeyDown(e, est.studentId, ev.id)}
                                autoFocus onFocus={(e) => e.target.select()} />
                            ) : (
                              <span className={`libro-grade-value-v2 ${isSaving ? "libro-grade-value-v2--saving" : ""}`}
                                style={{ color: colorNota(g?.grade ?? null), fontWeight: g?.grade !== null ? 700 : 400 }}
                                title={g && g.grade != null ? `Nota: ${formatearNota(g.grade)}\nClick para editar` : "Click para ingresar nota"}
                                onClick={() => handleCeldaClick(est.studentId, ev.id, g?.grade ?? null)}>
                                {formatearNota(g?.grade ?? null)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      {evSimce.map((ev) => {
                        const g = est.grades.find((n) => n.assessmentId === ev.id);
                        const isEditing = celdaEditando?.estudianteId === est.studentId && celdaEditando?.evaluacionId === ev.id;
                        return (
                          <td key={ev.id} className={`libro-col-eval libro-col-eval--simce libro-col-editable-v2 ${isEditing ? "libro-col-editable-v2--active" : ""}`}>
                            {isEditing ? (
                              <input className="libro-edit-input-v2" type="text" inputMode="decimal" value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                onBlur={() => handleSaveNota(est.studentId, ev.id)}
                                onKeyDown={(e) => handleCellKeyDown(e, est.studentId, ev.id)}
                                autoFocus onFocus={(e) => e.target.select()} />
                            ) : (
                              <span className="libro-grade-value-v2"
                                style={{ color: colorNota(g?.grade ?? null), fontWeight: g?.grade !== null ? 700 : 400 }}
                                title={g && g.grade != null ? `Nota: ${formatearNota(g.grade)}\nClick para editar` : "Click para ingresar nota"}
                                onClick={() => handleCeldaClick(est.studentId, ev.id, g?.grade ?? null)}>
                                {formatearNota(g?.grade ?? null)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="libro-col-add"></td>
                      <td className="libro-col-prom" style={{ fontWeight: 700, color: colorNota(avg) }}>{formatearNota(avg)}</td>
                      <td className="libro-col-nivel">
                        <span className={`badge ${nivelLogro === "Avanzado" ? "badge--active" : nivelLogro === "Adecuado" ? "badge--active" : nivelLogro === "Basico" ? "badge--warning" : "badge--inactive"}`}>{nivelLogro}</span>
                      </td>
                      <td className="libro-col-obs">
                        {notaRoja && <span style={{ color: "var(--danger)", fontSize: ".74rem" }}>&#9888; Bajo 4.0</span>}
                        {pendiente && <span style={{ color: "var(--warning)", fontSize: ".74rem" }}>&#9888; Pendiente</span>}
                        {!notaRoja && !pendiente && avg && avg >= 6.0 ? <span style={{ color: "var(--success)", fontSize: ".74rem" }}>Destacado</span> : ""}
                      </td>
                    </tr>
                  );
                })}
                {/* Footer row for adding a new student note (future) */}
              </tbody>
            </table>
          </div>

          <div className="libro-leyenda-v2">
            <span><span className="libro-leyenda-dot" style={{ background: "var(--danger)" }}/> Nota &lt; 4,0</span>
            <span><span className="libro-leyenda-dot" style={{ background: "var(--success)" }}/> Nota &ge; 6,0</span>
            <span><span className="libro-leyenda-dot" style={{ background: "var(--warning)" }}/> Pendiente</span>
            <span className="libro-leyenda-v2__hint">Click para editar &middot; Enter guarda &middot; Esc cancela &middot; Flechas navegan</span>
          </div>
        </section>
      )}

      {/* ─── WEIGHT SUMMARY ─── */}
      {hayDatos && (
        <section className="panel panel--collapsible">
          <div className="panel__toggle" onClick={() => setShowPonderaciones(!showPonderaciones)}>
            <h3>Resumen de Ponderaciones</h3>
            <span className="panel__toggle-arrow" style={{ transform: showPonderaciones ? "rotate(180deg)" : "" }}>&#9660;</span>
          </div>
          {showPonderaciones && (
            <div className="panel__content">
              <div className="form-grid" style={{ marginBottom: 12 }}>
                <div className="form-field"><label>Total ponderado</label><span style={{ fontSize: "1.3rem", fontWeight: 800, color: evTodas.reduce((s, e) => s + e.weight, 0) === 100 ? "var(--success)" : "var(--danger)" }}>{evTodas.reduce((s, e) => s + e.weight, 0)}%</span></div>
                <div className="form-field"><label>Promedio general</label><span style={{ fontSize: "1.3rem", fontWeight: 800 }}>{formatearNota(stats?.courseAvg || 0)}</span></div>
                <div className="form-field"><label>Aprobados</label><span style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--success)" }}>{stats?.approvedCount || 0} / {stats?.totalStudents || 0}</span></div>
                <div className="form-field"><label>Bajo 4,0</label><span style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--danger)" }}>{stats?.atRiskCount || 0}</span></div>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Evaluacion</th><th>Tipo</th><th>Semestre</th><th>Ponderacion</th><th>Estado</th><th>OA</th></tr></thead>
                  <tbody>
                    {evTodas.map((ev) => (
                      <tr key={ev.id}>
                        <td><strong>{ev.title}</strong></td>
                        <td><span className="badge badge--role">{ev.type}</span></td>
                        <td>{ev.semester}&deg;</td>
                        <td style={{ fontWeight: 700 }}>{ev.weight}%</td>
                        <td><span className={`badge ${ev.status === "GRADED" ? "badge--active" : ev.status === "IN_GRADING" ? "badge--warning" : "badge--inactive"}`}>{ev.status}</span></td>
                        <td style={{ fontSize: ".8rem" }}>{ev.oaCode || "\u2014"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ─── OA DESCENDIDOS ─── */}
      {hayDatos && (book?.oaDescendidos?.length || 0) > 0 && (
        <section className="panel panel--collapsible libro-ruta-v2">
          <div className="panel__toggle" onClick={() => setShowOaDescendidos(!showOaDescendidos)}>
            <h3>OA Descendidos &mdash; Ruta de Aprendizaje Sugerida</h3>
            <span className="panel__toggle-arrow" style={{ transform: showOaDescendidos ? "rotate(180deg)" : "" }}>&#9660;</span>
          </div>
          {showOaDescendidos && (
            <div className="panel__content">
              <div className="libro-ruta-alert">
                <strong>&#9888; Se detectaron {book?.oaDescendidos?.length} OA con rendimiento bajo 4,0</strong>
                <p>Se recomienda implementar un plan remedial enfocado en estos objetivos.</p>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>OA</th><th>Descripcion</th><th>Promedio</th><th>Registros</th><th>Recomendacion</th></tr></thead>
                  <tbody>
                    {(book?.oaDescendidos || []).map((oa) => (
                      <tr key={oa.code}>
                        <td><span className="badge badge--inactive">{oa.code}</span></td>
                        <td style={{ fontSize: ".84rem" }}>{oa.description}</td>
                        <td style={{ fontWeight: 700, color: "var(--danger)" }}>{formatearNota(oa.average)}</td>
                        <td style={{ textAlign: "center" }}>{oa.count}</td>
                        <td style={{ fontSize: ".82rem" }}>
                          {oa.average < 3.0 ? "Reforzar con guias de ejercicios y evaluacion de seguimiento en 2 semanas." : "Repasar contenidos clave con actividades grupales y reevaluar en 3 semanas."}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ─── NEW ASSESSMENT MODAL ─── */}
      {showNewAssessment && (
        <div className="libro-modal-overlay" onClick={() => setShowNewAssessment(false)}>
          <div className="libro-modal" ref={newEvalFormRef} onClick={(e) => e.stopPropagation()}>
            <div className="libro-modal__header">
              <h2>Nueva Evaluacion</h2>
              <button className="libro-modal__close" onClick={() => setShowNewAssessment(false)}>&times;</button>
            </div>
            <div className="libro-modal__body">
              <div className="form-field">
                <label>Titulo de la evaluacion <span style={{ color: "var(--danger)" }}>*</span></label>
                <input type="text" placeholder="Ej: Prueba Unidad 1..." value={newEvalTitle}
                  onChange={(e) => setNewEvalTitle(e.target.value)} autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreateAssessment(); }} />
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Tipo</label>
                  <select value={newEvalType} onChange={(e) => setNewEvalType(e.target.value)}>
                    {ASSESSMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Semestre</label>
                  <select value={newEvalSemester} onChange={(e) => setNewEvalSemester(Number(e.target.value))}>
                    <option value={1}>1er Semestre</option>
                    <option value={2}>2do Semestre</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>Ponderacion (%)</label>
                  <input type="number" min={0} max={100} value={newEvalWeight}
                    onChange={(e) => setNewEvalWeight(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} />
                </div>
              </div>
              <div className="libro-modal__info">
                <p>Curso: <strong>{book?.course?.name || "\u2014"}</strong></p>
                <p>Asignatura: <strong>{subjectId ? subjects.find((s) => s.subject_id === subjectId)?.subject_name || "\u2014" : "Todas"}</strong></p>
                <p style={{ fontSize: ".78rem", color: "var(--muted)", marginTop: 8 }}>La evaluacion se creara en estado DRAFT. Luego podras ingresar las notas directamente desde el libro.</p>
              </div>
            </div>
            <div className="libro-modal__footer">
              <button className="btn btn--ghost" onClick={() => setShowNewAssessment(false)}>Cancelar</button>
              <button className="btn btn--primary" onClick={handleCreateAssessment}
                disabled={createAssessmentMutation.isPending || !newEvalTitle.trim()}>
                {createAssessmentMutation.isPending ? "Creando..." : "Crear Evaluacion"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
