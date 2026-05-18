export type VoiceState =
  | "idle"
  | "requesting_permission"
  | "listening"
  | "silence_detected"
  | "processing"
  | "preview"
  | "inserted"
  | "error";

export interface VoiceRecorderState {
  status: VoiceState;
  transcript: string;
  interimTranscript: string;
  errorMessage: string;
  isSupported: boolean;
}

export const VOICE_MESSAGES: Record<VoiceState, string> = {
  idle: "Puedes escribir o dictar este campo.",
  requesting_permission: "Solicitando permiso de micrófono...",
  listening: "Escuchando… habla con claridad.",
  silence_detected: "Parece que terminaste. Preparando texto…",
  processing: "Procesando audio…",
  preview: "Texto detectado. Revísalo antes de insertarlo.",
  inserted: "Texto insertado. Puedes editarlo antes de guardar.",
  error: "No pudimos captar el audio. Intenta nuevamente.",
};

export const VOICE_ERRORS: Record<string, string> = {
  "not-allowed": "Debes permitir el uso del micrófono para dictar.",
  "not-supported": "Tu navegador no soporta dictado por voz. Usa Chrome o Edge.",
  "no-speech": "No se detectó voz. Intenta nuevamente hablando más cerca del micrófono.",
  "audio-capture": "No se pudo acceder al micrófono. Revisa que no esté en uso por otra aplicación.",
  "network": "Error de conexión. La transcripción requiere conexión a internet.",
  "aborted": "Grabación cancelada.",
};
