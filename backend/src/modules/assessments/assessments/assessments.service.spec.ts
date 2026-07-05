import { jest } from "@jest/globals";
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { AssessmentsService } from "./assessments.service.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { CacheService } from "../../cache/cache.service.js";

const MOCK_ASSESSMENT_ID = "assessment-001";
const MOCK_COURSE_ID = "course-001";
const MOCK_SUBJECT_ID = "subject-001";
const MOCK_USER_ID = "user-001";
const MOCK_TEACHER_ID = "teacher-001";
const MOCK_PERIOD_ID = "period-001";

const mockCourse = {
  id: MOCK_COURSE_ID,
  name: "4° Básico A",
  gradeLevel: 4,
  academicYear: { isActive: true, year: 2026 },
};

const mockInactiveCourse = {
  ...mockCourse,
  academicYear: { isActive: false, year: 2024 },
};

const mockSubject = {
  id: MOCK_SUBJECT_ID,
  name: "Lenguaje",
};

const mockTeacher = {
  id: MOCK_TEACHER_ID,
  userId: "teacher-user-001",
  user: { id: "teacher-user-001", firstName: "María", lastName: "González", email: "teacher@cordillera.cl" },
};

const mockPeriod = {
  id: MOCK_PERIOD_ID,
  name: "Primer Trimestre",
  status: "OPEN",
};

const mockPeriodClosed = {
  ...mockPeriod,
  status: "CLOSED",
};

const mockAssessment = {
  id: MOCK_ASSESSMENT_ID,
  courseId: MOCK_COURSE_ID,
  subjectId: MOCK_SUBJECT_ID,
  teacherId: MOCK_TEACHER_ID,
  periodId: MOCK_PERIOD_ID,
  title: "Prueba de Lenguaje",
  description: "Evaluación de comprensión lectora",
  assessmentType: "PROCESO",
  deliveryMode: "ONLINE",
  status: "DRAFT",
  semester: 1,
  maxScore: 100,
  weight: 20,
  timeLimitMin: 60,
  startDate: new Date("2026-03-01"),
  endDate: new Date("2026-03-15"),
  allowRetake: false,
  shuffleQuestions: false,
  createdBy: MOCK_USER_ID,
  isActive: true,
  publishedAt: null,
  archivedAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  course: { id: MOCK_COURSE_ID, name: "4° Básico A", gradeLevel: 4, academicYear: { year: 2026 } },
  subject: { id: MOCK_SUBJECT_ID, name: "Lenguaje" },
  teacher: mockTeacher,
  period: mockPeriod,
  questions: [],
  _count: { attempts: 0, grades: 0, questions: 3 },
};

const mockQuestion = {
  id: "question-001",
  statement: "¿Cuál es la idea principal?",
  type: "MULTIPLE_CHOICE",
  points: 10,
  isActive: true,
  subjectId: MOCK_SUBJECT_ID,
};

describe("AssessmentsService", () => {
  let service: AssessmentsService;
  let prismaAssessment: Record<string, jest.Mock<(...args: any[]) => any>>;
  let prismaCourse: Record<string, jest.Mock<(...args: any[]) => any>>;
  let prismaSubject: Record<string, jest.Mock<(...args: any[]) => any>>;
  let prismaTeacher: Record<string, jest.Mock<(...args: any[]) => any>>;
  let prismaPeriod: Record<string, jest.Mock<(...args: any[]) => any>>;
  let prismaAssessmentQuestion: Record<string, jest.Mock<(...args: any[]) => any>>;
  let prismaQuestion: Record<string, jest.Mock<(...args: any[]) => any>>;
  let prismaUser: Record<string, jest.Mock<(...args: any[]) => any>>;

  const mockScopeUser = {
    id: MOCK_USER_ID,
    role: "SUPER_ADMIN" as const,
    isActive: true,
    deletedAt: null,
    institutionId: null,
    teacher: null,
    student: null,
  };

  beforeEach(async () => {
    prismaAssessment = {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    };
    prismaCourse = { findUnique: jest.fn() };
    prismaSubject = { findUnique: jest.fn() };
    prismaTeacher = {
      findFirst: jest.fn(),
    };
    prismaPeriod = { findUnique: jest.fn() };
    prismaAssessmentQuestion = {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    prismaQuestion = { findUnique: jest.fn() };
    prismaUser = { findUnique: jest.fn<() => any>().mockResolvedValue(mockScopeUser) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssessmentsService,
        {
          provide: PrismaService,
          useValue: {
            assessment: prismaAssessment,
            course: prismaCourse,
            subject: prismaSubject,
            teacher: prismaTeacher,
            period: prismaPeriod,
            assessmentQuestion: prismaAssessmentQuestion,
            question: prismaQuestion,
            user: prismaUser,
          },
        },
        {
          provide: CacheService,
          useValue: {
            getOrSet: jest.fn((_key: string, factory: () => unknown) => factory()),
            del: jest.fn<() => any>().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<AssessmentsService>(AssessmentsService);
  });

  describe("create", () => {
    const createDto = {
      courseId: MOCK_COURSE_ID,
      subjectId: MOCK_SUBJECT_ID,
      periodId: MOCK_PERIOD_ID,
      title: "Prueba de Lenguaje",
      description: "Evaluación de comprensión lectora",
      assessmentType: "PROCESO" as const,
      deliveryMode: "ONLINE" as const,
      semester: 1,
      maxScore: 100,
      weight: 20,
      timeLimitMin: 60,
      startDate: "2026-03-01",
      endDate: "2026-03-15",
      allowRetake: false,
      shuffleQuestions: false,
    };

    beforeEach(() => {
      prismaCourse.findUnique.mockResolvedValue(mockCourse);
      prismaSubject.findUnique.mockResolvedValue(mockSubject);
    });

    it("debe crear una evaluación exitosamente como profesor", async () => {
      prismaTeacher.findFirst.mockResolvedValue(mockTeacher);
      prismaAssessment.create.mockResolvedValue(mockAssessment);
      prismaAssessment.findUnique.mockResolvedValue(mockAssessment);

      const result = await service.create(createDto, "teacher-user-001", "TEACHER");

      expect(result).toBeDefined();
      expect(result.id).toBe(MOCK_ASSESSMENT_ID);
      expect(prismaAssessment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "DRAFT",
            title: "Prueba de Lenguaje",
            createdBy: "teacher-user-001",
          }),
        }),
      );
    });

    it("debe lanzar NotFoundException si el curso no existe", async () => {
      prismaCourse.findUnique.mockResolvedValue(null);

      await expect(
        service.create(createDto, MOCK_USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it("debe lanzar BadRequestException si el año académico está inactivo", async () => {
      prismaCourse.findUnique.mockResolvedValue(mockInactiveCourse);

      await expect(
        service.create(createDto, MOCK_USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it("debe lanzar NotFoundException si la asignatura no existe", async () => {
      prismaSubject.findUnique.mockResolvedValue(null);

      await expect(
        service.create(createDto, MOCK_USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it("debe lanzar BadRequestException si endDate es anterior a startDate", async () => {
      prismaTeacher.findFirst.mockResolvedValue(mockTeacher);

      await expect(
        service.create({ ...createDto, startDate: "2026-06-01", endDate: "2026-05-01" }, "teacher-user-001", "TEACHER"),
      ).rejects.toThrow(BadRequestException);
    });

    it("debe lanzar ForbiddenException si el profesor no tiene asignado el curso/asignatura", async () => {
      prismaTeacher.findFirst.mockResolvedValue(null);

      await expect(
        service.create(createDto, "other-teacher", "TEACHER"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("debe crear items cuando se incluyen en el DTO", async () => {
      prismaTeacher.findFirst.mockResolvedValue(mockTeacher);
      prismaAssessment.create.mockResolvedValue(mockAssessment);
      prismaAssessment.findUnique.mockResolvedValue({ ...mockAssessment, status: "DRAFT" });
      prismaAssessmentQuestion.findUnique.mockResolvedValue(null);
      prismaQuestion.findUnique.mockResolvedValue(mockQuestion);
      prismaAssessmentQuestion.create.mockResolvedValue({
        id: "aq-001",
        assessmentId: MOCK_ASSESSMENT_ID,
        questionId: "question-001",
        sortOrder: 0,
        points: 10,
        question: { id: "question-001", statement: "test", type: "MULTIPLE_CHOICE" },
      });

      const dtoWithItems = {
        ...createDto,
        items: [{ questionId: "question-001", sortOrder: 0, points: 10 }],
      };

      await service.create(dtoWithItems, "teacher-user-001", "TEACHER");

      expect(prismaAssessmentQuestion.create).toHaveBeenCalled();
    });

    it("debe asignar un profesor existente si admin crea sin asignación específica", async () => {
      prismaAssessment.create.mockResolvedValue(mockAssessment);
      prismaAssessment.findUnique.mockResolvedValue(mockAssessment);
      prismaTeacher.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockTeacher);

      await service.create(createDto, MOCK_USER_ID, "ADMIN");

      expect(prismaTeacher.findFirst).toHaveBeenCalledTimes(2);
    });
  });

  describe("findAll", () => {
    it("debe retornar lista paginada sin filtros", async () => {
      prismaAssessment.findMany.mockResolvedValue([mockAssessment]);
      prismaAssessment.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it("debe filtrar por courseId", async () => {
      prismaAssessment.findMany.mockResolvedValue([mockAssessment]);
      prismaAssessment.count.mockResolvedValue(1);

      await service.findAll({ courseId: MOCK_COURSE_ID });

      expect(prismaAssessment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { courseId: MOCK_COURSE_ID } }),
      );
    });

    it("debe filtrar por status", async () => {
      prismaAssessment.findMany.mockResolvedValue([{ ...mockAssessment, status: "ACTIVE" }]);
      prismaAssessment.count.mockResolvedValue(1);

      await service.findAll({ status: "ACTIVE" });

      expect(prismaAssessment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: "ACTIVE" } }),
      );
    });

    it("debe combinar múltiples filtros", async () => {
      prismaAssessment.findMany.mockResolvedValue([mockAssessment]);
      prismaAssessment.count.mockResolvedValue(1);

      await service.findAll({ courseId: MOCK_COURSE_ID, subjectId: MOCK_SUBJECT_ID, status: "DRAFT" });

      expect(prismaAssessment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { courseId: MOCK_COURSE_ID, subjectId: MOCK_SUBJECT_ID, status: "DRAFT" },
        }),
      );
    });

    it("debe aplicar paginación página 3", async () => {
      prismaAssessment.findMany.mockResolvedValue([]);
      prismaAssessment.count.mockResolvedValue(50);

      const result = await service.findAll({}, 3, 20);

      expect(prismaAssessment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 20 }),
      );
      expect(result.meta.page).toBe(3);
      expect(result.meta.hasPrevious).toBe(true);
    });
  });

  describe("findById", () => {
    it("debe retornar una evaluación con todas sus relaciones", async () => {
      prismaAssessment.findUnique.mockResolvedValue(mockAssessment);

      const result = await service.findById(MOCK_ASSESSMENT_ID);

      expect(result.id).toBe(MOCK_ASSESSMENT_ID);
      expect(result.title).toBe("Prueba de Lenguaje");
      expect(result.course).toBeDefined();
      expect(result.subject).toBeDefined();
      expect(result.teacher).toBeDefined();
    });

    it("debe lanzar NotFoundException si la evaluación no existe", async () => {
      prismaAssessment.findUnique.mockResolvedValue(null);

      await expect(service.findById("nonexistent")).rejects.toThrow(NotFoundException);
    });

    it("debe incluir preguntas con opciones en orden", async () => {
      const assessmentWithQuestions = {
        ...mockAssessment,
        questions: [
          {
            sortOrder: 0,
            question: {
              id: "q-1",
              statement: "Pregunta 1",
              type: "MULTIPLE_CHOICE",
              subject: { id: MOCK_SUBJECT_ID, name: "Lenguaje" },
              learningObjective: { id: "oa-1", code: "OA01", description: "Comprender" },
              axis: { id: "axis-1", name: "Lectura" },
              options: [
                { id: "opt-1", text: "Opción A", sortOrder: 0 },
                { id: "opt-2", text: "Opción B", sortOrder: 1 },
              ],
            },
          },
        ],
      };

      prismaAssessment.findUnique.mockResolvedValue(assessmentWithQuestions);

      const result = await service.findById(MOCK_ASSESSMENT_ID);

      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].question.options).toHaveLength(2);
    });

    it("debe incluir conteos de intentos y notas", async () => {
      prismaAssessment.findUnique.mockResolvedValue(mockAssessment);

      const result = await service.findById(MOCK_ASSESSMENT_ID);

      expect(result._count.attempts).toBe(0);
      expect(result._count.grades).toBe(0);
    });
  });

  describe("publish", () => {
    it("debe publicar una evaluación en DRAFT con preguntas", async () => {
      prismaAssessment.findUnique.mockResolvedValue(mockAssessment);
      prismaAssessment.update.mockResolvedValue({
        ...mockAssessment,
        status: "PUBLISHED",
        publishedAt: new Date(),
      });

      const result = await service.publish(MOCK_ASSESSMENT_ID);

      expect(result.status).toBe("PUBLISHED");
      expect(prismaAssessment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MOCK_ASSESSMENT_ID },
          data: expect.objectContaining({ status: "PUBLISHED", publishedAt: expect.any(Date) }),
        }),
      );
    });

    it("debe lanzar NotFoundException si la evaluación no existe", async () => {
      prismaAssessment.findUnique.mockResolvedValue(null);

      await expect(service.publish("nonexistent")).rejects.toThrow(NotFoundException);
    });

    it("debe lanzar BadRequestException si la transición es inválida", async () => {
      prismaAssessment.findUnique.mockResolvedValue({ ...mockAssessment, status: "ACTIVE" });

      await expect(service.publish(MOCK_ASSESSMENT_ID)).rejects.toThrow(BadRequestException);
    });

    it("debe lanzar BadRequestException si no hay preguntas", async () => {
      prismaAssessment.findUnique.mockResolvedValue({
        ...mockAssessment,
        _count: { questions: 0 },
        status: "DRAFT",
      });

      await expect(service.publish(MOCK_ASSESSMENT_ID)).rejects.toThrow(BadRequestException);
    });

    it("debe lanzar BadRequestException si es sumativa y no tiene periodo", async () => {
      prismaAssessment.findUnique.mockResolvedValue({
        ...mockAssessment,
        assessmentType: "CIERRE",
        periodId: null,
        _count: { questions: 3 },
        status: "DRAFT",
      });

      await expect(service.publish(MOCK_ASSESSMENT_ID)).rejects.toThrow(BadRequestException);
    });

    it("debe lanzar BadRequestException si no tiene startDate", async () => {
      prismaAssessment.findUnique.mockResolvedValue({
        ...mockAssessment,
        startDate: null,
        _count: { questions: 3 },
        status: "DRAFT",
      });

      await expect(service.publish(MOCK_ASSESSMENT_ID)).rejects.toThrow(BadRequestException);
    });
  });

  describe("activate", () => {
    it("debe activar una evaluación en estado PUBLICADO", async () => {
      prismaAssessment.findUnique.mockResolvedValue({
        ...mockAssessment,
        status: "PUBLISHED",
        _count: { questions: 3 },
      });
      prismaAssessment.update.mockResolvedValue({
        ...mockAssessment,
        status: "ACTIVE",
        startDate: new Date(),
      });

      const result = await service.activate(MOCK_ASSESSMENT_ID);

      expect(result.status).toBe("ACTIVE");
    });

    it("debe lanzar NotFoundException si la evaluación no existe", async () => {
      prismaAssessment.findUnique.mockResolvedValue(null);

      await expect(service.activate("nonexistent")).rejects.toThrow(NotFoundException);
    });

    it("debe lanzar BadRequestException si la transición es inválida", async () => {
      prismaAssessment.findUnique.mockResolvedValue({
        ...mockAssessment,
        status: "DRAFT",
        _count: { questions: 3 },
      });

      await expect(service.activate(MOCK_ASSESSMENT_ID)).rejects.toThrow(BadRequestException);
    });

    it("debe lanzar BadRequestException si no tiene preguntas", async () => {
      prismaAssessment.findUnique.mockResolvedValue({
        ...mockAssessment,
        status: "PUBLISHED",
        _count: { questions: 0 },
      });

      await expect(service.activate(MOCK_ASSESSMENT_ID)).rejects.toThrow(BadRequestException);
    });

    it("debe lanzar BadRequestException si maxScore es 0 o menor", async () => {
      prismaAssessment.findUnique.mockResolvedValue({
        ...mockAssessment,
        status: "PUBLISHED",
        maxScore: 0,
        _count: { questions: 3 },
      });

      await expect(service.activate(MOCK_ASSESSMENT_ID)).rejects.toThrow(BadRequestException);
    });

    it("debe lanzar BadRequestException si el periodo está cerrado", async () => {
      prismaAssessment.findUnique.mockResolvedValue({
        ...mockAssessment,
        status: "PUBLISHED",
        _count: { questions: 3 },
        periodId: MOCK_PERIOD_ID,
      });
      prismaPeriod.findUnique.mockResolvedValue(mockPeriodClosed);

      await expect(service.activate(MOCK_ASSESSMENT_ID)).rejects.toThrow(BadRequestException);
    });
  });

  describe("close", () => {
    it("debe cerrar una evaluación ACTIVA exitosamente", async () => {
      prismaAssessment.findUnique.mockResolvedValue({
        ...mockAssessment,
        status: "ACTIVE",
      });
      prismaAssessment.update.mockResolvedValue({
        ...mockAssessment,
        status: "CLOSED",
        closedAt: new Date(),
        endDate: new Date(),
      });

      const result = await service.close(MOCK_ASSESSMENT_ID);

      expect(result.status).toBe("CLOSED");
      expect(prismaAssessment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "CLOSED",
            closedAt: expect.any(Date),
            endDate: expect.any(Date),
          }),
        }),
      );
    });

    it("debe lanzar NotFoundException si la evaluación no existe", async () => {
      prismaAssessment.findUnique.mockResolvedValue(null);

      await expect(service.close("nonexistent")).rejects.toThrow(NotFoundException);
    });

    it("debe lanzar BadRequestException si la transición es inválida", async () => {
      prismaAssessment.findUnique.mockResolvedValue({
        ...mockAssessment,
        status: "DRAFT",
      });

      await expect(service.close(MOCK_ASSESSMENT_ID)).rejects.toThrow(BadRequestException);
    });
  });

  describe("softDelete", () => {
    it("debe archivar una evaluación sin intentos", async () => {
      prismaAssessment.findUnique.mockResolvedValue({
        ...mockAssessment,
        _count: { attempts: 0 },
      });
      prismaAssessment.update.mockResolvedValue({
        ...mockAssessment,
        status: "ARCHIVED",
        isActive: false,
        archivedAt: new Date(),
      });

      const result = await service.softDelete(MOCK_ASSESSMENT_ID);

      expect(result.status).toBe("ARCHIVED");
      expect(result.isActive).toBe(false);
    });

    it("debe lanzar NotFoundException si la evaluación no existe", async () => {
      prismaAssessment.findUnique.mockResolvedValue(null);

      await expect(service.softDelete("nonexistent")).rejects.toThrow(NotFoundException);
    });

    it("debe lanzar BadRequestException si tiene intentos y no está archivada", async () => {
      prismaAssessment.findUnique.mockResolvedValue({
        ...mockAssessment,
        status: "ACTIVE",
        _count: { attempts: 5 },
      });

      await expect(service.softDelete(MOCK_ASSESSMENT_ID)).rejects.toThrow(BadRequestException);
    });
  });

  describe("revertToDraft", () => {
    it("debe revertir a DRAFT una evaluación PUBLICADA sin intentos", async () => {
      prismaAssessment.findUnique.mockResolvedValue({
        ...mockAssessment,
        status: "PUBLISHED",
        _count: { attempts: 0 },
      });
      prismaAssessment.update.mockResolvedValue({
        ...mockAssessment,
        status: "DRAFT",
        publishedAt: null,
      });

      const result = await service.revertToDraft(MOCK_ASSESSMENT_ID);

      expect(result.status).toBe("DRAFT");
    });

    it("debe lanzar BadRequestException si no está en estado PUBLICADO", async () => {
      prismaAssessment.findUnique.mockResolvedValue({
        ...mockAssessment,
        status: "DRAFT",
        _count: { attempts: 0 },
      });

      await expect(service.revertToDraft(MOCK_ASSESSMENT_ID)).rejects.toThrow(BadRequestException);
    });

    it("debe lanzar BadRequestException si hay intentos registrados", async () => {
      prismaAssessment.findUnique.mockResolvedValue({
        ...mockAssessment,
        status: "PUBLISHED",
        _count: { attempts: 3 },
      });

      await expect(service.revertToDraft(MOCK_ASSESSMENT_ID)).rejects.toThrow(BadRequestException);
    });
  });
});
