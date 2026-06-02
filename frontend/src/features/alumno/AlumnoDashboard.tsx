import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { CSSProperties } from "react";
import { ShellLayout } from "../../components/common/ShellLayout";
import { KpiCard } from "../../components/common/KpiCard";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { Modal } from "../../components/common/Modal";
import { SimcePdfViewer } from "../../pages/admin/simce/SimcePdfViewer";
import { api } from "../../lib/api";
import type { AuthUser } from "../../types/api";

interface Props {
  user: AuthUser;
  onLogout: () => void;
}

export function AlumnoDashboard({ user, onLogout }: Props) {
  const portalQuery = useQuery({
    queryKey: ["student-portal"],
    queryFn: api.studentPortal,
    staleTime: 0,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });
  const portal = portalQuery.data;

  if (portalQuery.isLoading) {
    return (
      <ShellLayout title="Pantalla Alumno" subtitle="Cargando tus datos..." right={null} className="shell--student">
        <LoadingSpinner label="Cargando panel de estudiante..." size="lg" />
      </ShellLayout>
    );
  }

  if (portalQuery.isError) {
    return (
      <ShellLayout title="Pantalla Alumno" subtitle="Error al cargar tus datos" right={null} className="shell--student">
        <section className="panel">
          <p style={{ color: "var(--danger)" }}>
            No se pudieron cargar tus datos academicos. Intenta recargar la pagina o contacta a tu profesor.
          </p>
        </section>
      </ShellLayout>
    );
  }

  const recentGrades = portal?.grades?.slice(0, 4) ?? [];
  const recentEvaluations = portal?.evaluations?.slice(0, 6) ?? [];
  const materials = portal?.materials ?? [];
  const currentSemester = portal?.semesters?.find((s) => !s.closed) ?? portal?.semesters?.[portal.semesters.length - 1];
  const avgPercent = Math.max(0, Math.min(100, portal?.overall.avgPercent ?? 0));

  return (
    <ShellLayout
      title="Pantalla Alumno"
      subtitle={`Hola ${user.name}. Tu avance academico en una vista simple.`}
      right={<button onClick={onLogout}>Cerrar sesion</button>}
      className="shell--student"
    >
      <section className="student-hero">
        <div className="student-hero__main">
          <span className="student-hero__eyebrow">Mi resumen</span>
          <strong>{portal?.overall.status ?? "Sin estado anual"}</strong>
          <p>
            Promedio {portal?.overall.avgGrade ?? "-"} con nivel {portal?.overall.level ?? "-"}.
          </p>
        </div>
        <div
          className="student-score"
          aria-label="Porcentaje academico"
          style={{ "--student-score": `${avgPercent}%` } as CSSProperties}
        >
          <span>{avgPercent}%</span>
          <small>avance</small>
        </div>
      </section>

      <section className="kpi-grid">
        <KpiCard label="Promedio general" value={portal?.overall.avgGrade ?? "-"} />
        <KpiCard label="Equivalente %" value={portal ? `${portal.overall.avgPercent}%` : "-"} />
        <KpiCard label="Nivel de desempeno" value={portal?.overall.level ?? "-"} />
        <KpiCard label="Evaluaciones" value={portal?.evaluations?.length ?? 0} />
        <KpiCard label="Materiales" value={portal?.materials?.length ?? 0} />
      </section>

      <section className="student-grid">
        <article className="panel student-panel">
          <h3>Semestre actual</h3>
          {currentSemester ? (
            <div className="student-semester">
              <strong>{currentSemester.avgGrade}</strong>
              <span>Semestre {currentSemester.semester}</span>
              <p>{currentSemester.totalGrades} notas registradas - {currentSemester.closed ? "Cerrado" : "Abierto"}</p>
              <span className="badge badge--role">{currentSemester.status}</span>
            </div>
          ) : (
            <p style={{ color: "var(--muted)" }}>No hay datos de cierre semestral disponibles.</p>
          )}
        </article>

        <article className="panel student-panel">
          <h3>Ultimas evaluaciones</h3>
          {!recentGrades.length ? (
            <p style={{ color: "var(--muted)" }}>Aun no tienes evaluaciones registradas.</p>
          ) : (
            <div className="student-grade-list">
              {recentGrades.map((row) => (
                <div key={`${row.assessment_id}-${row.applied_at}`} className="student-grade-item">
                  <span>{row.subject}</span>
                  <strong>{row.grade}</strong>
                  <small>{row.title}</small>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="panel">
        <h3>Evaluaciones disponibles</h3>
        {!recentEvaluations.length ? (
          <p style={{ color: "var(--muted)" }}>No tienes evaluaciones disponibles por ahora.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Asignatura</th>
                  <th>Evaluacion</th>
                  <th>Profesor</th>
                  <th>Estado</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {recentEvaluations.map((row) => (
                  <tr key={row.assessment_id}>
                    <td>{row.applied_at}</td>
                    <td>{row.subject}</td>
                    <td>{row.title}</td>
                    <td>{row.teacher}</td>
                    <td><span className="badge badge--role">{row.status}</span></td>
                    <td>{row.grade ?? "Pendiente"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h3>Material de apoyo</h3>
        {!materials.length ? (
          <p style={{ color: "var(--muted)" }}>No hay guias o materiales publicados para tus cursos.</p>
        ) : (
          <div className="student-timeline">
            {materials.map((material) => (
              <article key={material.id} className="student-timeline__item">
                <span>{material.subject} - {material.type}</span>
                <strong>{material.title}</strong>
                <p>{material.description || "Material publicado por el profesor."}</p>
                <p>Profesor: {material.teacher}</p>
                {!material.files.length ? (
                  <small style={{ color: "var(--muted)" }}>Sin archivo adjunto.</small>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                    {material.files.map((file) => (
                      <div key={file.id} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                        <span style={{ color: "var(--muted)", fontSize: ".82rem" }}>{file.originalName}</span>
                        <a className="btn-small" href={file.viewUrl} target="_blank" rel="noreferrer">
                          Abrir
                        </a>
                        <a className="btn-small" href={file.downloadUrl} download>
                          Descargar
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <SimceEssaysSection />

      <SimceStudentSection />

      <section className="panel">
        <h3>Cierre semestral</h3>
        {!portal?.semesters?.length ? (
          <p style={{ color: "var(--muted)" }}>No hay datos de cierre semestral disponibles.</p>
        ) : (
          <div className="student-timeline">
            {portal.semesters.map((s) => (
              <article key={s.semester} className="student-timeline__item">
                <span>Semestre {s.semester}</span>
                <strong>{s.avgGrade}</strong>
                <p>{s.totalGrades} notas - {s.closed ? "Cerrado" : "Abierto"} - {s.status}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h3>Alertas personales</h3>
        {!portal?.alerts?.length ? (
          <p style={{ color: "var(--muted)" }}>Sin alertas academicas por ahora.</p>
        ) : (
          <div className="alert-list">
            {portal.alerts.map((a, idx) => (
              <article key={`${a.type}-${idx}`} className="alert-card">
                <strong>{a.type}</strong>
                <p>{a.message}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h3>Seguimiento de evaluaciones</h3>
        {!portal?.grades?.length ? (
          <p style={{ color: "var(--muted)" }}>Aun no tienes evaluaciones registradas.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Semestre</th>
                  <th>Asignatura</th>
                  <th>Evaluacion</th>
                  <th>Profesor</th>
                  <th>Tipo</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {portal.grades.map((row) => (
                  <tr key={row.assessment_id}>
                    <td>{row.applied_at}</td>
                    <td>{row.semester ?? "-"}</td>
                    <td>{row.subject}</td>
                    <td>{row.title}</td>
                    <td>{row.teacher ?? "-"}</td>
                    <td>{row.assessment_type}</td>
                    <td>{row.grade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </ShellLayout>
  );
}

interface SimceResultRow {
  id: string;
  title: string;
  date: string;
  course: string;
  gradeLevel: number;
  subject: string;
  teacher: string;
  totalQuestions: number;
  maxScore: number;
  totalCorrect: number;
  totalIncorrect: number;
  totalOmitted: number;
  totalScore: number;
  percentage: number;
  pdfFile: { id: string } | null;
}

interface SimceDetail {
  student: { firstName: string; lastName: string };
  assessment: { id: string; title: string };
  summary: {
    totalCorrect: number;
    totalIncorrect: number;
    totalOmitted: number;
    totalQuestions: number;
    totalScore: number;
    maxScore: number;
    percentage: number;
    performanceLevel: string;
  };
  questions: {
    questionNumber: number;
    correctOption: string;
    score: number;
    selectedOption: string | null;
    isCorrect: boolean | null;
    scoreObtained: number;
    status: string;
  }[];
}

function SimceStudentSection() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const resultsQuery = useQuery({
    queryKey: ["student-simce-results"],
    queryFn: () => api.getStudentSimceResults() as Promise<SimceResultRow[]>,
  });

  const detailQuery = useQuery({
    queryKey: ["student-simce-detail", selectedId],
    queryFn: () => api.getStudentSimceDetail(selectedId!) as Promise<SimceDetail>,
    enabled: Boolean(selectedId),
  });

  const results = resultsQuery.data || [];
  const detail = detailQuery.data;

  if (resultsQuery.isLoading) return null;
  if (!results.length) return null;

  return (
    <>
      <section className="panel">
        <h3>Resultados SIMCE</h3>
        <p style={{ color: "var(--muted)", fontSize: ".84rem", marginBottom: 12 }}>
          Tus resultados de pruebas tipo SIMCE corregidas por tu profesor.
        </p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Prueba</th>
                <th>Curso</th>
                <th>Asignatura</th>
                <th>Correctas</th>
                <th>%</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {results.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.title}</strong></td>
                  <td>{row.course} ({row.gradeLevel}°)</td>
                  <td>{row.subject}</td>
                  <td style={{ color: "var(--success)", textAlign: "center" }}>{row.totalCorrect}/{row.totalQuestions}</td>
                  <td style={{ fontWeight: 700, color: row.percentage >= 60 ? "var(--success)" : "var(--danger)", textAlign: "center" }}>
                    {row.percentage}%
                  </td>
                  <td>
                    <button className="btn-small" onClick={() => setSelectedId(row.id)}>
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal isOpen={Boolean(selectedId)} onClose={() => setSelectedId(null)} title={detail?.assessment.title ?? "Detalle SIMCE"} size="lg">
        {detailQuery.isLoading ? (
          <LoadingSpinner size="sm" />
        ) : detail ? (
          <div>
            <div className="kpi-grid" style={{ marginBottom: 16 }}>
              <div className="kpi-card"><span>Correctas</span><strong style={{ color: "var(--success)" }}>{detail.summary.totalCorrect}</strong></div>
              <div className="kpi-card"><span>Incorrectas</span><strong style={{ color: "var(--danger)" }}>{detail.summary.totalIncorrect}</strong></div>
              <div className="kpi-card"><span>Omitidas</span><strong style={{ color: "var(--muted)" }}>{detail.summary.totalOmitted}</strong></div>
              <div className="kpi-card"><span>Puntaje</span><strong>{detail.summary.totalScore}/{detail.summary.maxScore}</strong></div>
              <div className="kpi-card"><span>Porcentaje</span><strong style={{ color: detail.summary.percentage >= 60 ? "var(--success)" : "var(--danger)" }}>{detail.summary.percentage}%</strong></div>
              <div className="kpi-card"><span>Nivel</span><strong>{detail.summary.performanceLevel}</strong></div>
            </div>
            <div className="simce-correction-grid" style={{ maxHeight: "50vh", overflowY: "auto" }}>
              {detail.questions.map((q) => (
                <div
                  key={q.questionNumber}
                  className={`simce-correction-cell simce-correction-cell--${q.status.toLowerCase()}`}
                  style={{
                    borderColor:
                      q.status === "CORRECT" ? "var(--success)" :
                      q.status === "INCORRECT" ? "var(--danger)" : "var(--muted)",
                    background:
                      q.status === "CORRECT" ? "#e6ffe6" :
                      q.status === "INCORRECT" ? "#ffe6e6" : "#f5f5f5",
                  }}
                >
                  <span className="simce-correction-cell__num">{q.questionNumber}</span>
                  <div className="simce-correction-cell__content">
                    <span>Marcaste: <strong>{q.selectedOption || "—"}</strong></span>
                    <span>Correcta: <strong>{q.correctOption}</strong></span>
                    <span>{q.scoreObtained}/{q.score} pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p style={{ color: "var(--muted)" }}>No se pudo cargar el detalle.</p>
        )}
      </Modal>
    </>
  );
}

interface SimceEssayRow {
  id: string;
  title: string;
  date: string;
  description: string | null;
  status: string;
  course: string;
  gradeLevel: number;
  subject: string;
  teacher: string;
  totalQuestions: number;
  pdfFile: { id: string; originalName: string; fileName: string } | null;
}

const essayStatusLabels: Record<string, string> = {
  DRAFT: "Borrador",
  KEY_PENDING: "En preparación",
  READY_TO_CORRECT: "Próximamente",
  CORRECTED: "Corregido",
};

function SimceEssaysSection() {
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const [selectedPdfTitle, setSelectedPdfTitle] = useState("");

  const essaysQuery = useQuery({
    queryKey: ["student-simce-essays"],
    queryFn: () => api.getStudentSimceEssays() as Promise<SimceEssayRow[]>,
    staleTime: 0,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const essays = essaysQuery.data || [];

  if (essaysQuery.isLoading) {
    return (
      <section className="panel">
        <h3>Ensayos SIMCE para estudiar</h3>
        <LoadingSpinner label="Cargando ensayos SIMCE..." size="sm" />
      </section>
    );
  }

  const handleViewPdf = (essay: SimceEssayRow) => {
    if (!essay.pdfFile) return;
    const url = `/api/v1/files/view/${essay.pdfFile.fileName}`;
    setSelectedPdfUrl(url);
    setSelectedPdfTitle(essay.title);
  };

  const getDownloadUrl = (essay: SimceEssayRow) => {
    if (!essay.pdfFile) return null;
    return `/api/v1/files/download/${essay.pdfFile.fileName}`;
  };

  return (
    <>
      <section className="panel">
        <h3>Ensayos SIMCE para estudiar</h3>
        <p style={{ color: "var(--muted)", fontSize: ".84rem", marginBottom: 12 }}>
          Pruebas tipo SIMCE disponibles para tu curso. Puedes verlas o descargarlas para estudiar.
        </p>
        {essays.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No hay ensayos SIMCE disponibles para tus cursos.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Ensayo</th>
                  <th>Curso</th>
                  <th>Asignatura</th>
                  <th>Preguntas</th>
                  <th>Estado</th>
                  <th>Profesor</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {essays.map((essay) => {
                  const downloadUrl = getDownloadUrl(essay);
                  return (
                    <tr key={essay.id}>
                      <td>
                        <strong>{essay.title}</strong>
                        {essay.description && (
                          <span style={{ display: "block", color: "var(--muted)", fontSize: ".75rem" }}>
                            {essay.description}
                          </span>
                        )}
                      </td>
                      <td>{essay.course} ({essay.gradeLevel}°)</td>
                      <td>{essay.subject}</td>
                      <td style={{ textAlign: "center" }}>{essay.totalQuestions}</td>
                      <td>
                        <span className="badge badge--role" style={{ fontSize: ".75rem" }}>
                          {essayStatusLabels[essay.status] || essay.status}
                        </span>
                      </td>
                      <td style={{ fontSize: ".84rem" }}>{essay.teacher}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          {essay.pdfFile && (
                            <button className="btn-small" onClick={() => handleViewPdf(essay)}>
                              Ver PDF
                            </button>
                          )}
                          {downloadUrl && (
                            <a className="btn-small" href={downloadUrl} download>
                              Descargar
                            </a>
                          )}
                          {!essay.pdfFile && (
                            <span style={{ color: "var(--muted)", fontSize: ".75rem" }}>Sin archivo</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal isOpen={Boolean(selectedPdfUrl)} onClose={() => { setSelectedPdfUrl(null); setSelectedPdfTitle(""); }} title={selectedPdfTitle} size="lg">
        {selectedPdfUrl && (
          <SimcePdfViewer url={selectedPdfUrl} fileName={selectedPdfTitle} />
        )}
      </Modal>
    </>
  );
}
