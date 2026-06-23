import { jest } from "@jest/globals";
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { GradingService } from "./grading.service.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { NotificationsService } from "../../notifications/notifications.service.js";

const MOCK_ANSWER_ID = "answer-001";
const MOCK_TEACHER_USER_ID = "teacher-user-001";
const MOCK_ASSESSMENT_ID = "assessment-001";
const MOCK_COURSE_ID = "course-001";
const MOCK_STUDENT_ID = "student-001";
const MOCK_QUESTION_ID = "question-001";
const MOCK_GRADE_ID = "grade-001";

const mockStudent = {
  id: MOCK_STUDENT_ID,
  firstName: "Pedro",
  lastName: "García",
  rut: "12345678-9",
};

const mockStudent2 = {
  id: "student-002",
  firstName: "Ana",
  lastName: "Martínez",
  rut: "98765432-1",
};

const mockTeacher = {
  id: "teacher-001",
  userId: MOCK_TEACHER_USER_ID,
  user: { id: MOCK_TEACHER_USER_ID, firstName: "María", lastName: "González" },
};

const mockAssessment = {
  id: MOCK_ASSESSMENT_ID,
  courseId: MOCK_COURSE_ID,
  title: "Prueba de Lenguaje",
  status: "IN_GRADING",
  maxScore: 100,
  weight: 20,
  semester: 1,
  assessmentType: "FORMATIVA",
  teacher: mockTeacher,
  questions: [],
};

const mockQuestion = {
  id: MOCK_QUESTION_ID,
  type: "MULTIPLE_CHOICE",
  statement: "¿Cuál es la idea principal?",
  points: 10,
  explanation: "La idea principal es...",
};

const mockAnswer = {
  id: MOCK_ANSWER_ID,
  questionId: MOCK_QUESTION_ID,
  attemptId: "attempt-001",
  answer: "La respuesta correcta",
  score: null,
  isCorrect: false,
  status: "MANUAL_REVIEW",
  isGraded: false,
  answeredAt: new Date("2026-03-01"),
  attempt: {
    assessmentId: MOCK_ASSESSMENT_ID,
    studentId: MOCK_STUDENT_ID,
    student: mockStudent,
    assessment: {
      teacher: mockTeacher,
      status: "IN_GRADING",
      questions: [{ questionId: MOCK_QUESTION_ID, points: 10 }],
    },
  },
  question: mockQuestion,
};

const mockGradedAnswer = {
  ...mockAnswer,
  score: 10,
  isCorrect: true,
  status: "CORRECT",
  isGraded: true,
};

const mockGrade = {
  id: MOCK_GRADE_ID,
  assessmentId: MOCK_ASSESSMENT_ID,
  studentId: MOCK_STUDENT_ID,
  grade: 6.0,
  score: 90,
  percentage: 90.0,
  comments: null,
  recordedBy: MOCK_TEACHER_USER_ID,
  assessment: { status: "CLOSED" },
  student: mockStudent,
};

const mockEnrollment = {
  id: "enroll-001",
  studentId: MOCK_STUDENT_ID,
  courseId: MOCK_COURSE_ID,
  isActive: true,
};

describe("GradingService", () => {
  let service: GradingService;
  let prismaStudentAnswer: Record<string, jest.Mock<(...args: any[]) => any>>;
  let prismaAssessment: Record<string, jest.Mock<(...args: any[]) => any>>;
  let prismaAssessmentQuestion: Record<string, jest.Mock<(...args: any[]) => any>>;
  let prismaAssessmentAttempt: Record<string, jest.Mock<(...args: any[]) => any>>;
  let prismaGrade: Record<string, jest.Mock<(...args: any[]) => any>>;
  let prismaStudent: Record<string, jest.Mock<(...args: any[]) => any>>;
  let prismaCourse: Record<string, jest.Mock<(...args: any[]) => any>>;
  let prismaEnrollment: Record<string, jest.Mock<(...args: any[]) => any>>;
  let prismaUser: Record<string, jest.Mock<(...args: any[]) => any>>;

  const mockScopeUser = {
    id: "scope-user-001",
    role: "SUPER_ADMIN" as const,
    isActive: true,
    deletedAt: null,
    institutionId: null,
    teacher: null,
    student: null,
  };

  beforeEach(async () => {
    prismaStudentAnswer = {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      groupBy: jest.fn(),
    };
    prismaAssessment = {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    };
    prismaAssessmentQuestion = {
      findUnique: jest.fn(),
    };
    prismaAssessmentAttempt = {
      findMany: jest.fn(),
      update: jest.fn(),
    };
    prismaGrade = {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    };
    prismaStudent = {
      findMany: jest.fn(),
    };
    prismaCourse = {
      findUnique: jest.fn(),
    };
    prismaEnrollment = {
      findFirst: jest.fn(),
    };
    prismaUser = { findUnique: jest.fn<() => any>().mockResolvedValue(mockScopeUser) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GradingService,
        {
          provide: PrismaService,
          useValue: {
            studentAnswer: prismaStudentAnswer,
            assessment: prismaAssessment,
            assessmentQuestion: prismaAssessmentQuestion,
            assessmentAttempt: prismaAssessmentAttempt,
            grade: prismaGrade,
            student: prismaStudent,
            course: prismaCourse,
            enrollment: prismaEnrollment,
            user: prismaUser,
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            notifyGradeChangeRequest: jest.fn<() => any>().mockResolvedValue(undefined),
            notifyAssessmentGraded: jest.fn<() => any>().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<GradingService>(GradingService);
  });

  describe("gradeAnswer", () => {
    it("debe guardar una nota como CORRECT cuando score >= maxPoints", async () => {
      prismaStudentAnswer.findUnique.mockResolvedValue(mockAnswer);
      prismaAssessmentQuestion.findUnique.mockResolvedValue({ points: 10 });
      prismaStudentAnswer.update.mockResolvedValue({
        ...mockAnswer,
        score: 10,
        isCorrect: true,
        status: "CORRECT",
        isGraded: true,
      });

      const result = await service.gradeAnswer(MOCK_ANSWER_ID, MOCK_TEACHER_USER_ID, 10, "Muy bien!");

      expect(result.answerId).toBe(MOCK_ANSWER_ID);
      expect(result.score).toBe(10);
      expect(result.status).toBe("CORRECT");
      expect(result.isCorrect).toBe(true);
      expect(prismaStudentAnswer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MOCK_ANSWER_ID },
          data: expect.objectContaining({
            score: 10,
            isCorrect: true,
            status: "CORRECT",
            isGraded: true,
          }),
        }),
      );
    });

    it("debe guardar como PARTIAL cuando score es intermedio", async () => {
      prismaStudentAnswer.findUnique.mockResolvedValue(mockAnswer);
      prismaAssessmentQuestion.findUnique.mockResolvedValue({ points: 10 });
      prismaStudentAnswer.update.mockResolvedValue({
        ...mockAnswer,
        score: 5,
        isCorrect: false,
        status: "PARTIAL",
        isGraded: true,
      });

      const result = await service.gradeAnswer(MOCK_ANSWER_ID, MOCK_TEACHER_USER_ID, 5);

      expect(result.status).toBe("PARTIAL");
      expect(result.isCorrect).toBe(false);
    });

    it("debe guardar como INCORRECT cuando score es 0", async () => {
      prismaStudentAnswer.findUnique.mockResolvedValue(mockAnswer);
      prismaAssessmentQuestion.findUnique.mockResolvedValue({ points: 10 });
      prismaStudentAnswer.update.mockResolvedValue({
        ...mockAnswer,
        score: 0,
        isCorrect: false,
        status: "INCORRECT",
        isGraded: true,
      });

      const result = await service.gradeAnswer(MOCK_ANSWER_ID, MOCK_TEACHER_USER_ID, 0);

      expect(result.status).toBe("INCORRECT");
    });

    it("debe lanzar NotFoundException si la respuesta no existe", async () => {
      prismaStudentAnswer.findUnique.mockResolvedValue(null);

      await expect(
        service.gradeAnswer("nonexistent", MOCK_TEACHER_USER_ID, 10),
      ).rejects.toThrow(NotFoundException);
    });

    it("debe lanzar ForbiddenException si el profesor no es dueño de la evaluación", async () => {
      prismaStudentAnswer.findUnique.mockResolvedValue(mockAnswer);

      await expect(
        service.gradeAnswer(MOCK_ANSWER_ID, "wrong-teacher", 10),
      ).rejects.toThrow(ForbiddenException);
    });

    it("debe lanzar BadRequestException si la evaluación no está en IN_GRADING o CLOSED", async () => {
      prismaStudentAnswer.findUnique.mockResolvedValue({
        ...mockAnswer,
        attempt: {
          ...mockAnswer.attempt,
          assessment: { ...mockAnswer.attempt.assessment, status: "ACTIVE", teacher: { ...mockTeacher, userId: MOCK_TEACHER_USER_ID } },
        },
      });

      await expect(
        service.gradeAnswer(MOCK_ANSWER_ID, MOCK_TEACHER_USER_ID, 10),
      ).rejects.toThrow(BadRequestException);
    });

    it("debe lanzar BadRequestException si el score supera el máximo", async () => {
      prismaStudentAnswer.findUnique.mockResolvedValue(mockAnswer);
      prismaAssessmentQuestion.findUnique.mockResolvedValue({ points: 10 });

      await expect(
        service.gradeAnswer(MOCK_ANSWER_ID, MOCK_TEACHER_USER_ID, 15),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("bulkGradeAnswers", () => {
    it("debe procesar múltiples respuestas exitosamente", async () => {
      prismaStudentAnswer.findUnique.mockResolvedValue(mockAnswer);
      prismaAssessmentQuestion.findUnique.mockResolvedValue({ points: 10 });
      prismaStudentAnswer.update.mockResolvedValue(mockGradedAnswer);

      const grades = [
        { answerId: "answer-001", score: 10, feedback: "Bien" },
        { answerId: "answer-002", score: 8, feedback: "Bien" },
      ];

      const result = await service.bulkGradeAnswers(grades, MOCK_TEACHER_USER_ID);

      expect(result.total).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(0);
    });

    it("debe reportar fallos parciales cuando algunas respuestas fallan", async () => {
      prismaStudentAnswer.findUnique
        .mockResolvedValueOnce(mockAnswer)
        .mockResolvedValueOnce(null);
      prismaAssessmentQuestion.findUnique.mockResolvedValue({ points: 10 });
      prismaStudentAnswer.update.mockResolvedValue(mockGradedAnswer);

      const grades = [
        { answerId: "answer-001", score: 10 },
        { answerId: "answer-002", score: 8 },
      ];

      const result = await service.bulkGradeAnswers(grades, MOCK_TEACHER_USER_ID);

      expect(result.total).toBe(2);
      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(1);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
    });

    it("debe devolver resultados vacíos si el array de grades está vacío", async () => {
      const result = await service.bulkGradeAnswers([], MOCK_TEACHER_USER_ID);

      expect(result.total).toBe(0);
      expect(result.successCount).toBe(0);
      expect(result.errorCount).toBe(0);
    });
  });

  describe("getPendingGrading", () => {
    it("debe retornar respuestas pendientes agrupadas por estudiante", async () => {
      prismaAssessment.findUnique.mockResolvedValue(mockAssessment);
      prismaStudentAnswer.findMany.mockResolvedValue([mockAnswer]);

      const result = await service.getPendingGrading(MOCK_ASSESSMENT_ID, MOCK_TEACHER_USER_ID);

      expect(result.assessmentId).toBe(MOCK_ASSESSMENT_ID);
      expect(result.totalPending).toBe(1);
      expect(result.byStudent).toHaveLength(1);
      expect(result.byStudent[0].studentName).toBe("Pedro García");
    });

    it("debe lanzar NotFoundException si la evaluación no existe", async () => {
      prismaAssessment.findUnique.mockResolvedValue(null);

      await expect(
        service.getPendingGrading("nonexistent", MOCK_TEACHER_USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it("debe lanzar ForbiddenException si el profesor no es dueño de la evaluación", async () => {
      prismaAssessment.findUnique.mockResolvedValue(mockAssessment);

      await expect(
        service.getPendingGrading(MOCK_ASSESSMENT_ID, "wrong-teacher"),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("getCourseGradeBook", () => {
    it("debe retornar el libro de calificaciones del curso", async () => {
      prismaCourse.findUnique.mockResolvedValue({
        id: MOCK_COURSE_ID,
        name: "4° Básico A",
        gradeLevel: 4,
        institutionId: "inst-001",
      });
      prismaStudent.findMany.mockResolvedValue([mockStudent, mockStudent2]);
      prismaAssessment.findMany.mockResolvedValue([mockAssessment]);
      prismaGrade.findMany.mockResolvedValue([mockGrade]);
      prismaAssessmentAttempt.findMany.mockResolvedValue([]);

      const result = await service.getCourseGradeBook(MOCK_COURSE_ID);

      expect(result.course.id).toBe(MOCK_COURSE_ID);
      expect(result.students).toBeDefined();
      expect(result.assessments).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.stats.totalStudents).toBe(2);
    });

    it("debe lanzar NotFoundException si el curso no existe", async () => {
      prismaCourse.findUnique.mockResolvedValue(null);

      await expect(service.getCourseGradeBook("nonexistent")).rejects.toThrow(NotFoundException);
    });

    it("debe identificar estudiantes en riesgo con promedio bajo", async () => {
      prismaCourse.findUnique.mockResolvedValue({
        id: MOCK_COURSE_ID,
        name: "4° Básico A",
        gradeLevel: 4,
        institutionId: "inst-001",
      });
      prismaStudent.findMany.mockResolvedValue([mockStudent]);
      prismaAssessment.findMany.mockResolvedValue([
        { ...mockAssessment, questions: [{ question: { learningObjective: { code: "OA01", description: "Leer" }, learningObjectiveId: "oa-1", id: "q-1" } }] },
      ]);
      prismaGrade.findMany.mockResolvedValue([
        { ...mockGrade, grade: 3.5 },
      ]);
      prismaAssessmentAttempt.findMany.mockResolvedValue([]);

      const result = await service.getCourseGradeBook(MOCK_COURSE_ID);

      expect(result.stats.atRiskCount).toBe(1);
    });

    it("debe calcular promedio del curso correctamente", async () => {
      prismaCourse.findUnique.mockResolvedValue({
        id: MOCK_COURSE_ID,
        name: "4° Básico A",
        gradeLevel: 4,
        institutionId: "inst-001",
      });
      prismaStudent.findMany.mockResolvedValue([mockStudent, mockStudent2]);
      prismaAssessment.findMany.mockResolvedValue([mockAssessment]);
      prismaGrade.findMany.mockResolvedValue([
        { ...mockGrade, grade: 6.0 },
        { ...mockGrade, grade: 5.0, studentId: "student-002", student: mockStudent2 },
      ]);
      prismaAssessmentAttempt.findMany.mockResolvedValue([]);

      const result = await service.getCourseGradeBook(MOCK_COURSE_ID);

      expect(result.stats.courseAvg).toBe(5.5);
    });
  });

  describe("updateGradeRecord", () => {
    it("debe actualizar una nota existente", async () => {
      prismaGrade.findUnique.mockResolvedValue(mockGrade);
      prismaGrade.update.mockResolvedValue({
        ...mockGrade,
        grade: 5.5,
        comments: "Revisado nuevamente",
      });

      const result = await service.updateGradeRecord(MOCK_GRADE_ID, 5.5, "Revisado nuevamente");

      expect(result.ok).toBe(true);
      expect(result.grade).toBe(5.5);
      expect(result.comments).toBe("Revisado nuevamente");
    });

    it("debe lanzar NotFoundException si el registro no existe", async () => {
      prismaGrade.findUnique.mockResolvedValue(null);

      await expect(
        service.updateGradeRecord("nonexistent", 5.0),
      ).rejects.toThrow(NotFoundException);
    });

    it("debe lanzar BadRequestException si la evaluación está activa", async () => {
      prismaGrade.findUnique.mockResolvedValue({
        ...mockGrade,
        assessment: { status: "ACTIVE" },
      });

      await expect(
        service.updateGradeRecord(MOCK_GRADE_ID, 5.0),
      ).rejects.toThrow(BadRequestException);
    });

    it("debe lanzar BadRequestException si la nota está fuera de rango 1.0-7.0", async () => {
      prismaGrade.findUnique.mockResolvedValue(mockGrade);

      await expect(
        service.updateGradeRecord(MOCK_GRADE_ID, 8.0),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateGradeRecord(MOCK_GRADE_ID, 0.5),
      ).rejects.toThrow(BadRequestException);
    });

    it("debe actualizar recordedBy si se provee userId", async () => {
      prismaGrade.findUnique.mockResolvedValue(mockGrade);
      prismaGrade.update.mockResolvedValue({ ...mockGrade, grade: 6.0 });

      await service.updateGradeRecord(MOCK_GRADE_ID, 6.0, undefined, "admin-001");

      expect(prismaGrade.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ recordedBy: "admin-001" }),
        }),
      );
    });
  });

  describe("directGradeRecord", () => {
    it("debe crear o actualizar una nota directamente", async () => {
      prismaAssessment.findUnique.mockResolvedValue({
        id: MOCK_ASSESSMENT_ID,
        status: "CLOSED",
        courseId: MOCK_COURSE_ID,
      });
      prismaEnrollment.findFirst.mockResolvedValue(mockEnrollment);
      prismaGrade.upsert.mockResolvedValue({
        ...mockGrade,
        grade: 6.5,
        comments: "Nota directa",
      });

      const result = await service.directGradeRecord(
        MOCK_ASSESSMENT_ID, MOCK_STUDENT_ID, 6.5, MOCK_TEACHER_USER_ID, "Nota directa",
      );

      expect(result.ok).toBe(true);
      expect(result.grade).toBe(6.5);
      expect(result.comments).toBe("Nota directa");
    });

    it("debe lanzar NotFoundException si la evaluación no existe", async () => {
      prismaAssessment.findUnique.mockResolvedValue(null);

      await expect(
        service.directGradeRecord("nonexistent", MOCK_STUDENT_ID, 5.0, MOCK_TEACHER_USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it("debe lanzar BadRequestException si el estudiante no pertenece al curso", async () => {
      prismaAssessment.findUnique.mockResolvedValue({
        id: MOCK_ASSESSMENT_ID,
        status: "CLOSED",
        courseId: MOCK_COURSE_ID,
      });
      prismaEnrollment.findFirst.mockResolvedValue(null);

      await expect(
        service.directGradeRecord(MOCK_ASSESSMENT_ID, "student-999", 5.0, MOCK_TEACHER_USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it("debe lanzar BadRequestException si la nota está fuera de rango", async () => {
      prismaAssessment.findUnique.mockResolvedValue({
        id: MOCK_ASSESSMENT_ID,
        status: "CLOSED",
        courseId: MOCK_COURSE_ID,
      });
      prismaEnrollment.findFirst.mockResolvedValue(mockEnrollment);

      await expect(
        service.directGradeRecord(MOCK_ASSESSMENT_ID, MOCK_STUDENT_ID, 9.0, MOCK_TEACHER_USER_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("recalculateAssessment", () => {
    it("debe recalcular puntajes y notas para todos los intentos", async () => {
      prismaAssessment.findUnique.mockResolvedValue({
        id: MOCK_ASSESSMENT_ID,
        teacher: mockTeacher,
        questions: [{ question: { id: MOCK_QUESTION_ID }, points: 10 }],
        attempts: [
          {
            id: "attempt-001",
            studentId: MOCK_STUDENT_ID,
            status: "COMPLETED",
            answers: [{ score: 8 }],
          },
        ],
      });
      prismaAssessmentAttempt.update.mockResolvedValue({});
      prismaGrade.upsert.mockResolvedValue(mockGrade);

      const result = await service.recalculateAssessment(MOCK_ASSESSMENT_ID, MOCK_TEACHER_USER_ID);

      expect(result.gradesRecalculated).toBe(1);
      expect(result.maxScore).toBe(10);
    });

    it("debe lanzar ForbiddenException si el profesor no es dueño", async () => {
      prismaAssessment.findUnique.mockResolvedValue({
        id: MOCK_ASSESSMENT_ID,
        teacher: mockTeacher,
        questions: [],
        attempts: [],
      });

      await expect(
        service.recalculateAssessment(MOCK_ASSESSMENT_ID, "wrong-teacher"),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
