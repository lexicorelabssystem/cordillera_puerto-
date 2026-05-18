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
  type GradeRecordRow,
  type StudentPortal,
  type TeacherAssignment,
  type Institution,
  type AcademicYear,
} from "@cordillera/shared";

import type { Role } from "@cordillera/shared";
export type UserRole = Role;

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
}

export interface AdminSubject {
  id: string;
  name: string;
  code?: string | null;
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
