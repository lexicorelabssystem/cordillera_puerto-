import { useCallback, useRef, useState } from "react";
import { useToast } from "../common/Toast";
import {
  drawOMROverlay,
  generateOMRGrid,
  processOMRSheet,
  type OMRRegion,
  type OMRResult,
} from "../../lib/omr";

interface QuestionOption {
  label: string;
  value: string;
}

interface Question {
  id: number;
  text: string;
  options: QuestionOption[];
}

interface Props {
  questions: Question[];
  onConfirm: (answers: Record<number, string>) => void;
  onCancel?: () => void;
}

export function OMRReader({ questions, onConfirm, onCancel }: Props) {
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [result, setResult] = useState<OMRResult | null>(null);
  const [regions, setRegions] = useState<OMRRegion[]>([]);
  const [manualAnswers, setManualAnswers] = useState<Record<number, string>>({});
  const [processing, setProcessing] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  const optionsPerQuestion =
    questions.length > 0 ? (questions[0]?.options.length ?? 4) : 4;

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        toast("Selecciona un archivo de imagen v\u00e1lido (PNG, JPG, WebP).", "error");
        return;
      }

      setProcessing(true);
      setResult(null);
      setImageData(null);
      setManualAnswers({});
      setShowOverlay(false);

      const reader = new FileReader();

      reader.onload = (event) => {
        const dataUrl = event.target?.result;
        if (typeof dataUrl !== "string") {
          setProcessing(false);
          toast("No se pudo leer el archivo.", "error");
          return;
        }

        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            setProcessing(false);
            toast("No se pudo procesar la imagen.", "error");
            return;
          }

          ctx.drawImage(img, 0, 0);
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
          setImageData(data);

          const grid = generateOMRGrid(
            questions.length,
            optionsPerQuestion,
            img.width,
            img.height
          );
          setRegions(grid);

          const omrResult = processOMRSheet(data, grid);
          setResult(omrResult);

          setProcessing(false);

          if (omrResult.warnings.length > 0) {
            toast(
              `Procesado con ${omrResult.warnings.length} advertencia(s). Revisa las marcas.`,
              "warning"
            );
          } else {
            toast("Hoja de respuestas procesada correctamente.", "success");
          }
        };

        img.onerror = () => {
          setProcessing(false);
          toast("El archivo no es una imagen v\u00e1lida.", "error");
        };

        img.src = dataUrl;
      };

      reader.onerror = () => {
        setProcessing(false);
        toast("Error al leer el archivo.", "error");
      };

      reader.readAsDataURL(file);
    },
    [questions.length, optionsPerQuestion, toast]
  );

  const handleManualChange = useCallback(
    (questionId: number, value: string) => {
      setManualAnswers((prev) => ({ ...prev, [questionId]: value }));
    },
    []
  );

  const handleDrawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas || !imageData || !result || regions.length === 0) return;

    drawOMROverlay(canvas, imageData, regions, result);
    setShowOverlay(true);
  }, [imageData, result, regions]);

  const handleConfirm = useCallback(() => {
    const finalAnswers: Record<number, string> = {};

    for (const q of questions) {
      finalAnswers[q.id] = manualAnswers[q.id] ?? result?.answers[q.id] ?? "";
    }

    const answered = Object.values(finalAnswers).filter(Boolean).length;
    if (answered < questions.length) {
      toast(
        `Solo ${answered} de ${questions.length} preguntas tienen respuesta. Revisa antes de confirmar.`,
        "warning"
      );
    }

    onConfirm(finalAnswers);
  }, [questions, manualAnswers, result, onConfirm, toast]);

  const getEffectiveAnswer = (questionId: number): string => {
    if (manualAnswers[questionId] !== undefined) return manualAnswers[questionId]!;
    return result?.answers[questionId] ?? "";
  };

  const getConfidenceLevel = (idx: number): "high" | "medium" | "low" => {
    const conf = result?.confidence[idx] ?? 0;
    if (conf >= 0.75) return "high";
    if (conf >= 0.55) return "medium";
    return "low";
  };

  const getConfidenceLabel = (idx: number): string => {
    const level = getConfidenceLevel(idx);
    if (level === "high") return "Alta";
    if (level === "medium") return "Media";
    return "Baja";
  };

  const handleSelectFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleReset = useCallback(() => {
    setImageData(null);
    setResult(null);
    setRegions([]);
    setManualAnswers({});
    setShowOverlay(false);
    setProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  return (
    <div className="omr-reader">
      <div className="omr-reader__header">
        <h2 className="omr-reader__title">Lector de Hojas de Respuesta (OMR)</h2>
        <p className="omr-reader__subtitle">
          Carga una imagen escaneada o fotograf\u00eda de la hoja de respuestas
        </p>
      </div>

      <div className="omr-reader__upload">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileChange}
          className="omr-reader__file-input"
        />
        <button
          type="button"
          className="omr-reader__upload-btn"
          onClick={handleSelectFile}
          disabled={processing}
        >
          {processing ? "Procesando..." : "Seleccionar imagen"}
        </button>
        {imageData && (
          <button
            type="button"
            className="btn-secondary btn-small"
            onClick={handleReset}
          >
            Cargar otra imagen
          </button>
        )}
      </div>

      {processing && (
        <div className="omr-reader__processing">
          <div className="omr-reader__spinner" />
          <span>Procesando imagen...</span>
        </div>
      )}

      {result && (
        <div className="omr-reader__results">
          <div className="omr-reader__results-header">
            <h3>Resultados Detectados</h3>
            <button
              type="button"
              className="btn-secondary btn-small"
              onClick={handleDrawOverlay}
            >
              {showOverlay ? "Refrescar superposici\u00f3n" : "Mostrar superposici\u00f3n"}
            </button>
          </div>

          {result.warnings.length > 0 && (
            <div className="omr-reader__warnings">
              <strong>Advertencias:</strong>
              <ul>
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {showOverlay && imageData && (
            <div className="omr-reader__overlay-container">
              <canvas
                ref={overlayCanvasRef}
                className="omr-reader__overlay-canvas"
              />
            </div>
          )}

          <div className="omr-reader__table-container">
            <table className="omr-reader__table">
              <thead>
                <tr>
                  <th>N\u00b0</th>
                  <th>Pregunta</th>
                  <th>Respuesta detectada</th>
                  <th>Confianza</th>
                  <th>Correcci\u00f3n manual</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q, idx) => {
                  const answer = getEffectiveAnswer(q.id);
                  const confLevel = getConfidenceLevel(idx);
                  const confLabel = getConfidenceLabel(idx);
                  const isManual = manualAnswers[q.id] !== undefined;

                  return (
                    <tr
                      key={q.id}
                      className={`omr-reader__row omr-reader__row--${confLevel}${isManual ? " omr-reader__row--manual" : ""}`}
                    >
                      <td className="omr-reader__cell omr-reader__cell--num">
                        {idx + 1}
                      </td>
                      <td className="omr-reader__cell omr-reader__cell--question">
                        {q.text}
                      </td>
                      <td
                        className={`omr-reader__cell omr-reader__cell--answer omr-reader__cell--${confLevel}`}
                      >
                        {answer || "\u2014"}
                      </td>
                      <td className="omr-reader__cell omr-reader__cell--confidence">
                        <span className={`omr-reader__badge omr-reader__badge--${confLevel}`}>
                          {confLabel}
                        </span>
                      </td>
                      <td className="omr-reader__cell omr-reader__cell--manual">
                        <select
                          value={manualAnswers[q.id] ?? answer}
                          onChange={(e) =>
                            handleManualChange(q.id, e.target.value)
                          }
                          className="omr-reader__select"
                        >
                          <option value="">Seleccionar...</option>
                          {q.options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}: {opt.value}
                            </option>
                          ))}
                        </select>
                        {isManual && (
                          <button
                            type="button"
                            className="btn-small btn-danger"
                            onClick={() =>
                              setManualAnswers((prev) => {
                                const next = { ...prev };
                                delete next[q.id];
                                return next;
                              })
                            }
                          >
                            Restaurar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="omr-reader__actions">
            <button
              type="button"
              className="omr-reader__confirm-btn"
              onClick={handleConfirm}
            >
              Confirmar
            </button>
            {onCancel && (
              <button
                type="button"
                className="btn-secondary"
                onClick={onCancel}
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}

      {!result && !processing && !imageData && (
        <div className="omr-reader__placeholder">
          <div className="omr-reader__placeholder-icon">{'\uD83D\uDCF7'}</div>
          <p>Selecciona una imagen de hoja de respuestas para comenzar el an\u00e1lisis.</p>
          <p className="omr-reader__placeholder-hint">
            Formatos soportados: PNG, JPG, WebP. Se recomienda una imagen clara y bien iluminada.
          </p>
        </div>
      )}
    </div>
  );
}
