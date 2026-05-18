import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { EmptyState } from "../../components/common/EmptyState";
import { VoiceTextarea } from "../../components/voice/VoiceTextarea";

type AssessmentType = "DIAGNOSTICA" | "PROCESO" | "CIERRE" | "PARCIAL" | "FINAL" | "SIMCE";

export function AssessmentsPage() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "", assessmentType: "PROCESO" as AssessmentType, semester: 1,
    courseId: "", subjectId: "", maxScore: 100, weight: 0,
  });

  const institutionsQuery = useQuery({ queryKey: ["inst-assess"], queryFn: () => api.listInstitutions() });
  const institutionId = institutionsQuery.data?.[0]?.id || "";

  const coursesQuery = useQuery({
    queryKey: ["courses-assess", institutionId],
    queryFn: () => api.listCourses({ institutionId }),
    enabled: Boolean(institutionId),
  });

  const subjectsQuery = useQuery({
    queryKey: ["subjects-assess"],
    queryFn: () => api.listSubjects(),
  });

  const assessmentsQuery = useQuery({
    queryKey: ["assessments-list"],
    queryFn: () => api.listAssessments() as Promise<{ assessment_id: string; title: string; assessment_type: string; status: string; course_name: string; subject_name: string; teacher_name: string; created_at: string }[]>,
  });

  const createMutation = useMutation({
    mutationFn: (payload: unknown) => api.createAssessment(payload),
    onSuccess: () => { setMessage("Evaluación creada."); setShowCreate(false); setForm({ title: "", assessmentType: "PROCESO", semester: 1, courseId: "", subjectId: "", maxScore: 100, weight: 0 }); queryClient.invalidateQueries({ queryKey: ["assessments-list"] }); },
    onError: (e) => setMessage(e instanceof Error ? e.message : "Error"),
  });

  function handleCreate() {
    if (!form.title || !form.courseId || !form.subjectId) { setMessage("Título, curso y asignatura son obligatorios."); return; }
    createMutation.mutate({
      courseId: form.courseId, subjectId: form.subjectId, title: form.title,
      assessmentType: form.assessmentType, semester: form.semester,
      maxScore: form.maxScore, weight: form.weight,
      startDate: new Date().toISOString(),
    });
  }

  const assessments = (assessmentsQuery.data as { assessment_id: string; title: string; assessment_type: string; status: string; course_name: string; subject_name: string; teacher_name: string; created_at: string }[]) || [];

  return (
    <>
      {message ? <p className="form-message">{message}</p> : null}

      <section className="panel">
        <h3>Evaluaciones</h3>
        <div className="form-actions">
          <button onClick={() => setShowCreate(!showCreate)}>{showCreate ? "Cancelar" : "+ Nueva evaluación"}</button>
        </div>

        {showCreate && (
          <div style={{ marginTop: 12 }}>
            <div className="form-grid">
              <div className="form-field"><label>Título *</label><input value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} /></div>
              <div className="form-field"><label>Tipo</label>
                <select value={form.assessmentType} onChange={(e) => setForm((s) => ({ ...s, assessmentType: e.target.value as AssessmentType }))}>
                  <option value="DIAGNOSTICA">Diagnóstica</option>
                  <option value="PROCESO">Proceso</option>
                  <option value="CIERRE">Cierre</option>
                  <option value="PARCIAL">Parcial</option>
                  <option value="FINAL">Final</option>
                  <option value="SIMCE">SIMCE</option>
                </select>
              </div>
              <div className="form-field"><label>Semestre</label>
                <select value={form.semester} onChange={(e) => setForm((s) => ({ ...s, semester: Number(e.target.value) }))}>
                  <option value={1}>Semestre 1</option><option value={2}>Semestre 2</option>
                </select>
              </div>
              <div className="form-field"><label>Curso *</label>
                <select value={form.courseId} onChange={(e) => setForm((s) => ({ ...s, courseId: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {(coursesQuery.data || []).map((c) => (<option key={c.course_id} value={c.course_id}>{c.course_name}</option>))}
                </select>
              </div>
              <div className="form-field"><label>Asignatura *</label>
                <select value={form.subjectId} onChange={(e) => setForm((s) => ({ ...s, subjectId: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {(subjectsQuery.data || []).map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </select>
              </div>
              <div className="form-field"><label>Puntaje máx</label><input type="number" value={form.maxScore} onChange={(e) => setForm((s) => ({ ...s, maxScore: Number(e.target.value) }))} /></div>
              <div className="form-field"><label>Ponderación</label><input type="number" value={form.weight} onChange={(e) => setForm((s) => ({ ...s, weight: Number(e.target.value) }))} /></div>
            </div>
            <div className="form-actions">
              <button onClick={handleCreate} disabled={createMutation.isPending}>{createMutation.isPending ? "Creando..." : "Crear"}</button>
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <h3>Listado de evaluaciones ({assessments.length})</h3>
        {assessmentsQuery.isLoading ? <LoadingSpinner size="sm" /> : null}
        {assessments.length === 0 && !assessmentsQuery.isLoading ? (
          <EmptyState title="Sin evaluaciones" description="Crea tu primera evaluación." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Título</th><th>Tipo</th><th>Curso</th><th>Asignatura</th><th>Estado</th><th>Fecha</th></tr></thead>
              <tbody>
                {assessments.map((a: { assessment_id: string; title: string; assessment_type: string; status: string; course_name: string; subject_name: string; teacher_name: string; created_at: string }) => (
                  <tr key={a.assessment_id}>
                    <td><strong>{a.title}</strong></td>
                    <td><span className="badge badge--role">{a.assessment_type}</span></td>
                    <td>{a.course_name}</td>
                    <td>{a.subject_name}</td>
                    <td><span className={`badge ${a.status === "PUBLISHED" || a.status === "ACTIVE" ? "badge--active" : a.status === "CLOSED" ? "badge--inactive" : "badge--warning"}`}>{a.status}</span></td>
                    <td>{new Date(a.created_at).toLocaleDateString("es-CL")}</td>
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
