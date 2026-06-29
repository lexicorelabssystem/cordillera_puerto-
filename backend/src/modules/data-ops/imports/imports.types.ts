export interface ImportRow {
  rowNumber: number;
  data: Record<string, string>;
  errors: string[];
}

export interface ValidationResult {
  valid: boolean;
  rows: ImportRow[];
  totalRows: number;
  validRows: number;
  errorRows: number;
}

export interface StudentImportRecord {
  studentId: string;
  enrollmentId: string;
  userId?: string;
}

export interface TeacherImportRecord {
  teacherId: string;
  userId: string;
}

export interface ImportMetadata {
  importedRecords?: StudentImportRecord[];
  importedTeacherRecords?: TeacherImportRecord[];
  institutionId?: string;
  validationErrors?: { row: number; errors: string[] }[];
  deletedAt?: string;
}

export interface ImportCourseTarget {
  institutionId: string;
  academicYearId: string;
  name: string;
  gradeLevel: number;
}

export interface ImportCourseMatch {
  course: {
    id: string;
    institutionId: string;
    academicYearId: string;
    name: string;
    gradeLevel: number;
    section: string | null;
  } | null;
  pendingCourse?: ImportCourseTarget;
  error?: string;
}

function resolveTemporaryPassword(envName: string, fallback: string, isProduction: boolean) {
  const value = process.env[envName];
  if (value) return value;
  if (isProduction) {
    throw new Error(`${envName} es requerido en produccion para importar usuarios.`);
  }
  return fallback;
}

export function getImportedStudentTempPassword(isProduction: boolean) {
  return resolveTemporaryPassword("IMPORTED_STUDENT_TEMP_PASSWORD", "Temp2026**", isProduction);
}

export function getImportedTeacherTempPassword(isProduction: boolean) {
  return resolveTemporaryPassword("IMPORTED_TEACHER_TEMP_PASSWORD", "Temp2026**", isProduction);
}
