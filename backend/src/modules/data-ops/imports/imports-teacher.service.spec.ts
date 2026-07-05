import { jest } from "@jest/globals";
import { Test, TestingModule } from "@nestjs/testing";
import { ImportsTeacherService } from "./imports-teacher.service.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { ImportsParserService } from "./imports-parser.service.js";

function mockConfig() {
  return { bcryptRounds: 4 } as any;
}

describe("ImportsTeacherService", () => {
  let service: ImportsTeacherService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      teacher: { findFirst: jest.fn<() => any>().mockResolvedValue(null), create: jest.fn<() => any>() },
      user: { findUnique: jest.fn<() => any>().mockResolvedValue(null), create: jest.fn<() => any>() },
      $transaction: jest.fn((cb: any) => cb(mockPrisma)),
    };

    const parser = new ImportsParserService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportsTeacherService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ImportsParserService, useValue: parser },
        { provide: "APP_CONFIG", useValue: mockConfig() },
      ],
    }).compile();

    service = module.get(ImportsTeacherService);
  });

  // ══════════════════════════════════════════════════════
  //  NAME SPLITTING
  // ══════════════════════════════════════════════════════

  describe("splitName", () => {
    it("returns empty last name for single word", () => {
      const result = (service as any).splitName("Carlos");
      expect(result.firstName).toBe("Carlos");
      expect(result.lastName).toBe("");
    });

    it("splits two words (1 first, 1 last)", () => {
      const result = (service as any).splitName("Carlos Muñoz");
      expect(result.firstName).toBe("Carlos");
      expect(result.lastName).toBe("Muñoz");
    });

    it("splits three+ words (2 first, rest last)", () => {
      const result = (service as any).splitName("María José Delgado Rojas");
      expect(result.firstName).toBe("María José");
      expect(result.lastName).toBe("Delgado Rojas");
    });
  });

  // ══════════════════════════════════════════════════════
  //  RUT NORMALIZATION
  // ══════════════════════════════════════════════════════

  describe("normalizeRut", () => {
    it("formats 123456785 → 12345678-5", () => {
      expect((service as any).normalizeRut("123456785")).toBe("12345678-5");
    });

    it("preserves already formatted: 12345678-5", () => {
      expect((service as any).normalizeRut("12345678-5")).toBe("12345678-5");
    });

    it("strips dots: 12.345.678-5", () => {
      expect((service as any).normalizeRut("12.345.678-5")).toBe("12345678-5");
    });

    it("uppercases K verifier: 12345678k → 12345678-K", () => {
      expect((service as any).normalizeRut("12345678k")).toBe("12345678-K");
    });
  });

  // ══════════════════════════════════════════════════════
  //  RUT VALIDATION (Chilean algorithm)
  // ══════════════════════════════════════════════════════

  describe("isValidRut", () => {
    it("validates correct: 11111111-1", () => {
      expect((service as any).isValidRut("11111111-1")).toBe(true);
    });

    it("rejects wrong verifier: 12345678-4", () => {
      expect((service as any).isValidRut("12345678-4")).toBe(false);
    });

    it("rejects random string", () => {
      expect((service as any).isValidRut("abcdef")).toBe(false);
    });

    it("validates without dash: 123456785", () => {
      expect((service as any).isValidRut("123456785")).toBe(true);
    });

    it("handles dots: 12.345.678-5", () => {
      expect((service as any).isValidRut("12.345.678-5")).toBe(true);
    });
  });
});
