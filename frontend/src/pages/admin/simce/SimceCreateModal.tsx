import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { LoadingSpinner } from "../../../components/common/LoadingSpinner";
import { useToast } from "../../../components/common/Toast";
import { useInstitution } from "../../../app/InstitutionContext";
import type { CourseOption, SubjectOption } from "./simce.types";
import type { AcademicYear } from "../../../types/api";

interface Props {
  onCreated: (id: string) => void;
  onCancel: () => void;
}

function getField<T extends Record<string, unknown>>(obj: T, snake: string, camel: string): string {
  return (obj[snake] ?? obj[camel] ?? "") as string;
}

export function SimceCreateModal({ onCreated, onCancel }: Props) {
  const { toast } = useToast();
  const { selectedInstitution } = useInstitution();
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [gradeLevel, setGradeLevel] = useState(4);
  const [academicYearId, setAcademicYearId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");

  const coursesQuery = useQuery({
    queryKey: ["simce-courses", selectedInstitution?.id],
    queryFn: () => api.listCourses(selectedInstitution?.id ? { institutionId: selectedInstitution.id } : undefined) as Promise<CourseOption[]>,
  });

  const subjectsQuery = useQuery({
    queryKey: ["simce-subjects"],
    queryFn: () => api.listSubjects(true) as Promise<SubjectOption[]>,
  });

  const academicYearsQuery = useQuery({
    queryKey: ["simce-academic-years", selectedInstitution?.id],
    queryFn: () => selectedInstitution?.id ? api.listAcademicYears(selectedInstitution.id) as Promise<AcademicYear[]> : Promise.resolve([]),
    enabled: Boolean(selectedInstitution?.id),
  });

  const resolvedSubjectId = useMemo(() => {
    if (subjectId) return subjectId;
    const subjects = subjectsQuery.data || [];
    return subjects.find((subject: SubjectOption) => /lenguaje|matem/i.test(subject.name))?.id || subjects[0]?.id || "";
  }, [subjectId, subjectsQuery.data]);

  const resolvedSubjectName = (subjectsQuery.data || []).find((subject: SubjectOption) => subject.id === resolvedSubjectId)?.name || "Automatica";

  const createMutation = useMutation({
    mutationFn: () => api.createSimceAssessment({ title, courseId, subjectId: resolvedSubjectId, gradeLevel, academicYearId: academicYearId || undefined, date, description }),
    onSuccess: (data: unknown) => {
      const id = (data as { id: string }).id;
      toast("Prueba SIMCE creada correctamente.", "success");
      onCreated(id);
    },
    onError: (error) => toast(error instanceof Error ? error.message : "No se pudo crear la prueba.", "error"),
  });

  return (
    <div className="simce-form">
      <div className="form-field">
        <label>Nombre de la prueba *</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej: Ensayo SIMCE Lenguaje 4° Básico"
        />
      </div>

      <div className="form-row" style={{ gap: 12 }}>
        <div className="form-field" style={{ flex: 1 }}>
          <label>Curso *</label>
          {coursesQuery.isLoading ? <LoadingSpinner size="sm" /> : (
            <select value={courseId} onChange={(e) => { setCourseId(e.target.value); setSubjectId(""); const c = coursesQuery.data?.find((c: CourseOption) => c.course_id === e.target.value); if (c?.grade_level) setGradeLevel(c.grade_level); }}>
              <option value="">Seleccionar curso</option>
              {(coursesQuery.data || []).map((c: CourseOption) => (
                <option key={c.course_id} value={c.course_id}>{c.course_name} {c.grade_level ? `(${c.grade_level}°)` : ""}</option>
              ))}
            </select>
          )}
        </div>
        <div className="form-field" style={{ flex: 1 }}>
          <label>Asignatura</label>
          {subjectsQuery.isLoading ? <LoadingSpinner size="sm" /> : (
            <input value={resolvedSubjectName} disabled />
          )}
        </div>
      </div>

      <div className="form-row" style={{ gap: 12 }}>
        <div className="form-field" style={{ flex: 1 }}>
          <label>Nivel *</label>
          <input type="number" min={1} max={12} value={gradeLevel} onChange={(e) => setGradeLevel(Number(e.target.value))} />
        </div>
        <div className="form-field" style={{ flex: 1 }}>
          <label>Fecha *</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div className="form-field">
        <label>Descripción</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Opcional: descripción de la prueba"
        />
      </div>

      <div className="form-field">
        <label>Año académico</label>
        {academicYearsQuery.isLoading ? <LoadingSpinner size="sm" /> : (
          <select value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)}>
            <option value="">Sin año académico</option>
            {(academicYearsQuery.data || []).map((ay: AcademicYear) => (
              <option key={ay.id} value={ay.id}>
                {ay.year} {ay.isActive ? "(activo)" : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
        <button className="btn-secondary" onClick={onCancel}>Cancelar</button>
        <button
          className="btn-primary"
          onClick={() => createMutation.mutate()}
          disabled={!title.trim() || !courseId || !resolvedSubjectId || createMutation.isPending}
        >
          {createMutation.isPending ? "Creando..." : "Crear prueba"}
        </button>
      </div>
    </div>
  );
}
