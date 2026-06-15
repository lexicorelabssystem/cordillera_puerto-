import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShellLayout } from "../../components/common/ShellLayout";
import { KpiCard } from "../../components/common/KpiCard";
import { GradeBarChart } from "../../components/charts/GradeBarChart";
import { VoiceTextarea } from "../../components/voice/VoiceTextarea";
import { useToast } from "../../components/common/Toast";
import { Modal } from "../../components/common/Modal";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { api } from "../../lib/api";
import { exportGradebookToPdf } from "../../lib/pdf";
import type { AuthUser, CourseStudentRow } from "../../types/api";

interface Props {
  user: AuthUser;
  onLogout: () => void;
}

interface TeacherAssessmentRow {
  assessment_id: string;
  title: string;
  assessment_type: string;
  status: string;
  course_name?: string;
  subject_name?: string;
  attempts_count: number;
  grades_count: number;
  created_at: string;
}

interface ClassBookEntry {
  id?: string;
  date?: string;
  classNumber?: number | null;
  unitName?: string | null;
  topic?: string | null;
  content?: string | null;
  activities?: string | null;
  resources?: string | null;
}

interface LearningResourceRow {
  id?: string;
  title?: string;
  description?: string | null;
  type?: string;
  status?: string;
  createdAt?: string;
  usedAt?: string | null;
  usageLogs?: ResourceUsageRow[];
  _count?: { usageLogs?: number; lessonResources?: number };
}

interface MaterialFileRow {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string | null;
  createdAt: string;
}

interface ResourceUsageRow {
  id: string;
  action: string;
  usedAt: string;
  notes?: string | null;
  course?: { id: string; name: string; gradeLevel?: number | null; section?: string | null } | null;
  subject?: { id: string; name: string } | null;
  usedBy?: { id: string; firstName: string; lastName: string } | null;
}

interface MaterialUploadProgress {
  total: number;
  completed: number;
  currentFile: string;
  phase: "idle" | "creating" | "uploading" | "publishing" | "done" | "error";
}

const MATERIAL_ACCEPT_ALL = ".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.txt";
const MATERIAL_TYPE_LABELS: Record<string, string> = {
  CLASS_MATERIAL: "Material",
  GUIDE: "Guía",
  PRESENTATION: "Presentación",
  WORKSHEET: "Actividad",
  PRINTABLE_TEST: "Evaluación imprimible",
  SIMCE_PDF: "PDF SIMCE",
};

function getTeacherMaterialLabel(resource: LearningResourceRow) {
  const title = resource.title?.toLowerCase() || "";
  const description = resource.description?.toLowerCase() || "";
  if (resource.type === "PRINTABLE_TEST" && (title.includes("simce") || description.includes("simce"))) {
    return "PDF SIMCE";
  }
  return MATERIAL_TYPE_LABELS[resource.type || ""] || resource.type || "RECURSO";
}

interface LearningObjectiveRow {
  id: string;
  code: string;
  description: string;
  gradeLevel: number;
}

interface TeacherAssignmentView {
  assignment_id: string;
  course_id: string;
  course_name: string;
  grade_level?: number;
  students_count?: number;
  subject_id: string;
  subject_name: string;
}

type CeldaLibro = { estudianteId: string; evaluacionId: string } | null;

type TeacherGradebookStudent = {
  studentId: string;
  firstName: string;
  lastName: string;
  rut?: string;
  average: number | null;
  hasPending: boolean;
  grades: { assessmentId: string; grade: number | null }[];
};

type TeacherGradebookAssessment = {
  id: string;
  title: string;
  type: string;
  status: string;
  weight: number;
};

function formatearNota(n: number | null | undefined): string {
  if (n === null || n === undefined) return "-";
  return n.toFixed(1).replace(".", ",");
}

function colorNota(n: number | null | undefined): string {
  if (n === null || n === undefined) return "var(--muted)";
  if (n < 4.0) return "var(--danger)";
  if (n >= 6.0) return "var(--success)";
  return "var(--ink)";
}

function getStudentField(student: CourseStudentRow, snakeKey: "student_id" | "first_name" | "last_name" | "course_name", camelKey: "studentId" | "firstName" | "lastName" | "courseName"): string {
  const raw = student as unknown as Record<string, unknown>;
  const value = raw[snakeKey] ?? raw[camelKey];
  return typeof value === "string" ? value : "";
}

export function ProfesorDashboard({ user, onLogout }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();
  const assignmentsQuery = useQuery({
    queryKey: ["teacher-assignments"],
    queryFn: () => api.myAssignments(),
  });
  const assignments = useMemo<TeacherAssignmentView[]>(
    () => (assignmentsQuery.data || []).map((assignment) => {
      const raw = assignment as unknown as {
        assignment_id?: string;
        course_id?: string;
        course_name?: string;
        grade_level?: number;
        students_count?: number;
        subject_id?: string;
        subject_name?: string;
        id?: string;
        courseId?: string;
        subjectId?: string;
        course?: { id?: string; name?: string; gradeLevel?: number; _count?: { enrollments?: number } };
        subject?: { id?: string; name?: string };
      };
      return {
        assignment_id: raw.assignment_id ?? raw.id ?? "",
        course_id: raw.course_id ?? raw.courseId ?? raw.course?.id ?? "",
        course_name: raw.course_name ?? raw.course?.name ?? "Curso sin nombre",
        grade_level: raw.grade_level ?? raw.course?.gradeLevel,
        students_count: raw.students_count ?? raw.course?._count?.enrollments,
        subject_id: raw.subject_id ?? raw.subjectId ?? raw.subject?.id ?? "",
        subject_name: raw.subject_name ?? raw.subject?.name ?? "Asignatura sin nombre",
      };
    }).filter((assignment) => assignment.assignment_id && assignment.course_id && assignment.subject_id),
    [assignmentsQuery.data],
  );
  const firstAssignment = assignments[0];
  const [assignmentId, setAssignmentId] = useState<string>("");
  const selectedAssignment = assignments.find((assignment) => assignment.assignment_id === assignmentId);
  const courseId = selectedAssignment?.course_id || "";
  const subjectId = selectedAssignment?.subject_id || "";
  useEffect(() => {
    if (firstAssignment && !assignmentId) {
      setAssignmentId(firstAssignment.assignment_id);
    }
  }, [firstAssignment, assignmentId]);

  const studentsQuery = useQuery({
    queryKey: ["course-students", courseId],
    queryFn: () => api.getCourseStudents(courseId),
    enabled: Boolean(courseId)
  });

  const alertsQuery = useQuery({ queryKey: ["my-alerts"], queryFn: api.myAlerts });
  const teacherAssessmentsQuery = useQuery({
    queryKey: ["teacher-profile-assessments", courseId, subjectId],
    queryFn: () => api.listAssessments({ courseId, subjectId }) as Promise<TeacherAssessmentRow[]>,
    enabled: Boolean(courseId) && Boolean(subjectId),
  });
  const coursesQuery = useQuery({
    queryKey: ["teacher-visible-courses"],
    queryFn: () => api.listCourses(),
  });
  const selectedCourse = coursesQuery.data?.find((course) => course.course_id === courseId);
  const gradeBookQuery = useQuery({
    queryKey: ["teacher-course-book", courseId, subjectId],
    queryFn: () => api.getCourseGradeBook(courseId, { subjectId }),
    enabled: Boolean(courseId) && Boolean(subjectId),
  });
  const objectivesQuery = useQuery({
    queryKey: ["teacher-learning-objectives", subjectId, selectedCourse?.grade_level],
    queryFn: () =>
      api.listLearningObjectives({ subjectId, gradeLevel: selectedCourse?.grade_level }) as Promise<LearningObjectiveRow[]>,
    enabled: Boolean(subjectId) && Boolean(selectedCourse?.grade_level),
  });
  const classBookQuery = useQuery({
    queryKey: ["teacher-class-book", courseId, subjectId],
    queryFn: () => api.listClassBookEntries({ courseId, subjectId }) as Promise<ClassBookEntry[]>,
    enabled: Boolean(courseId) && Boolean(subjectId),
  });
  const resourcesQuery = useQuery({
    queryKey: ["teacher-resources", courseId, subjectId],
    queryFn: () => api.listLearningResources({ courseId, subjectId }) as Promise<LearningResourceRow[]>,
    enabled: Boolean(courseId) && Boolean(subjectId),
  });
  const [title, setTitle] = useState("Control unidad 1");
  const [assessmentType, setAssessmentType] = useState("PROCESO");
  const [semester, setSemester] = useState(1);
  const [assessmentWeight, setAssessmentWeight] = useState(25);
  const [appliedAt, setAppliedAt] = useState(new Date().toISOString().slice(0, 10));
  const [lessonDate, setLessonDate] = useState(new Date().toISOString().slice(0, 10));
  const [lessonTopic, setLessonTopic] = useState("Clase de la unidad");
  const [lessonContent, setLessonContent] = useState("");
  const [lessonActivities, setLessonActivities] = useState("");
  const [lessonResources, setLessonResources] = useState("");
  const [grades, setGrades] = useState<Record<string, number>>({});
  const [celdaLibro, setCeldaLibro] = useState<CeldaLibro>(null);
  const [valorCeldaLibro, setValorCeldaLibro] = useState("");
  const [guardandoCeldas, setGuardandoCeldas] = useState<Set<string>>(new Set());
  const [finalizandoEvaluaciones, setFinalizandoEvaluaciones] = useState<Set<string>>(new Set());
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialType, setMaterialType] = useState("SIMCE_PDF");
  const [materialDescription, setMaterialDescription] = useState("");
  const [materialFiles, setMaterialFiles] = useState<File[]>([]);
  const [materialUploadProgress, setMaterialUploadProgress] = useState<MaterialUploadProgress | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<LearningResourceRow | null>(null);
  const [observation, setObservation] = useState("");
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [displayName, setDisplayName] = useState(user.name);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState(() => {
    const [firstName = "", ...rest] = user.name.split(" ").filter(Boolean);
    return { firstName, lastName: rest.join(" ") };
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const isSimcePdfMaterial = materialType === "SIMCE_PDF";
  const gradesEditedRef = useRef(false);
  const prevCourseIdRef = useRef(courseId);
  const { toast } = useToast();
  const avatarStorageKey = `cordillera_avatar_${user.sub}`;
  const userInitials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const materialFilesQuery = useQuery({
    queryKey: ["teacher-resource-files", selectedMaterial?.id],
    queryFn: () => api.listEntityFiles("resource", selectedMaterial?.id || "") as Promise<MaterialFileRow[]>,
    enabled: Boolean(selectedMaterial?.id),
  });
  const materialUsageQuery = useQuery({
    queryKey: ["teacher-resource-usage", selectedMaterial?.id],
    queryFn: () => api.getLearningResourceUsage(selectedMaterial?.id || "") as Promise<ResourceUsageRow[]>,
    enabled: Boolean(selectedMaterial?.id),
  });

  useEffect(() => {
    setDisplayName(user.name);
    const [firstName = "", ...rest] = user.name.split(" ").filter(Boolean);
    setProfileForm({ firstName, lastName: rest.join(" ") });
    setAvatarUrl(localStorage.getItem(avatarStorageKey));
  }, [avatarStorageKey, user.name]);

  async function handleProfileSave() {
    if (!profileForm.firstName.trim() || !profileForm.lastName.trim()) return;
    setProfileSaving(true);
    try {
      const result = await api.updateMyProfile({
        firstName: profileForm.firstName.trim(),
        lastName: profileForm.lastName.trim(),
      });
      localStorage.setItem("cordillera_user", JSON.stringify(result.user));
      setDisplayName(result.user.name);
      setIsEditingProfile(false);
      toast("Nombre actualizado correctamente.", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "No fue posible actualizar el nombre.", "error");
    } finally {
      setProfileSaving(false);
    }
  }

  function handleAvatarFile(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const nextAvatar = typeof reader.result === "string" ? reader.result : null;
      if (!nextAvatar) return;
      localStorage.setItem(avatarStorageKey, nextAvatar);
      setAvatarUrl(nextAvatar);
    };
    reader.readAsDataURL(file);
  }

  async function finalizarProcesoNota(assessmentId: string, status?: string) {
    let currentStatus = status || "ACTIVE";
    if (currentStatus === "REPORTED" || currentStatus === "GRADED") return;

    if (currentStatus === "PUBLISHED") {
      await api.activateAssessment(assessmentId);
      currentStatus = "ACTIVE";
    }
    if (currentStatus === "ACTIVE") {
      await api.closeAssessment(assessmentId);
      currentStatus = "CLOSED";
    }
    if (currentStatus === "CLOSED") {
      await api.startAssessmentGrading(assessmentId);
      currentStatus = "IN_GRADING";
    }
    if (currentStatus === "IN_GRADING") {
      await api.markAssessmentGraded(assessmentId);
    }
  }

  const createAssessment = useMutation({
    mutationFn: async (payload: {
      assessment: {
        courseId: string;
        subjectId: string;
        title: string;
        assessmentType: string;
        semester: number;
        weight?: number;
        description?: string;
        startDate: string;
        deliveryMode: string;
      };
      grades: { studentId: string; grade: number; comments?: string }[];
    }) => {
      const assessment = await api.createAssessment(payload.assessment);
      const assessmentId = assessment.assessmentId ?? assessment.id;
      if (!assessmentId) throw new Error("No fue posible identificar la evaluación creada.");
      if (payload.grades.length > 0) {
        const bulk = await api.bulkDirectGrades({
          grades: payload.grades.map((grade) => ({
            assessmentId,
            studentId: grade.studentId,
            grade: grade.grade,
            comments: grade.comments,
          })),
        });
        if (bulk.failed > 0) {
          throw new Error(`No se pudieron registrar ${bulk.failed} nota(s). Revisa la planilla e intenta nuevamente.`);
        }
      }
      return assessment;
    },
    onSuccess: () => {
      setGrades({});
      gradesEditedRef.current = false;
      toast("Planilla registrada. Puedes revisar las notas y cerrar la evaluación cuando esté completa.", "success");
      studentsQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ["teacher-course-book", courseId, subjectId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-profile-assessments", courseId, subjectId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-course-assessments", courseId, subjectId] });
      queryClient.invalidateQueries({ queryKey: ["my-alerts"] });
    },
    onError: (error) => {
      toast(error instanceof Error ? error.message : "No se pudo registrar la planilla", "error");
    }
  });

  const finalizarEvaluacion = useMutation({
    mutationFn: async ({ assessmentId, status, missingCount }: { assessmentId: string; status: string; missingCount: number }) => {
      if (status === "GRADED" || status === "REPORTED") return;
      if (missingCount > 0) {
        throw new Error(`Faltan ${missingCount} nota(s). Completa todos los alumnos antes de cerrar.`);
      }
      await finalizarProcesoNota(assessmentId, status);
    },
    onSuccess: () => {
      toast("Evaluacion cerrada: las notas quedaron puestas.", "success");
      queryClient.invalidateQueries({ queryKey: ["teacher-course-book", courseId, subjectId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-profile-assessments", courseId, subjectId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-course-assessments", courseId, subjectId] });
      queryClient.invalidateQueries({ queryKey: ["my-alerts"] });
    },
    onError: (error) => {
      toast(error instanceof Error ? error.message : "No se pudo cerrar la evaluación.", "error");
    },
    onSettled: (_data, _error, variables) => {
      setFinalizandoEvaluaciones((prev) => {
        const next = new Set(prev);
        if (variables?.assessmentId) next.delete(variables.assessmentId);
        return next;
      });
    },
  });

  const updateGradeMutation = useMutation({
    mutationFn: ({ gradeId, grade }: { gradeId: string; grade: number }) =>
      api.updateGrade(gradeId, { grade }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-course-book", courseId, subjectId] });
    },
    onError: (error) => {
      toast(error instanceof Error ? error.message : "No se pudo guardar la nota.", "error");
    },
  });

  const directGradeMutation = useMutation({
    mutationFn: (payload: { assessmentId: string; studentId: string; grade: number }) =>
      api.createDirectGrade(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-course-book", courseId, subjectId] });
    },
    onError: (error) => {
      toast(error instanceof Error ? error.message : "No se pudo registrar la nota.", "error");
    },
  });

  const createClassBookEntry = useMutation({
    mutationFn: () =>
      api.createClassBookEntry({
        courseId,
        subjectId,
        date: `${lessonDate}T12:00:00.000Z`,
        semester,
        topic: lessonTopic,
        content: lessonContent,
        activities: lessonActivities,
        resources: lessonResources,
      }),
    onSuccess: () => {
      setLessonContent("");
      setLessonActivities("");
      setLessonResources("");
      toast("Libro de clases registrado correctamente.", "success");
      classBookQuery.refetch();
    },
    onError: (error) => {
      toast(error instanceof Error ? error.message : "No se pudo guardar el libro de clases", "error");
    },
  });

  const uploadMaterial = useMutation({
    mutationFn: async () => {
      if (!user.institutionId) throw new Error("No se pudo identificar la institucion del profesor.");
      if (!courseId || !subjectId) throw new Error("Selecciona un curso/asignatura antes de subir material.");
      if (!materialFiles.length) throw new Error("Selecciona uno o más archivos.");
      const invalidSimceFile = materialFiles.find((file) => file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"));
      if (isSimcePdfMaterial && invalidSimceFile) {
        throw new Error("El material SIMCE debe ser un archivo PDF.");
      }

      const backendResourceType = isSimcePdfMaterial ? "PRINTABLE_TEST" : materialType;
      const created = [];
      setMaterialUploadProgress({
        total: materialFiles.length,
        completed: 0,
        currentFile: materialFiles[0]?.name || "",
        phase: "creating",
      });
      for (const [index, file] of materialFiles.entries()) {
        setMaterialUploadProgress({
          total: materialFiles.length,
          completed: index,
          currentFile: file.name,
          phase: "creating",
        });
        const baseName = file.name.replace(/\.[^.]+$/, "");
        const title = materialTitle.trim()
          ? (materialFiles.length > 1 ? `${materialTitle.trim()} ${index + 1}` : materialTitle.trim())
          : baseName;
        const description = materialDescription.trim()
          || (isSimcePdfMaterial ? "Ensayo SIMCE en PDF para el curso activo." : undefined);
        const resource = await api.createLearningResource({
          institutionId: user.institutionId,
          title,
          description,
          type: backendResourceType,
          subjectId,
          courseId,
          gradeLevel: selectedAssignment?.grade_level,
          guideType: backendResourceType === "GUIDE" ? "CONTENT" : undefined,
          presentationType: backendResourceType === "PRESENTATION" ? file.type || "PDF" : undefined,
          instructions: isSimcePdfMaterial ? "PDF SIMCE subido por profesor para práctica, impresión o revisión del curso." : undefined,
          isPrintable: isSimcePdfMaterial || backendResourceType === "PRINTABLE_TEST" ? true : undefined,
        }) as { id: string };

        setMaterialUploadProgress({
          total: materialFiles.length,
          completed: index,
          currentFile: file.name,
          phase: "uploading",
        });
        await api.uploadFile("resource", resource.id, file);
        setMaterialUploadProgress({
          total: materialFiles.length,
          completed: index,
          currentFile: file.name,
          phase: "publishing",
        });
        await api.publishLearningResource(resource.id).catch(() => null);
        created.push(resource);
        setMaterialUploadProgress({
          total: materialFiles.length,
          completed: index + 1,
          currentFile: file.name,
          phase: index + 1 === materialFiles.length ? "done" : "creating",
        });
      }
      return created;
    },
    onSuccess: (created) => {
      toast(created.length > 1 ? `${created.length} materiales subidos correctamente.` : "Material subido correctamente.", "success");
      setMaterialTitle("");
      setMaterialDescription("");
      setMaterialFiles([]);
      setMaterialUploadProgress((current) => current ? { ...current, phase: "done", completed: current.total } : null);
      resourcesQuery.refetch();
    },
    onError: (error) => {
      setMaterialUploadProgress((current) => current ? { ...current, phase: "error" } : null);
      toast(error instanceof Error ? error.message : "No se pudo subir el material.", "error");
    },
  });

  const archiveMaterial = useMutation({
    mutationFn: (resourceId: string) => api.archiveLearningResource(resourceId),
    onSuccess: () => {
      toast("Material eliminado de la biblioteca.", "success");
      setSelectedMaterial(null);
      resourcesQuery.refetch();
    },
    onError: (error) => {
      toast(error instanceof Error ? error.message : "No se pudo eliminar el material.", "error");
    },
  });

  const deleteMaterialFile = useMutation({
    mutationFn: (fileId: string) => api.deleteFile(fileId),
    onSuccess: () => {
      toast("Archivo eliminado.", "success");
      materialFilesQuery.refetch();
    },
    onError: (error) => {
      toast(error instanceof Error ? error.message : "No se pudo eliminar el archivo.", "error");
    },
  });

  const markMaterialUsed = useMutation({
    mutationFn: ({ resourceId, action, notes }: { resourceId: string; action: string; notes?: string }) =>
      api.markLearningResourceUsed(resourceId, { courseId, subjectId, action, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-resource-usage"] });
      resourcesQuery.refetch();
    },
  });

  function registrarUsoMaterial(action: "VIEW" | "DOWNLOAD" | "PRINT", notes?: string) {
    if (!selectedMaterial?.id || !courseId) return;
    markMaterialUsed.mutate({
      resourceId: selectedMaterial.id,
      action,
      notes: notes || `${getTeacherMaterialLabel(selectedMaterial)} usado en ${selectedAssignment?.course_name || "curso activo"}.`,
    });
  }

  function abrirMaterial(url: string) {
    registrarUsoMaterial("VIEW", "Visualización del ensayo o material.");
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function descargarMaterial(url: string) {
    registrarUsoMaterial("DOWNLOAD", "Descarga del ensayo o material.");
    window.location.href = url;
  }

  function imprimirMaterial(url: string) {
    registrarUsoMaterial("PRINT", "Impresión del ensayo o material.");
    const printWindow = window.open(url, "_blank", "noopener,noreferrer");
    if (printWindow) {
      printWindow.addEventListener("load", () => {
        try {
          printWindow.print();
        } catch {
          // Algunos navegadores bloquean print() hasta que el PDF termina de cargar.
        }
      });
    }
  }

  const students = studentsQuery.data || [];

  const kpiData = useMemo(() => {
    const total = students.length;
    if (!total) return { avgGrade: "-", avgPercent: "-", level: "-", totalGrades: 0 };
    const validGrades = Object.values(grades).filter(v => typeof v === 'number' && !isNaN(v) && v > 0);
    const totalGrades = validGrades.length;
    if (!totalGrades) return { avgGrade: "-", avgPercent: "-", level: "-", totalGrades: 0 };
    const avg = validGrades.reduce((s, g) => s + g, 0) / totalGrades;
    const pct = ((avg / 7) * 100).toFixed(0);
    let level = "Sin datos";
    if (avg >= 5.5) level = "Alto";
    else if (avg >= 4.0) level = "Medio";
    else level = "Bajo";
    return { avgGrade: avg.toFixed(2), avgPercent: `${pct}%`, level, totalGrades };
  }, [students, grades]);

  const activeAssessmentsCount = useMemo(
    () =>
      (teacherAssessmentsQuery.data || []).filter((assessment) =>
        ["ACTIVE", "PUBLISHED", "IN_GRADING"].includes(assessment.status)
      ).length,
    [teacherAssessmentsQuery.data]
  );
  const courseBookStats = gradeBookQuery.data?.stats;
  useEffect(() => {
    if (!studentsQuery.data?.length) return;

    if (courseId !== prevCourseIdRef.current) {
      if (gradesEditedRef.current) {
        const confirmed = window.confirm(
          "Has editado notas en este curso. Al cambiar de curso perderas los cambios no guardados. ¿Deseas continuar?"
        );
        if (!confirmed) {
          setAssignmentId(prevCourseIdRef.current ? assignmentId : "");
          return;
        }
      }
      prevCourseIdRef.current = courseId;
      gradesEditedRef.current = false;
    }

    if (!gradesEditedRef.current) {
      const next: Record<string, number> = {};
      for (const s of studentsQuery.data) {
        const studentId = getStudentField(s, "student_id", "studentId");
        if (studentId) next[studentId] = 4.0;
      }
      setGrades(next);
    }
  }, [studentsQuery.data, courseId]);

  const chartData = useMemo(
    () =>
      students.slice(0, 12).map((s: CourseStudentRow, index) => {
        const studentId = getStudentField(s, "student_id", "studentId");
        const firstName = getStudentField(s, "first_name", "firstName") || "Alumno";
        const lastName = getStudentField(s, "last_name", "lastName");
        return {
          name: `${firstName} ${lastName ? `${lastName.charAt(0)}.` : `#${index + 1}`}`,
          grade: grades[studentId] ?? 0,
        };
      }),
    [students, grades]
  );

  function submitGradebook() {
    
    if (!title.trim()) {
      toast("El nombre de la evaluación es obligatorio.", "warning");
      return;
    }
    if (!students.length) {
      toast("No hay alumnos en el curso seleccionado.", "warning");
      return;
    }
    if (Number.isNaN(assessmentWeight) || assessmentWeight < 0 || assessmentWeight > 100) {
      toast("La ponderacion debe estar entre 0% y 100%.", "warning");
      return;
    }

    const invalid = students.find((s) => {
      const studentId = getStudentField(s, "student_id", "studentId");
      const value = Number(grades[studentId]);
      return Number.isNaN(value) || value < 0 || value > 7;
    });
    if (invalid) {
      toast("Todas las notas deben estar entre 0.0 y 7.0.", "warning");
      return;
    }

    createAssessment.mutate({
      assessment: {
        courseId,
        subjectId,
        title,
        assessmentType,
        semester,
        weight: assessmentWeight,
        description: observation,
        startDate: `${appliedAt}T12:00:00.000Z`,
        deliveryMode: "PRINTED",
      },
      grades: students.map((s) => {
        const studentId = getStudentField(s, "student_id", "studentId");
        return {
          studentId,
          grade: Number(grades[studentId] ?? 0),
        comments: observation
        };
      }).filter((grade) => grade.studentId),
    });
  }

  function crearColumnaLibro() {
    if (!courseId || !subjectId) {
      toast("Selecciona una asignacion curso/asignatura.", "warning");
      return;
    }
    if (!title.trim()) {
      toast("El nombre de la evaluación es obligatorio.", "warning");
      return;
    }
    if (Number.isNaN(assessmentWeight) || assessmentWeight < 0 || assessmentWeight > 100) {
      toast("La ponderacion debe estar entre 0% y 100%.", "warning");
      return;
    }

    createAssessment.mutate({
      assessment: {
        courseId,
        subjectId,
        title: title.trim(),
        assessmentType,
        semester,
        weight: assessmentWeight,
        description: observation,
        startDate: `${appliedAt}T12:00:00.000Z`,
        deliveryMode: "PRINTED",
      },
      grades: [],
    });
  }

  function guardarCeldaLibro(estudianteId: string, evaluacionId: string) {
    const parsed = Number(valorCeldaLibro.trim().replace(",", "."));
    const cellKey = `${estudianteId}|${evaluacionId}`;
    if (valorCeldaLibro.trim() === "") {
      setCeldaLibro(null);
      return;
    }
    if (Number.isNaN(parsed) || parsed < 1 || parsed > 7) {
      toast("La nota debe estar entre 1.0 y 7.0.", "warning");
      setCeldaLibro(null);
      return;
    }

    const nota = Math.round(parsed * 10) / 10;
    const student = gradeBookQuery.data?.students.find((item) => item.studentId === estudianteId);
    const gradeEntry = student?.grades.find((item) => item.assessmentId === evaluacionId);
    const assessment = gradeBookQuery.data?.assessments.find((item) => item.id === evaluacionId);
    setGuardandoCeldas((prev) => new Set(prev).add(cellKey));

    const onSettled = () => {
      setGuardandoCeldas((prev) => {
        const next = new Set(prev);
        next.delete(cellKey);
        return next;
      });
    };

    if (gradeEntry?.gradeId && assessment?.status !== "ACTIVE") {
      updateGradeMutation.mutate({ gradeId: gradeEntry.gradeId, grade: nota }, { onSettled });
    } else {
      directGradeMutation.mutate({ assessmentId: evaluacionId, studentId: estudianteId, grade: nota }, { onSettled });
    }
    setCeldaLibro(null);
  }

  function descargarLibroExcel() {
    const book = gradeBookQuery.data;
    if (!book) return;
    const assessments = (book.assessments || []) as TeacherGradebookAssessment[];
    const students = (book.students || []) as TeacherGradebookStudent[];
    const headers = ["N", "Estudiante", "RUT", ...assessments.map((assessment) => `${assessment.title} (${assessment.weight || 0}%)`), "Promedio"];
    const rows = students.map((student, index) => [
      String(index + 1),
      `${student.lastName}, ${student.firstName}`,
      student.rut || "",
      ...assessments.map((assessment) => {
        const grade = student.grades.find((item) => item.assessmentId === assessment.id)?.grade;
        return grade == null ? "" : String(grade).replace(".", ",");
      }),
      student.average == null ? "" : String(student.average).replace(".", ","),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `libro-${selectedAssignment?.course_name || "curso"}-${selectedAssignment?.subject_name || "asignatura"}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function descargarLibroPdf() {
    const book = gradeBookQuery.data;
    if (!book || !selectedAssignment) return;
    exportGradebookToPdf(
      selectedAssignment.course_name,
      selectedAssignment.subject_name,
      (book.students || []) as TeacherGradebookStudent[],
      (book.assessments || []) as TeacherGradebookAssessment[],
      book.stats,
      user.name,
    );
  }

  function imprimirLibro() {
    window.print();
  }

  function descargarInformeAlumno(student: TeacherGradebookStudent) {
    const assessments = (gradeBookQuery.data?.assessments || []) as TeacherGradebookAssessment[];
    const rows = assessments.map((assessment) => ({
      id: assessment.id,
      title: `${assessment.title} (${assessment.weight || 0}%)`,
      type: assessment.type,
      weight: assessment.weight,
    }));
    exportGradebookToPdf(
      `${selectedAssignment?.course_name || "Curso"} - ${student.lastName}, ${student.firstName}`,
      selectedAssignment?.subject_name,
      [student],
      rows,
      null,
      user.name,
    );
  }

  return (
    <ShellLayout
      title="Pantalla Profesor"
      subtitle={`Bienvenido ${displayName}. Gestiona tus cursos, libro de clases, OA, evaluaciones, notas y material.`}
      right={
        <div className="header-actions">
          <div className="header-user-menu teacher-session-menu">
            <button
              className="header-user"
              type="button"
              onClick={() => setSessionMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={sessionMenuOpen}
            >
              <div className="header-user__copy">
                <span className="header-user__eyebrow">Sesión</span>
                <span className="header-user__name">{displayName}</span>
                <span className="header-user__role">TEACHER</span>
              </div>
              <span className="header-user__avatar" aria-hidden="true">
                {avatarUrl ? <img src={avatarUrl} alt="" /> : userInitials || "P"}
              </span>
            </button>
            {sessionMenuOpen ? (
              <div className="session-menu" role="menu">
                {isEditingProfile ? (
                  <div className="session-menu__form">
                    <label>
                      Nombre
                      <input
                        value={profileForm.firstName}
                        onChange={(event) => setProfileForm((form) => ({ ...form, firstName: event.target.value }))}
                      />
                    </label>
                    <label>
                      Apellido
                      <input
                        value={profileForm.lastName}
                        onChange={(event) => setProfileForm((form) => ({ ...form, lastName: event.target.value }))}
                      />
                    </label>
                    <div className="session-menu__row">
                      <button type="button" onClick={handleProfileSave} disabled={profileSaving}>
                        {profileSaving ? "Guardando..." : "Guardar"}
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => setIsEditingProfile(false)}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button type="button" onClick={() => setIsEditingProfile(true)} role="menuitem">
                      Editar nombre
                    </button>
                    <button type="button" onClick={() => fileInputRef.current?.click()} role="menuitem">
                      Cambiar foto
                    </button>
                    {avatarUrl ? (
                      <button
                        type="button"
                        onClick={() => {
                          localStorage.removeItem(avatarStorageKey);
                          setAvatarUrl(null);
                        }}
                        role="menuitem"
                      >
                        Quitar foto
                      </button>
                    ) : null}
                    <button type="button" className="session-menu__logout" onClick={onLogout} role="menuitem">
                      Salir
                    </button>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={(event) => {
                    handleAvatarFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>
      }
      className="shell--teacher"
    >
      {assignmentsQuery.isLoading ? <section className="panel"><p>Cargando asignaciones...</p></section> : null}
      {assignmentsQuery.isError ? <section className="panel"><p>No se pudieron cargar las asignaciones.</p></section> : null}

      <section className="teacher-overview teacher-workspace-hero">
        <div className="teacher-overview__main">
          <span>Espacio de trabajo docente</span>
          <strong>{selectedAssignment ? `${selectedAssignment.course_name} - ${selectedAssignment.subject_name}` : "Sin curso asignado"}</strong>
          <p>Libro de notas, evaluaciones, recursos, reportes y registro de clase del curso activo en una vista preparada para trabajo diario.</p>
          <div className="teacher-hero-actions">
            <a href="#teacher-grades">Notas</a>
            <Link to="/teacher/importar-prueba">Importar prueba</Link>
            <a href="#teacher-classbook">Clase</a>
            <a href="#teacher-material">Materiales</a>
            <a href="#teacher-analysis">Reportes</a>
          </div>
        </div>
        <div className="teacher-active-card">
          <label>Asignación activa</label>
          <select value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)}>
            {assignments.map((assignment) => (
              <option key={assignment.assignment_id} value={assignment.assignment_id}>
                {assignment.course_name} - {assignment.subject_name}
              </option>
            ))}
          </select>
          <div className="teacher-active-card__meta">
            <span>{gradeBookQuery.data?.students.length ?? selectedAssignment?.students_count ?? 0} alumnos</span>
            <span>{gradeBookQuery.data?.assessments.length ?? 0} evaluaciones</span>
            <span>{courseBookStats?.approvalRate ?? 0}% aprobación</span>
          </div>
        </div>
      </section>

      <section className="kpi-grid">
        <KpiCard label="Cursos asignados" value={assignments.length} />
        <KpiCard label="Promedio libro" value={courseBookStats?.courseAvg?.toFixed?.(2) ?? kpiData.avgGrade} />
        <KpiCard label="Evaluaciones activas" value={activeAssessmentsCount} />
        <KpiCard label="Alumnos en riesgo" value={courseBookStats?.atRiskCount ?? alertsQuery.data?.summary?.atRiskCount ?? 0} />
      </section>

      <div className="teacher-complete-grid">
        <aside className="teacher-module-rail" aria-label="Módulos del profesor">
          <a href="#teacher-grades">Notas</a>
          <Link to="/teacher/importar-prueba">Importar prueba</Link>
          <a href="#teacher-classbook">Clase diaria</a>
          <a href="#teacher-material">Materiales</a>
          <a href="#teacher-curricular">Curriculum</a>
          <a href="#teacher-analysis">Reportes</a>
        </aside>

        <main className="teacher-complete-content">
          <section id="teacher-curricular" className="panel teacher-work-panel">
            <div className="panel-heading">
              <div>
                <h3>Diseño Curricular</h3>
                <p>OA del curso activo y objetivos descendidos desde el libro de notas.</p>
              </div>
              <span className="badge badge--role">{selectedCourse?.grade_level ? `${selectedCourse.grade_level} basico/medio` : "Curso activo"}</span>
            </div>

            <div className="teacher-oa-grid">
              {(objectivesQuery.data || []).slice(0, 8).map((objective) => (
                <article key={objective.id} className="teacher-oa-card">
                  <strong>{objective.code}</strong>
                  <p>{objective.description}</p>
                </article>
              ))}
              {!objectivesQuery.isLoading && !objectivesQuery.data?.length ? (
                <div className="empty-inline">
                  <strong>Sin OA cargados para esta asignatura.</strong>
                  <span>Cuando UTP registre objetivos, aparecerán aquí para planificar y evaluar.</span>
                </div>
              ) : null}
            </div>

            {gradeBookQuery.data?.oaDescendidos?.length ? (
              <div className="teacher-risk-strip">
                {gradeBookQuery.data.oaDescendidos.slice(0, 4).map((oa) => (
                  <span key={oa.code}>{oa.code}: promedio {oa.average.toFixed(2)}</span>
                ))}
              </div>
            ) : null}
          </section>

          <section id="teacher-classbook" className="panel teacher-work-panel">
            <div className="panel-heading">
              <div>
                <h3>Libro de clases</h3>
                <p>Registro de la clase diaria para el curso y asignatura seleccionados.</p>
              </div>
            </div>

            <div className="form-row">
              <input type="date" value={lessonDate} onChange={(e) => setLessonDate(e.target.value)} />
              <input value={lessonTopic} onChange={(e) => setLessonTopic(e.target.value)} placeholder="Tema de la clase" />
              <button onClick={() => createClassBookEntry.mutate()} disabled={!courseId || !subjectId || createClassBookEntry.isPending}>
                {createClassBookEntry.isPending ? "Guardando..." : "Guardar clase"}
              </button>
            </div>
            <div className="teacher-classbook-form">
              <VoiceTextarea value={lessonContent} onChange={setLessonContent} label="Contenido tratado" placeholder="Contenido, OA o foco de la clase..." rows={2} />
              <VoiceTextarea value={lessonActivities} onChange={setLessonActivities} label="Actividades" placeholder="Actividades realizadas..." rows={2} />
              <VoiceTextarea value={lessonResources} onChange={setLessonResources} label="Recursos" placeholder="Materiales, enlaces, guias o apoyos..." rows={2} />
            </div>

            <div className="teacher-entry-list">
              {(classBookQuery.data || []).slice(0, 4).map((entry, index) => (
                <article key={entry.id || `${entry.date}-${index}`} className="teacher-entry-card">
                  <span>{entry.date ? new Date(entry.date).toLocaleDateString("es-CL") : "Sin fecha"}</span>
                  <strong>{entry.topic || entry.unitName || "Clase registrada"}</strong>
                  <p>{entry.content || entry.activities || "Registro sin detalle."}</p>
                </article>
              ))}
              {!classBookQuery.isLoading && !classBookQuery.data?.length ? (
                <div className="empty-inline">
                  <strong>Sin clases registradas.</strong>
                  <span>Guarda la primera clase para comenzar el libro.</span>
                </div>
              ) : null}
            </div>
          </section>

          <section id="teacher-grades" className="panel teacher-work-panel teacher-gradebook-panel">
            <div className="panel-heading">
              <div>
                <h3>Libro de Calificaciones</h3>
                <p>{selectedAssignment ? `${selectedAssignment.course_name} - ${selectedAssignment.subject_name}` : "Selecciona una asignación para ver el libro."}</p>
              </div>
              <span className="badge badge--role">{gradeBookQuery.data?.students.length ?? 0} alumnos</span>
            </div>
            <div className="teacher-grade-composer">
              <div className="teacher-grade-composer__intro">
                <span>Nueva evaluación</span>
                <strong>Configura la columna antes de agregarla al libro</strong>
              </div>
              <div className="form-row teacher-grade-form">
                <label className="teacher-grade-field teacher-grade-field--title">
                  <span>Nombre de evaluación</span>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Control unidad 1" />
                </label>
                <label className="teacher-grade-field">
                  <span>Fase de evaluación</span>
                  <select value={assessmentType} onChange={(e) => setAssessmentType(e.target.value)}>
                    <option value="DIAGNOSTICA">Diagnóstica</option>
                    <option value="PROCESO">Proceso</option>
                    <option value="CIERRE">Cierre</option>
                    <option value="PARCIAL">Parcial</option>
                    <option value="FINAL">Final</option>
                  </select>
                </label>
                <label className="teacher-grade-field">
                  <span>Semestre</span>
                  <select value={semester} onChange={(e) => setSemester(Number(e.target.value))}>
                    <option value={1}>Semestre 1</option>
                    <option value={2}>Semestre 2</option>
                  </select>
                </label>
                <label className="teacher-grade-field">
                  <span>Ponderación</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={assessmentWeight}
                    onChange={(e) => setAssessmentWeight(Number(e.target.value))}
                    placeholder="%"
                    title="Ponderación de la evaluación (%)"
                  />
                </label>
                <label className="teacher-grade-field">
                  <span>Fecha</span>
                  <input type="date" value={appliedAt} onChange={(e) => setAppliedAt(e.target.value)} />
                </label>
                <button className="teacher-grade-submit" onClick={crearColumnaLibro} disabled={!courseId || !subjectId || createAssessment.isPending}>
                  {createAssessment.isPending ? "Creando..." : "+ Calificación"}
                </button>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <VoiceTextarea
                value={observation}
                onChange={setObservation}
                label="Observaciones de la evaluación"
                placeholder="Dicta o escribe observaciones generales..."
                rows={2}
              />
            </div>

            {gradeBookQuery.isLoading ? <LoadingSpinner label="Cargando libro de calificaciones..." /> : null}
            {gradeBookQuery.isError ? <p className="error">No se pudo cargar el libro del curso asignado.</p> : null}

            {!gradeBookQuery.isLoading && gradeBookQuery.data ? (
              <>
                <div className="gradebook-kpi-grid" style={{ marginTop: 16 }}>
                  <div className="gradebook-kpi-card"><div><span>Promedio</span><strong style={{ color: colorNota(gradeBookQuery.data.stats.courseAvg) }}>{formatearNota(gradeBookQuery.data.stats.courseAvg)}</strong></div></div>
                  <div className="gradebook-kpi-card"><div><span>Aprobación</span><strong>{gradeBookQuery.data.stats.approvalRate}%</strong></div></div>
                  <div className="gradebook-kpi-card"><div><span>Evaluaciones</span><strong>{gradeBookQuery.data.assessments.length}</strong></div></div>
                  <div className="gradebook-kpi-card"><div><span>Pendientes</span><strong>{gradeBookQuery.data.stats.pendingsCount}</strong></div></div>
                </div>

                <div className="teacher-export-actions">
                  <button type="button" onClick={descargarLibroPdf} disabled={!gradeBookQuery.data.assessments.length}>
                    Descargar PDF
                  </button>
                  <button type="button" onClick={descargarLibroExcel} disabled={!gradeBookQuery.data.assessments.length}>
                    Descargar Excel
                  </button>
                  <button type="button" onClick={imprimirLibro} disabled={!gradeBookQuery.data.assessments.length}>
                    Imprimir
                  </button>
                </div>

                {gradeBookQuery.data.students.length === 0 ? (
                  <div className="empty-inline" style={{ marginTop: 16 }}>
                    <strong>Este curso no tiene alumnos matriculados.</strong>
                    <span>Cuando se asignen alumnos al curso, aparecerán aquí automáticamente.</span>
                  </div>
                ) : (
                  <div className="gradebook-table-scroll" style={{ marginTop: 16 }}>
                    <table className="gradebook-table">
                      <thead>
                        <tr>
                          <th className="gb-col-nro">N°</th>
                          <th className="gb-col-nombre">Estudiante</th>
                          {gradeBookQuery.data.assessments.map((assessment, index) => {
                            const totalStudents = gradeBookQuery.data.students.length;
                            const gradesCount = gradeBookQuery.data.students.filter((student) =>
                              student.grades.some((grade) => grade.assessmentId === assessment.id && grade.grade !== null)
                            ).length;
                            const missingCount = Math.max(totalStudents - gradesCount, 0);
                            const canCloseGrade = totalStudents > 0 && missingCount === 0;
                            const isClosedGrade = assessment.status === "GRADED" || assessment.status === "REPORTED";
                            const isFinalizing = finalizandoEvaluaciones.has(assessment.id);
                            return (
                              <th key={assessment.id} className="gb-col-eval" title={assessment.title}>
                                <div className="gb-eval-header">
                                  <span className="gb-eval-title">{assessment.title || `N${index + 1}`}</span>
                                  <span className="gb-eval-type">{assessment.type}</span>
                                  <span className={`badge ${isClosedGrade ? "badge--active" : "badge--warning"}`}>
                                    {isClosedGrade ? "Nota puesta" : `${gradesCount}/${totalStudents}`}
                                  </span>
                                  {!isClosedGrade ? (
                                    <button
                                      type="button"
                                      className="gb-finalize-btn"
                                      disabled={!canCloseGrade || isFinalizing}
                                      title={canCloseGrade ? "Cerrar evaluación y bloquear notas" : `Faltan ${missingCount} nota(s)`}
                                      onClick={() => {
                                        setFinalizandoEvaluaciones((prev) => new Set(prev).add(assessment.id));
                                        finalizarEvaluacion.mutate({ assessmentId: assessment.id, status: assessment.status, missingCount });
                                      }}
                                    >
                                      {isFinalizing ? "Cerrando..." : "Cerrar nota"}
                                    </button>
                                  ) : null}
                                </div>
                              </th>
                            );
                          })}
                          <th className="gb-col-prom">Promedio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gradeBookQuery.data.students.map((student, index) => (
                          <tr key={student.studentId}>
                            <td className="gb-col-nro">{index + 1}</td>
                            <td className="gb-col-nombre">
                              <div className="gb-student-card">
                                <span className="gb-student-avatar">
                                  {(student.firstName?.[0] || "A").toUpperCase()}{(student.lastName?.[0] || "").toUpperCase()}
                                </span>
                                <div className="gb-student-main">
                                  <strong>{student.lastName}, {student.firstName}</strong>
                                  {student.rut ? <span>{student.rut}</span> : <span>Sin RUT registrado</span>}
                                </div>
                                <button
                                  type="button"
                                  className="btn-small btn-secondary gb-student-report"
                                  onClick={() => descargarInformeAlumno(student as TeacherGradebookStudent)}
                                >
                                  Informe PDF
                                </button>
                              </div>
                            </td>
                            {gradeBookQuery.data.assessments.map((assessment) => {
                              const grade = student.grades.find((item) => item.assessmentId === assessment.id);
                              const isEditing = celdaLibro?.estudianteId === student.studentId && celdaLibro.evaluacionId === assessment.id;
                              const cellKey = `${student.studentId}|${assessment.id}`;
                              const isClosedGrade = assessment.status === "GRADED" || assessment.status === "REPORTED";
                              return (
                                <td key={assessment.id} className={`gb-col-eval gb-cell ${isEditing ? "gb-cell--editing" : ""}`}>
                                  {isClosedGrade ? (
                                    <span
                                      className="gb-cell-value gb-cell-value--locked"
                                      style={{ color: colorNota(grade?.grade), fontWeight: grade?.grade !== null ? 700 : 400 }}
                                      title="Nota cerrada"
                                    >
                                      {formatearNota(grade?.grade)}
                                    </span>
                                  ) : isEditing ? (
                                    <input
                                      className="gb-cell-input"
                                      type="text"
                                      inputMode="decimal"
                                      value={valorCeldaLibro}
                                      onChange={(e) => setValorCeldaLibro(e.target.value)}
                                      onBlur={() => guardarCeldaLibro(student.studentId, assessment.id)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          guardarCeldaLibro(student.studentId, assessment.id);
                                        }
                                        if (e.key === "Escape") setCeldaLibro(null);
                                      }}
                                      autoFocus
                                      onFocus={(e) => e.target.select()}
                                    />
                                  ) : (
                                    <button
                                      type="button"
                                      className="gb-cell-value"
                                      style={{ color: colorNota(grade?.grade), fontWeight: grade?.grade !== null ? 700 : 400 }}
                                      disabled={guardandoCeldas.has(cellKey) || isClosedGrade}
                                      onClick={() => {
                                        setCeldaLibro({ estudianteId: student.studentId, evaluacionId: assessment.id });
                                        setValorCeldaLibro(grade?.grade != null ? grade.grade.toFixed(1).replace(".", ",") : "");
                                      }}
                                    >
                                      {guardandoCeldas.has(cellKey) ? "..." : formatearNota(grade?.grade)}
                                    </button>
                                  )}
                                </td>
                              );
                            })}
                            <td className="gb-col-prom" style={{ color: colorNota(student.average), fontWeight: 800 }}>{formatearNota(student.average)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : null}
          </section>

          <SharedAssessmentTemplatesPanel courseId={courseId} subjectId={subjectId} gradeLevel={selectedCourse?.grade_level} />
          <EvaluacionesProfesorPanel courseId={courseId} subjectId={subjectId} />
          <AnswersInspectionPanel courseId={courseId} subjectId={subjectId} />

          <section id="teacher-analysis" className="panel teacher-work-panel">
            <div className="panel-heading">
              <div>
                <h3>Análisis y Reportes</h3>
                <p>Promedios, alumnos en riesgo y salud académica del curso.</p>
              </div>
            </div>
            <div className="kpi-grid">
              <KpiCard label="Notas libro" value={courseBookStats?.totalNotes ?? kpiData.totalGrades} />
              <KpiCard label="Aprobación" value={courseBookStats ? `${courseBookStats.approvalRate}%` : kpiData.avgPercent} />
              <KpiCard label="Pendientes" value={courseBookStats?.pendingsCount ?? 0} />
            </div>
            <GradeBarChart data={chartData} />
            <div className="alert-list" style={{ marginTop: 16 }}>
              {alertsQuery.data?.alerts.slice(0, 8).map((a) => (
                <article key={`${a.studentId}-${a.semester}`} className="alert-card">
                  <strong>{a.courseName} - {a.studentName} (Sem {a.semester})</strong>
                  <p>Promedio {a.avgGrade} | Riesgo {a.level}. {a.message}</p>
                </article>
              ))}
              {!alertsQuery.data?.alerts.length ? <p>Sin alumnos con riesgo alto en tus cursos asignados.</p> : null}
            </div>
          </section>

          <section id="teacher-material" className="panel teacher-work-panel">
            <div className="panel-heading">
              <div>
                <h3>Material Pedagógico</h3>
                <p>Sube, organiza y visualiza recursos del curso activo: PDF SIMCE, PPT, guías, imágenes y material de apoyo.</p>
              </div>
            </div>

            <div className="teacher-material-upload">
              <div className="form-field">
                <label>Título</label>
                <input value={materialTitle} onChange={(e) => setMaterialTitle(e.target.value)} placeholder="Ej: Guía unidad 2" />
              </div>
              <div className="form-field">
                <label>Tipo</label>
                <select value={materialType} onChange={(e) => setMaterialType(e.target.value)}>
                  <option value="CLASS_MATERIAL">Material</option>
                  <option value="SIMCE_PDF">PDF SIMCE</option>
                  <option value="GUIDE">Guía</option>
                  <option value="PRESENTATION">Presentación</option>
                  <option value="WORKSHEET">Actividad</option>
                  <option value="PRINTABLE_TEST">Evaluación imprimible</option>
                </select>
              </div>
              <div className="form-field">
                <label>Archivo</label>
                <input
                  type="file"
                  multiple
                  accept={isSimcePdfMaterial ? ".pdf,application/pdf" : MATERIAL_ACCEPT_ALL}
                  onChange={(e) => {
                    setMaterialFiles(Array.from(e.target.files || []));
                    setMaterialUploadProgress(null);
                  }}
                />
                {materialFiles.length ? <small>{materialFiles.length} archivo(s) seleccionado(s)</small> : null}
              </div>
              <button onClick={() => uploadMaterial.mutate()} disabled={uploadMaterial.isPending || !materialFiles.length || !courseId || !subjectId}>
                {uploadMaterial.isPending ? "Subiendo..." : materialFiles.length > 1 ? "Subir masivamente" : "Subir material"}
              </button>
              <div className="form-field teacher-material-upload__description">
                <label>Descripción breve</label>
                <input
                  value={materialDescription}
                  onChange={(e) => setMaterialDescription(e.target.value)}
                  placeholder={isSimcePdfMaterial ? "Ej: Ensayo SIMCE Lectura 4° básico..." : "Para qué sirve este recurso..."}
                />
              </div>
              {materialUploadProgress ? (
                <div className={`teacher-material-upload-progress teacher-material-upload-progress--${materialUploadProgress.phase}`}>
                  <div className="teacher-material-upload-progress__header">
                    <strong>
                      {materialUploadProgress.phase === "done"
                        ? "Carga completada"
                        : materialUploadProgress.phase === "error"
                          ? "Carga interrumpida"
                          : "Subiendo archivos"}
                    </strong>
                    <span>
                      {Math.round((materialUploadProgress.completed / Math.max(materialUploadProgress.total, 1)) * 100)}%
                    </span>
                  </div>
                  <div className="teacher-material-upload-progress__track" aria-hidden="true">
                    <span style={{ width: `${Math.round((materialUploadProgress.completed / Math.max(materialUploadProgress.total, 1)) * 100)}%` }} />
                  </div>
                  <div className="teacher-material-upload-progress__meta">
                    <span>{materialUploadProgress.completed}/{materialUploadProgress.total} archivo(s)</span>
                    <span>
                      {materialUploadProgress.phase === "creating" ? "Preparando" : null}
                      {materialUploadProgress.phase === "uploading" ? "Subiendo" : null}
                      {materialUploadProgress.phase === "publishing" ? "Publicando" : null}
                      {materialUploadProgress.phase === "done" ? "Todo listo" : null}
                      {materialUploadProgress.phase === "error" ? "Revisa el último archivo" : null}
                      {materialUploadProgress.currentFile && materialUploadProgress.phase !== "done" ? `: ${materialUploadProgress.currentFile}` : ""}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="teacher-material-grid">
              {(resourcesQuery.data || []).map((resource, index) => (
                <article
                  key={resource.id || `${resource.title}-${index}`}
                  className="teacher-material-card"
                >
                  <span className="teacher-material-card__type">{getTeacherMaterialLabel(resource)}</span>
                  <strong>{resource.title || "Material sin título"}</strong>
                  <p>{resource.description || "Disponible para este curso."}</p>
                  <small>{resource.status || "DRAFT"}</small>
                  <div className="teacher-material-card__usage">
                    <span>Usado {resource._count?.usageLogs ?? 0} vez/veces</span>
                    {resource.usageLogs?.[0]?.usedAt || resource.usedAt ? (
                      <time>Último uso: {new Date(resource.usageLogs?.[0]?.usedAt || resource.usedAt || "").toLocaleString("es-CL")}</time>
                    ) : (
                      <time>Sin uso registrado</time>
                    )}
                  </div>
                  <div className="teacher-material-card__actions">
                    <button type="button" className="btn-small" onClick={() => setSelectedMaterial(resource)}>Ver</button>
                    <button
                      type="button"
                      className="btn-small btn-danger"
                      disabled={!resource.id || archiveMaterial.isPending}
                      onClick={() => {
                        if (!resource.id) return;
                        const ok = window.confirm(`¿Eliminar "${resource.title || "este material"}" de la biblioteca?`);
                        if (ok) archiveMaterial.mutate(resource.id);
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              ))}
              {!resourcesQuery.isLoading && !resourcesQuery.data?.length ? (
                <div className="empty-inline">
                  <strong>Biblioteca vacía.</strong>
                  <span>Sube uno o varios PDF SIMCE, presentaciones o guías para compartirlos con el curso.</span>
                </div>
              ) : null}
            </div>
          </section>
        </main>
      </div>

      <Modal
        isOpen={Boolean(selectedMaterial)}
        onClose={() => setSelectedMaterial(null)}
        title={selectedMaterial?.title || "Material pedagógico"}
        size="lg"
        footer={
          <>
            {selectedMaterial?.id ? (
              <button
                className="btn-danger"
                disabled={archiveMaterial.isPending}
                onClick={() => {
                  const ok = window.confirm(`¿Eliminar "${selectedMaterial.title || "este material"}" de la biblioteca?`);
                  if (ok) archiveMaterial.mutate(selectedMaterial.id!);
                }}
              >
                Eliminar material
              </button>
            ) : null}
            <button className="btn-secondary" onClick={() => setSelectedMaterial(null)}>Cerrar</button>
          </>
        }
      >
        <div className="teacher-material-preview">
          <p>{selectedMaterial?.description || "Recurso asociado al curso activo."}</p>
          {materialFilesQuery.isLoading ? <LoadingSpinner size="sm" /> : null}
          {(materialFilesQuery.data || []).map((file) => {
            const viewUrl = `/api/v1/files/view/${file.fileName}`;
            const downloadUrl = `/api/v1/files/download/${file.fileName}`;
            const canPrint = file.mimeType.includes("pdf") || file.mimeType.startsWith("image/") || file.mimeType.startsWith("text/");
            const canEmbed = file.mimeType.includes("pdf") || file.mimeType.startsWith("image/") || file.mimeType.startsWith("text/");
            return (
              <article key={file.id} className="teacher-material-file">
                <div>
                  <strong>{file.originalName}</strong>
                  <span>{file.mimeType} · {(file.size / 1024).toFixed(1)} KB</span>
                </div>
                <div className="teacher-material-file__actions">
                  <button type="button" className="btn-small" onClick={() => abrirMaterial(viewUrl)}>Abrir</button>
                  <button type="button" className="btn-small" onClick={() => descargarMaterial(downloadUrl)}>Descargar</button>
                  <button type="button" className="btn-small" disabled={!canPrint} onClick={() => imprimirMaterial(viewUrl)}>Imprimir</button>
                  <button
                    type="button"
                    className="btn-small btn-danger"
                    disabled={deleteMaterialFile.isPending}
                    onClick={() => {
                      const ok = window.confirm(`¿Eliminar el archivo "${file.originalName}"?`);
                      if (ok) deleteMaterialFile.mutate(file.id);
                    }}
                  >
                    Eliminar archivo
                  </button>
                </div>
                {canEmbed ? (
                  file.mimeType.startsWith("image/") ? (
                    <img src={viewUrl} alt={file.originalName} className="teacher-material-file__image" />
                  ) : (
                    <iframe src={viewUrl} title={file.originalName} className="teacher-material-file__frame" />
                  )
                ) : (
                  <div className="teacher-material-file__placeholder">
                    <strong>Vista previa no disponible en navegador</strong>
                    <span>Abre o descarga el archivo para verlo con su aplicacion correspondiente.</span>
                  </div>
                )}
              </article>
            );
          })}
          {!materialFilesQuery.isLoading && !materialFilesQuery.data?.length ? (
            <div className="empty-inline">
              <strong>Este recurso no tiene archivo asociado.</strong>
              <span>Sube un archivo nuevo para visualizarlo aquí.</span>
            </div>
          ) : null}
          <div className="teacher-material-usage">
            <div className="teacher-material-usage__heading">
              <strong>Historial de uso</strong>
              <span>{materialUsageQuery.data?.length ?? 0} registro(s)</span>
            </div>
            {materialUsageQuery.isLoading ? <LoadingSpinner size="sm" /> : null}
            {(materialUsageQuery.data || []).slice(0, 8).map((usage) => (
              <article key={usage.id} className="teacher-material-usage__item">
                <div>
                  <strong>{usage.course?.name || selectedAssignment?.course_name || "Curso"}</strong>
                  <span>{usage.subject?.name || selectedAssignment?.subject_name || "Asignatura"} · {usage.action}</span>
                </div>
                <time>{new Date(usage.usedAt).toLocaleString("es-CL")}</time>
              </article>
            ))}
            {!materialUsageQuery.isLoading && !materialUsageQuery.data?.length ? (
              <div className="empty-inline">
                <strong>Este ensayo aún no registra uso.</strong>
                <span>Al abrir, descargar o imprimir se guardará fecha, hora y curso sin bloquear su reutilización.</span>
              </div>
            ) : null}
          </div>
        </div>
      </Modal>
    </ShellLayout>
  );
}

function SharedAssessmentTemplatesPanel({ courseId, subjectId, gradeLevel }: { courseId: string; subjectId: string; gradeLevel?: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [publishingId, setPublishingId] = useState("");
  const templatesQuery = useQuery({
    queryKey: ["teacher-assessment-templates", courseId, subjectId],
    queryFn: () => api.listAssessmentTemplates({ status: "PUBLISHED" }) as Promise<{
      id: string;
      title: string;
      description: string | null;
      subjectId: string | null;
      gradeLevel: number | null;
      status: string;
      fileName: string | null;
      totalPoints: number;
      questionsCount: number;
    }[]>,
    enabled: Boolean(courseId) && Boolean(subjectId),
  });

  const createFromTemplate = useMutation({
    mutationFn: async (template: { id: string; title: string }) => {
      const result = await api.createAssessmentFromTemplate(template.id, {
        courseId,
        subjectId,
        title: template.title,
        assessmentType: "PROCESO",
        deliveryMode: "ONLINE",
        semester: 1,
        startDate: new Date().toISOString(),
        publishNow: true,
      }) as { assessmentId: string; createdCount: number; maxScore: number; status: string };
      await api.activateAssessment(result.assessmentId);
      return result;
    },
    onMutate: (template) => setPublishingId(template.id),
    onSuccess: (result) => {
      toast(`Prueba asignada con ${result.createdCount} pregunta(s). Los alumnos ya pueden responder.`, "success");
      queryClient.invalidateQueries({ queryKey: ["teacher-course-assessments", courseId, subjectId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-profile-assessments", courseId, subjectId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-course-book", courseId, subjectId] });
    },
    onError: (error) => {
      toast(error instanceof Error ? error.message : "No se pudo asignar la prueba al curso.", "error");
    },
    onSettled: () => setPublishingId(""),
  });

  const templates = templatesQuery.data || [];
  if (!courseId || !subjectId) return null;

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h3>Banco de Pruebas Compartido</h3>
          <p>Pruebas validadas por UTP/Admin listas para convertir en evaluacion digital del curso.</p>
        </div>
        <Link className="btn-secondary" to="/teacher/importar-prueba">Subir prueba propia</Link>
      </div>

      {templatesQuery.isLoading ? <LoadingSpinner size="sm" /> : null}
      {!templatesQuery.isLoading && templates.length === 0 ? (
        <div className="empty-inline">
          <strong>No hay pruebas publicadas en el banco institucional.</strong>
          <span>Un administrador o UTP debe subir y publicar plantillas desde el panel Admin &gt; Banco de Pruebas.</span>
        </div>
      ) : null}

      {templates.length > 0 ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Prueba</th>
                <th>Nivel</th>
                <th>Preguntas</th>
                <th>Puntaje</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => {
                const gradeMismatch = gradeLevel && template.gradeLevel && template.gradeLevel !== gradeLevel;
                return (
                <tr key={template.id}>
                  <td>
                    <strong>{template.title}</strong>
                    <br />
                    <small>{template.description || template.fileName || "Plantilla publicada"}</small>
                  </td>
                  <td>
                    {template.gradeLevel ? `${template.gradeLevel} basico/medio` : "Flexible"}
                    {gradeMismatch ? (
                      <span className="badge badge--role" style={{ display: "inline-block", marginLeft: 6, fontSize: 10, background: "var(--warning-bg)", color: "var(--warning)" }}>
                        no coincide
                      </span>
                    ) : null}
                  </td>
                  <td>{template.questionsCount}</td>
                  <td>{template.totalPoints}</td>
                  <td>
                    <button
                      className="btn-small"
                      disabled={createFromTemplate.isPending}
                      onClick={() => createFromTemplate.mutate(template)}
                      title={gradeMismatch ? "El nivel no coincide con el curso, pero puedes usarlo igual" : "Asignar prueba al curso y activarla para los alumnos"}
                    >
                      {publishingId === template.id ? "Asignando..." : "Asignar al curso"}
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function EvaluacionesProfesorPanel({ courseId, subjectId }: { courseId: string; subjectId: string }) {
  const assessmentsQuery = useQuery({
    queryKey: ["teacher-course-assessments", courseId, subjectId],
    queryFn: () => api.listAssessments({ courseId, subjectId }) as Promise<{ assessment_id: string; title: string; assessment_type: string; status: string; course_name: string; subject_name: string; attempts_count: number; grades_count: number; created_at: string }[]>,
    enabled: Boolean(courseId) && Boolean(subjectId),
  });

  const assessments = assessmentsQuery.data || [];

  const porEstado = useMemo(() => {
    const map: Record<string, number> = {};
    assessments.forEach((a) => { map[a.status] = (map[a.status] || 0) + 1; });
    return map;
  }, [assessments]);

  if (!courseId || !subjectId) return null;

  return (
    <section className="panel">
      <h3>Mis Evaluaciones del Curso</h3>
      <p style={{ color: "var(--muted)", fontSize: ".84rem", marginBottom: 12 }}>
        Evaluaciones creadas para este curso y asignatura. Puedes crear, revisar y monitorear el progreso de tus estudiantes.
      </p>

      {assessmentsQuery.isLoading ? <LoadingSpinner size="sm" /> : null}

      {!assessmentsQuery.isLoading && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {Object.entries(porEstado).map(([estado, count]) => (
            <span key={estado} className={`badge ${estado === "PUBLISHED" || estado === "ACTIVE" ? "badge--active" : estado === "CLOSED" || estado === "IN_GRADING" ? "badge--warning" : estado === "GRADED" || estado === "REPORTED" ? "badge--active" : "badge--inactive"}`}>
              {estado}: {count}
            </span>
          ))}
          {assessments.length === 0 && <span style={{ color: "var(--muted)", fontSize: ".84rem" }}>Sin evaluaciones aún. Crea una planilla arriba.</span>}
        </div>
      )}

      {assessments.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Evaluación</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Intentos</th>
                <th>Notas</th>
                <th>Fecha</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((a) => (
                <tr key={a.assessment_id}>
                  <td><strong>{a.title}</strong></td>
                  <td><span className="badge badge--role">{a.assessment_type}</span></td>
                  <td>
                    <span className={`badge ${a.status === "PUBLISHED" || a.status === "ACTIVE" || a.status === "GRADED" ? "badge--active" : a.status === "CLOSED" || a.status === "IN_GRADING" ? "badge--warning" : "badge--inactive"}`}>
                      {a.status}
                    </span>
                  </td>
                  <td style={{ textAlign: "center" }}>{a.attempts_count}</td>
                  <td style={{ textAlign: "center" }}>{a.grades_count}</td>
                  <td style={{ fontSize: ".78rem", whiteSpace: "nowrap" }}>{new Date(a.created_at).toLocaleDateString("es-CL")}</td>
                  <td><Link className="btn-small" to={`/teacher/evaluaciones/${a.assessment_id}`}>{a.status === "DRAFT" ? "Revisar" : "Ver"}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AnswersInspectionPanel({ courseId, subjectId }: { courseId: string; subjectId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [manualScores, setManualScores] = useState<Record<string, string>>({});

  const assessmentsQuery = useQuery({
    queryKey: ["teacher-assessments", courseId, subjectId],
    queryFn: async () => {
      const data = await api.listAssessments({ courseId, subjectId }) as { assessment_id: string; title: string; assessment_type: string; status: string; attempts_count: number }[];
      return data.filter((assessment) => ["CLOSED", "IN_GRADING", "GRADED"].includes(assessment.status));
    },
    enabled: Boolean(courseId) && Boolean(subjectId),
  });

  const summaryQuery = useQuery({
    queryKey: ["grading-summary", selectedAssessmentId],
    queryFn: () => api.getGradingSummary(selectedAssessmentId),
    enabled: Boolean(selectedAssessmentId) && showModal,
  });

  const pendingQuery = useQuery({
    queryKey: ["pending-grading-teacher", selectedAssessmentId],
    queryFn: () => api.getPendingGrading(selectedAssessmentId),
    enabled: Boolean(selectedAssessmentId) && showModal,
  });

  const assessments = (assessmentsQuery.data || []) as { assessment_id: string; title: string; assessment_type: string; status: string; attempts_count: number }[];
  const summary = summaryQuery.data;
  const pending = pendingQuery.data;

  const gradeAnswerMutation = useMutation({
    mutationFn: ({ answerId, score, maxScore }: { answerId: string; score: number; maxScore: number }) =>
      api.gradeAnswer(answerId, {
        score,
        status: score <= 0 ? "INCORRECT" : score >= maxScore ? "CORRECT" : "PARTIAL",
      }),
    onSuccess: () => {
      toast("Respuesta corregida.", "success");
      queryClient.invalidateQueries({ queryKey: ["pending-grading-teacher", selectedAssessmentId] });
      queryClient.invalidateQueries({ queryKey: ["grading-summary", selectedAssessmentId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-course-assessments", courseId, subjectId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-course-book", courseId, subjectId] });
    },
    onError: (error) => {
      toast(error instanceof Error ? error.message : "No se pudo guardar la correccion.", "error");
    },
  });

  function submitManualScore(answerId: string, maxScore: number) {
    const raw = manualScores[answerId];
    const score = Number(raw);
    if (raw === undefined || Number.isNaN(score) || score < 0 || score > maxScore) {
      toast(`Ingresa un puntaje entre 0 y ${maxScore}.`, "error");
      return;
    }
    gradeAnswerMutation.mutate({ answerId, score, maxScore });
  }

  return (
    <section className="panel">
      <h3>Respuestas por alumno</h3>
      <p style={{ color: "var(--muted)", marginBottom: 8 }}>
        Selecciona una evaluación cerrada para ver el detalle de respuestas y puntajes por alumno.
      </p>
      <div className="form-row" style={{ marginBottom: 8 }}>
        <select value={selectedAssessmentId} onChange={(e) => setSelectedAssessmentId(e.target.value)}>
          <option value="">Seleccionar evaluación...</option>
          {assessments.map((a) => (
            <option key={a.assessment_id} value={a.assessment_id}>
              {a.title} ({a.assessment_type}) — {a.attempts_count} intentos
            </option>
          ))}
        </select>
        <button onClick={() => setShowModal(true)} disabled={!selectedAssessmentId}>
          Ver detalle
        </button>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={`Detalle: ${assessments.find((a) => a.assessment_id === selectedAssessmentId)?.title || "Evaluación"}`}
        size="lg"
        footer={<button className="btn-secondary" onClick={() => setShowModal(false)}>Cerrar</button>}
      >
        {summaryQuery.isLoading ? <LoadingSpinner size="sm" /> : summary ? (
          <div style={{ display: "grid", gap: 16 }}>
            <div className="kpi-grid">
              <div className="kpi-card"><span>Total intentos</span><strong>{summary.totalAttempts}</strong></div>
              <div className="kpi-card"><span>Preguntas</span><strong>{summary.totalQuestions}</strong></div>
              <div className="kpi-card"><span>Promedio general</span><strong>{summary.grades.length > 0 ? (summary.grades.reduce((s: number, g: { grade: number }) => s + g.grade, 0) / summary.grades.length).toFixed(2) : "-"}</strong></div>
            </div>

            <div>
              <h4>Estados de respuesta</h4>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {Object.entries(summary.answersByStatus as Record<string, number>).map(([status, count]) => (
                  <span key={status} className={`badge ${status === "CORRECT" ? "badge--active" : status === "INCORRECT" ? "badge--inactive" : status === "PENDING" || status === "MANUAL_REVIEW" ? "badge--warning" : "badge--role"}`}>
                    {status}: {count}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4>Notas por alumno</h4>
              <div className="table-wrap" style={{ maxHeight: 400, overflowY: "auto" }}>
                <table className="table">
                  <thead><tr><th>Alumno</th><th>Puntaje</th><th>%</th><th>Nota</th></tr></thead>
                  <tbody>
                    {summary.grades.map((g: { studentId: string; studentName: string; score: number | null; percentage: number | null; grade: number }) => (
                      <tr key={g.studentId}>
                        <td><strong>{g.studentName}</strong></td>
                        <td>{g.score ?? "-"}</td>
                        <td>{g.percentage != null ? `${g.percentage}%` : "-"}</td>
                        <td><span className={`badge ${g.grade >= 4.0 ? "badge--active" : "badge--inactive"}`}>{g.grade}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {pending && pending.totalPending > 0 && (
              <div>
                <h4>Pendientes de corrección manual</h4>
                <div className="kpi-grid">
                  <div className="kpi-card"><span>Total pendientes</span><strong>{pending.totalPending}</strong></div>
                  <div className="kpi-card"><span>Alumnos</span><strong>{pending.byStudent.length}</strong></div>
                </div>
                <div className="student-timeline" style={{ marginTop: 12 }}>
                  {pending.byStudent.map((student) => (
                    <article key={student.studentName} className="student-timeline__item">
                      <span>{student.pendingCount} pendiente(s)</span>
                      <strong>{student.studentName}</strong>
                      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                        {student.answers.map((answer) => (
                          <div key={answer.id} className="imported-test-question" style={{ padding: 12 }}>
                            <div className="imported-test-question__head">
                              <span className="badge badge--warning">{answer.status}</span>
                              <span>{answer.question.points} pts</span>
                            </div>
                            <p style={{ marginTop: 8 }}>{answer.question.statement}</p>
                            <p style={{ color: "var(--muted)", marginTop: 6 }}>{answer.textAnswer || "Sin respuesta escrita."}</p>
                            <div className="form-row" style={{ marginTop: 8 }}>
                              <input
                                type="number"
                                min={0}
                                max={answer.question.points}
                                step={0.5}
                                placeholder={`0 a ${answer.question.points}`}
                                value={manualScores[answer.id] ?? ""}
                                onChange={(event) => setManualScores((current) => ({ ...current, [answer.id]: event.target.value }))}
                              />
                              <button
                                disabled={gradeAnswerMutation.isPending}
                                onClick={() => submitManualScore(answer.id, answer.question.points)}
                              >
                                Guardar puntaje
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
