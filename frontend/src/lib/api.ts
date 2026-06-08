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

type AuthResponse = {
  token?: string;
  refreshToken?: string;
  user: AuthUser;
};

const ACCESS_TOKEN_KEY = "cordillera_access_token";
const REFRESH_TOKEN_KEY = "cordillera_refresh_token";

function readStoredToken(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

let _accessToken: string | null = readStoredToken(ACCESS_TOKEN_KEY);
let _refreshToken: string | null = readStoredToken(REFRESH_TOKEN_KEY);

function persistToken(key: string, value: string | null) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // Storage can be unavailable in private contexts; in-memory tokens still work.
  }
}

export function setAuthTokens(tokens: { token?: string; refreshToken?: string }) {
  if (tokens.token) {
    _accessToken = tokens.token;
    persistToken(ACCESS_TOKEN_KEY, tokens.token);
  }
  if (tokens.refreshToken) {
    _refreshToken = tokens.refreshToken;
    persistToken(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }
}

export function clearAuthTokens() {
  _accessToken = null;
  _refreshToken = null;
  persistToken(ACCESS_TOKEN_KEY, null);
  persistToken(REFRESH_TOKEN_KEY, null);
}

function normalizeApiBase(value?: string): string {
  const raw = value?.trim();
  if (!raw) {
    return import.meta.env.PROD ? "https://cordillera-backend.onrender.com/api/v1" : "/api/v1";
  }

  const withoutTrailingSlash = raw.replace(/\/+$/, "");
  try {
    const url = new URL(withoutTrailingSlash);
    if (!url.pathname || url.pathname === "/") {
      url.pathname = "/api/v1";
      return url.toString().replace(/\/+$/, "");
    }
  } catch {
    // Relative bases like /api/v1 are valid for local/proxied deployments.
  }

  return withoutTrailingSlash;
}

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE_URL);

let _refreshPromise: Promise<boolean> | null = null;
let _onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: () => void) {
  _onSessionExpired = handler;
}

async function refreshSession(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      const headers = new Headers();
      let body: string | undefined;
      if (_refreshToken) {
        headers.set("Content-Type", "application/json");
        body = JSON.stringify({ refreshToken: _refreshToken });
      }
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers,
        body,
      });
      if (response.ok) {
        const result = (await response.json().catch(() => null)) as AuthResponse | null;
        if (result) setAuthTokens(result);
      }
      return response.ok;
    } catch {
      return false;
    }
  })();

  const result = await _refreshPromise;
  _refreshPromise = null;
  return result;
}

const NO_REFRESH_PATHS = ["/auth/login", "/auth/refresh"];

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (_accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${_accessToken}`);
  }

  const fetchOptions: RequestInit = {
    credentials: "include",
    ...init,
    headers,
  };

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch {
    throw new Error("No se pudo conectar con el servidor. Revisa que el backend este activo y que VITE_API_BASE_URL apunte a la URL correcta.");
  }

  if (response.status === 401 && !NO_REFRESH_PATHS.includes(path)) {
    const refreshed = await refreshSession();
    if (refreshed) {
      if (_accessToken) headers.set("Authorization", `Bearer ${_accessToken}`);
      try {
        response = await fetch(url, fetchOptions);
      } catch {
        throw new Error("No se pudo conectar con el servidor. Revisa que el backend este activo y que VITE_API_BASE_URL apunte a la URL correcta.");
      }
    } else {
      if (_onSessionExpired) _onSessionExpired();
      throw new Error("Sesion expirada. Por favor inicia sesion nuevamente.");
    }
  }

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

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return undefined as T;
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
  login: async (payload: { email: string; password: string }) => {
    const result = await request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setAuthTokens(result);
    return result;
  },
  me: () =>
    request<{ user: AuthUser }>("/auth/me"),
  updateMyProfile: async (payload: { firstName: string; lastName: string }) => {
    const result = await request<AuthResponse>("/auth/me", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    setAuthTokens(result);
    return result;
  },
  refresh: () =>
    request<AuthResponse>("/auth/refresh", {
      method: "POST",
      body: _refreshToken ? JSON.stringify({ refreshToken: _refreshToken }) : undefined,
    }).then((result) => {
      setAuthTokens(result);
      return result;
    }),
  logout: async () => {
    try {
      await request<void>("/auth/logout", { method: "POST" });
    } catch {
      // Logout must clear local state even if the server cookie is already gone.
    } finally {
      clearAuthTokens();
    }
  },
  changePassword: async (payload: { currentPassword: string; newPassword: string }) => {
    const result = await request<AuthResponse>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setAuthTokens(result);
    return result;
  },
  forgotPassword: (email: string) =>
    request<{ ok: boolean; message: string }>("/auth/forgot-password", {
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
  deleteInstitutionPermanent: (id: string) =>
    request<{ ok: boolean; id: string }>(`/institutions/${id}/permanent`, { method: "DELETE" }),
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
  listUsers: (params?: { page?: number; limit?: number; role?: string; search?: string; institutionId?: string }) =>
    request<PaginatedResponse<UserRow>>(`/users${buildQuery(params ?? {})}`),
  getUser: (id: string) => request<UserRow>(`/users/${id}`),
  createUser: (payload: {
    firstName: string;
    lastName: string;
    email: string;
    temporaryPassword: string;
    role: string;
    institutionId?: string;
    courseId?: string;
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
  listTeachers: (search?: string, params?: { institutionId?: string; includeInactive?: boolean }) =>
    request<TeacherAssignment[]>(`/teachers${buildQuery({ search, ...(params ?? {}) })}`),
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
  updateTeacher: (id: string, payload: Record<string, unknown>) =>
    request<TeacherAssignment>(`/teachers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  retireTeacher: (id: string, removeAssignments = false) =>
    request<TeacherAssignment>(`/teachers/${id}/retire`, {
      method: "POST",
      body: JSON.stringify({ removeAssignments })
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
  listStudents: (params?: { page?: number; limit?: number; search?: string; courseId?: string; includeInactive?: boolean }) =>
    request<PaginatedResponse<CourseStudentRow>>(`/students${buildQuery(params ?? {})}`),
  getStudent: (id: string) => request<CourseStudentRow>(`/students/${id}`),
  createStudent: (payload: {
    firstName: string;
    lastName: string;
    courseId: string;
    email?: string;
    temporaryPassword?: string;
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
  restoreStudent: (id: string) =>
    request<CourseStudentRow>(`/students/${id}/restore`, { method: "POST" }),
  studentKpi: () => request<StudentKpi>("/students/me/kpi"),
  studentPortal: () => request<StudentPortal>("/students/me/portal"),
  // ─── Courses ────────────────────────────────────
  listCourses: (params?: { institutionId?: string; academicYearId?: string; gradeLevel?: number; includeInactive?: boolean }) =>
    request<AdminCourseRow[]>(`/courses${buildQuery(params ?? {})}`),
  getCourse: (id: string) => request<AdminCourseRow & { students: CourseStudentRow[]; teachers: TeacherAssignment[] }>(`/courses/${id}`),
  getCourseStudents: (courseId: string) => request<CourseStudentRow[]>(`/courses/${courseId}/students`),
  createCourse: (payload: { institutionId: string; academicYearId: string; name: string; gradeLevel: number; section?: string; maxStudents?: number }) =>
    request<AdminCourseRow>("/courses", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateCourse: (id: string, payload: Record<string, unknown>) =>
    request<AdminCourseRow>(`/courses/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteCoursePermanent: (id: string) =>
    request<{ ok: boolean; id: string }>(`/courses/${id}/permanent`, { method: "DELETE" }),

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
  deleteSubjectPermanent: (id: string) =>
    request<{ ok: boolean; id: string }>(`/subjects/${id}/permanent`, { method: "DELETE" }),

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
    request<{ id: string; assessmentId?: string; count?: number }>("/assessments", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  listAssessments: (params?: Record<string, string | number | boolean | undefined>) =>
    request<{ data: unknown[] }>(`/assessments${buildQuery(params ?? {})}`).then((r) => r.data),
  getAssessment: (id: string) =>
    request<{ id: string; title: string; assessmentType: string; status: string; courseId: string; subjectId: string; semester: number; maxScore: number; questions: { questionId: string; points: number; question: { id: string; statement: string; type: string } }[] }>(`/assessments/${id}`),
  getAssessmentAttempts: (assessmentId: string) =>
    request<{ id: string; studentId: string; student: { firstName: string; lastName: string }; status: string; totalScore: number | null; percentage: number | null; answers: { questionId: string; question: { statement: string; type: string }; textAnswer: string | null; selectedOptionId: string | null; score: number | null; status: string; isCorrect: boolean | null }[] }[]>(`/attempts/assessment/${assessmentId}`),

  // ─── Enrollments ────────────────────────────────
  closeAssessment: (id: string) =>
    request<unknown>(`/assessments/${id}/close`, { method: "POST" }),
  activateAssessment: (id: string) =>
    request<unknown>(`/assessments/${id}/activate`, { method: "POST" }),
  startAssessmentGrading: (id: string) =>
    request<unknown>(`/assessments/${id}/start-grading`, { method: "POST" }),
  markAssessmentGraded: (id: string) =>
    request<unknown>(`/assessments/${id}/mark-graded`, { method: "POST" }),
  markAssessmentReported: (id: string) =>
    request<unknown>(`/assessments/${id}/mark-reported`, { method: "POST" }),

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
  updateGrade: (gradeId: string, payload: { grade: number; comments?: string; reason?: string }) =>
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
  generateReport: (payload: {
    type: string;
    studentId?: string;
    courseId?: string;
    subjectId?: string;
    institutionId?: string;
    academicYearId?: string;
    learningObjectiveId?: string;
    threshold?: number;
    format?: string;
  }) =>
    request<{ reportId: string; type?: string }>("/reports/generate", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  listReports: (params?: Record<string, string | number | boolean | undefined>) =>
    request<{ data: unknown[] }>(`/reports${buildQuery(params ?? {})}`).then((r) => r.data),
  getReport: (id: string) =>
    request<{ id: string; type: string; status: string; data: unknown; filters: unknown; generatedAt: string | null }>(`/reports/${id}`),

  // ─── Dashboard ──────────────────────────────────
  adminOverview: (institutionId?: string) =>
    request<AdminOverview>(`/admin/overview${buildQuery({ institutionId })}`),

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
    request<{ id: string; name: string; description: string | null; sortOrder: number }[]>(`/axes/subject/${subjectId}`),
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
    request<{ id: string; name: string; gradeLevel: number }[]>(`/curriculum-units/subject/${subjectId}${gradeLevel ? `?gradeLevel=${gradeLevel}` : ""}`),

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
    request<{ id: string }>(`/questions/options/${optionId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteQuestionOption: (questionId: string, optionId: string) =>
    request<{ ok: boolean }>(`/questions/options/${optionId}`, { method: "DELETE" }),
  getOaCoverage: (subjectId: string, gradeLevel: number) =>
    request<{ learningObjectiveId: string; code: string; description: string; questionCount: number }[]>(`/questions/oa-coverage?subjectId=${subjectId}&gradeLevel=${gradeLevel}`),

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

  // ─── Course Grade Book ────────────────────────────
  getCourseGradeBook: (courseId: string, params?: { subjectId?: string }) =>
    request<{
      course: { id: string; name: string; gradeLevel: number };
      subjectId: string | null;
      assessments: { id: string; title: string; type: string; status: string; weight: number; maxScore: number; semester: number; subjectName: string; oaCode: string | null; oaDescription: string | null }[];
      students: { studentId: string; firstName: string; lastName: string; rut: string; grades: { gradeId: string; assessmentId: string; assessmentTitle: string; assessmentType: string; semester: number; subjectName: string; weight: number; maxScore: number; score: number | null; percentage: number | null; grade: number | null; status: string; oaCode: string | null; oaDescription: string | null }[]; average: number; atRisk: boolean; hasPending: boolean }[];
      stats: { courseAvg: number; approvalRate: number; approvedCount: number; atRiskCount: number; pendingsCount: number; totalNotes: number; totalStudents: number; totalAssessments: number; simceCount: number; appliedCount: number };
      oaDescendidos: { code: string; description: string; average: number; count: number }[];
    }>(`/grading/course-book/${courseId}${buildQuery(params ?? {})}`),

  createDirectGrade: (payload: { assessmentId: string; studentId: string; grade: number; comments?: string; reason?: string }) =>
    request<{ ok: boolean; gradeId: string; grade: number }>("/grading/direct-grade", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  bulkDirectGrades: (payload: { grades: { assessmentId: string; studentId: string; grade: number; comments?: string }[] }) =>
    request<{ total: number; succeeded: number; failed: number; results: { ok: boolean; gradeId: string; assessmentId: string; studentId: string; error?: string }[] }>("/grading/direct-grades/bulk", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // ─── Remedial Plans ────────────────────────────────
  listRemedialPlans: (params?: { courseId?: string; status?: string }) =>
    request<unknown[]>(`/remedial-plans${buildQuery(params ?? {})}`),

  // ─── Learning Resources ─────────────────────────
  listLearningResources: (params?: { institutionId?: string; type?: string; subjectId?: string; courseId?: string }) =>
    request<{ data: unknown[] }>(`/resources${buildQuery(params ?? {})}`).then((r) => r.data),
  getLearningResource: (id: string) => request<unknown>(`/resources/${id}`),
  createLearningResource: (payload: {
    institutionId: string;
    title: string;
    description?: string;
    type: string;
    subjectId?: string;
    courseId?: string;
    gradeLevel?: number;
    guideType?: string;
    presentationType?: string;
  }) =>
    request<unknown>("/resources", { method: "POST", body: JSON.stringify(payload) }),
  updateLearningResource: (id: string, payload: Record<string, unknown>) =>
    request<unknown>(`/resources/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  publishLearningResource: (id: string) =>
    request<unknown>(`/resources/${id}/publish`, { method: "POST" }),
  archiveLearningResource: (id: string) =>
    request<unknown>(`/resources/${id}/archive`, { method: "POST" }),
  uploadFile: (entityType: string, entityId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return fetch(`${API_BASE}/files/upload${buildQuery({ entityType, entityId })}`, {
      method: "POST",
      credentials: "include",
      body: formData,
    }).then(async (r) => {
      if (!r.ok) {
        const err = await r.json().catch(() => null);
        throw new Error(typeof err?.message === "string" ? err.message : `Fallo al subir archivo (${r.status})`);
      }
      return r.json() as Promise<{ fileId: string; fileName: string; url: string; size: number }>;
    });
  },
  listEntityFiles: (entityType: string, entityId: string) =>
    request<{ id: string; fileName: string; originalName: string; mimeType: string; size: number; url: string | null; createdAt: string }[]>(
      `/files/entity/${entityType}/${entityId}`,
    ),
  deleteFile: (fileId: string) =>
    request<void>(`/files/${fileId}`, { method: "DELETE" }),

  // ─── Lessons ───────────────────────────────────────
  listLessons: (params?: Record<string, string | number | boolean | undefined>) =>
    request<{ data: unknown[] }>(`/lessons${buildQuery(params ?? {})}`).then((r) => r.data),

  // ─── Calculations ────────────────────────────────
  setPeriodWeights: (payload: { periodWeights: { periodId: string; weight: number }[]; courseId: string; subjectId: string }) =>
    request<unknown>("/calculations/weights", { method: "POST", body: JSON.stringify(payload) }),
  getPeriodAverages: (periodId: string, params?: { courseId?: string; subjectId?: string }) =>
    request<unknown>(`/calculations/period/${periodId}${buildQuery(params ?? {})}`),
  getYearAverage: (academicYearId: string, params?: { courseId?: string; subjectId?: string }) =>
    request<unknown>(`/calculations/year/${academicYearId}${buildQuery(params ?? {})}`),
  getStudentYearSummary: (studentId: string, academicYearId: string) =>
    request<unknown>(`/calculations/student/${studentId}/year/${academicYearId}`),

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

  // ─── Attendance ────────────────────────────────────
  createAttendance: (payload: { studentId: string; courseId: string; date: string; status?: string }) =>
    request<unknown>("/attendance", { method: "POST", body: JSON.stringify(payload) }),
  bulkAttendance: (payload: { courseId: string; date: string; items: { studentId: string; status: string }[] }) =>
    request<{ total: number; succeeded: number; failed: number }>("/attendance/bulk", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listAttendance: (params?: { courseId?: string; date?: string; from?: string; to?: string }) =>
    request<unknown[]>(`/attendance${buildQuery(params ?? {})}`),
  getStudentAttendance: (studentId: string, params?: { courseId?: string }) =>
    request<unknown[]>(`/attendance/student/${studentId}${buildQuery(params ?? {})}`),
  getAttendanceStats: (studentId: string) =>
    request<{ studentId: string; total: number; present: number; absent: number; late: number; justified: number; excused: number; attendanceRate: number; absenceRate: number; atRisk: boolean }>(`/attendance/stats/${studentId}`),
  updateAttendance: (id: string, status: string) =>
    request<unknown>(`/attendance/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),

  // ─── Observations ────────────────────────────────
  createObservation: (payload: { studentId: string; courseId: string; type?: string; title: string; content: string }) =>
    request<unknown>("/observations", { method: "POST", body: JSON.stringify(payload) }),
  listObservations: (params?: { studentId?: string; courseId?: string; type?: string }) =>
    request<unknown[]>(`/observations${buildQuery(params ?? {})}`),
  getObservation: (id: string) =>
    request<unknown>(`/observations/${id}`),
  updateObservation: (id: string, payload: Record<string, unknown>) =>
    request<unknown>(`/observations/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteObservation: (id: string) =>
    request<{ ok: boolean }>(`/observations/${id}`, { method: "DELETE" }),

  // ─── Class Book ───────────────────────────────────
  createClassBookEntry: (payload: {
    courseId: string; subjectId: string; date: string; semester?: number;
    classNumber?: number; unitName?: string; topic?: string;
    content?: string; activities?: string; resources?: string; notes?: string;
  }) =>
    request<unknown>("/class-book", { method: "POST", body: JSON.stringify(payload) }),
  listClassBookEntries: (params?: { courseId?: string; subjectId?: string; date?: string; from?: string; to?: string }) =>
    request<unknown[]>(`/class-book${buildQuery(params ?? {})}`),
  getClassBookEntry: (id: string) =>
    request<unknown>(`/class-book/${id}`),
  updateClassBookEntry: (id: string, payload: Record<string, unknown>) =>
    request<unknown>(`/class-book/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteClassBookEntry: (id: string) =>
    request<{ ok: boolean }>(`/class-book/${id}`, { method: "DELETE" }),

  // ─── Notifications ─────────────────────────────────
  getNotifications: (params?: { status?: string; limit?: number; offset?: number }) =>
    request<{ notifications: { id: string; type: string; title: string; message: string; status: string; metadata: Record<string, unknown> | null; createdAt: string; readAt: string | null }[]; total: number }>(`/notifications${buildQuery(params ?? {})}`),
  getUnreadNotificationCount: () =>
    request<number>("/notifications/unread-count"),
  markNotificationRead: (id: string) =>
    request<{ ok: boolean }>(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllNotificationsRead: () =>
    request<{ marked: number }>("/notifications/read-all", { method: "PATCH" }),

  // ─── SIMCE ────────────────────────────────────────────

  listSimceAssessments: (params?: { courseId?: string; subjectId?: string; status?: string; academicYearId?: string; page?: number; limit?: number }) =>
    request<{ data: unknown[]; meta: { total: number; page: number; limit: number; totalPages: number; hasNext: boolean; hasPrevious: boolean } }>(`/simce${buildQuery(params ?? {})}`),
  getSimceAssessment: (id: string) => request<unknown>(`/simce/${id}`),
  createSimceAssessment: (payload: { title: string; courseId: string; subjectId: string; gradeLevel: number; academicYearId?: string; date?: string; description?: string }) =>
    request<unknown>("/simce", { method: "POST", body: JSON.stringify(payload) }),
  updateSimceAssessment: (id: string, payload: { title?: string; description?: string; date?: string; pdfFileId?: string; academicYearId?: string; status?: string }) =>
    request<unknown>(`/simce/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteSimceAssessment: (id: string) =>
    request<{ ok: boolean }>(`/simce/${id}`, { method: "DELETE" }),

  getSimceAnswerKey: (id: string) => request<unknown>(`/simce/${id}/answer-key`),
  saveSimceAnswerKey: (id: string, payload: { items: { questionNumber: number; correctOption: string; score?: number; axisId?: string; skillId?: string; oaId?: string; observation?: string }[] }) =>
    request<unknown>(`/simce/${id}/answer-key`, { method: "POST", body: JSON.stringify(payload) }),
  confirmSimceAnswerKey: (id: string) =>
    request<unknown>(`/simce/${id}/answer-key/confirm`, { method: "POST" }),

  saveSimceStudentResponses: (assessmentId: string, studentId: string, payload: { responses: { questionNumber: number; selectedOption?: string }[] }) =>
    request<unknown>(`/simce/${assessmentId}/responses/${studentId}`, { method: "POST", body: JSON.stringify(payload) }),
  batchSaveSimceResponses: (assessmentId: string, payload: { studentId: string; responses: { questionNumber: number; selectedOption?: string }[] }[]) =>
    request<unknown>(`/simce/${assessmentId}/responses/batch`, { method: "POST", body: JSON.stringify(payload) }),

  autoCorrectSimce: (id: string) =>
    request<unknown>(`/simce/${id}/auto-correct`, { method: "POST" }),

  getSimceResults: (id: string) => request<unknown>(`/simce/${id}/results`),
  getSimceStudentResult: (assessmentId: string, studentId: string) => request<unknown>(`/simce/${assessmentId}/results/${studentId}`),

  getSimceGroupReview: (id: string) => request<unknown>(`/simce/${id}/review`),
  getSimceQuestionStats: (assessmentId: string, questionNumber: number) => request<unknown>(`/simce/${assessmentId}/review/${questionNumber}`),

  getStudentSimceResults: () => request<unknown[]>("/simce/student/results"),
  getStudentSimceDetail: (assessmentId: string) => request<unknown>(`/simce/student/results/${assessmentId}`),
  getStudentSimceEssays: () => request<unknown[]>("/simce/student/essays"),
};
