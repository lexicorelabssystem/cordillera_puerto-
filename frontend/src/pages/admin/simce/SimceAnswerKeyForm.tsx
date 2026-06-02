import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { LoadingSpinner } from "../../../components/common/LoadingSpinner";
import { EmptyState } from "../../../components/common/EmptyState";
import { useToast } from "../../../components/common/Toast";
import type { SimceAssessment, SimceAnswerKey } from "./simce.types";

const OPTIONS = ["A", "B", "C", "D", "E"];

interface Props {
  assessment: SimceAssessment;
}

export function SimceAnswerKeyForm({ assessment }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [questionCount, setQuestionCount] = useState(30);
  const [formData, setFormData] = useState<Record<number, { option: string; score: number }>>({});
  const [isDirty, setIsDirty] = useState(false);

  const keyQuery = useQuery({
    queryKey: ["simce-answer-key", assessment.id],
    queryFn: () => api.getSimceAnswerKey(assessment.id) as Promise<SimceAnswerKey>,
  });

  useEffect(() => {
    if (keyQuery.data) {
      setQuestionCount(keyQuery.data.totalQuestions || 30);
      const data: Record<number, { option: string; score: number }> = {};
      keyQuery.data.items.forEach((item) => {
        data[item.questionNumber] = { option: item.correctOption, score: item.score };
      });
      setFormData(data);
    }
  }, [keyQuery.data]);

  function handleOptionChange(qnum: number, option: string) {
    setFormData((prev) => ({ ...prev, [qnum]: { ...(prev[qnum] || { option: "", score: 1 }), option } }));
    setIsDirty(true);
  }

  function handleScoreChange(qnum: number, score: number) {
    setFormData((prev) => ({ ...prev, [qnum]: { ...(prev[qnum] || { option: "", score: 1 }), score } }));
    setIsDirty(true);
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const items = [];
      for (let i = 1; i <= questionCount; i++) {
        const data = formData[i];
        if (data && data.option) {
          items.push({ questionNumber: i, correctOption: data.option, score: data.score || 1 });
        }
      }
      return api.saveSimceAnswerKey(assessment.id, { items });
    },
    onSuccess: () => {
      toast("Pauta guardada correctamente.", "success");
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ["simce-answer-key", assessment.id] });
      queryClient.invalidateQueries({ queryKey: ["simce-assessments"] });
    },
    onError: (error) => toast(error instanceof Error ? error.message : "No se pudo guardar la pauta.", "error"),
  });

  const confirmMutation = useMutation({
    mutationFn: () => api.confirmSimceAnswerKey(assessment.id),
    onSuccess: () => {
      toast("Pauta confirmada. Ya puedes ingresar respuestas de alumnos.", "success");
      queryClient.invalidateQueries({ queryKey: ["simce-assessments"] });
      queryClient.invalidateQueries({ queryKey: ["simce-answer-key", assessment.id] });
    },
    onError: (error) => toast(error instanceof Error ? error.message : "No se pudo confirmar la pauta.", "error"),
  });

  const filledCount = Object.values(formData).filter((v) => v.option).length;

  if (keyQuery.isLoading) return <LoadingSpinner label="Cargando pauta..." />;

  return (
    <div className="simce-answer-key">
      <div className="panel-heading">
        <div>
          <h3>Pauta de corrección</h3>
          <p style={{ color: "var(--muted)", fontSize: ".84rem" }}>
            Define la alternativa correcta y puntaje para cada pregunta.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div className="form-field" style={{ margin: 0 }}>
            <label>Preguntas</label>
            <input type="number" min={1} max={100} value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} style={{ width: 70 }} />
          </div>
          <span className="badge badge--info">{filledCount}/{questionCount} definidas</span>
        </div>
      </div>

      <div className="simce-answer-key-grid">
        {Array.from({ length: questionCount }, (_, i) => i + 1).map((qnum) => {
          const data = formData[qnum];
          return (
            <div key={qnum} className="simce-key-cell">
              <span className="simce-key-cell__num">{qnum}</span>
              <div className="simce-key-cell__options">
                {OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`simce-option-btn ${data?.option === opt ? "simce-option-btn--selected" : ""}`}
                    onClick={() => handleOptionChange(qnum, opt)}
                    title={`Alternativa ${opt}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <input
                type="number"
                className="simce-key-cell__score"
                min={0}
                max={10}
                step={0.5}
                value={data?.score ?? 1}
                onChange={(e) => handleScoreChange(qnum, Number(e.target.value))}
                title="Puntaje"
              />
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
        <button className="btn-secondary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !isDirty}>
          {saveMutation.isPending ? "Guardando..." : "Guardar pauta"}
        </button>
        {assessment.status !== "READY_TO_CORRECT" && assessment.status !== "CORRECTED" && (
          <button
            className="btn-primary"
            onClick={() => confirmMutation.mutate()}
            disabled={confirmMutation.isPending || filledCount === 0}
          >
            {confirmMutation.isPending ? "Confirmando..." : "Confirmar y preparar corrección"}
          </button>
        )}
      </div>
    </div>
  );
}
