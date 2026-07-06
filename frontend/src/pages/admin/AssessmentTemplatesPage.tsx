import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { useToast } from "../../components/common/Toast";
import { useInstitution } from "../../app/InstitutionContext";
import { api } from "../../lib/api";
import type { AdminCourseRow, AdminSubject } from "../../types/api";

type TemplateOption = {
  id?: string;
  label?: string | null;
  text: string;
  isCorrect: boolean;
  sortOrder: number;
};

type TemplateQuestion = {
  id: string;
  type: string;
  sortOrder: number;
  statement: string;
  points: number;
  explanation?: string | null;
  confidence?: number;
  options: TemplateOption[];
};

type AssessmentTemplate = {
  id: string;
  institutionId?: string | null;
  subjectId?: string | null;
  gradeLevel?: number | null;
  title: string;
  description?: string | null;
  status: string;
  fileName?: string | null;
  mimeType?: string | null;
  instructions?: string | null;
  totalPoints: number;
  questionsCount?: number;
  questions?: TemplateQuestion[];
  updatedAt?: string;
  publishedAt?: string | null;
};

const QUESTION_TYPES = [
  { value: "MULTIPLE_CHOICE", label: "Seleccion multiple" },
  { value: "TRUE_FALSE", label: "Verdadero/Falso" },
  { value: "SHORT_ANSWER", label: "Respuesta corta" },
  { value: "ESSAY", label: "Desarrollo" },
];

export function AssessmentTemplatesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedInstitution } = useInstitution();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [file, setFile] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [selectedId, setSelectedId] = useState("");
  const [questions, setQuestions] = useState<TemplateQuestion[]>([]);

  const subjectsQuery = useQuery({
    queryKey: ["subjects"],
    queryFn: () => api.listSubjects(true) as Promise<AdminSubject[]>,
  });

  const coursesQuery = useQuery({
    queryKey: ["all-courses", selectedInstitution?.id],
    queryFn: () => api.listCourses({ institutionId: selectedInstitution?.id, includeInactive: false }) as Promise<AdminCourseRow[]>,
    enabled: Boolean(selectedInstitution?.id),
  });

  const selectedCourse = useMemo(
    () => (coursesQuery.data || []).find((c) => c.course_id === courseId),
    [coursesQuery.data, courseId],
  );

  const gradeLevel = selectedCourse?.grade_level;

  const templatesQuery = useQuery({
    queryKey: ["assessment-templates", selectedInstitution?.id, subjectId, gradeLevel, status, search],
    queryFn: () =>
      api.listAssessmentTemplates({
        institutionId: selectedInstitution?.id,
        subjectId: subjectId || undefined,
        gradeLevel: gradeLevel ?? undefined,
        status: status || undefined,
        search: search || undefined,
      }) as Promise<AssessmentTemplate[]>,
  });

  const detailQuery = useQuery({
    queryKey: ["assessment-template", selectedId],
    queryFn: () => api.getAssessmentTemplate(selectedId) as Promise<AssessmentTemplate>,
    enabled: Boolean(selectedId),
  });

  useEffect(() => {
    if (detailQuery.data?.questions) {
      setQuestions(detailQuery.data.questions.map((question) => ({
        ...question,
        options: question.options?.length ? question.options : defaultOptionsForType(question.type),
      })));
    }
  }, [detailQuery.data]);

  const selectedTemplate = detailQuery.data;
  const subjectNameById = useMemo(() => {
    const map = new Map<string, string>();
    (subjectsQuery.data || []).forEach((subject) => map.set(subject.id, subject.name));
    return map;
  }, [subjectsQuery.data]);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (file.length === 0) throw new Error("Selecciona al menos un PDF o Word .docx.");
      setUploadProgress({ current: 0, total: file.length });
      const results: AssessmentTemplate[] = [];
      for (let i = 0; i < file.length; i++) {
        const f = file[i];
        const result = await api.uploadAssessmentTemplate({
          file: f,
          title: file.length > 1 ? f.name.replace(/\.[^.]+$/, "") : title.trim(),
          description: description.trim() || undefined,
          institutionId: selectedInstitution?.id,
          subjectId: subjectId || undefined,
          gradeLevel: gradeLevel ?? undefined,
        }) as AssessmentTemplate;
        results.push(result);
        setUploadProgress({ current: i + 1, total: file.length });
      }
      return results;
    },
    onSuccess: (templates) => {
      toast(`${templates.length} prueba(s) analizada(s) y guardada(s) como borrador.`, "success");
      setSelectedId(templates[0]?.id ?? "");
      setFile([]);
      setUploadProgress({ current: 0, total: 0 });
      queryClient.invalidateQueries({ queryKey: ["assessment-templates"] });
    },
    onError: (error) => {
      toast(error instanceof Error ? error.message : "No se pudieron subir las pruebas.", "error");
      setUploadProgress({ current: 0, total: 0 });
    },
  });

  const saveQuestionMutation = useMutation({
    mutationFn: (question: TemplateQuestion) =>
      api.updateAssessmentTemplateQuestion(selectedId, question.id, {
        type: question.type,
        statement: question.statement,
        points: Number(question.points) || 1,
        explanation: question.explanation || undefined,
        sortOrder: question.sortOrder,
        options: needsOptions(question.type) ? question.options : [],
      }),
    onSuccess: () => {
      toast("Pregunta actualizada.", "success");
      queryClient.invalidateQueries({ queryKey: ["assessment-template", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["assessment-templates"] });
    },
    onError: (error) => toast(error instanceof Error ? error.message : "No se pudo guardar la pregunta.", "error"),
  });

  const addQuestionMutation = useMutation({
    mutationFn: () =>
      api.addAssessmentTemplateQuestion(selectedId, {
        type: "MULTIPLE_CHOICE",
        statement: "Nueva pregunta",
        points: 1,
        sortOrder: questions.length,
        options: [
          { label: "A", text: "Alternativa A", isCorrect: true, sortOrder: 0 },
          { label: "B", text: "Alternativa B", isCorrect: false, sortOrder: 1 },
        ],
      }),
    onSuccess: () => {
      toast("Pregunta agregada.", "success");
      queryClient.invalidateQueries({ queryKey: ["assessment-template", selectedId] });
    },
    onError: (error) => toast(error instanceof Error ? error.message : "No se pudo agregar la pregunta.", "error"),
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (questionId: string) => api.deleteAssessmentTemplateQuestion(selectedId, questionId),
    onSuccess: () => {
      toast("Pregunta eliminada.", "success");
      queryClient.invalidateQueries({ queryKey: ["assessment-template", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["assessment-templates"] });
    },
    onError: (error) => toast(error instanceof Error ? error.message : "No se pudo eliminar la pregunta.", "error"),
  });

  const publishMutation = useMutation({
    mutationFn: () => api.publishAssessmentTemplate(selectedId),
    onSuccess: () => {
      toast("Plantilla publicada para profesores.", "success");
      queryClient.invalidateQueries({ queryKey: ["assessment-template", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["assessment-templates"] });
    },
    onError: (error) => toast(error instanceof Error ? error.message : "No se pudo publicar.", "error"),
  });

  const downloadSourceMutation = useMutation({
    mutationFn: async (template: AssessmentTemplate) => {
      const blob = await api.downloadAssessmentTemplateSource(template.id);
      const extension = template.mimeType?.includes("pdf") ? "pdf" : template.mimeType?.includes("wordprocessingml") ? "docx" : "bin";
      const safeTitle = template.title.replace(/[^a-z0-9\-_]+/gi, "_").replace(/^_+|_+$/g, "") || "plantilla";
      const fileName = template.fileName || `${safeTitle}.${extension}`;
      downloadBlob(blob, fileName);
    },
    onSuccess: () => toast("Archivo fuente descargado.", "success"),
    onError: (error) => toast(error instanceof Error ? error.message : "No se pudo descargar el archivo fuente.", "error"),
  });
  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => api.deleteAssessmentTemplate(id),
    onSuccess: (_, id) => {
      toast("Plantilla eliminada definitivamente.", "success");
      if (selectedId === id) {
        setSelectedId("");
        setQuestions([]);
      }
      queryClient.invalidateQueries({ queryKey: ["assessment-templates"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
    },
    onError: (error) => toast(error instanceof Error ? error.message : "No se pudo eliminar la plantilla.", "error"),
  });

  const readyToPublish = questions.length > 0 && questions.every((question) => {
    if (!question.statement.trim() || Number(question.points) <= 0) return false;
    if (!needsOptions(question.type)) return true;
    return question.options.filter((option) => option.text.trim()).length >= 2 && question.options.some((option) => option.isCorrect);
  });

  function updateQuestion(index: number, patch: Partial<TemplateQuestion>) {
    setQuestions((current) => current.map((question, i) => (i === index ? { ...question, ...patch } : question)));
  }

  function updateOption(questionIndex: number, optionIndex: number, patch: Partial<TemplateOption>) {
    setQuestions((current) =>
      current.map((question, i) => {
        if (i !== questionIndex) return question;
        const options = question.options.map((option, j) => {
          if (j !== optionIndex) return patch.isCorrect ? { ...option, isCorrect: false } : option;
          return { ...option, ...patch };
        });
        return { ...question, options };
      }),
    );
  }

  function addOption(questionIndex: number) {
    setQuestions((current) =>
      current.map((question, i) => {
        if (i !== questionIndex) return question;
        const nextIndex = question.options.length;
        return {
          ...question,
          options: [
            ...question.options,
            { label: String.fromCharCode(65 + nextIndex), text: "", isCorrect: false, sortOrder: nextIndex },
          ],
        };
      }),
    );
  }

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Banco de Pruebas</h3>
            <p>Sube PDF o Word, revisa la deteccion y publica pruebas reutilizables para todos los profesores.</p>
          </div>
          <span className="badge badge--role">{selectedInstitution?.name || "Banco global"}</span>
        </div>

        <div className="teacher-material-upload">
          <div className="form-field">
            <label>Titulo</label>
            <input
              value={file.length > 1 ? "" : title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={file.length > 1 ? "Se usa el nombre de cada archivo" : "Prueba unidad 1"}
              disabled={file.length > 1}
            />
            {file.length > 1 ? <small>Con multiples archivos el titulo se toma del nombre de cada documento.</small> : null}
          </div>
          <div className="form-field">
            <label>Asignatura</label>
            <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
              <option value="">Sin asignatura fija</option>
              {(subjectsQuery.data || []).map((subject) => (
                <option key={subject.id} value={subject.id}>{subject.name}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Curso</label>
            <select value={courseId} onChange={(event) => setCourseId(event.target.value)}>
              <option value="">Sin curso fijo (flexible)</option>
              {(coursesQuery.data || []).map((course) => (
                <option key={course.course_id} value={course.course_id}>
                  {course.course_name} ({course.grade_level} basico{course.section ? ` · ${course.section}` : ""})
                </option>
              ))}
            </select>
            {coursesQuery.isLoading ? <LoadingSpinner size="sm" /> : null}
          </div>
          <div className="form-field">
            <label>Archivo PDF/DOCX</label>
            <input
              type="file"
              multiple
              accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
              onChange={(event) => {
                const selected = event.target.files;
                if (selected && selected.length > 0) setFile(Array.from(selected));
              }}
            />
            {file.length > 0 ? <small>{file.length} archivo(s): {file.map(f => f.name).join(", ")}</small> : null}
          </div>
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label>Descripcion</label>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} />
          </div>
          <button disabled={uploadMutation.isPending || file.length === 0} onClick={() => uploadMutation.mutate()}>
            {uploadMutation.isPending
              ? uploadProgress.total > 1
                ? `Analizando ${uploadProgress.current}/${uploadProgress.total}...`
                : "Analizando..."
              : file.length > 1
                ? `Subir y analizar (${file.length})`
                : "Subir y analizar"}
          </button>
          {uploadMutation.isPending && uploadProgress.total > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
              <progress
                value={uploadProgress.current}
                max={uploadProgress.total}
                style={{ flex: 1, height: 8 }}
              />
              <small>{Math.round((uploadProgress.current / uploadProgress.total) * 100)}%</small>
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Plantillas disponibles</h3>
            <p>Los profesores solo ven las pruebas publicadas.</p>
          </div>
          <div className="form-row" style={{ margin: 0 }}>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar prueba" />
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Todos</option>
              <option value="DRAFT">Borrador</option>
              <option value="PUBLISHED">Publicadas</option>
              <option value="ARCHIVED">Archivadas</option>
            </select>
          </div>
        </div>
        {templatesQuery.isLoading ? <LoadingSpinner size="sm" /> : null}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Prueba</th>
                <th>Asignatura</th>
                <th>Curso/Nivel</th>
                <th>Estado</th>
                <th>Preguntas</th>
                <th>Puntaje</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(templatesQuery.data || []).map((template) => (
                <tr key={template.id}>
                  <td><strong>{template.title}</strong><br /><small>{template.fileName || "Sin archivo"}</small></td>
                  <td>{template.subjectId ? subjectNameById.get(template.subjectId) || "Asignatura" : "Flexible"}</td>
                  <td>{template.gradeLevel ? `${template.gradeLevel}° basico/medio` : "Flexible"}</td>
                  <td><span className={`badge ${template.status === "PUBLISHED" ? "badge--active" : template.status === "DRAFT" ? "badge--warning" : "badge--inactive"}`}>{template.status}</span></td>
                  <td>{template.questionsCount ?? 0}</td>
                  <td>{template.totalPoints}</td>
                  <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><button className="btn-small" onClick={() => setSelectedId(template.id)}>Revisar</button><button className="btn-small btn-secondary" disabled={!template.fileName || downloadSourceMutation.isPending} onClick={() => downloadSourceMutation.mutate(template)}>Descargar fuente</button><button className="btn-small btn-danger" disabled={deleteTemplateMutation.isPending} onClick={() => { if (window.confirm(`¿Eliminar plantilla "${template.title}" definitivamente?`)) deleteTemplateMutation.mutate(template.id); }}>Eliminar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedId ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>{selectedTemplate?.title || "Revision de plantilla"}</h3>
              <p>{questions.length} pregunta(s). Marca pauta y puntajes antes de publicar.</p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn-secondary" disabled={!selectedTemplate?.fileName || !selectedTemplate || downloadSourceMutation.isPending} onClick={() => selectedTemplate && downloadSourceMutation.mutate(selectedTemplate)}>
                {downloadSourceMutation.isPending ? "Descargando..." : "Descargar fuente"}
              </button>
              <button className="btn-secondary" disabled={addQuestionMutation.isPending || selectedTemplate?.status === "PUBLISHED"} onClick={() => addQuestionMutation.mutate()}>
                Agregar pregunta
              </button>
              <button disabled={!readyToPublish || publishMutation.isPending || selectedTemplate?.status === "PUBLISHED"} onClick={() => publishMutation.mutate()}>
                {selectedTemplate?.status === "PUBLISHED" ? "Publicada" : publishMutation.isPending ? "Publicando..." : "Publicar para profesores"}
              </button>
            </div>
          </div>
          {detailQuery.isLoading ? <LoadingSpinner size="sm" /> : null}
          {selectedTemplate?.instructions ? (
            <div className="empty-inline" style={{ marginBottom: 12 }}>
              <strong>Instrucciones detectadas</strong>
              <span>{selectedTemplate.instructions}</span>
            </div>
          ) : null}
          <div className="imported-test-list">
            {questions.map((question, questionIndex) => (
              <article key={question.id} className="imported-test-question">
                <div className="imported-test-question__head">
                  <strong>Pregunta {questionIndex + 1}</strong>
                  <span className="badge badge--info">{Math.round((question.confidence ?? 1) * 100)}% confianza</span>
                </div>
                <div className="form-field">
                  <label>Enunciado</label>
                  <textarea value={question.statement} rows={3} disabled={selectedTemplate?.status === "PUBLISHED"} onChange={(event) => updateQuestion(questionIndex, { statement: event.target.value })} />
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label>Tipo</label>
                    <select value={question.type} disabled={selectedTemplate?.status === "PUBLISHED"} onChange={(event) => updateQuestion(questionIndex, { type: event.target.value, options: defaultOptionsForType(event.target.value) })}>
                      {QUESTION_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Puntaje</label>
                    <input type="number" min={0.1} step={0.5} value={question.points} disabled={selectedTemplate?.status === "PUBLISHED"} onChange={(event) => updateQuestion(questionIndex, { points: Number(event.target.value) })} />
                  </div>
                </div>

                {needsOptions(question.type) ? (
                  <div className="imported-test-options">
                    {question.options.map((option, optionIndex) => (
                      <label key={`${question.id}-${optionIndex}`} className="imported-test-option">
                        <input
                          type="radio"
                          name={`correct-template-${question.id}`}
                          checked={option.isCorrect}
                          disabled={selectedTemplate?.status === "PUBLISHED"}
                          onChange={() => updateOption(questionIndex, optionIndex, { isCorrect: true })}
                        />
                        <input
                          value={option.text}
                          disabled={selectedTemplate?.status === "PUBLISHED"}
                          onChange={(event) => updateOption(questionIndex, optionIndex, { text: event.target.value })}
                        />
                      </label>
                    ))}
                    <button type="button" className="btn-secondary" disabled={selectedTemplate?.status === "PUBLISHED"} onClick={() => addOption(questionIndex)}>
                      Agregar alternativa
                    </button>
                  </div>
                ) : null}

                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button disabled={selectedTemplate?.status === "PUBLISHED" || saveQuestionMutation.isPending} onClick={() => saveQuestionMutation.mutate(question)}>
                    Guardar pregunta
                  </button>
                  <button className="btn-danger" disabled={selectedTemplate?.status === "PUBLISHED" || deleteQuestionMutation.isPending} onClick={() => deleteQuestionMutation.mutate(question.id)}>
                    Eliminar
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
function needsOptions(type: string) {
  return type === "MULTIPLE_CHOICE" || type === "TRUE_FALSE";
}

function defaultOptionsForType(type: string): TemplateOption[] {
  if (type === "TRUE_FALSE") {
    return [
      { label: "V", text: "Verdadero", isCorrect: false, sortOrder: 0 },
      { label: "F", text: "Falso", isCorrect: false, sortOrder: 1 },
    ];
  }
  if (type === "MULTIPLE_CHOICE") {
    return [
      { label: "A", text: "", isCorrect: false, sortOrder: 0 },
      { label: "B", text: "", isCorrect: false, sortOrder: 1 },
    ];
  }
  return [];
}
