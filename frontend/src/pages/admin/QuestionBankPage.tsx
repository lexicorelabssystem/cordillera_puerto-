import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { Modal } from "../../components/common/Modal";
import { EmptyState } from "../../components/common/EmptyState";
import { VoiceTextarea } from "../../components/voice/VoiceTextarea";
import type { AdminSubject } from "../../types/api";

type QuestionType = "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER" | "ESSAY" | "MATCHING";

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "MULTIPLE_CHOICE", label: "Selección múltiple" },
  { value: "TRUE_FALSE", label: "Verdadero/Falso" },
  { value: "SHORT_ANSWER", label: "Respuesta corta" },
  { value: "ESSAY", label: "Ensayo" },
  { value: "MATCHING", label: "Emparejamiento" },
];

interface OptionForm { text: string; isCorrect: boolean }

export function QuestionBankPage() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const [form, setForm] = useState({
    statement: "", type: "MULTIPLE_CHOICE" as QuestionType, difficulty: 2, points: 1,
    learningObjectiveId: "", axisId: "", skillId: "", explanation: "",
  });
  const [options, setOptions] = useState<OptionForm[]>([{ text: "", isCorrect: true }, { text: "", isCorrect: false }]);

  const subjectsQuery = useQuery<AdminSubject[]>({ queryKey: ["subjects-qb"], queryFn: () => api.listSubjectsForCurriculum() });
  const subjectId = selectedSubjectId || subjectsQuery.data?.[0]?.id || "";

  const questionsQuery = useQuery({
    queryKey: ["questions", { subjectId, type: typeFilter, page }],
    queryFn: () => api.listQuestions({ subjectId: subjectId || undefined, type: typeFilter || undefined, page, limit: 15 }),
    enabled: Boolean(subjectId),
  });

  const oasQuery = useQuery({
    queryKey: ["learning-objectives-qb", subjectId],
    queryFn: () => api.listLearningObjectives({ subjectId }),
    enabled: Boolean(subjectId),
  });
  const axesQuery = useQuery({ queryKey: ["axes-qb", subjectId], queryFn: () => api.listAxes(subjectId), enabled: Boolean(subjectId) });
  const skillsQuery = useQuery({ queryKey: ["skills-qb"], queryFn: api.listSkills, enabled: Boolean(subjectId) });
  const coverageQuery = useQuery({
    queryKey: ["oa-coverage", subjectId],
    queryFn: () => api.getOaCoverage(subjectId),
    enabled: Boolean(subjectId),
  });

  const createMutation = useMutation({
    mutationFn: (payload: { subjectId: string; type: string; statement: string; difficulty?: number; points?: number; learningObjectiveId?: string; axisId?: string; skillId?: string; explanation?: string; options: { text: string; isCorrect: boolean; sortOrder?: number }[] }) => api.createQuestion(payload),
    onSuccess: () => { setMessage("Pregunta creada."); resetForm(); queryClient.invalidateQueries({ queryKey: ["questions"] }); queryClient.invalidateQueries({ queryKey: ["oa-coverage"] }); },
    onError: (e) => setMessage(e instanceof Error ? e.message : "Error"),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.updateQuestion(id, data),
    onSuccess: () => { setMessage("Pregunta actualizada."); setEditingId(null); resetForm(); queryClient.invalidateQueries({ queryKey: ["questions"] }); },
    onError: (e) => setMessage(e instanceof Error ? e.message : "Error"),
  });
  const deleteMutation = useMutation({
    mutationFn: api.deleteQuestion,
    onSuccess: () => { setMessage("Pregunta desactivada."); queryClient.invalidateQueries({ queryKey: ["questions"] }); },
    onError: (e) => setMessage(e instanceof Error ? e.message : "Error"),
  });

  function resetForm() {
    setForm({ statement: "", type: "MULTIPLE_CHOICE", difficulty: 2, points: 1, learningObjectiveId: "", axisId: "", skillId: "", explanation: "" });
    setOptions([{ text: "", isCorrect: true }, { text: "", isCorrect: false }]);
    setShowCreate(false);
    setEditingId(null);
  }

  function handleSave() {
    if (!form.statement || !subjectId) { setMessage("Enunciado y asignatura son obligatorios."); return; }
    const needOptions = ["MULTIPLE_CHOICE", "TRUE_FALSE", "MATCHING"].includes(form.type);
    const validOptions = options.filter((o) => o.text.trim());
    if (needOptions && validOptions.length < 2) { setMessage("Mínimo 2 opciones con texto."); return; }

    const payload = {
      subjectId,
      type: form.type,
      statement: form.statement,
      difficulty: form.difficulty,
      points: form.points,
      learningObjectiveId: form.learningObjectiveId || undefined,
      axisId: form.axisId || undefined,
      skillId: form.skillId || undefined,
      explanation: form.explanation || undefined,
      options: needOptions ? validOptions.map((o, i) => ({ text: o.text, isCorrect: o.isCorrect, sortOrder: i })) : [],
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload as unknown as Record<string, unknown> });
    } else {
      createMutation.mutate(payload);
    }
  }

  const questions = (questionsQuery.data as { data: { id: string; statement: string; type: string; difficulty: number; points: number; isActive: boolean; subjectId: string; learningObjectiveId: string | null; explanation: string | null; options: { id: string; text: string; isCorrect: boolean }[] }[] })?.data || [];
  const meta = (questionsQuery.data as { meta: { total: number; page: number; totalPages: number; hasNext: boolean; hasPrevious: boolean } })?.meta;
  const oas = oasQuery.data || [];
  const axes = axesQuery.data || [];
  const skills = skillsQuery.data || [];
  const coverage = coverageQuery.data || [];

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      {message ? <p className="form-message">{message}</p> : null}

      <section className="panel">
        <h3>Banco de Preguntas</h3>
        <div className="form-row">
          <select value={subjectId} onChange={(e) => { setSelectedSubjectId(e.target.value); setPage(1); }}>
            <option value="">Asignatura...</option>
            {(subjectsQuery.data || []).map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </select>
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
            <option value="">Todos los tipos</option>
            {QUESTION_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
          </select>
          <button onClick={() => setShowCreate(true)}>+ Nueva pregunta</button>
        </div>
      </section>

      {(showCreate || editingId) && (
        <section className="panel">
          <h3>{editingId ? "Editar pregunta" : "Nueva pregunta"}</h3>
          <div className="form-grid">
            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label>Enunciado *</label>
              <VoiceTextarea value={form.statement} onChange={(text) => setForm((s) => ({ ...s, statement: text }))} placeholder="Escribe o dicta el enunciado..." rows={3} label="Enunciado de la pregunta" />
            </div>
            <div className="form-field"><label>Tipo *</label>
              <select value={form.type} onChange={(e) => setForm((s) => ({ ...s, type: e.target.value as QuestionType }))}>
                {QUESTION_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
              </select>
            </div>
            <div className="form-field"><label>Dificultad (1-5)</label>
              <input type="number" min={1} max={5} value={form.difficulty} onChange={(e) => setForm((s) => ({ ...s, difficulty: Number(e.target.value) }))} />
            </div>
            <div className="form-field"><label>Puntaje</label>
              <input type="number" min={0} step={0.5} value={form.points} onChange={(e) => setForm((s) => ({ ...s, points: Number(e.target.value) }))} />
            </div>
            <div className="form-field"><label>OA</label>
              <select value={form.learningObjectiveId} onChange={(e) => setForm((s) => ({ ...s, learningObjectiveId: e.target.value }))}>
                <option value="">Sin OA</option>
                {oas.map((oa) => (<option key={oa.id} value={oa.id}>{oa.code} - {oa.description.slice(0, 40)}</option>))}
              </select>
            </div>
            <div className="form-field"><label>Eje</label>
              <select value={form.axisId} onChange={(e) => setForm((s) => ({ ...s, axisId: e.target.value }))}>
                <option value="">Sin eje</option>
                {axes.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
              </select>
            </div>
            <div className="form-field"><label>Habilidad</label>
              <select value={form.skillId} onChange={(e) => setForm((s) => ({ ...s, skillId: e.target.value }))}>
                <option value="">Sin habilidad</option>
                {skills.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </select>
            </div>
          </div>

          {["MULTIPLE_CHOICE", "TRUE_FALSE", "MATCHING"].includes(form.type) && (
            <div style={{ marginTop: 12 }}>
              <h4>Opciones ({options.filter((o) => o.text.trim()).length})</h4>
              {options.map((opt, i) => (
                <div key={i} className="form-row" style={{ marginBottom: 4, alignItems: "center" }}>
                  <input placeholder={`Opción ${i + 1}`} value={opt.text} onChange={(e) => {
                    const next = [...options]; next[i] = { ...next[i], text: e.target.value }; setOptions(next);
                  }} />
                  <label style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                    <input type="checkbox" checked={opt.isCorrect} onChange={(e) => {
                      const next = [...options];
                      if (form.type === "TRUE_FALSE") {
                        next.forEach((o, j) => { next[j] = { ...o, isCorrect: j === i }; });
                      } else {
                        next[i] = { ...next[i], isCorrect: e.target.checked };
                      }
                      setOptions(next);
                    }} style={{ width: "auto" }} />
                    Correcta
                  </label>
                  {options.length > 2 && (
                    <button className="btn-small btn-danger" onClick={() => setOptions(options.filter((_, j) => j !== i))}>X</button>
                  )}
                </div>
              ))}
              <button className="btn-small btn-secondary" onClick={() => setOptions([...options, { text: "", isCorrect: false }])}>+ Opción</button>
            </div>
          )}

          <div className="form-field" style={{ marginTop: 12 }}>
            <label>Explicación / Retroalimentación</label>
            <VoiceTextarea value={form.explanation} onChange={(text) => setForm((s) => ({ ...s, explanation: text }))} placeholder="Explica la respuesta correcta..." rows={2} label="Retroalimentación" />
          </div>

          <div className="form-actions">
            <button onClick={handleSave} disabled={isPending || !form.statement}>{isPending ? "Guardando..." : "Guardar pregunta"}</button>
            <button className="btn-secondary" onClick={resetForm}>Cancelar</button>
          </div>
        </section>
      )}

      <section className="panel">
        <h3>Preguntas {meta ? `(${meta.total})` : ""}</h3>
        {questionsQuery.isLoading ? <LoadingSpinner size="sm" /> : null}
        {questions.length === 0 && !questionsQuery.isLoading ? (
          <EmptyState title="Sin preguntas" description={`Crea preguntas para ${subjectsQuery.data?.find((s) => s.id === subjectId)?.name || "esta asignatura"}.`} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Enunciado</th><th>Tipo</th><th>Dif.</th><th>OA</th><th>Opciones</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {questions.map((q) => (
                    <tr key={q.id}>
                      <td style={{ maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis" }}>
                        <strong>{q.statement.slice(0, 80)}{q.statement.length > 80 ? "..." : ""}</strong>
                      </td>
                      <td><span className="badge badge--role">{QUESTION_TYPES.find((t) => t.value === q.type)?.label || q.type}</span></td>
                      <td>{"★".repeat(q.difficulty)}</td>
                      <td>{oas.find((oa) => oa.id === q.learningObjectiveId)?.code || "-"}</td>
                      <td>{q.options?.length || 0}</td>
                      <td>
                        <div className="action-buttons">
                          <button className="btn-small" onClick={() => {
                            setEditingId(q.id);
                            setForm({ statement: q.statement, type: q.type as QuestionType, difficulty: q.difficulty, points: q.points, learningObjectiveId: q.learningObjectiveId || "", axisId: "", skillId: "", explanation: q.explanation || "" });
                            setOptions((q.options || []).map((o) => ({ text: o.text, isCorrect: o.isCorrect })));
                          }}>Editar</button>
                          <button className="btn-small btn-danger" onClick={() => { if (window.confirm("¿Desactivar pregunta?")) deleteMutation.mutate(q.id); }}>Desactivar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {meta ? (
              <div className="pagination">
                <span>Página {meta.page} de {meta.totalPages}</span>
                <div className="pagination-buttons">
                  <button disabled={!meta.hasPrevious} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</button>
                  <button disabled={!meta.hasNext} onClick={() => setPage((p) => p + 1)}>Siguiente</button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>

      {coverage.length > 0 && (
        <section className="panel">
          <h3>Cobertura de OA</h3>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>OA</th><th>Descripción</th><th>Preguntas</th><th>Cobertura</th></tr></thead>
              <tbody>
                {coverage.map((c) => (
                  <tr key={c.learningObjectiveId}>
                    <td><strong>{c.code}</strong></td>
                    <td>{c.description.slice(0, 60)}</td>
                    <td>{c.questionCount}</td>
                    <td><span className={`badge ${c.questionCount >= 3 ? "badge--active" : c.questionCount > 0 ? "badge--warning" : "badge--inactive"}`}>{c.questionCount >= 3 ? "Completo" : c.questionCount > 0 ? "Parcial" : "Sin preguntas"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
