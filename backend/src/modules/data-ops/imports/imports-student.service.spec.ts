import { jest } from "@jest/globals";
import { Test, TestingModule } from "@nestjs/testing";
import { ImportsStudentService } from "./imports-student.service.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { ImportsParserService } from "./imports-parser.service.js";

function mockConfig() {
  return { bcryptRounds: 4 } as any;
}

describe("ImportsStudentService", () => {
  let service: ImportsStudentService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      user: { findUnique: jest.fn<() => any>().mockResolvedValue(null) },
      academicYear: { findFirst: jest.fn<() => any>() },
      course: {
        findMany: jest.fn<() => any>().mockResolvedValue([]),
        upsert: jest.fn<() => any>(),
      },
      student: { create: jest.fn<() => any>(), update: jest.fn<() => any>(), deleteMany: jest.fn<() => any>() },
      enrollment: { create: jest.fn<() => any>(), findUnique: jest.fn<() => any>() },
      $transaction: jest.fn((cb: any) => cb(mockPrisma)),
    };

    const parser = new ImportsParserService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportsStudentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ImportsParserService, useValue: parser },
        { provide: "APP_CONFIG", useValue: mockConfig() },
      ],
    }).compile();

    service = module.get(ImportsStudentService);
  });

  // ══════════════════════════════════════════════════════
  //  NAME SPLITTING
  // ══════════════════════════════════════════════════════

  describe("splitName", () => {
    it("returns empty last name for single word", () => {
      const result = (service as any).splitName("Alexis");
      expect(result.firstName).toBe("Alexis");
      expect(result.lastName).toBe("");
    });

    it("splits two words into firstName + lastName", () => {
      const result = (service as any).splitName("Alexis Sánchez");
      expect(result.firstName).toBe("Alexis");
      expect(result.lastName).toBe("Sánchez");
    });

    it("splits three words (1 first, 2 last)", () => {
      const result = (service as any).splitName("Alexis Sánchez Pérez");
      expect(result.firstName).toBe("Alexis");
      expect(result.lastName).toBe("Sánchez Pérez");
    });

    it("splits four+ words (2 first, 2 last)", () => {
      const result = (service as any).splitName("Juan Pablo Sánchez Pérez");
      expect(result.firstName).toBe("Juan Pablo");
      expect(result.lastName).toBe("Sánchez Pérez");
    });

    it("handles extra whitespace", () => {
      const result = (service as any).splitName("  Alexis   Sánchez  ");
      expect(result.firstName).toBe("Alexis");
      expect(result.lastName).toBe("Sánchez");
    });
  });

  // ══════════════════════════════════════════════════════
  //  COURSE LABEL NORMALIZATION
  // ══════════════════════════════════════════════════════

  describe("normalizeCourseLabel", () => {
    it("lowercases and normalizes tildes", () => {
      expect((service as any).normalizeCourseLabel("Básico")).toBe("basico");
    });

    it('converts "basica/basicos/basicas" to "basico"', () => {
      expect((service as any).normalizeCourseLabel("1° basica")).toBe("1° basico");
      expect((service as any).normalizeCourseLabel("2° basicos")).toBe("2° basico");
      expect((service as any).normalizeCourseLabel("3° basicas")).toBe("3° basico");
    });

    it('removes "curso" word', () => {
      expect((service as any).normalizeCourseLabel("Curso 4° Básico")).toBe("4° basico");
    });

    it("preserves section letter", () => {
      expect((service as any).normalizeCourseLabel("3° A")).toBe("3° a");
    });
  });

  // ══════════════════════════════════════════════════════
  //  GRADE LEVEL DETECTION
  // ══════════════════════════════════════════════════════

  describe("getCourseGradeLevel", () => {
    it("detects numeric: 1° básico → 1", () => {
      expect((service as any).getCourseGradeLevel("1° Básico")).toBe(1);
    });

    it("detects numeric: 3° Básico A → 3", () => {
      expect((service as any).getCourseGradeLevel("3° Básico A")).toBe(3);
    });

    it("detects numeric: 8° Básico → 8", () => {
      expect((service as any).getCourseGradeLevel("8° Básico")).toBe(8);
    });

    it("detects written: Primero Básico → 1", () => {
      expect((service as any).getCourseGradeLevel("Primero Básico")).toBe(1);
    });

    it("detects medio: 1° Medio → 9", () => {
      expect((service as any).getCourseGradeLevel("1° Medio")).toBe(9);
    });

    it("returns null for unrecognized", () => {
      expect((service as any).getCourseGradeLevel("Sala de Profesores")).toBeNull();
    });
  });

  // ══════════════════════════════════════════════════════
  //  SECTION DETECTION
  // ══════════════════════════════════════════════════════

  describe("getCourseSection", () => {
    it("detects '3° A' → A", () => {
      expect((service as any).getCourseSection("3° Básico A")).toBe("A");
    });

    it("detects '5° B' → B", () => {
      expect((service as any).getCourseSection("5° Básico B")).toBe("B");
    });

    it("returns null when no section", () => {
      expect((service as any).getCourseSection("3° Básico")).toBeNull();
      expect((service as any).getCourseSection("1° Básico")).toBeNull();
    });
  });

  // ══════════════════════════════════════════════════════
  //  COURSE MATCHING (mock DB)
  // ══════════════════════════════════════════════════════

  describe("findCourseByName", () => {
    it("returns error when no institutionId", async () => {
      const result = await service.findCourseByName("3° Básico", undefined);
      expect(result.course).toBeNull();
      expect(result.error).toContain("institucion");
    });

    it("returns error when no active academic year", async () => {
      mockPrisma.academicYear.findFirst.mockResolvedValue(null);
      const result = await service.findCourseByName("3° Básico", "inst-001");
      expect(result.course).toBeNull();
      expect(result.error).toContain("año academico");
    });

    it("returns pendingCourse when course not found, no section requested", async () => {
      mockPrisma.academicYear.findFirst.mockResolvedValue({ id: "year-001" });
      mockPrisma.course.findMany.mockResolvedValue([]);
      const result = await service.findCourseByName("3° Básico", "inst-001");
      expect(result.course).toBeNull();
      expect(result.pendingCourse).toBeDefined();
      expect(result.pendingCourse!.gradeLevel).toBe(3);
    });

    it("matches unsectioned course for 1° básico", async () => {
      mockPrisma.academicYear.findFirst.mockResolvedValue({ id: "year-001" });
      mockPrisma.course.findMany.mockResolvedValue([
        { id: "c1", institutionId: "inst-001", academicYearId: "year-001", name: "1° Básico", gradeLevel: 1, section: null },
      ]);
      const result = await service.findCourseByName("1° Básico", "inst-001");
      expect(result.course).not.toBeNull();
      expect(result.course!.id).toBe("c1");
      expect(result.course!.section).toBeNull();
    });

    it("matches sectioned course when section requested", async () => {
      mockPrisma.academicYear.findFirst.mockResolvedValue({ id: "year-001" });
      mockPrisma.course.findMany.mockResolvedValue([
        { id: "c1", institutionId: "inst-001", academicYearId: "year-001", name: "3° Básico A", gradeLevel: 3, section: "A" },
        { id: "c2", institutionId: "inst-001", academicYearId: "year-001", name: "3° Básico B", gradeLevel: 3, section: "B" },
      ]);
      const result = await service.findCourseByName("3° Básico B", "inst-001");
      expect(result.course).not.toBeNull();
      expect(result.course!.id).toBe("c2");
    });
  });
});
