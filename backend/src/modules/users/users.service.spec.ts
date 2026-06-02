import { jest } from "@jest/globals";
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, ConflictException, BadRequestException } from "@nestjs/common";
import { UsersService } from "./users.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditLogsService } from "../audit-logs/audit-logs.service.js";
import { mockConfig } from "../auth/__test-helpers.js";

const MOCK_INSTITUTION_ID = "inst-001";
const MOCK_USER_ID = "user-001";
const MOCK_EMAIL = "test@cordillera.cl";
const MOCK_PASSWORD = "ValidPass123!";
const MOCK_HASH = "$2a$04$mockhash";
const MOCK_COURSE_ID = "course-001";
const MOCK_NEW_COURSE_ID = "course-002";

const mockUser = {
  id: MOCK_USER_ID,
  email: MOCK_EMAIL,
  firstName: "Juan",
  lastName: "Pérez",
  role: "STUDENT",
  isActive: true,
  mustChangePassword: true,
  institutionId: MOCK_INSTITUTION_ID,
  lastLoginAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  student: {
    id: "student-001",
    enrollments: [
      {
        id: "enrollment-001",
        courseId: MOCK_COURSE_ID,
        course: { name: "4° A" },
      },
    ],
  },
  teacher: null,
  passwordHash: MOCK_HASH,
  deletedAt: null,
};

const mockTeacherUser = {
  ...mockUser,
  id: "teacher-user-001",
  email: "profesor@cordillera.cl",
  firstName: "María",
  lastName: "González",
  role: "TEACHER",
  student: null,
  teacher: { id: "teacher-001" },
};

describe("UsersService", () => {
  let service: UsersService;
  let prismaUser: Record<string, jest.Mock<(...args: any[]) => any>>;
  let prismaTeacher: Record<string, jest.Mock<(...args: any[]) => any>>;
  let prismaCourse: Record<string, jest.Mock<(...args: any[]) => any>>;
  let prismaStudent: Record<string, jest.Mock<(...args: any[]) => any>>;
  let prismaEnrollment: Record<string, jest.Mock<(...args: any[]) => any>>;
  let auditLogMock: { log: jest.Mock<(...args: any[]) => any> };

  beforeEach(async () => {
    prismaUser = {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    };
    prismaTeacher = {
      create: jest.fn(),
    };
    prismaCourse = {
      findUnique: jest.fn<(...args: any[]) => any>().mockImplementation(({ where }: any) => Promise.resolve({
        id: where.id,
        institutionId: MOCK_INSTITUTION_ID,
        isActive: true,
      })),
    };
    prismaStudent = {
      create: jest.fn<(...args: any[]) => any>().mockResolvedValue({ id: "student-002", userId: "user-002" }),
      update: jest.fn<(...args: any[]) => any>().mockResolvedValue({ id: "student-001" }),
    };
    prismaEnrollment = {
      create: jest.fn<(...args: any[]) => any>().mockResolvedValue({ id: "enrollment-001" }),
      updateMany: jest.fn<(...args: any[]) => any>().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn<(...args: any[]) => any>().mockResolvedValue(null),
      update: jest.fn<(...args: any[]) => any>().mockResolvedValue({ id: "enrollment-001" }),
    };
    auditLogMock = { log: jest.fn<(...args: any[]) => any>().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            user: prismaUser,
            teacher: prismaTeacher,
            course: prismaCourse,
            student: prismaStudent,
            enrollment: prismaEnrollment,
            $transaction: jest.fn(async (callback: any) =>
              callback({
                user: prismaUser,
                teacher: prismaTeacher,
                student: prismaStudent,
                enrollment: prismaEnrollment,
              }),
            ),
          },
        },
        { provide: AuditLogsService, useValue: auditLogMock },
        { provide: "APP_CONFIG", useValue: mockConfig() },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe("create", () => {
    const createDto = {
      email: "nuevo@cordillera.cl",
      firstName: "Carlos",
      lastName: "López",
      role: "STUDENT" as const,
      temporaryPassword: "ValidPass123!",
      institutionId: MOCK_INSTITUTION_ID,
      courseId: MOCK_COURSE_ID,
    };

    const createdUser = {
      ...mockUser,
      id: "user-002",
      email: "nuevo@cordillera.cl",
      firstName: "Carlos",
      lastName: "López",
      role: "STUDENT",
      mustChangePassword: true,
      institutionId: MOCK_INSTITUTION_ID,
    };

    it("debe crear un usuario correctamente", async () => {
      prismaUser.findUnique.mockResolvedValueOnce(null);
      prismaUser.create.mockResolvedValueOnce(createdUser);
      prismaUser.findUnique.mockResolvedValueOnce(createdUser);

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.email).toBe("nuevo@cordillera.cl");
      expect(result.firstName).toBe("Carlos");
      expect(result.role).toBe("STUDENT");
      expect(prismaUser.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: "nuevo@cordillera.cl",
            role: "STUDENT",
            mustChangePassword: true,
          }),
        }),
      );
    });

    it("debe normalizar el email a minúsculas", async () => {
      prismaUser.findUnique.mockResolvedValueOnce(null);
      prismaUser.create.mockResolvedValueOnce(createdUser);
      prismaUser.findUnique.mockResolvedValueOnce(createdUser);

      await service.create({ ...createDto, email: "Carlos@Cordillera.CL" });

      expect(prismaUser.findUnique).toHaveBeenCalledWith({
        where: { email: "carlos@cordillera.cl" },
      });
    });

    it("debe lanzar ConflictException si el email ya existe", async () => {
      prismaUser.findUnique.mockResolvedValueOnce(mockUser);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
      expect(prismaUser.create).not.toHaveBeenCalled();
    });

    it("debe lanzar BadRequestException si la contraseña no cumple la política", async () => {
      prismaUser.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.create({ ...createDto, temporaryPassword: "corta" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("debe crear un registro de profesor al crear un TEACHER", async () => {
      const teacherDto = { ...createDto, email: "teacher@cordillera.cl", role: "TEACHER" as const };
      const createdTeacher = { ...createdUser, id: "teacher-user-002", email: "teacher@cordillera.cl", role: "TEACHER" };

      prismaUser.findUnique.mockResolvedValueOnce(null);
      prismaUser.create.mockResolvedValueOnce(createdTeacher);
      prismaTeacher.create.mockResolvedValueOnce({ id: "teacher-002", userId: "teacher-user-002" });
      prismaUser.findUnique.mockResolvedValueOnce(createdTeacher);

      await service.create(teacherDto);

      expect(prismaTeacher.create).toHaveBeenCalledWith({
        data: { userId: "teacher-user-002" },
      });
    });

    it("no debe crear registro de profesor para roles que no son TEACHER", async () => {
      prismaUser.findUnique.mockResolvedValueOnce(null);
      prismaUser.create.mockResolvedValueOnce(createdUser);
      prismaUser.findUnique.mockResolvedValueOnce(createdUser);

      await service.create(createDto);

      expect(prismaTeacher.create).not.toHaveBeenCalled();
    });

    it("debe registrar auditoría al crear usuario", async () => {
      prismaUser.findUnique.mockResolvedValueOnce(null);
      prismaUser.create.mockResolvedValueOnce(createdUser);
      prismaUser.findUnique.mockResolvedValueOnce(createdUser);

      await service.create(createDto);

      expect(auditLogMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "USER_CREATED",
          entityType: "user",
        }),
      );
    });
  });

  describe("findAll", () => {
    it("debe retornar usuarios paginados sin filtro de rol", async () => {
      prismaUser.findMany.mockResolvedValue([mockUser, mockTeacherUser]);
      prismaUser.count.mockResolvedValue(2);

      const result = await service.findAll(1, 20);

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.totalPages).toBe(1);
      expect(prismaUser.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null },
          skip: 0,
          take: 20,
        }),
      );
    });

    it("debe filtrar por rol cuando se especifica", async () => {
      prismaUser.findMany.mockResolvedValue([mockTeacherUser]);
      prismaUser.count.mockResolvedValue(1);

      const result = await service.findAll(1, 20, "TEACHER");

      expect(result.data).toHaveLength(1);
      expect(prismaUser.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: "TEACHER", deletedAt: null },
        }),
      );
    });

    it("debe aplicar paginación correctamente en página 2", async () => {
      prismaUser.findMany.mockResolvedValue([mockTeacherUser]);
      prismaUser.count.mockResolvedValue(50);

      const result = await service.findAll(2, 20);

      expect(result.meta.page).toBe(2);
      expect(result.meta.hasNext).toBe(true);
      expect(result.meta.hasPrevious).toBe(true);
      expect(prismaUser.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20 }),
      );
    });

    it("debe mapear studentId y teacherId correctamente", async () => {
      prismaUser.findMany.mockResolvedValue([mockUser, mockTeacherUser]);
      prismaUser.count.mockResolvedValue(2);

      const result = await service.findAll();

      expect(result.data[0]).toEqual(
        expect.objectContaining({ studentId: "student-001", teacherId: null }),
      );
      expect(result.data[1]).toEqual(
        expect.objectContaining({ studentId: null, teacherId: "teacher-001" }),
      );
    });

    it("debe retornar lista vacía cuando no hay usuarios", async () => {
      prismaUser.findMany.mockResolvedValue([]);
      prismaUser.count.mockResolvedValue(0);

      const result = await service.findAll();

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.hasNext).toBe(false);
    });
  });

  describe("findById", () => {
    it("debe retornar usuario por id", async () => {
      prismaUser.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById(MOCK_USER_ID);

      expect(result.id).toBe(MOCK_USER_ID);
      expect(result.email).toBe(MOCK_EMAIL);
      expect(result.studentId).toBe("student-001");
      expect(result.teacherId).toBeNull();
    });

    it("debe lanzar NotFoundException si el usuario no existe", async () => {
      prismaUser.findUnique.mockResolvedValue(null);

      await expect(service.findById("nonexistent")).rejects.toThrow(NotFoundException);
    });

    it("debe lanzar NotFoundException si el usuario está inactivo", async () => {
      prismaUser.findUnique.mockResolvedValue({ ...mockUser, isActive: false });

      await expect(service.findById(MOCK_USER_ID)).rejects.toThrow(NotFoundException);
    });

    it("debe excluir los campos student y teacher del resultado", async () => {
      prismaUser.findUnique.mockResolvedValue({ ...mockUser, student: { id: "st-1" }, teacher: null });

      const result = await service.findById(MOCK_USER_ID);

      expect(result.student).toBeUndefined();
      expect(result.teacher).toBeUndefined();
    });

    it("debe retornar studentId y teacherId como null cuando no existen", async () => {
      const userWithoutRelations = { ...mockUser, student: null, teacher: null };
      prismaUser.findUnique.mockResolvedValue(userWithoutRelations);

      const result = await service.findById(MOCK_USER_ID);

      expect(result.studentId).toBeNull();
      expect(result.teacherId).toBeNull();
    });
  });

  describe("update", () => {
    const updateDto = {
      firstName: "Juan Carlos",
      lastName: "Pérez Actualizado",
      isActive: true,
    };

    it("debe actualizar campos del usuario correctamente", async () => {
      const updatedUser = { ...mockUser, firstName: "Juan Carlos", lastName: "Pérez Actualizado" };
      prismaUser.findUnique.mockResolvedValueOnce(mockUser);
      prismaUser.update.mockResolvedValueOnce(updatedUser);
      prismaUser.findUnique.mockResolvedValueOnce(updatedUser);

      const result = await service.update(MOCK_USER_ID, updateDto);

      expect(result.firstName).toBe("Juan Carlos");
      expect(result.lastName).toBe("Pérez Actualizado");
      expect(prismaUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MOCK_USER_ID },
          data: expect.objectContaining({ firstName: "Juan Carlos", lastName: "Pérez Actualizado" }),
        }),
      );
    });

    it("debe lanzar NotFoundException si el usuario no existe", async () => {
      prismaUser.findUnique.mockResolvedValue(null);

      await expect(service.update("nonexistent", updateDto)).rejects.toThrow(NotFoundException);
    });

    it("debe permitir actualizar solo algunos campos", async () => {
      const updatedUser = { ...mockUser, role: "TEACHER" };
      prismaUser.findUnique.mockResolvedValueOnce(mockUser);
      prismaUser.update.mockResolvedValueOnce(updatedUser);
      prismaUser.findUnique.mockResolvedValueOnce(updatedUser);

      await service.update(MOCK_USER_ID, { role: "TEACHER" });

      expect(prismaUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: "TEACHER" }),
        }),
      );
    });

    it("debe registrar auditoría al actualizar", async () => {
      prismaUser.findUnique.mockResolvedValueOnce(mockUser);
      prismaUser.update.mockResolvedValueOnce(mockUser);
      prismaUser.findUnique.mockResolvedValueOnce(mockUser);

      await service.update(MOCK_USER_ID, updateDto);

      expect(auditLogMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "USER_UPDATED",
          entityType: "user",
          entityId: MOCK_USER_ID,
        }),
      );
    });

    it("debe aplicar trim a firstName y lastName", async () => {
      const updatedUser = { ...mockUser, firstName: "  Juan  " };
      prismaUser.findUnique.mockResolvedValueOnce(mockUser);
      prismaUser.update.mockResolvedValueOnce(updatedUser);
      prismaUser.findUnique.mockResolvedValueOnce(updatedUser);

      await service.update(MOCK_USER_ID, { firstName: "  Juan  " });

      expect(prismaUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ firstName: "Juan" }),
        }),
      );
    });

    it("debe transferir el curso activo de un estudiante al actualizar courseId", async () => {
      prismaUser.findUnique.mockResolvedValueOnce(mockUser);
      prismaUser.update.mockResolvedValueOnce({ ...mockUser, role: "STUDENT" });
      prismaUser.findUnique.mockResolvedValueOnce({
        ...mockUser,
        student: {
          ...mockUser.student,
          enrollments: [{ id: "enrollment-002", courseId: MOCK_NEW_COURSE_ID, course: { name: "4° B" } }],
        },
      });

      await service.update(MOCK_USER_ID, { courseId: MOCK_NEW_COURSE_ID });

      expect(prismaEnrollment.updateMany).toHaveBeenCalledWith({
        where: { studentId: "student-001", isActive: true },
        data: { isActive: false },
      });
      expect(prismaEnrollment.create).toHaveBeenCalledWith({
        data: { studentId: "student-001", courseId: MOCK_NEW_COURSE_ID },
      });
    });
  });

  describe("softDelete", () => {
    it("debe desactivar el usuario y modificar el email", async () => {
      prismaUser.findUnique.mockResolvedValueOnce(mockUser);
      prismaUser.update.mockResolvedValueOnce({
        ...mockUser,
        isActive: false,
        deletedAt: new Date(),
        email: `${mockUser.email}__deleted_1234567890`,
      });

      await service.softDelete(MOCK_USER_ID);

      expect(prismaUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MOCK_USER_ID },
          data: expect.objectContaining({
            isActive: false,
            deletedAt: expect.any(Date),
            email: expect.stringContaining("__deleted_"),
          }),
        }),
      );
    });

    it("debe lanzar NotFoundException si el usuario no existe", async () => {
      prismaUser.findUnique.mockResolvedValue(null);

      await expect(service.softDelete("nonexistent")).rejects.toThrow(NotFoundException);
    });

    it("debe registrar auditoría al eliminar", async () => {
      prismaUser.findUnique.mockResolvedValueOnce(mockUser);
      prismaUser.update.mockResolvedValueOnce({ ...mockUser, isActive: false, deletedAt: new Date() });

      await service.softDelete(MOCK_USER_ID);

      expect(auditLogMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "USER_DELETED",
          entityType: "user",
          entityId: MOCK_USER_ID,
        }),
      );
    });

    it("debe marcar la cuenta como inactiva", async () => {
      prismaUser.findUnique.mockResolvedValueOnce(mockUser);
      prismaUser.update.mockResolvedValueOnce({
        ...mockUser,
        isActive: false,
        deletedAt: new Date(),
      });

      await service.softDelete(MOCK_USER_ID);

      const updateCall = prismaUser.update.mock.calls[0][0];
      expect(updateCall.data.isActive).toBe(false);
    });

    it("debe establecer deletedAt con fecha actual", async () => {
      const before = Date.now();
      prismaUser.findUnique.mockResolvedValueOnce(mockUser);
      prismaUser.update.mockResolvedValueOnce({
        ...mockUser,
        isActive: false,
        deletedAt: new Date(),
      });

      await service.softDelete(MOCK_USER_ID);

      const updateCall = prismaUser.update.mock.calls[0][0];
      expect(updateCall.data.deletedAt.getTime()).toBeGreaterThanOrEqual(before);
    });
  });
});
