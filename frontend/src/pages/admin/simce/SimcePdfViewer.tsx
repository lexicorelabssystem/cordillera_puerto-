import { useCallback, useEffect, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface Props {
  url: string;
  fileName?: string;
  onTextExtracted?: (text: string) => void;
}

export function SimcePdfViewer({ url, fileName, onTextExtracted }: Props) {
  const [loadingText, setLoadingText] = useState(true);
  const [extractedText, setExtractedText] = useState("");
  const [showText, setShowText] = useState(false);
  const downloadUrl = url.replace("/files/view/", "/files/download/");

  const extractText = useCallback(async () => {
    try {
      setLoadingText(true);
      const loadingTask = pdfjsLib.getDocument({ url, withCredentials: true });
      const pdf = await loadingTask.promise;
      const fullText: string[] = [];

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const text = (content.items as Array<{ str?: string }>)
          .map((item) => item.str ?? "")
          .join(" ");
        fullText.push(`--- Pagina ${pageNumber} ---\n${text}`);
      }

      const allText = fullText.join("\n\n");
      setExtractedText(allText);
      onTextExtracted?.(allText);
      await pdf.destroy();
    } catch {
      setExtractedText("");
    } finally {
      setLoadingText(false);
    }
  }, [url, onTextExtracted]);

  useEffect(() => {
    extractText();
  }, [extractText]);

  function copyToClipboard() {
    navigator.clipboard.writeText(extractedText).catch(() => {
      const textarea = document.createElement("textarea");
      textarea.value = extractedText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    });
  }

  return (
    <div className="simce-pdf-reader">
      <div className="simce-pdf-reader__toolbar">
        <div className="simce-pdf-reader__nav">
          <span style={{ fontSize: ".85rem", fontWeight: 600 }}>
            {fileName || "PDF SIMCE"}
          </span>
        </div>

        <div className="simce-pdf-reader__actions">
          {loadingText ? (
            <span style={{ color: "var(--muted)", fontSize: ".8rem" }}>Extrayendo texto...</span>
          ) : extractedText ? (
            <>
              <button
                className={`btn-small ${showText ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setShowText(!showText)}
              >
                {showText ? "Ocultar texto" : "Ver texto extraido"}
              </button>
              <button className="btn-small" onClick={copyToClipboard}>
                Copiar texto
              </button>
            </>
          ) : null}
          {fileName && (
            <a className="btn-small" href={downloadUrl} download={fileName}>
              Descargar
            </a>
          )}
        </div>
      </div>

      <iframe
        className="simce-pdf-reader__frame"
        src={url}
        title={fileName || "PDF SIMCE"}
      />

      {showText && extractedText && (
        <div className="simce-pdf-reader__view">
          <div className="simce-pdf-reader__text-panel">
            <h4>Texto extraido del PDF</h4>
            <pre className="simce-pdf-reader__text">{extractedText}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
