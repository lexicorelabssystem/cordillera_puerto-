import { useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { EmptyState } from "../../components/common/EmptyState";
import { useToast } from "../../components/common/Toast";
import { SimceAssessmentList } from "./simce/SimceAssessmentList";
import { SimceAnswerKeyForm } from "./simce/SimceAnswerKeyForm";
import { SimceStudentResponseGrid } from "./simce/SimceStudentResponseGrid";
import { SimceCorrectionView } from "./simce/SimceCorrectionView";
import { SimceGroupReview } from "./simce/SimceGroupReview";
import { SimceResultsPanel } from "./simce/SimceResultsPanel";
import { SimcePdfViewer } from "./simce/SimcePdfViewer";
import type { SimceAssessment } from "./simce/simce.types";

type SimceStep = "detail" | "key" | "responses" | "correction" | "review" | "results";

const STEPS: { id: SimceStep; label: string; description: string }[] = [
  { id: "detail", label: "1. Detalle y PDF", description: "Información de la prueba y subida de PDF" },
  { id: "key", label: "2. Pauta", description: "Alternativas correctas por pregunta" },
  { id: "responses", label: "3. Respuestas", description: "Ingresar respuestas de alumnos" },
  { id: "correction", label: "4. Corrección", description: "Revisar resultados por alumno" },
  { id: "review", label: "5. Revisión grupal", description: "Revisar pregunta por pregunta en clases" },
  { id: "results", label: "6. Resultados", description: "Resumen y reporte del curso" },
];

const statusStepDefault: Record<string, SimceStep> = {
  DRAFT: "key",
  KEY_PENDING: "key",
  READY_TO_CORRECT: "responses",
  CORRECTED: "results",
};

export function SimceBankPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<SimceStep>("detail");

  const assessmentQuery = useQuery({
    queryKey: ["simce-assessment", selectedId],
    queryFn: () => api.getSimceAssessment(selectedId!) as Promise<SimceAssessment>,
    enabled: Boolean(selectedId),
  });

  const assessment = assessmentQuery.data;

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  useEffect(() => {
    if (assessment) {
      const defaultStep = statusStepDefault[assessment.status] || "detail";
      setCurrentStep(defaultStep);
    }
  }, [assessment?.id, assessment?.status]);

  const autoCorrectMutation = useMutation({
    mutationFn: () => api.autoCorrectSimce(assessment!.id),
    onSuccess: () => {
      toast("Auto-corrección completada.", "success");
      queryClient.invalidateQueries({ queryKey: ["simce-assessments"] });
      queryClient.invalidateQueries({ queryKey: ["simce-assessment", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["simce-results", selectedId] });
      setCurrentStep("results");
    },
    onError: (error) => toast(error instanceof Error ? error.message : "Error en auto-corrección.", "error"),
  });

  const uploadPdfMutation = useMutation({
    mutationFn: async ({ file, id }: { file: File; id: string }) => {
      const result = await api.uploadFile("simce", id, file) as { fileId: string };
      await api.updateSimceAssessment(id, { pdfFileId: result.fileId });
    },
    onSuccess: () => {
      toast("PDF subido correctamente.", "success");
      queryClient.invalidateQueries({ queryKey: ["simce-assessment", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["simce-assessments"] });
    },
    onError: (error) => toast(error instanceof Error ? error.message : "No se pudo subir el PDF.", "error"),
  });

  function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.includes("pdf")) {
      toast("Solo se permiten archivos PDF.", "error");
      return;
    }
    uploadPdfMutation.mutate({ file, id: assessment!.id });
  }

  const pdfFileName = assessment?.pdfFile?.fileName ?? "";
  const pdfViewUrl = pdfFileName ? `/api/v1/files/view/${pdfFileName}` : null;
  const pdfDownloadUrl = pdfFileName ? `/api/v1/files/download/${pdfFileName}` : null;

  return (
    <section className="panel simce-bank-page">
      <div className="panel-heading">
        <div>
          <h2 style={{ margin: 0, fontSize: "1.3rem" }}>Módulo SIMCE</h2>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: ".84rem" }}>
            Sube pruebas PDF, crea pautas de corrección, ingresa respuestas y corrige automáticamente.
          </p>
        </div>
      </div>

      <div className="simce-layout">
        <aside className="simce-sidebar">
          <SimceAssessmentList onSelect={handleSelect} selectedId={selectedId} />
        </aside>

        <main className="simce-main">
          {!selectedId ? (
            <EmptyState
              title="Selecciona una prueba SIMCE"
              description="Elige una prueba existente de la lista o crea una nueva para comenzar a trabajar."
            />
          ) : assessmentQuery.isLoading ? (
            <LoadingSpinner label="Cargando prueba..." />
          ) : assessment ? (
            <>
              <div className="simce-assessment-header">
                <h3>{assessment.title}</h3>
                <div className="simce-assessment-meta">
                  <span>{assessment.course?.name} {assessment.course?.gradeLevel ? `${assessment.course.gradeLevel}°` : ""}</span>
                  <span>{assessment.subject?.name}</span>
                  <span>{assessment.date ? new Date(assessment.date).toLocaleDateString("es-CL") : ""}</span>
                  <span className={`badge ${assessment.status === "CORRECTED" ? "badge--active" : assessment.status === "READY_TO_CORRECT" ? "badge--info" : "badge--warning"}`}>
                    {assessment.status}
                  </span>
                </div>
              </div>

              {/* Step indicator */}
              <div className="simce-steps">
                {STEPS.map((step, index) => (
                  <button
                    key={step.id}
                    type="button"
                    className={`simce-step ${currentStep === step.id ? "simce-step--active" : ""}`}
                    onClick={() => setCurrentStep(step.id)}
                    title={step.description}
                  >
                    <span className="simce-step__indicator">{index + 1}</span>
                    <span className="simce-step__label">{step.label}</span>
                  </button>
                ))}
              </div>

              <div className="simce-step-content">
                {currentStep === "detail" && (
                  <div className="simce-detail">
                    <div className="panel-heading">
                      <div>
                        <h3>Detalle de la prueba</h3>
                        <p style={{ color: "var(--muted)", fontSize: ".84rem" }}>
                          Información general y archivo PDF asociado.
                        </p>
                      </div>
                    </div>

                    <div className="simce-detail-grid">
                      <div className="simce-detail-field">
                        <label>Nombre</label>
                        <span>{assessment.title}</span>
                      </div>
                      <div className="simce-detail-field">
                        <label>Curso</label>
                        <span>{assessment.course?.name} ({assessment.gradeLevel}°)</span>
                      </div>
                      <div className="simce-detail-field">
                        <label>Asignatura</label>
                        <span>{assessment.subject?.name}</span>
                      </div>
                      <div className="simce-detail-field">
                        <label>Fecha</label>
                        <span>{assessment.date ? new Date(assessment.date).toLocaleDateString("es-CL") : "Sin fecha"}</span>
                      </div>
                      <div className="simce-detail-field">
                        <label>Profesor</label>
                        <span>{assessment.teacher?.user ? `${assessment.teacher.user.firstName} ${assessment.teacher.user.lastName}` : "-"}</span>
                      </div>
                      <div className="simce-detail-field">
                        <label>Estado</label>
                        <span>{assessment.status}</span>
                      </div>
                      <div className="simce-detail-field">
                        <label>Año académico</label>
                        <span>{assessment.academicYear?.year ?? "—"}</span>
                      </div>
                    </div>

                    {assessment.description && (
                      <div className="simce-detail-field" style={{ marginTop: 12 }}>
                        <label>Descripción</label>
                        <p>{assessment.description}</p>
                      </div>
                    )}

                      <div className="simce-pdf-section" style={{ marginTop: 16 }}>
                        <div className="panel-heading">
                          <div>
                            <h3>PDF de la prueba</h3>
                            <p style={{ color: "var(--muted)", fontSize: ".84rem" }}>
                              {assessment.pdfFile ? `Archivo: ${assessment.pdfFile.originalName}` : "No se ha subido un PDF aún."}
                            </p>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            {pdfDownloadUrl && (
                              <a className="btn-small" href={pdfDownloadUrl} rel="noreferrer">
                                Descargar PDF
                              </a>
                            )}
                            <label className="btn-small" style={{ cursor: "pointer" }}>
                              {uploadPdfMutation.isPending ? "Subiendo..." : assessment.pdfFile ? "Cambiar PDF" : "Subir PDF"}
                              <input
                                type="file"
                                accept=".pdf"
                                style={{ display: "none" }}
                                onChange={handlePdfUpload}
                                disabled={uploadPdfMutation.isPending}
                              />
                            </label>
                          </div>
                        </div>
                        {pdfViewUrl ? (
                          <SimcePdfViewer
                            url={pdfViewUrl}
                            fileName={assessment.pdfFile?.originalName}
                          />
                        ) : null}
                      </div>
                  </div>
                )}

                {currentStep === "key" && <SimceAnswerKeyForm assessment={assessment} />}

                {currentStep === "responses" && (
                  <div>
                    <SimceStudentResponseGrid assessment={assessment} />
                    <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
                      <button
                        className="btn-primary"
                        onClick={() => autoCorrectMutation.mutate()}
                        disabled={autoCorrectMutation.isPending}
                      >
                        {autoCorrectMutation.isPending ? "Corrigiendo..." : "Ejecutar auto-corrección"}
                      </button>
                    </div>
                  </div>
                )}

                {currentStep === "correction" && <SimceCorrectionView assessment={assessment} />}

                {currentStep === "review" && <SimceGroupReview assessment={assessment} />}

                {currentStep === "results" && <SimceResultsPanel assessment={assessment} />}
              </div>
            </>
          ) : (
            <EmptyState title="Error" description="No se pudo cargar la prueba seleccionada." />
          )}
        </main>
      </div>
    </section>
  );
}
