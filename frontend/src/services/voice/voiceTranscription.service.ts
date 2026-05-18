const SILENCE_TIMEOUT_MS = 3000;
const MAX_RECORDING_MS = 60000;

export interface SpeechRecognitionResult {
  transcript: string;
  isFinal: boolean;
}

type SpeechCallback = (result: SpeechRecognitionResult) => void;
type ErrorCallback = (error: string) => void;

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: {
    resultIndex: number;
    results: {
      [index: number]: {
        isFinal: boolean;
        [index: number]: { transcript: string; confidence: number };
      };
      length: number;
    };
  }) => void) | null;
  onerror: ((event: { error: string; message?: string }) => void) | null;
  onend: (() => void) | null;
}

class VoiceTranscriptionService {
  private recognition: SpeechRecognitionInstance | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private maxTimer: ReturnType<typeof setTimeout> | null = null;
  private onResult: SpeechCallback | null = null;
  private onError: ErrorCallback | null = null;

  isSupported(): boolean {
    return !!(window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
           !!(window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
  }

  async start(onResult: SpeechCallback, onError: ErrorCallback): Promise<void> {
    this.onResult = onResult;
    this.onError = onError;

    const SpeechRecognitionAPI =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      onError("not-supported");
      return;
    }

    this.recognition = new SpeechRecognitionAPI();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = "es-CL";

    this.recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      if (finalTranscript) {
        this.resetSilenceTimer();
        onResult({ transcript: finalTranscript, isFinal: true });
      } else if (interimTranscript) {
        this.resetSilenceTimer();
        onResult({ transcript: interimTranscript, isFinal: false });
      }
    };

    this.recognition.onerror = (event) => {
      if (event.error === "no-speech") {
        onResult({ transcript: "", isFinal: true });
      } else {
        onError(event.error === "not-allowed" ? "not-allowed" : event.error || "unknown");
      }
    };

    this.recognition.onend = () => {
      this.clearTimers();
    };

    this.recognition.start();
    this.startSilenceTimer();
    this.startMaxTimer();
  }

  stop(): void {
    this.clearTimers();
    try {
      this.recognition?.stop();
    } catch {
      // already stopped
    }
  }

  abort(): void {
    this.clearTimers();
    try {
      this.recognition?.abort();
    } catch {
      // already aborted
    }
  }

  private resetSilenceTimer(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
  }

  private startSilenceTimer(): void {
    this.resetSilenceTimer();
    this.silenceTimer = setTimeout(() => {
      if (this.onResult) {
        this.onResult({ transcript: "", isFinal: true });
      }
      this.stop();
    }, SILENCE_TIMEOUT_MS);
  }

  private startMaxTimer(): void {
    this.maxTimer = setTimeout(() => {
      this.stop();
    }, MAX_RECORDING_MS);
  }

  private clearTimers(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (this.maxTimer) clearTimeout(this.maxTimer);
    this.silenceTimer = null;
    this.maxTimer = null;
  }
}

export const voiceTranscriptionService = new VoiceTranscriptionService();
