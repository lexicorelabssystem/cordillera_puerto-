import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { EmptyState } from "../../components/common/EmptyState";
import { VoiceTextarea } from "../../components/voice/VoiceTextarea";

const RESOURCE_TYPES = [
  { value: "GUIDE", label: "Guía" },
  { value: "PRESENTATION", label: "Presentación" },
  { value: "PRINTABLE_TEST", label: "Prueba imprimible" },
  { value: "WORKSHEET", label: "Ficha de trabajo" },
  { value: "REMEDIAL_ACTIVITY", label: "Actividad remedial" },
  { value: "CLASS_MATERIAL", label: "Material de clase" },
];

export function LearningResourcesPage() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", type: "GUIDE", subjectId: "", courseId: "", gradeLevel: 0 });

  const institutionsQuery = useQuery({ queryKey: ["inst-resources"], queryFn: () => api.listInstitutions() });
  const institutionId = institutionsQuery.data?.[0]?.id || "";

  const subjectsQuery = useQuery({ queryKey: ["subjects-resources"], queryFn: () => api.listSubjects() });
  const coursesQuery = useQuery({ queryKey: ["courses-resources", institutionId], queryFn: () => api.listCourses({ institutionId }), enabled: Boolean(institutionId) });

  const resourcesQuery = useQuery({
    queryKey: ["learning-resources", institutionId],
    queryFn: () => api.listLearningResources({ institutionId }) as Promise<{ id: string; title: string; description: string | null; type: string; status: string; gradeLevel: number | null; subject: { name: string } | null; course: { name: string } | null; createdAt: string }[]>,
    enabled: Boolean(institutionId),
  });

  const createMutation = useMutation({
    mutationFn: (payload: { institutionId: string; title: string; description?: string; type: string; subjectId?: string; courseId?: string; gradeLevel?: number }) =>
      api.createLearningResource(payload),
    onSuccess: () => { setMessage("Recurso creado."); setShowCreate(false); setForm({ title: "", description: "", type: "GUIDE", subjectId: "", courseId: "", gradeLevel: 0 }); queryClient.invalidateQueries({ queryKey: ["learning-resources"] }); },
    onError: (e) => setMessage(e instanceof Error ? e.message : "Error"),
  });

  const publishMutation = useMutation({
    mutationFn: api.publishLearningResource,
    onSuccess: () => { setMessage("Recurso publicado."); queryClient.invalidateQueries({ queryKey: ["learning-resources"] }); },
    onError: (e) => setMessage(e instanceof Error ? e.message : "Error"),
  });

  function handleCreate() {
    if (!form.title || !institutionId) { setMessage("Título e institución son obligatorios."); return; }
    createMutation.mutate({
      institutionId,
      title: form.title,
      description: form.description || undefined,
      type: form.type,
      subjectId: form.subjectId || undefined,
      courseId: form.courseId || undefined,
      gradeLevel: form.gradeLevel || undefined,
    });
  }

  const resources = resourcesQuery.data || [];

  return (
    <>
      {message ? <p className="form-message">{message}</p> : null}

      <section className="panel">
        <h3>Recursos Pedagógicos</h3>
        <div className="form-actions">
          <button onClick={() => setShowCreate(!showCreate)}>{showCreate ? "Cancelar" : "+ Nuevo recurso"}</button>
        </div>

        {showCreate && (
          <div style={{ marginTop: 12 }}>
            <div className="form-grid">
              <div className="form-field"><label>Título *</label><input value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} /></div>
              <div className="form-field"><label>Tipo</label>
                <select value={form.type} onChange={(e) => setForm((s) => ({ ...s, type: e.target.value }))}>
                  {RESOURCE_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
                </select>
              </div>
              <div className="form-field"><label>Asignatura</label>
                <select value={form.subjectId} onChange={(e) => setForm((s) => ({ ...s, subjectId: e.target.value }))}>
                  <option value="">Sin asignatura</option>
                  {(subjectsQuery.data || []).map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </select>
              </div>
              <div className="form-field"><label>Curso</label>
                <select value={form.courseId} onChange={(e) => setForm((s) => ({ ...s, courseId: e.target.value }))}>
                  <option value="">Sin curso</option>
                  {(coursesQuery.data || []).map((c) => (<option key={c.course_id} value={c.course_id}>{c.course_name}</option>))}
                </select>
              </div>
              <div className="form-field"><label>Nivel</label>
                <select value={form.gradeLevel} onChange={(e) => setForm((s) => ({ ...s, gradeLevel: Number(e.target.value) }))}>
                  <option value={0}>Sin nivel</option>
                  {[1,2,3,4,5,6,7,8].map((g) => (<option key={g} value={g}>{g}° básico</option>))}
                </select>
              </div>
            </div>
            <div className="form-field" style={{ marginTop: 8 }}>
              <label>Descripción</label>
              <VoiceTextarea value={form.description} onChange={(text) => setForm((s) => ({ ...s, description: text }))} placeholder="Describe el recurso..." rows={2} label="Descripción del recurso" />
            </div>
            <div className="form-actions">
              <button onClick={handleCreate} disabled={createMutation.isPending}>{createMutation.isPending ? "Creando..." : "Crear"}</button>
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <h3>Recursos ({resources.length})</h3>
        {resourcesQuery.isLoading ? <LoadingSpinner size="sm" /> : null}
        {resources.length === 0 && !resourcesQuery.isLoading ? (
          <EmptyState title="Sin recursos" description="Crea guías, presentaciones y material pedagógico." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Título</th><th>Tipo</th><th>Asignatura</th><th>Curso</th><th>Estado</th><th>Acción</th></tr></thead>
              <tbody>
                {resources.map((r: { id: string; title: string; description: string | null; type: string; status: string; gradeLevel: number | null; subject: { name: string } | null; course: { name: string } | null; createdAt: string }) => (
                  <tr key={r.id}>
                    <td><strong>{r.title}</strong></td>
                    <td><span className="badge badge--role">{RESOURCE_TYPES.find((t) => t.value === r.type)?.label || r.type}</span></td>
                    <td>{r.subject?.name || "-"}</td>
                    <td>{r.course?.name || "-"}</td>
                    <td><span className={`badge ${r.status === "PUBLISHED" ? "badge--active" : r.status === "DRAFT" ? "badge--warning" : "badge--inactive"}`}>{r.status}</span></td>
                    <td>
                      {r.status === "DRAFT" && (
                        <button className="btn-small" onClick={() => publishMutation.mutate(r.id)}>Publicar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
