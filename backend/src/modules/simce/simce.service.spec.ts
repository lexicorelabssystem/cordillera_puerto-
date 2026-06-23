import { jest } from "@jest/globals";
import { Test, TestingModule } from "@nestjs/testing";
import { SimceService, VALID_STATUS_TRANSITIONS } from "./simce.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { DocumentAssessmentParserService } from "../assessments/import/document-assessment-parser.service.js";

describe("SimceService", () => {
  let service: SimceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SimceService,
        { provide: PrismaService, useValue: {} },
        {
          provide: DocumentAssessmentParserService,
          useValue: { parseFromPdf: jest.fn(), parseFromFile: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(SimceService);
  });

  // ══════════════════════════════════════════════════════
  //  STATUS TRANSITIONS
  // ══════════════════════════════════════════════════════

  describe("status transitions", () => {
    it("DRAFT → KEY_PENDING is allowed", () => {
      expect(VALID_STATUS_TRANSITIONS["DRAFT"]).toContain("KEY_PENDING");
    });

    it("KEY_PENDING → READY_TO_CORRECT is allowed", () => {
      expect(VALID_STATUS_TRANSITIONS["KEY_PENDING"]).toContain("READY_TO_CORRECT");
    });

    it("KEY_PENDING → DRAFT is allowed (rollback)", () => {
      expect(VALID_STATUS_TRANSITIONS["KEY_PENDING"]).toContain("DRAFT");
    });

    it("READY_TO_CORRECT → CORRECTED is allowed", () => {
      expect(VALID_STATUS_TRANSITIONS["READY_TO_CORRECT"]).toContain("CORRECTED");
    });

    it("CORRECTED → READY_TO_CORRECT is allowed (reopen)", () => {
      expect(VALID_STATUS_TRANSITIONS["CORRECTED"]).toContain("READY_TO_CORRECT");
    });

    it("DRAFT → CORRECTED is NOT allowed (must go through KEY_PENDING)", () => {
      expect(VALID_STATUS_TRANSITIONS["DRAFT"]).not.toContain("CORRECTED");
    });
  });

  // ══════════════════════════════════════════════════════
  //  PERFORMANCE LEVELS
  // ══════════════════════════════════════════════════════

  describe("getSimcePerformanceLevel", () => {
    it("≥ 75% → Adecuado", () => {
      expect((service as any).getSimcePerformanceLevel(75)).toBe("Adecuado");
      expect((service as any).getSimcePerformanceLevel(100)).toBe("Adecuado");
    });

    it("50-74% → Elemental", () => {
      expect((service as any).getSimcePerformanceLevel(50)).toBe("Elemental");
      expect((service as any).getSimcePerformanceLevel(74)).toBe("Elemental");
    });

    it("< 50% → Inicial", () => {
      expect((service as any).getSimcePerformanceLevel(0)).toBe("Inicial");
      expect((service as any).getSimcePerformanceLevel(49)).toBe("Inicial");
    });
  });

  // ══════════════════════════════════════════════════════
  //  SCHOOL GRADE CALCULATION
  // ══════════════════════════════════════════════════════

  describe("calculateSchoolGrade", () => {
    it("returns 1.0 for 0%", () => {
      expect((service as any).calculateSchoolGrade(0)).toBeCloseTo(1.0, 1);
    });

    it("returns 4.0 at 60% (minimum passing)", () => {
      expect((service as any).calculateSchoolGrade(60)).toBeCloseTo(4.0, 1);
    });

    it("returns 7.0 for 100%", () => {
      expect((service as any).calculateSchoolGrade(100)).toBeCloseTo(7.0, 1);
    });

    it("is monotonic increasing", () => {
      const g60 = (service as any).calculateSchoolGrade(60);
      const g70 = (service as any).calculateSchoolGrade(70);
      const g80 = (service as any).calculateSchoolGrade(80);
      expect(g70).toBeGreaterThan(g60);
      expect(g80).toBeGreaterThan(g70);
    });

    it("clamps to range 1.0-7.0", () => {
      expect((service as any).calculateSchoolGrade(-10)).toBe(1.0);
      expect((service as any).calculateSchoolGrade(200)).toBe(7.0);
    });
  });

  // ══════════════════════════════════════════════════════
  //  CORRECTION MATH (inline unit logic)
  // ══════════════════════════════════════════════════════

  describe("correction logic", () => {
    it("marks correct when response matches key", () => {
      const key = { questionNumber: 1, correctOption: "B", score: 1.0 };
      const selected = "B";
      const isCorrect = selected.toUpperCase() === key.correctOption;
      const scoreObtained = isCorrect ? key.score : 0;
      expect(isCorrect).toBe(true);
      expect(scoreObtained).toBe(1.0);
    });

    it("marks incorrect when response differs from key", () => {
      const key = { questionNumber: 1, correctOption: "C", score: 1.0 };
      const selected = "A";
      expect(selected.toUpperCase() === key.correctOption).toBe(false);
    });

    it("handles null responses as OMITTED", () => {
      const selected: string | null = null;
      const status = selected === null || selected === undefined ? "OMITTED" : "CORRECT";
      expect(status).toBe("OMITTED");
    });
  });
});
