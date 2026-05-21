import { jest } from "@jest/globals";
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { RemedialPlansService } from "./remedial-plans.service.js";
import { PrismaService } from "../../prisma/prisma.service.js";

const MOCK_PLAN_ID = "plan-001";
const MOCK_STUDENT_ID = "student-001";
const MOCK_COURSE_ID = "course-001";
const MOCK_SUBJECT_ID = "subject-001";
const MOCK_OA_ID = "oa-001";
const MOCK_TEACHER_ID = "teacher-001";

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
};

const mockLearningObjective = {
  id: MOCK_OA_ID,
  code: "OA01",
  description: "Leer y comprender textos literarios",
  subject: { name: "Lenguaje" },
};

const mockRemedialPlan = {
  id: MOCK_PLAN_ID,
  studentId: MOCK_STUDENT_ID,
  courseId: MOCK_COURSE_ID,
  subjectId: MOCK_SUBJECT_ID,
  learningObjectiveId: MOCK_OA_ID,
  title: "Reforzamiento OA01",
  description: "Plan remedial de 2 semanas",
  status: "PENDING",
  startDate: new Date("2026-03-01"),
  endDate: new Date("2026-03-15"),
  preScore: 45.0,
  postScore: null,
  assignedTo: null,
  createdAt: new Date("2026-02-15"),
  updatedAt: new Date("2026-02-15"),
  student: { firstName: "Pedro", lastName: "García" },
  learningObjective: { code: "OA01", description: "Leer y comprender textos literarios" },
  learningResources: [],
};

const mockCourse = {
  id: MOCK_COURSE_ID,
  name: "4° Básico A",
  gradeLevel: 4,
  institutionId: "inst-001",
};

const mockEnrollment = {
  student: mockStudent,
};

const mockEnrollment2 = {
  student: mockStudent2,
};

describe("RemedialPlansService", () => {
  let service: RemedialPlansService;
  let prismaRemedialPlan: Record<string, jest.Mock<(...args: any[]) => any>>;
  let prismaStudent: Record<string, jest.Mock<(...args: any[]) => any>>;
  let prismaLearningObjective: Record<string, jest.Mock<(...args: any[]) => any>>;
  let prismaCourse: Record<string, jest.Mock<(...args: any[]) => any>>;
  let prismaAssessment: Record<string, jest.Mock<(...args: any[]) => any>>;
  let prismaLearningResource: Record<string, jest.Mock<(...args: any[]) => any>>;

  beforeEach(async () => {
    prismaRemedialPlan = {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    };
    prismaStudent = { findUnique: jest.fn() };
    prismaLearningObjective = { findUnique: jest.fn() };
    prismaCourse = { findUnique: jest.fn() };
    prismaAssessment = { findMany: jest.fn() };
    prismaLearningResource = { findMany: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemedialPlansService,
        {
          provide: PrismaService,
          useValue: {
            remedialPlan: prismaRemedialPlan,
            student: prismaStudent,
            learningObjective: prismaLearningObjective,
            course: prismaCourse,
            assessment: prismaAssessment,
            learningResource: prismaLearningResource,
          },
        },
      ],
    }).compile();

    service = module.get<RemedialPlansService>(RemedialPlansService);
  });

  describe("create", () => {
    const createDto = {
      studentId: MOCK_STUDENT_ID,
      courseId: MOCK_COURSE_ID,
      subjectId: MOCK_SUBJECT_ID,
      learningObjectiveId: MOCK_OA_ID,
      title: "Reforzamiento OA01",
      description: "Plan remedial de 2 semanas para mejorar logro en OA01",
      startDate: "2026-03-01",
      endDate: "2026-03-15",
      preScore: 45.0,
      assignedTo: MOCK_TEACHER_ID,
    };

    it("debe crear un plan remedial exitosamente", async () => {
      prismaStudent.findUnique.mockResolvedValue(mockStudent);
      prismaLearningObjective.findUnique.mockResolvedValue(mockLearningObjective);
      prismaRemedialPlan.create.mockResolvedValue(mockRemedialPlan);

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.id).toBe(MOCK_PLAN_ID);
      expect(result.title).toBe("Reforzamiento OA01");
      expect(result.status).toBe("PENDING");
      expect(prismaRemedialPlan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            studentId: MOCK_STUDENT_ID,
            courseId: MOCK_COURSE_ID,
            learningObjectiveId: MOCK_OA_ID,
            status: "PENDING",
            preScore: 45.0,
            assignedTo: MOCK_TEACHER_ID,
          }),
        }),
      );
    });

    it("debe lanzar NotFoundException si el estudiante no existe", async () => {
      prismaStudent.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it("debe lanzar NotFoundException si el OA no existe", async () => {
      prismaStudent.findUnique.mockResolvedValue(mockStudent);
      prismaLearningObjective.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it("debe crear plan con preScore nulo si no se proporciona", async () => {
      prismaStudent.findUnique.mockResolvedValue(mockStudent);
      prismaLearningObjective.findUnique.mockResolvedValue(mockLearningObjective);
      prismaRemedialPlan.create.mockResolvedValue({ ...mockRemedialPlan, preScore: null });

      const result = await service.create({ ...createDto, preScore: undefined });

      expect(result.preScore).toBeNull();
    });

    it("debe incluir las relaciones student y learningObjective en el resultado", async () => {
      prismaStudent.findUnique.mockResolvedValue(mockStudent);
      prismaLearningObjective.findUnique.mockResolvedValue(mockLearningObjective);
      prismaRemedialPlan.create.mockResolvedValue(mockRemedialPlan);

      const result = await service.create(createDto);

      expect(result.student.firstName).toBe("Pedro");
      expect(result.learningObjective.code).toBe("OA01");
    });
  });

  describe("findByStudent", () => {
    it("debe retornar planes de un estudiante ordenados por fecha descendente", async () => {
      prismaRemedialPlan.findMany.mockResolvedValue([mockRemedialPlan]);

      const result = await service.findByStudent(MOCK_STUDENT_ID);

      expect(result).toHaveLength(1);
      expect(result[0].studentId).toBe(MOCK_STUDENT_ID);
      expect(prismaRemedialPlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { studentId: MOCK_STUDENT_ID },
          orderBy: { createdAt: "desc" },
        }),
      );
    });

    it("debe retornar array vacío si el estudiante no tiene planes", async () => {
      prismaRemedialPlan.findMany.mockResolvedValue([]);

      const result = await service.findByStudent("student-999");

      expect(result).toHaveLength(0);
    });

    it("debe incluir datos del estudiante y OA en cada plan", async () => {
      prismaRemedialPlan.findMany.mockResolvedValue([mockRemedialPlan]);

      const result = await service.findByStudent(MOCK_STUDENT_ID);

      expect(result[0].student).toBeDefined();
      expect(result[0].student.firstName).toBe("Pedro");
      expect(result[0].learningObjective).toBeDefined();
      expect(result[0].learningObjective.code).toBe("OA01");
    });

    it("debe retornar múltiples planes si el estudiante tiene varios", async () => {
      const plan2 = { ...mockRemedialPlan, id: "plan-002", title: "Otro plan" };
      prismaRemedialPlan.findMany.mockResolvedValue([mockRemedialPlan, plan2]);

      const result = await service.findByStudent(MOCK_STUDENT_ID);

      expect(result).toHaveLength(2);
    });
  });

  describe("findById", () => {
    it("debe retornar un plan con sus relaciones", async () => {
      prismaRemedialPlan.findUnique.mockResolvedValue(mockRemedialPlan);

      const result = await service.findById(MOCK_PLAN_ID);

      expect(result.id).toBe(MOCK_PLAN_ID);
      expect(result.student).toBeDefined();
      expect(result.learningObjective).toBeDefined();
      expect(result.learningResources).toBeDefined();
    });

    it("debe lanzar NotFoundException si el plan no existe", async () => {
      prismaRemedialPlan.findUnique.mockResolvedValue(null);

      await expect(service.findById("nonexistent")).rejects.toThrow(NotFoundException);
    });
  });

  describe("complete", () => {
    it("debe completar un plan en estado IN_PROGRESS", async () => {
      prismaRemedialPlan.findUnique.mockResolvedValue({
        ...mockRemedialPlan,
        status: "IN_PROGRESS",
      });
      prismaRemedialPlan.update.mockResolvedValue({
        ...mockRemedialPlan,
        status: "COMPLETED",
      });

      const result = await service.complete(MOCK_PLAN_ID);

      expect(result.status).toBe("COMPLETED");
      expect(prismaRemedialPlan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MOCK_PLAN_ID },
          data: { status: "COMPLETED" },
        }),
      );
    });

    it("debe lanzar NotFoundException si el plan no existe", async () => {
      prismaRemedialPlan.findUnique.mockResolvedValue(null);

      await expect(service.complete("nonexistent")).rejects.toThrow(NotFoundException);
    });

    it("debe lanzar BadRequestException si el plan no está en IN_PROGRESS", async () => {
      prismaRemedialPlan.findUnique.mockResolvedValue(mockRemedialPlan);

      await expect(service.complete(MOCK_PLAN_ID)).rejects.toThrow(BadRequestException);
    });

    it("no debe permitir completar un plan ya completado", async () => {
      prismaRemedialPlan.findUnique.mockResolvedValue({
        ...mockRemedialPlan,
        status: "COMPLETED",
      });

      await expect(service.complete(MOCK_PLAN_ID)).rejects.toThrow(BadRequestException);
    });
  });

  describe("evaluate", () => {
    it("debe marcar como EFFECTIVE cuando hay mejora significativa (>=15 puntos)", async () => {
      prismaRemedialPlan.findUnique.mockResolvedValue({
        ...mockRemedialPlan,
        status: "COMPLETED",
        preScore: 45.0,
      });
      prismaRemedialPlan.update.mockResolvedValue({
        ...mockRemedialPlan,
        status: "EFFECTIVE",
        postScore: 65.0,
      });

      const result = await service.evaluate(MOCK_PLAN_ID, 65);

      expect(result.status).toBe("EFFECTIVE");
      expect(result.postScore).toBe(65);
    });

    it("debe marcar como COMPLETED cuando hay mejora leve (<15 puntos)", async () => {
      prismaRemedialPlan.findUnique.mockResolvedValue({
        ...mockRemedialPlan,
        status: "COMPLETED",
        preScore: 45.0,
      });
      prismaRemedialPlan.update.mockResolvedValue({
        ...mockRemedialPlan,
        status: "COMPLETED",
        postScore: 55.0,
      });

      const result = await service.evaluate(MOCK_PLAN_ID, 55);

      expect(result.status).toBe("COMPLETED");
    });

    it("debe marcar como NOT_EFFECTIVE cuando no hay mejora", async () => {
      prismaRemedialPlan.findUnique.mockResolvedValue({
        ...mockRemedialPlan,
        status: "COMPLETED",
        preScore: 45.0,
      });
      prismaRemedialPlan.update.mockResolvedValue({
        ...mockRemedialPlan,
        status: "NOT_EFFECTIVE",
        postScore: 40.0,
      });

      const result = await service.evaluate(MOCK_PLAN_ID, 40);

      expect(result.status).toBe("NOT_EFFECTIVE");
    });

    it("debe lanzar NotFoundException si el plan no existe", async () => {
      prismaRemedialPlan.findUnique.mockResolvedValue(null);

      await expect(service.evaluate("nonexistent", 60)).rejects.toThrow(NotFoundException);
    });

    it("debe lanzar BadRequestException si el plan no está COMPLETED", async () => {
      prismaRemedialPlan.findUnique.mockResolvedValue({
        ...mockRemedialPlan,
        status: "PENDING",
      });

      await expect(service.evaluate(MOCK_PLAN_ID, 60)).rejects.toThrow(BadRequestException);
    });
  });

  describe("detectAndSuggest", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("debe detectar estudiantes con bajo rendimiento y sugerir planes", async () => {
      prismaCourse.findUnique.mockResolvedValue({
        ...mockCourse,
        enrollments: [mockEnrollment],
      });
      prismaAssessment.findMany.mockResolvedValue([
        {
          id: "assessment-001",
          courseId: MOCK_COURSE_ID,
          status: "GRADED",
          subject: { id: MOCK_SUBJECT_ID, name: "Lenguaje" },
          questions: [
            {
              questionId: "question-001",
              question: {
                learningObjective: mockLearningObjective,
              },
            },
          ],
          attempts: [
            {
              student: { id: MOCK_STUDENT_ID },
              answers: [
                { questionId: "question-001", isCorrect: false },
              ],
            },
          ],
        },
      ]);
      prismaLearningObjective.findUnique.mockResolvedValue(mockLearningObjective);
      prismaRemedialPlan.findFirst.mockResolvedValue(null);
      prismaLearningResource.findMany.mockResolvedValue([]);

      const result = await service.detectAndSuggest(MOCK_COURSE_ID);

      expect(result.courseId).toBe(MOCK_COURSE_ID);
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions[0].studentId).toBe(MOCK_STUDENT_ID);
      expect(result.suggestions[0].existingPlan).toBe(false);
    });

    it("debe marcar existingPlan true si ya existe un plan", async () => {
      prismaCourse.findUnique.mockResolvedValue({
        ...mockCourse,
        enrollments: [mockEnrollment],
      });
      prismaAssessment.findMany.mockResolvedValue([
        {
          id: "assessment-001",
          courseId: MOCK_COURSE_ID,
          status: "GRADED",
          subject: { id: MOCK_SUBJECT_ID, name: "Lenguaje" },
          questions: [{ questionId: "question-001", question: { learningObjective: mockLearningObjective } }],
          attempts: [
            {
              student: { id: MOCK_STUDENT_ID },
              answers: [{ questionId: "question-001", isCorrect: false }],
            },
          ],
        },
      ]);
      prismaLearningObjective.findUnique.mockResolvedValue(mockLearningObjective);
      prismaRemedialPlan.findFirst.mockResolvedValue(mockRemedialPlan);
      prismaLearningResource.findMany.mockResolvedValue([]);

      const result = await service.detectAndSuggest(MOCK_COURSE_ID);

      expect(result.suggestions[0].existingPlan).toBe(true);
    });

    it("debe lanzar NotFoundException si el curso no existe", async () => {
      prismaCourse.findUnique.mockResolvedValue(null);

      await expect(service.detectAndSuggest("nonexistent")).rejects.toThrow(NotFoundException);
    });

    it("debe asignar severidad CRITICAL cuando achievement < 30%", async () => {
      prismaCourse.findUnique.mockResolvedValue({
        ...mockCourse,
        enrollments: [mockEnrollment],
      });
      prismaAssessment.findMany.mockResolvedValue([
        {
          id: "assessment-001",
          courseId: MOCK_COURSE_ID,
          status: "GRADED",
          subject: { id: MOCK_SUBJECT_ID, name: "Lenguaje" },
          questions: [{ questionId: "question-001", question: { learningObjective: mockLearningObjective } }],
          attempts: [
            {
              student: { id: MOCK_STUDENT_ID },
              answers: [
                { questionId: "question-001", isCorrect: false },
              ],
            },
          ],
        },
      ]);
      prismaLearningObjective.findUnique.mockResolvedValue(mockLearningObjective);
      prismaRemedialPlan.findFirst.mockResolvedValue(null);
      prismaLearningResource.findMany.mockResolvedValue([]);

      const result = await service.detectAndSuggest(MOCK_COURSE_ID);

      expect(result.suggestions[0].severity).toBe("CRITICAL");
      expect(result.suggestions[0].achievement).toBeLessThan(30);
    });

    it("debe retornar sin sugerencias si nadie está bajo el threshold", async () => {
      prismaCourse.findUnique.mockResolvedValue({
        ...mockCourse,
        enrollments: [mockEnrollment],
      });
      prismaAssessment.findMany.mockResolvedValue([
        {
          id: "assessment-001",
          courseId: MOCK_COURSE_ID,
          status: "GRADED",
          subject: { id: MOCK_SUBJECT_ID, name: "Lenguaje" },
          questions: [{ questionId: "question-001", question: { learningObjective: mockLearningObjective } }],
          attempts: [
            {
              student: { id: MOCK_STUDENT_ID },
              answers: [{ questionId: "question-001", isCorrect: true }],
            },
          ],
        },
      ]);
      prismaLearningResource.findMany.mockResolvedValue([]);

      const result = await service.detectAndSuggest(MOCK_COURSE_ID, MOCK_SUBJECT_ID);

      expect(result.suggestions).toHaveLength(0);
      expect(result.breachCount).toBe(0);
    });

    it("debe incluir recursos sugeridos cuando existen", async () => {
      prismaCourse.findUnique.mockResolvedValue({
        ...mockCourse,
        enrollments: [mockEnrollment],
      });
      prismaAssessment.findMany.mockResolvedValue([
        {
          id: "assessment-001",
          courseId: MOCK_COURSE_ID,
          status: "GRADED",
          subject: { id: MOCK_SUBJECT_ID, name: "Lenguaje" },
          questions: [{ questionId: "question-001", question: { learningObjective: mockLearningObjective } }],
          attempts: [
            {
              student: { id: MOCK_STUDENT_ID },
              answers: [{ questionId: "question-001", isCorrect: false }],
            },
          ],
        },
      ]);
      prismaLearningObjective.findUnique.mockResolvedValue(mockLearningObjective);
      prismaRemedialPlan.findFirst.mockResolvedValue(null);
      prismaLearningResource.findMany.mockResolvedValue([
        {
          id: "resource-001",
          title: "Guía de comprensión lectora",
          type: "GUIDE",
          learningObjectiveId: MOCK_OA_ID,
          subject: { name: "Lenguaje" },
          guide: { guideType: "PRACTICE" },
        },
      ]);

      const result = await service.detectAndSuggest(MOCK_COURSE_ID);

      expect(result.suggestions[0].suggestedResources).toHaveLength(1);
      expect(result.suggestions[0].suggestedResources[0].title).toBe("Guía de comprensión lectora");
    });
  });

  describe("assign", () => {
    it("debe asignar un plan PENDING a IN_PROGRESS", async () => {
      prismaRemedialPlan.findUnique.mockResolvedValue({
        ...mockRemedialPlan,
        status: "PENDING",
      });
      prismaRemedialPlan.update.mockResolvedValue({
        ...mockRemedialPlan,
        status: "IN_PROGRESS",
      });

      const result = await service.assign(MOCK_PLAN_ID);

      expect(result.status).toBe("IN_PROGRESS");
    });

    it("debe lanzar BadRequestException si no está en PENDING", async () => {
      prismaRemedialPlan.findUnique.mockResolvedValue({
        ...mockRemedialPlan,
        status: "IN_PROGRESS",
      });

      await expect(service.assign(MOCK_PLAN_ID)).rejects.toThrow(BadRequestException);
    });
  });

  describe("findAll", () => {
    it("debe retornar todos los planes con filtro por curso", async () => {
      prismaRemedialPlan.findMany.mockResolvedValue([mockRemedialPlan]);

      const result = await service.findAll(MOCK_COURSE_ID);

      expect(result).toHaveLength(1);
      expect(prismaRemedialPlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { courseId: MOCK_COURSE_ID },
        }),
      );
    });

    it("debe filtrar por curso y estado", async () => {
      prismaRemedialPlan.findMany.mockResolvedValue([mockRemedialPlan]);

      await service.findAll(MOCK_COURSE_ID, "PENDING");

      expect(prismaRemedialPlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { courseId: MOCK_COURSE_ID, status: "PENDING" },
        }),
      );
    });
  });

  describe("getCourseRemedialSummary", () => {
    it("debe retornar resumen de planes del curso", async () => {
      prismaRemedialPlan.findMany.mockResolvedValue([mockRemedialPlan]);

      const result = await service.getCourseRemedialSummary(MOCK_COURSE_ID);

      expect(result.courseId).toBe(MOCK_COURSE_ID);
      expect(result.totalPlans).toBe(1);
      expect(result.byStatus).toBeDefined();
      expect(result.effectivenessRate).toBe(0);
    });

    it("debe calcular la tasa de efectividad correctamente", async () => {
      prismaRemedialPlan.findMany.mockResolvedValue([
        { ...mockRemedialPlan, status: "EFFECTIVE" },
        { ...mockRemedialPlan, id: "plan-002", status: "EFFECTIVE" },
        { ...mockRemedialPlan, id: "plan-003", status: "NOT_EFFECTIVE" },
        { ...mockRemedialPlan, id: "plan-004", status: "PENDING" },
      ]);

      const result = await service.getCourseRemedialSummary(MOCK_COURSE_ID);

      expect(result.totalPlans).toBe(4);
      expect(result.effectivenessRate).toBe(50.0);
    });
  });
});
