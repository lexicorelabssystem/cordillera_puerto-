import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useInstitution } from "../../app/InstitutionContext";
import { GRADE_LEVELS } from "../../lib/grade-levels";

export function LearningResourcesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", type: "guia", subjectId: "", courseId: "", gradeLevel: 4 });
  const { selectedInstitution } = useInstitution();
  const queryClient = useQueryClient();

  const resourcesQuery = useQuery({
    queryKey: ["learning-resources", selectedInstitution?.id],
    queryFn: () => api.listLearningResources({ institutionId: selectedInstitution?.id }) as Promise<unknown[]>,
    enabled: Boolean(selectedInstitution?.id),
  });

  const createResource = useMutation({
    mutationFn: () => api.createLearningResource({
      institutionId: selectedInstitution?.id || "",
      title: form.title,
      description: form.description,
      type: form.type,
      subjectId: form.subjectId || undefined,
      courseId: form.courseId || undefined,
      gradeLevel: form.gradeLevel,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learning-resources", selectedInstitution?.id] });
      setForm({ title: "", description: "", type: "guia", subjectId: "", courseId: "", gradeLevel: 4 });
      setShowCreate(false);
    },
  });

  const resources = (resourcesQuery.data || []) as unknown as { id: string; title: string; description: string; type: string; subjectName: string; courseName: string; gradeLevel: number; status: string; createdAt: string }[];

  return (
    <>
      <section className="panel">
        <h3>Recursos y Guías Pedagógicas</h3>
        <p style={{ color: "var(--muted)", fontSize: ".84rem", marginBottom: 12 }}>
          Material descargable: guías, presentaciones, ejercicios, rúbricas y ensayos. Todo organizado por asignatura y nivel.
        </p>
        <div className="form-actions">
          <button onClick={() => setShowCreate(!showCreate)}>{showCreate ? "Cancelar" : "+ Nuevo recurso"}</button>
        </div>
        {showCreate && (
          <div style={{ marginTop: 12 }}>
            <div className="form-grid">
              <div className="form-field"><label>Título *</label><input value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} placeholder="Guía de ejercicios..." /></div>
              <div className="form-field"><label>Tipo</label>
                <select value={form.type} onChange={(e) => setForm((s) => ({ ...s, type: e.target.value }))}>
                  <option value="guia">Guía</option><option value="ejercicios">Ejercicios</option>
                  <option value="presentacion">Presentación</option><option value="material">Material imprimible</option>
                  <option value="rubrica">Rúbrica</option><option value="ensayo">Ensayo</option>
                </select>
              </div>
              <div className="form-field"><label>Asignatura</label>
                <select value={form.subjectId} onChange={(e) => setForm((s) => ({ ...s, subjectId: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  <option value="asig-len">Lenguaje</option><option value="asig-mat">Matemática</option>
                  <option value="asig-cie">Ciencias Naturales</option><option value="asig-his">Historia y Geografía</option>
                </select>
              </div>
              <div className="form-field"><label>Nivel</label>
                <select value={form.gradeLevel} onChange={(e) => setForm((s) => ({ ...s, gradeLevel: Number(e.target.value) }))}>
                  {GRADE_LEVELS.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}
                </select>
              </div>
              <div className="form-field"><label>Descripción</label><input value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} /></div>
            </div>
            <div className="form-actions">
              <button onClick={() => createResource.mutate()} disabled={createResource.isPending || !form.title.trim()}>
                {createResource.isPending ? "Creando..." : "Crear recurso"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <h3>Material disponible ({resources.length})</h3>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Título</th><th>Tipo</th><th>Asignatura</th><th>Curso</th><th>Estado</th><th>Fecha</th></tr></thead>
            <tbody>
              {resources.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.title}</strong><br /><small style={{ color: "var(--muted)" }}>{r.description}</small></td>
                  <td><span className="badge badge--role">{r.type}</span></td>
                  <td>{r.subjectName}</td>
                  <td>{r.courseName}</td>
                  <td><span className={`badge ${r.status === "PUBLISHED" ? "badge--active" : "badge--inactive"}`}>{r.status === "PUBLISHED" ? "Publicado" : "Borrador"}</span></td>
                  <td style={{ whiteSpace: "nowrap" }}>{new Date(r.createdAt).toLocaleDateString("es-CL")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
