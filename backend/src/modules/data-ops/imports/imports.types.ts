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

export const IMPORTED_STUDENT_TEMP_PASSWORD = "Temp2026**";
export const IMPORTED_TEACHER_TEMP_PASSWORD = "Temp2026**";
