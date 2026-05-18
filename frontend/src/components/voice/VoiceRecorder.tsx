import { VoiceInputButton } from "./VoiceInputButton";
import type { VoiceState } from "../../services/voice/voiceTypes";

interface Props {
  status: VoiceState;
  interimTranscript: string;
  transcript: string;
  label?: string;
  disabled?: boolean;
  onStart: () => void;
  onStop: () => void;
  onInsert: () => void;
  onRetry: () => void;
  onEdit: (text: string) => void;
}

export function VoiceRecorder({
  status, interimTranscript, transcript, label, disabled,
  onStart, onStop, onInsert, onRetry, onEdit,
}: Props) {
  return (
    <div className="voice-recorder">
      <VoiceInputButton
        status={status}
        label={label}
        disabled={disabled}
        onStart={onStart}
        onStop={onStop}
      />

      {status === "listening" && interimTranscript && (
        <div className="voice-recorder__interim">
          <small>Vista previa en tiempo real:</small>
          <em>{interimTranscript}</em>
        </div>
      )}

      {status === "preview" && transcript && (
        <div className="voice-recorder__preview">
          <div className="voice-recorder__preview-label">Texto detectado:</div>
          <div className="voice-recorder__preview-text">“{transcript}”</div>
          <div className="voice-recorder__preview-actions">
            <button type="button" className="voice-btn voice-btn--insert" onClick={onInsert}>
              ✅ Insertar texto
            </button>
            <button type="button" className="voice-btn voice-btn--retry" onClick={onRetry}>
              🎙️ Volver a grabar
            </button>
            <button
              type="button"
              className="voice-btn voice-btn--edit"
              onClick={() => onEdit(transcript)}
            >
              ✏️ Editar
            </button>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="voice-recorder__error">
          <p>No pudimos captar el audio. Intenta nuevamente.</p>
          <button type="button" className="voice-btn voice-btn--retry" onClick={onRetry}>
            🔄 Intentar de nuevo
          </button>
        </div>
      )}
    </div>
  );
}
