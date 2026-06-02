export {
  type AssessmentStatus,
  type AssessmentType,
  type QuestionType,
  type PeriodStatus,
  type RemedialStatus,
  type AlertLevel,
  type AuthUser,
  type PaginatedResponse,
  type KpiDataPoint,
  type KpiSummary,
  type CourseStudentRow,
  type RoleAlerts,
  type AdminOverview,
  type TeacherAssignment,
  type Institution,
  type AcademicYear,
} from "@cordillera/shared";

import type { AssessmentType as SharedAssessmentType, Role } from "@cordillera/shared";
export type UserRole = Role;

export interface GradeRecordRow {
  grade_id?: string;
  assessment_id: string;
  title: string;
  subject: string;
  course?: string;
  teacher?: string;
  assessment_type: SharedAssessmentType;
  status?: string;
  semester?: number;
  applied_at: string;
  grade: number;
  comments: string | null;
  period?: string | null;
}

export interface StudentEvaluationRow {
  assessment_id: string;
  title: string;
  subject: string;
  subject_id: string;
  course: string;
  course_id: string;
  teacher: string;
  assessment_type: SharedAssessmentType;
  raw_status: string;
  status: "pendiente" | "calificada" | "corregida" | "publicada";
  semester: number;
  applied_at: string;
  grade: number | null;
  grade_id: string | null;
  comments: string | null;
  period: string | null;
  updated_at: string;
}

export interface StudentMaterialFileRow {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  downloadUrl: string;
  viewUrl: string;
}

export interface StudentMaterialRow {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  subject: string;
  subject_id: string | null;
  course: string | null;
  course_id: string | null;
  teacher: string;
  updated_at: string;
  files: StudentMaterialFileRow[];
}

export interface StudentPortal {
  student: { id: string; name: string };
  overall: { avgGrade: number; avgPercent: number; level: string; totalGrades: number; status: string };
  semesters: { semester: number; avgGrade: number; totalGrades: number; closed: boolean; status: string }[];
  alerts: { type: string; message: string }[];
  grades: GradeRecordRow[];
  evaluations: StudentEvaluationRow[];
  materials: StudentMaterialRow[];
}

export interface InstitutionConfig {
  id: string;
  institutionId: string;
  gradingScaleMin: number;
  gradingScaleMax: number;
  exigencia: number;
  allowGradeEdit: boolean;
  allowSelfRegistration: boolean;
  defaultLanguage: string;
}

export interface UserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  institutionId: string | null;
  studentId?: string | null;
  teacherId?: string | null;
  enrollmentId?: string | null;
  courseId?: string | null;
  courseName?: string | null;
  createdAt: string;
}

export interface PeriodRow {
  id: string;
  academicYearId: string;
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  weight: number | null;
  status: string;
  closedAt: string | null;
  createdAt: string;
}

export interface AdminCourseRow {
  course_id: string;
  course_name: string;
  grade_level: number;
  students_count: number;
  section?: string | null;
  max_students?: number;
  is_active?: boolean;
}

export interface AdminSubject {
  id: string;
  name: string;
  code?: string | null;
  isActive?: boolean;
}

export interface LoginResponse {
  token: string;
  user: import("@cordillera/shared").AuthUser;
}

export interface CourseKpi {
  avgGrade: number;
  avgPercent: number;
  level: string;
  totalGrades: number;
}

export interface StudentKpi {
  studentId: string;
  avgGrade: number;
  avgPercent: number;
  performanceLevel: string;
  totalGrades: number;
}

export interface AdminAssignmentRow {
  assignment_id: string;
  teacher_name: string;
  teacher_user_id: string;
  course_id: string;
  course_name: string;
  subject_id: string;
  subject_name: string;
}

export interface AdminTeacher {
  user_id: string;
  teacher_name: string;
}

export interface PermissionCatalogItem {
  id: string;
  action: string;
  description: string;
  module: string;
}

export interface UserPermissionInfo {
  userId: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
}
