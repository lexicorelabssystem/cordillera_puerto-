export interface SimceAssessment {
  id: string;
  title: string;
  status: string;
  gradeLevel: number;
  date: string;
  description?: string | null;
  academicYearId?: string | null;
  academicYear?: { id: string; year: number } | null;
  course?: { id: string; name: string; gradeLevel?: number };
  subject?: { id: string; name: string };
  teacher?: { user?: { firstName: string; lastName: string } };
  creator?: { firstName: string; lastName: string };
  pdfFile?: { id: string; originalName: string; fileName: string; url: string | null; mimeType?: string } | null;
  _count?: { answerKeys: number; responses: number };
  createdAt?: string;
  updatedAt?: string;
}

export interface SimceKpiStats {
  total: number;
  draft: number;
  keyPending: number;
  ready: number;
  corrected: number;
}

export interface SimceAnswerKeyItem {
  id: string;
  questionNumber: number;
  correctOption: string;
  score: number;
  observation?: string | null;
  axis?: { id: string; name: string } | null;
  skill?: { id: string; name: string } | null;
  oa?: { id: string; code: string; description: string } | null;
}

export interface SimceAnswerKey {
  assessmentId: string;
  totalQuestions: number;
  totalScore: number;
  items: SimceAnswerKeyItem[];
}

export interface StudentResultQuestion {
  questionNumber: number;
  correctOption: string;
  score: number;
  selectedOption: string | null;
  isCorrect: boolean | null;
  scoreObtained: number;
  status: "CORRECT" | "INCORRECT" | "OMITTED";
}

export interface StudentResult {
  student: { id: string; firstName: string; lastName: string; rut?: string | null };
  assessment: { id: string; title: string };
  summary: {
    totalCorrect: number;
    totalIncorrect: number;
    totalOmitted: number;
    totalQuestions: number;
    totalScore: number;
    maxScore: number;
    percentage: number;
    performanceLevel: string;
  };
  questions: StudentResultQuestion[];
}

export interface SimceResultsSummary {
  assessment: { id: string; title: string; status: string };
  maxScore: number;
  totalQuestions: number;
  totalStudents: number;
  answeredCount: number;
  avgPercentage: number;
  results: {
    student: { id: string; firstName: string; lastName: string; rut?: string | null };
    answered: boolean;
    completed?: boolean;
    responseCount?: number;
    totalCorrect: number;
    totalIncorrect: number;
    totalOmitted: number;
    totalQuestions: number;
    totalScore: number;
    percentage: number;
    performanceLevel?: string;
  }[];
  weakestQuestions?: SimceWeakestQuestion[];
  skillsPerformance?: SimceSkillPerformance[];
  axesPerformance?: SimceSkillPerformance[];
  oasPerformance?: SimceSkillPerformance[];
}

export interface SimceWeakestQuestion {
  questionNumber: number;
  correctOption: string;
  correctCount: number;
  incorrectCount: number;
  totalResponses: number;
  correctPercent: number;
  axis?: { id: string; name: string } | null;
  skill?: { id: string; name: string } | null;
  oa?: { id: string; code: string; description: string } | null;
}

export interface SimceSkillPerformance {
  id: string;
  name: string;
  totalQuestions: number;
  totalCorrect: number;
  totalResponses: number;
  avgCorrectPercent: number;
}

export interface GroupReviewQuestion {
  questionNumber: number;
  correctOption: string;
  score: number;
  totalStudents: number;
  answered: number;
  omitted: number;
  correct: number;
  incorrect: number;
  correctPercent: number;
  optionDistribution: Record<string, number>;
}

export interface GroupReview {
  assessmentId: string;
  totalStudents: number;
  totalQuestions: number;
  questions: GroupReviewQuestion[];
}

export interface QuestionStats {
  questionNumber: number;
  correctOption: string;
  totalStudents: number;
  correct: number;
  incorrect: number;
  omitted: number;
  correctPercent: number;
  optionDistribution: Record<string, number>;
}

export interface CourseOption {
  course_id: string;
  course_name: string;
  grade_level?: number;
}

export interface SubjectOption {
  id: string;
  name: string;
}

export interface StudentOption {
  student_id: string;
  first_name?: string;
  firstName?: string;
  last_name?: string;
  lastName?: string;
  rut?: string | null;
}
