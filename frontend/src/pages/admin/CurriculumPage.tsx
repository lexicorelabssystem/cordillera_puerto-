import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { Modal } from "../../components/common/Modal";
import { VoiceTextarea } from "../../components/voice/VoiceTextarea";
import { useToast } from "../../components/common/Toast";
import type { AdminSubject } from "../../types/api";
import { GRADE_LEVELS, formatGradeLevel } from "../../lib/grade-levels";

export function CurriculumPage() {
  const queryClient = useQueryClient();
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [tab, setTab] = useState<"axes" | "objectives" | "skills">("objectives");
  const { toast } = useToast();

  const subjectsQuery = useQuery<AdminSubject[]>({
    queryKey: ["subjects-curriculum"],
    queryFn: () => api.listSubjectsForCurriculum(),
  });

  const subjectId = selectedSubjectId || subjectsQuery.data?.[0]?.id || "";

  if (subjectsQuery.isLoading) return <LoadingSpinner label="Cargando..." />;

  return (
    <>

      <section className="panel">
        <div className="form-row">
          <div className="form-field">
            <label>Asignatura</label>
            <select value={subjectId} onChange={(e) => { setSelectedSubjectId(e.target.value); setTab("objectives"); }}>
              <option value="">Seleccionar...</option>
              {(subjectsQuery.data || []).map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
          </div>
        </div>
        <div className="form-actions">
          {(["objectives", "axes", "skills"] as const).map((t) => (
            <button key={t} className={tab === t ? "" : "btn-secondary"} onClick={() => setTab(t)}>
              {t === "objectives" ? "Objetivos (OA)" : t === "axes" ? "Ejes" : "Habilidades"}
            </button>
          ))}
        </div>
      </section>

      {subjectId ? (
        tab === "axes" ? <AxesPanel subjectId={subjectId} />
        : tab === "skills" ? <SkillsPanel />
        : <ObjectivesPanel subjectId={subjectId} />
      ) : (
        <section className="panel"><p>Selecciona una asignatura para gestionar su currículum.</p></section>
      )}
    </>
  );
}

function AxesPanel({ subjectId }: { subjectId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", sortOrder: 0 });

  const axesQuery = useQuery({ queryKey: ["axes", subjectId], queryFn: () => api.listAxes(subjectId), enabled: Boolean(subjectId) });

  const createMutation = useMutation({
    mutationFn: api.createAxis,
    onSuccess: () => { ("Eje creado."); setForm({ name: "", description: "", sortOrder: 0 }); queryClient.invalidateQueries({ queryKey: ["axes"] }); },
    onError: (e) => toast(e instanceof Error ? e.message : "Error", "error"),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.updateAxis(id, data),
    onSuccess: () => { ("Eje actualizado."); setEditingId(null); queryClient.invalidateQueries({ queryKey: ["axes"] }); },
    onError: (e) => toast(e instanceof Error ? e.message : "Error", "error"),
  });
  const deleteMutation = useMutation({
    mutationFn: api.deleteAxis,
    onSuccess: () => { ("Eje eliminado."); queryClient.invalidateQueries({ queryKey: ["axes"] }); },
    onError: (e) => toast(e instanceof Error ? e.message : "Error", "error"),
  });

  const axes = axesQuery.data || [];

  return (
    <section className="panel">
      <h3>Ejes temáticos ({axes.length})</h3>
      {axesQuery.isLoading ? <LoadingSpinner size="sm" /> : null}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Nombre</th><th>Descripción</th><th>Orden</th><th>Acciones</th></tr></thead>
          <tbody>
            {axes.map((a) => (
              <tr key={a.id}>
                <td><strong>{a.name}</strong></td>
                <td>{a.description || "-"}</td>
                <td>{a.sortOrder}</td>
                <td>
                  <div className="action-buttons">
                    <button className="btn-small" onClick={() => { setEditingId(a.id); setForm({ name: a.name, description: a.description || "", sortOrder: a.sortOrder }); }}>Editar</button>
                    <button className="btn-small btn-danger" onClick={() => { if (window.confirm("¿Eliminar eje?")) deleteMutation.mutate(a.id); }}>Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h4 style={{ marginTop: 12 }}>{editingId ? "Editar eje" : "Nuevo eje"}</h4>
      <div className="form-grid">
        <div className="form-field"><label>Nombre *</label><input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} /></div>
        <div className="form-field" style={{ gridColumn: "1 / -1" }}><label>Descripción</label>
          <VoiceTextarea value={form.description} onChange={(text) => setForm((s) => ({ ...s, description: text }))} placeholder="Describe el eje..." rows={2} label="Descripción del eje" />
        </div>
        <div className="form-field"><label>Orden</label><input type="number" value={form.sortOrder} onChange={(e) => setForm((s) => ({ ...s, sortOrder: Number(e.target.value) }))} /></div>
      </div>
      <div className="form-actions">
        {editingId ? (
          <><button onClick={() => updateMutation.mutate({ id: editingId, data: form })} disabled={!form.name}>Guardar</button>
            <button className="btn-secondary" onClick={() => { setEditingId(null); setForm({ name: "", description: "", sortOrder: 0 }); }}>Cancelar</button></>
        ) : (
          <button onClick={() => createMutation.mutate({ subjectId, name: form.name, description: form.description || undefined, sortOrder: form.sortOrder })} disabled={!form.name}>Crear eje</button>
        )}
      </div>
    </section>
  );
}

function ObjectivesPanel({ subjectId }: { subjectId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [gradeFilter, setGradeFilter] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", description: "", gradeLevel: 1, axisId: "" });

  const objectivesQuery = useQuery({
    queryKey: ["learning-objectives", subjectId, gradeFilter],
    queryFn: () => api.listLearningObjectives({ subjectId, gradeLevel: gradeFilter || undefined }),
    enabled: Boolean(subjectId),
  });
  const axesQuery = useQuery({ queryKey: ["axes-obj", subjectId], queryFn: () => api.listAxes(subjectId), enabled: Boolean(subjectId) });

  const createMutation = useMutation({
    mutationFn: api.createLearningObjective,
    onSuccess: () => { ("OA creado."); setForm({ code: "", description: "", gradeLevel: 1, axisId: "" }); queryClient.invalidateQueries({ queryKey: ["learning-objectives"] }); },
    onError: (e) => toast(e instanceof Error ? e.message : "Error", "error"),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.updateLearningObjective(id, data),
    onSuccess: () => { ("OA actualizado."); setEditingId(null); queryClient.invalidateQueries({ queryKey: ["learning-objectives"] }); },
    onError: (e) => toast(e instanceof Error ? e.message : "Error", "error"),
  });
  const deleteMutation = useMutation({
    mutationFn: api.deleteLearningObjective,
    onSuccess: () => { ("OA desactivado."); queryClient.invalidateQueries({ queryKey: ["learning-objectives"] }); },
    onError: (e) => toast(e instanceof Error ? e.message : "Error", "error"),
  });

  const objectives = objectivesQuery.data || [];
  const axes = axesQuery.data || [];

  const startEdit = (oa: { id: string; code: string; description: string; gradeLevel: number; axisId: string | null }) => {
    setEditingId(oa.id);
    setForm({ code: oa.code, description: oa.description, gradeLevel: oa.gradeLevel, axisId: oa.axisId || "" });
  };

  return (
    <section className="panel">
      <h3>Objetivos de Aprendizaje ({objectives.length})</h3>
      <div className="form-row" style={{ marginBottom: 8 }}>
        <select value={gradeFilter} onChange={(e) => setGradeFilter(Number(e.target.value))}>
          <option value={0}>Todos los niveles</option>
          {GRADE_LEVELS.map((level) => (<option key={level.value} value={level.value}>{level.label}</option>))}
        </select>
      </div>
      {objectivesQuery.isLoading ? <LoadingSpinner size="sm" /> : null}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Código</th><th>Descripción</th><th>Nivel</th><th>Eje</th><th>Acciones</th></tr></thead>
          <tbody>
            {objectives.map((oa) => (
              <tr key={oa.id}>
                <td><strong>{oa.code}</strong></td>
                <td style={{ maxWidth: 300 }}>{oa.description}</td>
                <td>{formatGradeLevel(oa.gradeLevel)}</td>
                <td>{axes.find((a) => a.id === oa.axisId)?.name || "-"}</td>
                <td>
                  <div className="action-buttons">
                    <button className="btn-small" onClick={() => startEdit(oa)}>Editar</button>
                    <button className="btn-small btn-danger" onClick={() => { if (window.confirm("¿Desactivar OA?")) deleteMutation.mutate(oa.id); }}>Desactivar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h4 style={{ marginTop: 12 }}>{editingId ? "Editar OA" : "Nuevo OA"}</h4>
      <div className="form-grid">
        <div className="form-field"><label>Código *</label><input placeholder="OA01, OA02..." value={form.code} onChange={(e) => setForm((s) => ({ ...s, code: e.target.value }))} /></div>
        <div className="form-field"><label>Nivel *</label><select value={form.gradeLevel} onChange={(e) => setForm((s) => ({ ...s, gradeLevel: Number(e.target.value) }))}>{GRADE_LEVELS.map((level) => (<option key={level.value} value={level.value}>{level.label}</option>))}</select></div>
        <div className="form-field"><label>Eje</label><select value={form.axisId} onChange={(e) => setForm((s) => ({ ...s, axisId: e.target.value }))}><option value="">Sin eje</option>{axes.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}</select></div>
        <div className="form-field" style={{ gridColumn: "1 / -1" }}><label>Descripción *</label>
          <VoiceTextarea value={form.description} onChange={(text) => setForm((s) => ({ ...s, description: text }))} placeholder="Describe el objetivo de aprendizaje..." rows={2} label="Descripción del OA" />
        </div>
      </div>
      <div className="form-actions">
        {editingId ? (
          <><button onClick={() => updateMutation.mutate({ id: editingId, data: form })} disabled={!form.code || !form.description}>Guardar</button>
            <button className="btn-secondary" onClick={() => { setEditingId(null); setForm({ code: "", description: "", gradeLevel: 1, axisId: "" }); }}>Cancelar</button></>
        ) : (
          <button onClick={() => createMutation.mutate({ subjectId, code: form.code, description: form.description, gradeLevel: form.gradeLevel, axisId: form.axisId || undefined })} disabled={!form.code || !form.description}>Crear OA</button>
        )}
      </div>
    </section>
  );
}

function SkillsPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });

  const skillsQuery = useQuery({ queryKey: ["skills"], queryFn: api.listSkills });

  const createMutation = useMutation({
    mutationFn: api.createSkill,
    onSuccess: () => { ("Habilidad creada."); setForm({ name: "", description: "" }); queryClient.invalidateQueries({ queryKey: ["skills"] }); },
    onError: (e) => toast(e instanceof Error ? e.message : "Error", "error"),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.updateSkill(id, data),
    onSuccess: () => { ("Habilidad actualizada."); setEditingId(null); queryClient.invalidateQueries({ queryKey: ["skills"] }); },
    onError: (e) => toast(e instanceof Error ? e.message : "Error", "error"),
  });
  const deleteMutation = useMutation({
    mutationFn: api.deleteSkill,
    onSuccess: () => { ("Habilidad eliminada."); queryClient.invalidateQueries({ queryKey: ["skills"] }); },
    onError: (e) => toast(e instanceof Error ? e.message : "Error", "error"),
  });

  const skills = skillsQuery.data || [];

  return (
    <section className="panel">
      <h3>Habilidades ({skills.length})</h3>
      {skillsQuery.isLoading ? <LoadingSpinner size="sm" /> : null}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Nombre</th><th>Descripción</th><th>Acciones</th></tr></thead>
          <tbody>
            {skills.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.name}</strong></td>
                <td>{s.description || "-"}</td>
                <td>
                  <div className="action-buttons">
                    <button className="btn-small" onClick={() => { setEditingId(s.id); setForm({ name: s.name, description: s.description || "" }); }}>Editar</button>
                    <button className="btn-small btn-danger" onClick={() => { if (window.confirm("¿Eliminar habilidad?")) deleteMutation.mutate(s.id); }}>Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h4 style={{ marginTop: 12 }}>{editingId ? "Editar habilidad" : "Nueva habilidad"}</h4>
      <div className="form-grid">
        <div className="form-field"><label>Nombre *</label><input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} /></div>
        <div className="form-field" style={{ gridColumn: "1 / -1" }}><label>Descripción</label>
          <VoiceTextarea value={form.description} onChange={(text) => setForm((s) => ({ ...s, description: text }))} placeholder="Describe la habilidad..." rows={2} label="Descripción de la habilidad" />
        </div>
      </div>
      <div className="form-actions">
        {editingId ? (
          <><button onClick={() => updateMutation.mutate({ id: editingId, data: form })} disabled={!form.name}>Guardar</button>
            <button className="btn-secondary" onClick={() => { setEditingId(null); setForm({ name: "", description: "" }); }}>Cancelar</button></>
        ) : (
          <button onClick={() => createMutation.mutate({ name: form.name, description: form.description || undefined })} disabled={!form.name}>Crear habilidad</button>
        )}
      </div>
    </section>
  );
}
