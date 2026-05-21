// ─── MOCK DATA: MÓDULOS COMPLEMENTARIOS ─────────────────────────────
// Datos simulados para todos los módulos que dependen de API/overview

import type { AdminOverview } from "../types/api";

export const mockOverview: AdminOverview = {
  studentCount: 109,
  courseCount: 4,
  teacherCount: 5,
  assessmentCount: 75,
  coverageRate: 85,
  subjectCount: 4,
  totals: { users: 186, courses: 4, students: 109, assessments: 75 },
  courses: [
    { course_id: "curso-1a", course_name: "1° A", grade_level: 1, section: "A", students_count: 22 },
    { course_id: "curso-4a", course_name: "4° A", grade_level: 4, section: "A", students_count: 28 },
    { course_id: "curso-6a", course_name: "6° A", grade_level: 6, section: "A", students_count: 30 },
    { course_id: "curso-8a", course_name: "8° A", grade_level: 8, section: "A", students_count: 29 },
  ],
  students: [
    { student_id: "est-01", first_name: "Martín", last_name: "González Muñoz", course_name: "4° A", email: "martin@ejemplo.cl" },
    { student_id: "est-02", first_name: "Sofía", last_name: "Muñoz Rojas", course_name: "4° A", email: "sofia@ejemplo.cl" },
    { student_id: "est-03", first_name: "Diego", last_name: "Rojas Díaz", course_name: "4° A", email: "diego@ejemplo.cl" },
    { student_id: "est-04", first_name: "Valentina", last_name: "Díaz Pérez", course_name: "4° A", email: "vale@ejemplo.cl" },
    { student_id: "est-05", first_name: "Benjamín", last_name: "Pérez Soto", course_name: "4° A", email: "benja@ejemplo.cl" },
    { student_id: "est-06", first_name: "Isabella", last_name: "Soto Contreras", course_name: "6° A", email: "isa@ejemplo.cl" },
    { student_id: "est-07", first_name: "Lucas", last_name: "Contreras Martínez", course_name: "6° A", email: "lucas@ejemplo.cl" },
    { student_id: "est-08", first_name: "Emilia", last_name: "Martínez Sepúlveda", course_name: "8° A", email: "emi@ejemplo.cl" },
  ],
  teachers: [
    { user_id: "tch-1", teacher_id: "tid-1", teacher_name: "Carolina Vega", email: "carolina@ejemplo.cl", courses: [{ course: "1° A", subject: "Lenguaje" }, { course: "4° A", subject: "Lenguaje" }], total_assessments: 9 },
    { user_id: "tch-2", teacher_id: "tid-2", teacher_name: "Roberto Contreras", email: "roberto@ejemplo.cl", courses: [{ course: "4° A", subject: "Matemática" }, { course: "6° A", subject: "Matemática" }], total_assessments: 8 },
    { user_id: "tch-3", teacher_id: "tid-3", teacher_name: "Valentina Araya", email: "vale@ejemplo.cl", courses: [{ course: "6° A", subject: "Ciencias Naturales" }], total_assessments: 2 },
    { user_id: "tch-4", teacher_id: "tid-4", teacher_name: "Felipe Morales", email: "felipe@ejemplo.cl", courses: [{ course: "8° A", subject: "Historia y Geografía" }, { course: "6° A", subject: "Lenguaje" }], total_assessments: 4 },
    { user_id: "tch-5", teacher_id: "tid-5", teacher_name: "Marcela Flores", email: "marcela@ejemplo.cl", courses: [{ course: "8° A", subject: "Lenguaje" }, { course: "8° A", subject: "Matemática" }], total_assessments: 4 },
  ],
  subjects: [
    { id: "asig-len", name: "Lenguaje", code: "LEN" },
    { id: "asig-mat", name: "Matemática", code: "MAT" },
    { id: "asig-cie", name: "Ciencias Naturales", code: "CIE" },
    { id: "asig-his", name: "Historia y Geografía", code: "HIS" },
  ],
  recentAssessments: [
    { assessment_id: "a1", title: "Evaluación 1: Comprensión Lectora 4°", assessment_type: "PROCESO", status: "ACTIVE", course_name: "4° A", subject_name: "Lenguaje", teacher_name: "Carolina Vega", attempts_count: 20, grades_count: 18, created_at: "2026-05-15T10:00:00Z", published_at: "2026-05-15T12:00:00Z" },
    { assessment_id: "a2", title: "Evaluación 1: Números y Operaciones 4°", assessment_type: "PROCESO", status: "IN_GRADING", course_name: "4° A", subject_name: "Matemática", teacher_name: "Roberto Contreras", attempts_count: 22, grades_count: 15, created_at: "2026-05-16T08:00:00Z", published_at: "2026-05-16T10:00:00Z" },
    { assessment_id: "a3", title: "Evaluación Diagnóstica Ciencias 6°", assessment_type: "DIAGNOSTICA", status: "GRADED", course_name: "6° A", subject_name: "Ciencias Naturales", teacher_name: "Valentina Araya", attempts_count: 28, grades_count: 28, created_at: "2026-04-20T09:00:00Z", published_at: "2026-04-20T11:00:00Z" },
    { assessment_id: "a4", title: "Ensayo SIMCE Matemática 4° N°1", assessment_type: "SIMCE", status: "PUBLISHED", course_name: "4° A", subject_name: "Matemática", teacher_name: "Roberto Contreras", attempts_count: 0, grades_count: 0, created_at: "2026-06-10T08:00:00Z", published_at: "2026-06-10T08:30:00Z" },
    { assessment_id: "a5", title: "Evaluación Historia 8° - Independencia", assessment_type: "CIERRE", status: "CLOSED", course_name: "8° A", subject_name: "Historia y Geografía", teacher_name: "Felipe Morales", attempts_count: 25, grades_count: 22, created_at: "2026-05-20T10:00:00Z", published_at: "2026-05-20T12:00:00Z" },
    { assessment_id: "a6", title: "Evaluación 2: Escritura Creativa 4°", assessment_type: "PARCIAL", status: "DRAFT", course_name: "4° A", subject_name: "Lenguaje", teacher_name: "Carolina Vega", attempts_count: 0, grades_count: 0, created_at: "2026-06-01T14:00:00Z", published_at: null },
    { assessment_id: "a7", title: "Ensayo SIMCE Comprensión Lectora 4° N°1", assessment_type: "SIMCE", status: "PUBLISHED", course_name: "4° A", subject_name: "Lenguaje", teacher_name: "Carolina Vega", attempts_count: 0, grades_count: 0, created_at: "2026-06-08T09:00:00Z", published_at: "2026-06-08T09:30:00Z" },
    { assessment_id: "a8", title: "Guía Evaluada: Fracciones 4°", assessment_type: "PROCESO", status: "GRADED", course_name: "4° A", subject_name: "Matemática", teacher_name: "Roberto Contreras", attempts_count: 26, grades_count: 26, created_at: "2026-04-25T08:00:00Z", published_at: "2026-04-25T09:00:00Z" },
  ],
  semaforoCursos: [
    { course_id: "curso-1a", course_name: "1° A", avg_grade: 5.2, total_grades: 88, level: "Medio" },
    { course_id: "curso-4a", course_name: "4° A", avg_grade: 4.8, total_grades: 140, level: "Medio" },
    { course_id: "curso-6a", course_name: "6° A", avg_grade: 5.5, total_grades: 120, level: "Alto" },
    { course_id: "curso-8a", course_name: "8° A", avg_grade: 4.3, total_grades: 116, level: "Medio" },
  ],
  alertas: [
    { courseName: "8° A", avgGrade: 4.3, suggestion: "Implementar plan remedial en Historia y Matemática. Promedio cercano al límite." },
    { courseName: "4° A", avgGrade: 4.8, suggestion: "Reforzar OA de lectura en Lenguaje. Hay 6 estudiantes bajo 4.0." },
  ],
};

// ─── Grade Change Requests ──────────────────────────────────────────

export const mockGradeChangeRequests = [
  { id: "gcr-01", gradeId: "g1", studentName: "Benjamín Pérez", courseName: "4° A", subjectName: "Matemática", assessmentTitle: "Evaluación 1: Números", oldGrade: 3.5, newGrade: 4.5, reason: "Error en corrección de pregunta 3. El estudiante marcó la alternativa correcta.", status: "PENDING", requestedBy: "Roberto Contreras", createdAt: "2026-05-18T14:00:00Z" },
  { id: "gcr-02", gradeId: "g2", studentName: "Isabella Soto", courseName: "6° A", subjectName: "Ciencias Naturales", assessmentTitle: "Evaluación Diagnóstica Ciencias", oldGrade: 3.8, newGrade: 5.0, reason: "Se detectó error en la pauta de corrección.", status: "PENDING", requestedBy: "Valentina Araya", createdAt: "2026-04-22T11:00:00Z" },
  { id: "gcr-03", gradeId: "g3", studentName: "Diego Rojas", courseName: "4° A", subjectName: "Lenguaje", assessmentTitle: "Evaluación 1: Comprensión Lectora", oldGrade: 4.0, newGrade: 5.5, reason: "Revisión de pregunta abierta mostró mayor profundidad en la respuesta.", status: "APPROVED", requestedBy: "Carolina Vega", reviewedBy: "Admin", reviewNotes: "Aprobado. La respuesta efectivamente refleja comprensión profunda.", createdAt: "2026-05-16T10:00:00Z" },
];

// ─── Reports ─────────────────────────────────────────────────────────

export const mockReports = [
  { id: "rep-01", type: "reporte_curso", status: "COMPLETED", format: "pdf", generatedAt: "2026-05-20T10:00:00Z", filters: { course: "4° A", subject: "Lenguaje" } },
  { id: "rep-02", type: "reporte_estudiante", status: "COMPLETED", format: "pdf", generatedAt: "2026-05-19T14:00:00Z", filters: { student: "Benjamín Pérez" } },
  { id: "rep-03", type: "reporte_oa", status: "PROCESSING", format: "xlsx", generatedAt: null, filters: { course: "6° A", subject: "Ciencias" } },
  { id: "rep-04", type: "reporte_riesgo", status: "COMPLETED", format: "pdf", generatedAt: "2026-05-15T08:00:00Z", filters: { institution: "all" } },
];

// ─── Remedial Routes ──────────────────────────────────────────────────

export const mockRemedialPlans = [
  { id: "rem-01", courseName: "4° A", subjectName: "Lenguaje", oaCode: "OA 4", oaDesc: "Leer independientemente textos literarios", habilidad: "Analizar", avgPerformance: 3.6, studentsAffected: 8, planName: "Plan remedial OA 4 - Lectura comprensiva", status: "ACTIVE", createdAt: "2026-05-18" },
  { id: "rem-02", courseName: "4° A", subjectName: "Matemática", oaCode: "OA 5", oaDesc: "Resolver problemas con 4 operaciones", habilidad: "Resolver", avgPerformance: 3.2, studentsAffected: 12, planName: "Plan remedial OA 5 - Resolución de problemas", status: "ACTIVE", createdAt: "2026-05-17" },
  { id: "rem-03", courseName: "6° A", subjectName: "Ciencias Naturales", oaCode: "OA 5", oaDesc: "Describir el rol de los microorganismos", habilidad: "Describir", avgPerformance: 3.9, studentsAffected: 5, planName: "Plan remedial OA 5 - Microorganismos", status: "PENDING", createdAt: "2026-04-25" },
  { id: "rem-04", courseName: "8° A", subjectName: "Historia y Geografía", oaCode: "OA 1", oaDesc: "Analizar proceso de independencia", habilidad: "Analizar", avgPerformance: 3.4, studentsAffected: 10, planName: "Plan remedial OA 1 - Independencia de Chile", status: "ACTIVE", createdAt: "2026-05-22" },
];

// ─── Learning Resources ──────────────────────────────────────────────

export const mockLearningResources = [
  { id: "lr-01", title: "Guía de Comprensión Lectora 4°", description: "Textos narrativos con preguntas de comprensión literal e inferencial.", type: "guia", subjectName: "Lenguaje", courseName: "4° A", gradeLevel: 4, status: "PUBLISHED", createdAt: "2026-04-10" },
  { id: "lr-02", title: "Ejercicios de Fracciones y Decimales", description: "Set de 20 ejercicios para practicar fracciones equivalentes y operaciones.", type: "ejercicios", subjectName: "Matemática", courseName: "4° A", gradeLevel: 4, status: "PUBLISHED", createdAt: "2026-04-15" },
  { id: "lr-03", title: "Presentación: Capas de la Tierra", description: "PPT interactivo con imágenes y actividades sobre estructura terrestre.", type: "presentacion", subjectName: "Ciencias Naturales", courseName: "6° A", gradeLevel: 6, status: "PUBLISHED", createdAt: "2026-04-20" },
  { id: "lr-04", title: "Ensayo SIMCE Matemática N°1 - Hoja de respuestas", description: "Hoja de respuestas imprimible para ensayo SIMCE 4° básico.", type: "material", subjectName: "Matemática", courseName: "4° A", gradeLevel: 4, status: "PUBLISHED", createdAt: "2026-06-10" },
  { id: "lr-05", title: "Rúbrica de Evaluación Escritura Creativa", description: "Rúbrica con criterios: estructura, creatividad, ortografía y vocabulario.", type: "rubrica", subjectName: "Lenguaje", courseName: "4° A", gradeLevel: 4, status: "DRAFT", createdAt: "2026-05-28" },
];

// ─── Student Grades (mock by student) ─────────────────────────────────

export const mockStudentGrades = [
  { student_id: "est-01", student_name: "Martín González", course_name: "4° A", semester1: 5.8, semester1_total: 8, semester2: null, semester2_total: 0 },
  { student_id: "est-02", student_name: "Sofía Muñoz", course_name: "4° A", semester1: 6.2, semester1_total: 8, semester2: null, semester2_total: 0 },
  { student_id: "est-03", student_name: "Diego Rojas", course_name: "4° A", semester1: 4.5, semester1_total: 8, semester2: null, semester2_total: 0 },
  { student_id: "est-04", student_name: "Valentina Díaz", course_name: "4° A", semester1: 3.8, semester1_total: 3, semester2: null, semester2_total: 0 },
  { student_id: "est-05", student_name: "Benjamín Pérez", course_name: "4° A", semester1: 3.5, semester1_total: 2, semester2: null, semester2_total: 0 },
  { student_id: "est-06", student_name: "Isabella Soto", course_name: "6° A", semester1: 5.5, semester1_total: 6, semester2: null, semester2_total: 0 },
  { student_id: "est-07", student_name: "Lucas Contreras", course_name: "6° A", semester1: 4.8, semester1_total: 6, semester2: null, semester2_total: 0 },
  { student_id: "est-08", student_name: "Emilia Martínez", course_name: "8° A", semester1: 6.0, semester1_total: 4, semester2: null, semester2_total: 0 },
];

// ─── Calculations ─────────────────────────────────────────────────────

export const mockPeriodAverages = {
  periodId: "per-1",
  periodName: "Abril - Mayo",
  courseAverages: [
    { courseId: "curso-4a", courseName: "4° A", subjectName: "Lenguaje", avgGrade: 5.2, totalStudents: 28, graded: 26 },
    { courseId: "curso-4a", courseName: "4° A", subjectName: "Matemática", avgGrade: 4.8, totalStudents: 28, graded: 24 },
  ],
};

export const mockYearSummaries: { courseId: string; courseName: string; subjectName: string; sem1Avg: number; sem2Avg: number | null; yearAvg: number; totalGrades: number }[] = [
  { courseId: "curso-4a", courseName: "4° A", subjectName: "Lenguaje", sem1Avg: 5.2, sem2Avg: null, yearAvg: 5.2, totalGrades: 112 },
  { courseId: "curso-4a", courseName: "4° A", subjectName: "Matemática", sem1Avg: 4.8, sem2Avg: null, yearAvg: 4.8, totalGrades: 96 },
  { courseId: "curso-6a", courseName: "6° A", subjectName: "Ciencias Naturales", sem1Avg: 5.5, sem2Avg: 4.8, yearAvg: 5.2, totalGrades: 28 },
];
