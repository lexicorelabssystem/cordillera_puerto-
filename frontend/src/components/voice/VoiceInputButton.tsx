import type { VoiceState } from "../../services/voice/voiceTypes";

interface Props {
  status: VoiceState;
  label?: string;
  disabled?: boolean;
  isSupported?: boolean;
  onStart: () => void;
  onStop: () => void;
}

export function VoiceInputButton({ status, label, disabled, isSupported = true, onStart, onStop }: Props) {
  if (!isSupported) {
    return (
      <button type="button" className="voice-btn voice-btn--idle" disabled title="Dictado no disponible en este navegador">
        <span className="voice-btn__icon">🚫</span>
        <span className="voice-btn__text" style={{ fontSize: "0.8rem" }}>
          Dictado no disponible. Usa Chrome o Edge.
        </span>
      </button>
    );
  }
  if (status === "idle" || status === "error" || status === "inserted") {
    return (
      <button
        type="button"
        className="voice-btn voice-btn--idle"
        onClick={onStart}
        disabled={disabled}
        title="Hablar para dictar"
      >
        <span className="voice-btn__icon">🎙️</span>
        <span className="voice-btn__text">{label ?? "Hablar"}</span>
      </button>
    );
  }

  if (status === "requesting_permission") {
    return (
      <button type="button" className="voice-btn voice-btn--loading" disabled>
        <span className="voice-btn__icon">⏳</span>
        <span className="voice-btn__text">Solicitando permiso...</span>
      </button>
    );
  }

  if (status === "listening" || status === "silence_detected") {
    const isListening = status === "listening";
    return (
      <button
        type="button"
        className={`voice-btn voice-btn--recording ${isListening ? "voice-btn--pulse" : ""}`}
        onClick={onStop}
        title="Detener grabación"
      >
        <span className="voice-btn__icon">{isListening ? "🔴" : "⏸️"}</span>
        <span className="voice-btn__text">{isListening ? "Escuchando… presiona para detener" : "Preparando texto…"}</span>
      </button>
    );
  }

  if (status === "processing") {
    return (
      <button type="button" className="voice-btn voice-btn--loading" disabled>
        <span className="voice-btn__icon">⏳</span>
        <span className="voice-btn__text">Procesando audio…</span>
      </button>
    );
  }

  return null;
}
