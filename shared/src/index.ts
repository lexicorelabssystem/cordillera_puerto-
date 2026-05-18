export type Role = "SUPER_ADMIN" | "ADMIN" | "DIRECTION" | "UTP" | "TEACHER" | "STUDENT" | "PARENT";

export type AssessmentStatus =
  | "DRAFT" | "PUBLISHED" | "ACTIVE" | "CLOSED" | "IN_GRADING"
  | "GRADED" | "REPORTED" | "ARCHIVED" | "CANCELLED";

export type AssessmentType = "DIAGNOSTICA" | "PROCESO" | "CIERRE" | "PARCIAL" | "FINAL" | "SIMCE";

export type QuestionType = "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER" | "ESSAY" | "MATCHING";

export type PeriodStatus = "OPEN" | "CLOSED";

export type RemedialStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "EVALUATED";

export type AlertLevel = "CRITICO" | "ALTO" | "MEDIO" | "INFORMATIVO";

export interface AuthUser {
  sub: string;
  role: Role;
  name: string;
  email: string;
  institutionId?: string | null;
  mustChangePassword: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number; hasNext: boolean; hasPrevious: boolean };
}

export interface KpiDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface KpiSummary {
  avgGrade: number;
  avgPercent: number;
  level: string;
  totalGrades: number;
}

export interface CourseStudentRow {
  student_id: string;
  first_name: string;
  last_name: string;
  course_name: string;
}

export interface RoleAlerts {
  role: Role;
  total: number;
  summary: { atRiskCount: number; lowPerformingOaCount: number };
  recent: { id: string; message: string }[];
  alerts: {
    studentId: string;
    studentName: string;
    courseId: string;
    courseName: string;
    semester: number;
    avgGrade: number;
    level: AlertLevel;
    message: string;
  }[];
}

export interface AdminOverview {
  studentCount: number;
  courseCount: number;
  teacherCount: number;
  assessmentCount: number;
  coverageRate: number;
  subjectCount: number;
  totals: { users: number; courses: number; students: number; assessments: number };
  courses: { course_id: string; course_name: string; grade_level: number; section?: string | null; students_count: number }[];
  students: { student_id: string; first_name: string; last_name: string; course_name: string; email: string | null }[];
  teachers: { user_id: string; teacher_id: string; teacher_name: string; email: string; courses: { course: string; subject: string }[]; total_assessments: number }[];
  subjects: { id: string; name: string; code: string | null }[];
  recentAssessments: { assessment_id: string; title: string; assessment_type: AssessmentType; status: AssessmentStatus; course_name: string; subject_name: string; teacher_name: string; attempts_count: number; grades_count: number; created_at: string; published_at: string | null }[];
  semaforoCursos: { course_id: string; course_name: string; avg_grade: number | null; total_grades: number; level: string }[];
  alertas: { courseName: string; avgGrade: number; suggestion: string }[];
}

export interface GradeRecordRow {
  grade_id?: string;
  assessment_id: string;
  title: string;
  subject: string;
  assessment_type: AssessmentType;
  semester?: number;
  applied_at: string;
  grade: number;
  comments: string | null;
}

export interface StudentPortal {
  student: { id: string; name: string };
  overall: { avgGrade: number; avgPercent: number; level: string; totalGrades: number; status: string };
  semesters: { semester: number; avgGrade: number; totalGrades: number; closed: boolean; status: string }[];
  alerts: { type: string; message: string }[];
  grades: GradeRecordRow[];
}

export interface TeacherAssignment {
  assignment_id: string;
  course_id: string;
  course_name: string;
  subject_id: string;
  subject_name: string;
}

export interface Institution {
  id: string;
  name: string;
  rbd?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
  region?: string | null;
  comuna?: string | null;
  sede?: string | null;
  jornada?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AcademicYear {
  id: string;
  institutionId: string;
  year: number;
  isActive: boolean;
  startDate: string;
  endDate: string;
}
