import { useState, useEffect } from "react";
import { useVoiceRecorder } from "../../hooks/voice/useVoiceRecorder";
import { VoiceRecorder } from "./VoiceRecorder";

interface Props {
  value: string;
  onChange: (text: string) => void;
  label?: string;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}

export function VoiceTextarea({
  value, onChange, label, placeholder, rows = 3, disabled,
}: Props) {
  const [mode, setMode] = useState<"write" | "speak">("write");
  const {
    status, transcript, interimTranscript, errorMessage, isSupported,
    start, stop, reset, insert, clearInserted,
  } = useVoiceRecorder();

  useEffect(() => {
    if (status === "inserted") {
      onChange(transcript);
      const timer = setTimeout(() => {
        clearInserted();
        setMode("write");
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [status, transcript, onChange, clearInserted]);

  const handleInsert = () => {
    const text = insert();
    if (text) {
      onChange(text);
    }
  };

  const handleRetry = () => {
    reset();
    setTimeout(() => start(), 200);
  };

  const handleEdit = (text: string) => {
    onChange(text);
    setMode("write");
    reset();
  };

  return (
    <div className="voice-textarea">
      <div className="voice-textarea__tabs">
        <button
          type="button"
          className={`voice-textarea__tab ${mode === "write" ? "voice-textarea__tab--active" : ""}`}
          onClick={() => setMode("write")}
        >
          ✍️ Escribir
        </button>
        {isSupported && (
          <button
            type="button"
            className={`voice-textarea__tab ${mode === "speak" ? "voice-textarea__tab--active" : ""}`}
            onClick={() => setMode("speak")}
          >
            🎙️ Hablar
          </button>
        )}
      </div>

      {mode === "write" && (
        <textarea
          className="voice-textarea__input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "Escribe aquí..."}
          rows={rows}
          disabled={disabled}
        />
      )}

      {mode === "speak" && (
        <div className="voice-textarea__speak-mode">
          {status === "idle" && (
            <p className="voice-textarea__hint">{label ?? "Habla con claridad. Podrás revisar el texto antes de insertarlo."}</p>
          )}

          {status === "inserted" && (
            <div className="voice-textarea__inserted">
              <p>✅ Texto insertado. Puedes editarlo antes de guardar.</p>
            </div>
          )}

          <VoiceRecorder
            status={status}
            interimTranscript={interimTranscript}
            transcript={transcript}
            errorMessage={errorMessage}
            label={`Dictar ${label?.toLowerCase() ?? "texto"}`}
            disabled={disabled}
            onStart={start}
            onStop={stop}
            onInsert={handleInsert}
            onRetry={handleRetry}
            onEdit={handleEdit}
          />

          {transcript && status !== "preview" && status !== "inserted" && (
            <div className="voice-textarea__preview-box">
              <div className="voice-textarea__preview-label">Texto actual:</div>
              <div className="voice-textarea__preview-content">{transcript}</div>
            </div>
          )}

          <button
            type="button"
            className="voice-textarea__back-btn"
            onClick={() => { setMode("write"); reset(); }}
          >
            Volver a escribir
          </button>
        </div>
      )}

      {!isSupported && mode === "speak" && (
        <div className="voice-textarea__unsupported">
          <p>Tu navegador no soporta dictado por voz. Usa Chrome o Edge.</p>
        </div>
      )}
    </div>
  );
}
