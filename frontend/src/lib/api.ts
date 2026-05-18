import type {
  AuthUser,
  TeacherAssignment,
  CourseStudentRow,
  CourseKpi,
  GradeRecordRow,
  StudentKpi,
  AdminOverview,
  AdminCourseRow,
  AdminSubject,
  StudentPortal,
  RoleAlerts,
  Institution,
  UserRow,
  PaginatedResponse,
  AcademicYear,
  PeriodRow,
  InstitutionConfig,
  PermissionCatalogItem,
  UserPermissionInfo,
} from "../types/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    } as HeadersInit,
    ...init,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => null);
    if (err && typeof err.message === "string") {
      throw new Error(err.message);
    }
    if (response.status >= 500) {
      throw new Error("Servidor no disponible temporalmente. Intenta de nuevo en unos segundos.");
    }
    throw new Error(`Solicitud fallida (${response.status})`);
  }

  return response.json() as Promise<T>;
}

async function requestBlob(path: string): Promise<Blob> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Descarga fallida (${response.status})`);
  }
  return response.blob();
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") search.set(k, String(v));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const api = {
  // ─── Auth ───────────────────────────────────────
  login: (payload: { email: string; password: string }) =>
    request<{ user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  me: () =>
    request<{ user: AuthUser }>("/auth/me"),
  refresh: () =>
    request<{ user: AuthUser }>("/auth/refresh", { method: "POST" }),
  logout: () =>
    request<void>("/auth/logout", { method: "POST" }).catch(() => {}),
  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    request<{ user: AuthUser }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  forgotPassword: (email: string) =>
    request<{ ok: boolean; resetToken?: string; message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email })
    }),
  resetPassword: (token: string, newPassword: string) =>
    request<{ ok: boolean; message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, newPassword })
    }),

  // ─── Institutions ───────────────────────────────
  listInstitutions: (includeInactive?: boolean) =>
    request<Institution[]>(`/institutions${buildQuery({ includeInactive })}`),
  getInstitution: (id: string) => request<Institution>(`/institutions/${id}`),
  createInstitution: (payload: {
    name: string;
    rbd?: string;
    address?: string;
    phone?: string;
    email?: string;
    logoUrl?: string;
    sede?: string;
    region?: string;
    comuna?: string;
    jornada?: string;
  }) =>
    request<Institution>("/institutions", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateInstitution: (id: string, payload: Record<string, unknown>) =>
    request<Institution>(`/institutions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteInstitution: (id: string) =>
    request<{ ok: boolean }>(`/institutions/${id}`, { method: "DELETE" }),
  getInstitutionConfig: (institutionId: string) =>
    request<InstitutionConfig>(`/institutions/${institutionId}/config`),
  updateInstitutionConfig: (institutionId: string, payload: {
    gradingScaleMin?: number;
    gradingScaleMax?: number;
    exigencia?: number;
    allowGradeEdit?: boolean;
    allowSelfRegistration?: boolean;
    defaultLanguage?: string;
  }) =>
    request<InstitutionConfig>(`/institutions/${institutionId}/config`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),

  // ─── Users ──────────────────────────────────────
  listUsers: (params?: { page?: number; limit?: number; role?: string; search?: string }) =>
    request<PaginatedResponse<UserRow>>(`/users${buildQuery(params ?? {})}`),
  getUser: (id: string) => request<UserRow>(`/users/${id}`),
  createUser: (payload: {
    firstName: string;
    lastName: string;
    email: string;
    temporaryPassword: string;
    role: string;
    institutionId?: string;
  }) =>
    request<UserRow>("/users", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateUser: (id: string, payload: Record<string, unknown>) =>
    request<UserRow>(`/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteUser: (id: string) =>
    request<{ ok: boolean }>(`/users/${id}`, { method: "DELETE" }),

  // ─── Teachers ───────────────────────────────────
  myAssignments: () => request<TeacherAssignment[]>("/teachers/my/assignments"),
  listTeachers: (search?: string) =>
    request<TeacherAssignment[]>(`/teachers${buildQuery({ search })}`),
  getTeacher: (id: string) => request<TeacherAssignment>(`/teachers/${id}`),
  createTeacher: (payload: {
    firstName: string;
    lastName: string;
    email: string;
    temporaryPassword: string;
    rut?: string;
    title?: string;
    institutionId?: string;
  }) =>
    request<{ userId: string; teacherId: string }>("/teachers", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  getTeacherAssignments: (teacherId: string) =>
    request<TeacherAssignment[]>(`/teachers/${teacherId}/assignments`),
  assignTeacher: (payload: { userId: string; courseId: string; subjectId: string }) =>
    request<{ assignmentId: string }>("/teachers/assignments", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  removeAssignment: (assignmentId: string) =>
    request<{ ok: boolean }>(`/teachers/assignments/${assignmentId}`, { method: "DELETE" }),

  // ─── Students ───────────────────────────────────
  listStudents: (params?: { page?: number; limit?: number; search?: string; courseId?: string }) =>
    request<PaginatedResponse<CourseStudentRow>>(`/students${buildQuery(params ?? {})}`),
  getStudent: (id: string) => request<CourseStudentRow>(`/students/${id}`),
  createStudent: (payload: {
    firstName: string;
    lastName: string;
    courseId: string;
    email?: string;
    temporaryPassword: string;
    rut?: string;
    gender?: string;
    birthDate?: string;
  }) =>
    request<{ studentId: string; userId?: string; email: string }>("/students", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateStudent: (id: string, payload: Record<string, unknown>) =>
    request<CourseStudentRow>(`/students/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteStudent: (id: string) =>
    request<{ ok: boolean }>(`/students/${id}`, { method: "DELETE" }),
  studentKpi: () => request<StudentKpi>("/students/me/kpi"),
  studentPortal: () => request<StudentPortal>("/students/me/portal"),
  studentGrades: (studentId: string) => request<GradeRecordRow[]>(`/students/${studentId}/grades`),

  // ─── Courses ────────────────────────────────────
  listCourses: (params?: { institutionId?: string; academicYearId?: string; gradeLevel?: number }) =>
    request<AdminCourseRow[]>(`/courses${buildQuery(params ?? {})}`),
  getCourse: (id: string) => request<AdminCourseRow & { students: CourseStudentRow[]; teachers: TeacherAssignment[] }>(`/courses/${id}`),
  getCourseStudents: (courseId: string) => request<CourseStudentRow[]>(`/courses/${courseId}/students`),
  createCourse: (payload: { institutionId: string; academicYearId: string; name: string; gradeLevel: number; section?: string; maxStudents?: number }) =>
    request<AdminCourseRow>("/courses", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  courseKpi: (courseId: string) => request<CourseKpi>(`/courses/${courseId}/kpi`),
  updateCourse: (id: string, payload: Record<string, unknown>) =>
    request<AdminCourseRow>(`/courses/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteCourse: (id: string) =>
    request<{ ok: boolean }>(`/courses/${id}`, { method: "DELETE" }),

  // ─── Subjects ───────────────────────────────────
  listSubjects: (includeInactive?: boolean) =>
    request<AdminSubject[]>(`/subjects${buildQuery({ includeInactive })}`),
  createSubject: (payload: { name: string; code?: string }) =>
    request<AdminSubject>("/subjects", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateSubject: (id: string, payload: Record<string, unknown>) =>
    request<AdminSubject>(`/subjects/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteSubject: (id: string) =>
    request<{ ok: boolean }>(`/subjects/${id}`, { method: "DELETE" }),

  // ─── Academic Years ────────────────────────────
  listAcademicYears: (institutionId: string) =>
    request<AcademicYear[]>(`/academic-years/institution/${institutionId}`),
  getAcademicYear: (id: string) => request<AcademicYear>(`/academic-years/${id}`),
  createAcademicYear: (payload: { institutionId: string; year: number; startDate: string; endDate: string }) =>
    request<AcademicYear>("/academic-years", { method: "POST", body: JSON.stringify(payload) }),
  updateAcademicYear: (id: string, payload: Record<string, unknown>) =>
    request<AcademicYear>(`/academic-years/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  closeAcademicYear: (id: string) =>
    request<AcademicYear>(`/academic-years/${id}/close`, { method: "POST" }),
  reopenAcademicYear: (id: string) =>
    request<AcademicYear>(`/academic-years/${id}/reopen`, { method: "POST" }),

  // ─── Periods ────────────────────────────────────
  listPeriods: (academicYearId: string) =>
    request<PeriodRow[]>(`/periods/academic-year/${academicYearId}`),
  getPeriod: (id: string) => request<PeriodRow>(`/periods/${id}`),
  createPeriod: (payload: {
    academicYearId: string;
    name: string;
    type?: string;
    startDate: string;
    endDate: string;
    weight?: number;
  }) =>
    request<PeriodRow>("/periods", { method: "POST", body: JSON.stringify(payload) }),
  updatePeriod: (id: string, payload: Record<string, unknown>) =>
    request<PeriodRow>(`/periods/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  closePeriod: (id: string) =>
    request<PeriodRow>(`/periods/${id}/close`, { method: "POST" }),
  reopenPeriod: (id: string) =>
    request<PeriodRow>(`/periods/${id}/reopen`, { method: "POST" }),
  createAssessment: (payload: unknown) =>
    request<{ assessmentId: string; count: number }>("/assessments", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  listAssessments: (params?: Record<string, string | number | boolean | undefined>) =>
    request<unknown[]>(`/assessments${buildQuery(params ?? {})}`),
  getAssessment: (id: string) =>
    request<{ id: string; title: string; assessmentType: string; status: string; courseId: string; subjectId: string; semester: number; maxScore: number; questions: { questionId: string; points: number; question: { id: string; statement: string; type: string } }[] }>(`/assessments/${id}`),
  getAssessmentAttempts: (assessmentId: string) =>
    request<{ id: string; studentId: string; student: { firstName: string; lastName: string }; status: string; totalScore: number | null; percentage: number | null; answers: { questionId: string; question: { statement: string; type: string }; textAnswer: string | null; selectedOptionId: string | null; score: number | null; status: string; isCorrect: boolean | null }[] }[]>(`/assessments/${assessmentId}/attempts`),

  // ─── Enrollments ────────────────────────────────
  enrollStudent: (payload: { studentId: string; courseId: string }) =>
    request<{ enrollmentId: string }>("/enrollments", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  withdrawStudent: (enrollmentId: string) =>
    request<{ ok: boolean }>(`/enrollments/${enrollmentId}/withdraw`, { method: "PATCH" }),
  transferStudent: (enrollmentId: string, newCourseId: string) =>
    request<{ ok: boolean }>(`/enrollments/${enrollmentId}/transfer`, {
      method: "POST",
      body: JSON.stringify({ newCourseId })
    }),

  // ─── Grading ────────────────────────────────────
  updateGrade: (gradeId: string, payload: { grade: number; comments?: string }) =>
    request<{ ok: boolean }>(`/grading/grades/${gradeId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  getGradingSummary: (assessmentId: string) =>
    request<{ assessmentId: string; title: string; totalQuestions: number; totalAttempts: number; answersByStatus: Record<string, number>; grades: { studentId: string; studentName: string; score: number | null; percentage: number | null; grade: number }[] }>(`/grading/summary/${assessmentId}`),
  getPendingGrading: (assessmentId: string) =>
    request<{ assessmentId: string; totalPending: number; byStudent: { studentName: string; pendingCount: number; answers: { id: string; question: { id: string; type: string; statement: string; points: number }; textAnswer: string | null; selectedOptionId: string | null; status: string }[] }[] }>(`/grading/pending/${assessmentId}`),

  // ─── Alerts ─────────────────────────────────────
  myAlerts: () => request<RoleAlerts>("/alerts/teacher"),
  institutionalAlerts: (institutionId: string) =>
    request<RoleAlerts>(`/alerts/institutional/${institutionId}`),

  // ─── Reports ────────────────────────────────────
  generateReport: (payload: { type: string; studentId?: string; courseId?: string; subjectId?: string; institutionId?: string }) =>
    request<{ reportId: string }>("/reports/generate", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  listReports: (params?: Record<string, string | number | boolean | undefined>) =>
    request<PaginatedResponse<{ id: string; type: string; status: string; format: string; generatedAt: string | null }>>(`/reports${buildQuery(params ?? {})}`),
  getReport: (id: string) =>
    request<{ id: string; type: string; status: string; data: unknown; filters: unknown; generatedAt: string | null }>(`/reports/${id}`),

  // ─── Dashboard ──────────────────────────────────
  adminOverview: (institutionId?: string) =>
    request<AdminOverview>(`/admin/overview${buildQuery({ institutionId })}`),

  // ─── Downloads ──────────────────────────────────
  adminDownloadPdf: (kind: "reporte" | "material" | "simce") =>
    requestBlob(`/admin/downloads/${kind}.pdf`),

  // ─── Imports ────────────────────────────────────
  uploadImport: (entityType: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return fetch(`${API_BASE}/imports/upload/${entityType}`, {
      method: "POST",
      credentials: "include",
      body: formData,
    }).then((r) => {
      if (!r.ok) throw new Error(`Fallo al subir archivo (${r.status})`);
      return r.json();
    });
  },

  // ─── Exports ────────────────────────────────────
  requestExport: (payload: { entityType: string; format: string; courseId?: string; institutionId?: string; academicYearId?: string; subjectId?: string }) =>
    request<{ exportJobId: string }>("/exports", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  // ─── Audit ───────────────────────────────────────
  listAuditLogs: (params?: Record<string, string | number | boolean | undefined>) =>
    request<PaginatedResponse<unknown>>(`/audit-logs${buildQuery(params ?? {})}`),
  auditSummary: (days?: number) =>
    request<unknown>(`/audit-logs/summary${buildQuery({ days })}`),

  // ─── Curriculum ──────────────────────────────────
  listSubjectsForCurriculum: (includeInactive?: boolean) =>
    request<AdminSubject[]>(`/subjects${buildQuery({ includeInactive })}`),
  // Axes
  listAxes: (subjectId: string) =>
    request<{ id: string; name: string; description: string | null; sortOrder: number }[]>(`/axes/${subjectId}`),
  createAxis: (payload: { subjectId: string; name: string; description?: string; sortOrder?: number }) =>
    request<{ id: string }>("/axes", { method: "POST", body: JSON.stringify(payload) }),
  updateAxis: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/axes/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteAxis: (id: string) =>
    request<{ ok: boolean }>(`/axes/${id}`, { method: "DELETE" }),
  // Learning Objectives
  listLearningObjectives: (params?: { subjectId?: string; gradeLevel?: number; axisId?: string }) =>
    request<{ id: string; code: string; description: string; gradeLevel: number; subjectId: string; axisId: string | null; isActive: boolean }[]>(`/learning-objectives${buildQuery(params ?? {})}`),
  createLearningObjective: (payload: { subjectId: string; code: string; description: string; gradeLevel: number; axisId?: string; skillIds?: string[]; indicators?: string[] }) =>
    request<{ id: string }>("/learning-objectives", { method: "POST", body: JSON.stringify(payload) }),
  updateLearningObjective: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/learning-objectives/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteLearningObjective: (id: string) =>
    request<{ ok: boolean }>(`/learning-objectives/${id}`, { method: "DELETE" }),
  // Skills
  listSkills: () =>
    request<{ id: string; name: string; description: string | null }[]>("/skills"),
  createSkill: (payload: { name: string; description?: string }) =>
    request<{ id: string }>("/skills", { method: "POST", body: JSON.stringify(payload) }),
  updateSkill: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/skills/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteSkill: (id: string) =>
    request<{ ok: boolean }>(`/skills/${id}`, { method: "DELETE" }),
  // Units
  listUnits: (subjectId: string, gradeLevel?: number) =>
    request<{ id: string; name: string; gradeLevel: number }[]>(`/curriculum-units?subjectId=${subjectId}${gradeLevel ? `&gradeLevel=${gradeLevel}` : ""}`),

  // ─── Question Bank ────────────────────────────────
  listQuestions: (params?: { subjectId?: string; type?: string; learningObjectiveId?: string; isActive?: boolean; page?: number; limit?: number }) =>
    request<PaginatedResponse<{ id: string; statement: string; type: string; difficulty: number; points: number; isActive: boolean; subjectId: string; learningObjectiveId: string | null; axisId: string | null; skillId: string | null; explanation: string | null; options: { id: string; text: string; isCorrect: boolean; sortOrder: number }[] }>>(`/questions${buildQuery(params ?? {})}`),
  getQuestion: (id: string) =>
    request<{ id: string; statement: string; type: string; difficulty: number; points: number }>(`/questions/${id}`),
  createQuestion: (payload: { subjectId: string; type: string; statement: string; difficulty?: number; points?: number; learningObjectiveId?: string; axisId?: string; skillId?: string; explanation?: string; options: { text: string; isCorrect: boolean; sortOrder?: number }[] }) =>
    request<{ id: string }>("/questions", { method: "POST", body: JSON.stringify(payload) }),
  updateQuestion: (id: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/questions/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteQuestion: (id: string) =>
    request<{ ok: boolean }>(`/questions/${id}`, { method: "DELETE" }),
  addQuestionOption: (questionId: string, payload: { text: string; isCorrect: boolean; sortOrder?: number }) =>
    request<{ id: string }>(`/questions/${questionId}/options`, { method: "POST", body: JSON.stringify(payload) }),
  updateQuestionOption: (questionId: string, optionId: string, payload: { text?: string; isCorrect?: boolean }) =>
    request<{ id: string }>(`/questions/${questionId}/options/${optionId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteQuestionOption: (questionId: string, optionId: string) =>
    request<{ ok: boolean }>(`/questions/${questionId}/options/${optionId}`, { method: "DELETE" }),
  getOaCoverage: (subjectId: string) =>
    request<{ learningObjectiveId: string; code: string; description: string; questionCount: number }[]>(`/questions/oa-coverage?subjectId=${subjectId}`),

  // ─── Grade Change Requests ──────────────────────
  listGradeChangeRequests: (params?: { status?: string; studentId?: string; courseId?: string }) =>
    request<unknown[]>(`/grade-change-requests${buildQuery(params ?? {})}`),
  getGradeChangeRequest: (id: string) => request<unknown>(`/grade-change-requests/${id}`),
  createGradeChangeRequest: (payload: { gradeId: string; newGrade: number; reason: string }) =>
    request<unknown>("/grade-change-requests", { method: "POST", body: JSON.stringify(payload) }),
  approveGradeChangeRequest: (id: string, reviewNotes?: string) =>
    request<unknown>(`/grade-change-requests/${id}/approve`, { method: "PATCH", body: JSON.stringify({ status: "APPROVED", reviewNotes }) }),
  rejectGradeChangeRequest: (id: string, reviewNotes?: string) =>
    request<unknown>(`/grade-change-requests/${id}/reject`, { method: "PATCH", body: JSON.stringify({ status: "REJECTED", reviewNotes }) }),

  // ─── Learning Resources ─────────────────────────
  listLearningResources: (params?: { institutionId?: string; type?: string; subjectId?: string; courseId?: string }) =>
    request<unknown[]>(`/learning-resources${buildQuery(params ?? {})}`),
  getLearningResource: (id: string) => request<unknown>(`/learning-resources/${id}`),
  createLearningResource: (payload: { institutionId: string; title: string; description?: string; type: string; subjectId?: string; courseId?: string; gradeLevel?: number }) =>
    request<unknown>("/learning-resources", { method: "POST", body: JSON.stringify(payload) }),
  updateLearningResource: (id: string, payload: Record<string, unknown>) =>
    request<unknown>(`/learning-resources/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  publishLearningResource: (id: string) =>
    request<unknown>(`/learning-resources/${id}/publish`, { method: "POST" }),

  // ─── Calculations ────────────────────────────────
  setPeriodWeights: (payload: { periodWeights: { periodId: string; weight: number }[]; courseId: string; subjectId: string }) =>
    request<unknown>("/calculations/weights", { method: "POST", body: JSON.stringify(payload) }),
  getPeriodAverages: (params: { courseId: string; subjectId: string; periodId?: string }) =>
    request<unknown>(`/calculations/period-averages${buildQuery(params ?? {})}`),
  getYearAverage: (params: { studentId: string; courseId: string; subjectId: string }) =>
    request<unknown>(`/calculations/year-average${buildQuery(params ?? {})}`),
  getStudentYearSummary: (params: { studentId: string; courseId: string }) =>
    request<unknown>(`/calculations/student-year-summary${buildQuery(params ?? {})}`),

  // ─── Permissions ──────────────────────────────────
  getPermissionsCatalog: () =>
    request<PermissionCatalogItem[]>("/permissions/catalog"),
  getUserPermissions: (userId: string) =>
    request<UserPermissionInfo>(`/permissions/user/${userId}`),
  getMyPermissions: () =>
    request<UserPermissionInfo>("/permissions/me"),
  assignPermissions: (payload: { userId: string; permissionActions: string[] }) =>
    request<{ action: string; status: string }[]>("/permissions/assign", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  revokePermission: (payload: { userId: string; permissionAction: string }) =>
    request<{ ok: boolean; action: string }>("/permissions/revoke", {
      method: "DELETE",
      body: JSON.stringify(payload)
    }),
  seedPermissions: () =>
    request<{ total: number }>("/permissions/seed", { method: "POST" }),
};
