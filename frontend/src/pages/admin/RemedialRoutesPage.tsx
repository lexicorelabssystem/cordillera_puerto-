import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { EmptyState } from "../../components/common/EmptyState";

export function RemedialRoutesPage() {
  const [selectedCourseId, setSelectedCourseId] = useState("");

  const institutionsQuery = useQuery({ queryKey: ["inst-remedial"], queryFn: () => api.listInstitutions() });
  const institutionId = institutionsQuery.data?.[0]?.id || "";

  const coursesQuery = useQuery({
    queryKey: ["courses-remedial", institutionId],
    queryFn: () => api.listCourses({ institutionId }),
    enabled: Boolean(institutionId),
  });

  const courseId = selectedCourseId || coursesQuery.data?.[0]?.course_id || "";

  const plansQuery = useQuery({
    queryKey: ["remedial-plans", courseId],
    queryFn: () => api.listLearningResources({ courseId }) as Promise<{ id: string; title: string; student: { firstName: string; lastName: string }; status: string; startDate: string; endDate: string; preScore: number | null; postScore: number | null }[]>,
    enabled: Boolean(courseId),
  });

  const plans = plansQuery.data || [];

  return (
    <>
      <section className="panel">
        <h3>Ruta Remedial</h3>
        <div className="form-row" style={{ marginBottom: 12 }}>
          <div className="form-field">
            <label>Curso</label>
            <select value={courseId} onChange={(e) => setSelectedCourseId(e.target.value)}>
              {(coursesQuery.data || []).map((c) => (<option key={c.course_id} value={c.course_id}>{c.course_name}</option>))}
            </select>
          </div>
        </div>
      </section>

      <section className="panel">
        <h3>Planes remediales ({plans.length})</h3>
        {plansQuery.isLoading ? <LoadingSpinner size="sm" /> : null}
        {plans.length === 0 && !plansQuery.isLoading ? (
          <EmptyState
            title="Sin planes remediales"
            description="Los planes remediales se generan automáticamente cuando se detectan OA con bajo rendimiento."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Alumno</th><th>Plan</th><th>Pre-score</th><th>Post-score</th><th>Estado</th><th>Período</th></tr></thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.student.firstName} {p.student.lastName}</strong></td>
                    <td>{p.title}</td>
                    <td>{p.preScore ?? "-"}</td>
                    <td>{p.postScore ?? "-"}</td>
                    <td><span className={`badge ${p.status === "COMPLETED" || p.status === "EFFECTIVE" ? "badge--active" : p.status === "IN_PROGRESS" ? "badge--warning" : "badge--inactive"}`}>{p.status}</span></td>
                    <td>{new Date(p.startDate).toLocaleDateString("es-CL")} → {new Date(p.endDate).toLocaleDateString("es-CL")}</td>
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
