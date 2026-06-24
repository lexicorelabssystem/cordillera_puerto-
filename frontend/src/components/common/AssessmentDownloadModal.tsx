import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import type { AssessmentPdfOptions, GeneratedAssessmentPdf } from "../../lib/pdf";

interface Props {
  isOpen: boolean;
  title: string;
  isPending?: boolean;
  onClose: () => void;
  onDownload: (options: Required<AssessmentPdfOptions>) => Promise<GeneratedAssessmentPdf[]> | GeneratedAssessmentPdf[];
}

export function AssessmentDownloadModal({ isOpen, title, isPending = false, onClose, onDownload }: Props) {
  const [version, setVersion] = useState<"student" | "answer-key">("student");
  const [includeAnswerSheet, setIncludeAnswerSheet] = useState(true);
  const [fontSize, setFontSize] = useState<"normal" | "large">("normal");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setVersion("student");
    setIncludeAnswerSheet(true);
    setFontSize("normal");
  }, [isOpen, title]);

  const busy = isPending || downloading;

  async function handleDownload() {
    setDownloading(true);
    try {
      await onDownload({ includeAnswerKey: version === "answer-key", includeAnswerSheet, fontSize });
      onClose();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={() => { if (!busy) onClose(); }} title="Descargar ensayo" size="md" className="assessment-download-modal">
      <div className="assessment-download-modal__body">
        <h3>{title}</h3>
        <fieldset>
          <legend>¿Qué versión necesitas?</legend>
          <div className="assessment-download-modal__versions">
            <button type="button" className={version === "student" ? "is-selected" : ""} onClick={() => setVersion("student")}><strong>Para estudiantes</strong><span>Sin respuestas</span></button>
            <button type="button" className={version === "answer-key" ? "is-selected" : ""} onClick={() => setVersion("answer-key")}><strong>Con pauta</strong><span>Respuestas marcadas</span></button>
          </div>
        </fieldset>
        <fieldset>
          <legend>Incluir también</legend>
          <label className={`assessment-download-modal__sheet ${includeAnswerSheet ? "is-selected" : ""}`}>
            <input type="checkbox" checked={includeAnswerSheet} onChange={(event) => setIncludeAnswerSheet(event.target.checked)} />
            <span className="assessment-download-modal__check">✓</span>
            <span><strong>Hoja de respuestas</strong><small>Tabla para marcar A a D</small></span>
          </label>
        </fieldset>
        <fieldset>
          <legend>Tamaño de letra</legend>
          <div className="assessment-download-modal__font-size">
            <button type="button" className={fontSize === "normal" ? "is-selected" : ""} onClick={() => setFontSize("normal")}>Normal</button>
            <button type="button" className={fontSize === "large" ? "is-selected" : ""} onClick={() => setFontSize("large")}>Grande</button>
          </div>
        </fieldset>
        <button type="button" className="assessment-download-modal__submit" disabled={busy} onClick={handleDownload}><span aria-hidden="true">↓</span> {busy ? "Preparando PDF..." : "Descargar PDF"}</button>
      </div>
    </Modal>
  );
}