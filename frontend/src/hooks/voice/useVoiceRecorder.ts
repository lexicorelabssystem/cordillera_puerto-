import { useState, useCallback, useRef } from "react";
import { voiceTranscriptionService } from "../../services/voice/voiceTranscription.service";
import type { VoiceState } from "../../services/voice/voiceTypes";
import type { SpeechRecognitionResult } from "../../services/voice/voiceTranscription.service";

export function useVoiceRecorder() {
  const [status, setStatus] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const finalTranscriptRef = useRef("");

  const isSupported = voiceTranscriptionService.isSupported();

  const start = useCallback(async () => {
    setStatus("requesting_permission");
    setTranscript("");
    setInterimTranscript("");
    setErrorMessage("");
    finalTranscriptRef.current = "";

    try {
      await voiceTranscriptionService.start(
        (result: SpeechRecognitionResult) => {
          if (result.isFinal) {
            if (result.transcript) {
              finalTranscriptRef.current += (finalTranscriptRef.current ? " " : "") + result.transcript;
              setTranscript(finalTranscriptRef.current);
            } else {
              // Silence detected → stop and show preview
              setStatus("silence_detected");
              setTimeout(() => {
                if (finalTranscriptRef.current.trim()) {
                  setStatus("preview");
                } else {
                  setErrorMessage("no-speech");
                  setStatus("error");
                }
              }, 500);
              voiceTranscriptionService.stop();
            }
          } else {
            setInterimTranscript(result.transcript);
          }
        },
        (error: string) => {
          setErrorMessage(error);
          setStatus("error");
        },
      );
      setStatus("listening");
    } catch {
      setErrorMessage("audio-capture");
      setStatus("error");
    }
  }, []);

  const stop = useCallback(() => {
    voiceTranscriptionService.stop();
    if (finalTranscriptRef.current.trim()) {
      setStatus("processing");
      setTimeout(() => {
        setStatus("preview");
      }, 600);
    } else {
      setErrorMessage("no-speech");
      setStatus("error");
    }
  }, []);

  const reset = useCallback(() => {
    finalTranscriptRef.current = "";
    setTranscript("");
    setInterimTranscript("");
    setErrorMessage("");
    setStatus("idle");
  }, []);

  const insert = useCallback((): string => {
    const finalText = transcript.trim();
    setStatus("inserted");
    return finalText;
  }, [transcript]);

  const clearInserted = useCallback(() => {
    setStatus("idle");
    setTranscript("");
    finalTranscriptRef.current = "";
  }, []);

  return {
    status,
    transcript,
    interimTranscript,
    errorMessage,
    isSupported,
    start,
    stop,
    reset,
    insert,
    clearInserted,
  };
}
