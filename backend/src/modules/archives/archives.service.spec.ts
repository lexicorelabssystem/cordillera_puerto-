import { jest } from "@jest/globals";
import { createHash } from "node:crypto";
import { ArchivesService } from "./archives.service.js";

describe("ArchivesService", () => {
  const now = new Date("2026-06-27T00:00:00.000Z");

  it("writes a durable snapshot before removing hot historical rows", async () => {
    const record = { id: "archive-1", status: "PENDING", storagePath: null, institutionId: "inst-1", cutoffDate: now, semester: 1 };
    const assessment = {
      id: "assessment-1", status: "GRADED", isActive: true, archivedAt: null,
      attempts: [{ id: "attempt-1", assessmentId: "assessment-1", answers: [{ id: "answer-1", attemptId: "attempt-1" }] }],
    };
    const tx = {
      studentAnswer: { deleteMany: jest.fn() }, assessmentAttempt: { deleteMany: jest.fn() },
      report: { deleteMany: jest.fn() }, exportJob: { deleteMany: jest.fn() },
      assessment: { updateMany: jest.fn() }, archiveRecord: { update: jest.fn() },
    };
    const prisma: any = {
      archiveRecord: { findUnique: jest.fn().mockResolvedValue(record), update: jest.fn() },
      course: { findMany: jest.fn().mockResolvedValue([{ id: "course-1" }]) },
      assessment: { findMany: jest.fn().mockResolvedValue([assessment]) },
      report: { findMany: jest.fn().mockResolvedValue([{ id: "report-1" }]) },
      exportJob: { findMany: jest.fn().mockResolvedValue([{ id: "export-1" }]) },
      $transaction: jest.fn(async (callback) => callback(tx)),
    };
    const storage: any = { archivesBucket: "archives", put: jest.fn().mockResolvedValue("minio://archives/archives/archive-1.json") };
    const result = await new ArchivesService(prisma, storage).archive(record.id);

    expect(storage.put.mock.invocationCallOrder[0]).toBeLessThan(prisma.$transaction.mock.invocationCallOrder[0]);
    expect(tx.studentAnswer.deleteMany).toHaveBeenCalled();
    expect(tx.assessmentAttempt.deleteMany).toHaveBeenCalled();
    expect(tx.assessment.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "ARCHIVED" }) }));
    expect(result).toEqual(expect.objectContaining({ status: "ARCHIVED", recordCounts: { assessments: 1, attempts: 1, answers: 1, reports: 1, exports: 1 } }));
  });

  it("restores archived rows when the snapshot checksum is valid", async () => {
    const snapshot = {
      assessments: [{ id: "assessment-1", status: "GRADED", isActive: true, archivedAt: null, attempts: [{ id: "attempt-1", assessmentId: "assessment-1", startedAt: now.toISOString(), submittedAt: now.toISOString(), answers: [{ id: "answer-1", attemptId: "attempt-1", answeredAt: now.toISOString() }] }] }],
      reports: [{ id: "report-1", createdAt: now.toISOString() }],
      exports: [{ id: "export-1", createdAt: now.toISOString(), completedAt: now.toISOString() }],
    };
    const payload = Buffer.from(JSON.stringify(snapshot));
    const checksum = createHash("sha256").update(payload).digest("hex");
    const record = { id: "archive-1", status: "ARCHIVED", storagePath: "minio://archives/archive-1.json", checksum, recordCounts: {} };
    const tx = {
      assessment: { update: jest.fn() }, assessmentAttempt: { createMany: jest.fn() },
      studentAnswer: { createMany: jest.fn() }, report: { createMany: jest.fn() },
      exportJob: { createMany: jest.fn() }, archiveRecord: { update: jest.fn() },
    };
    const prisma: any = {
      archiveRecord: { findUnique: jest.fn().mockResolvedValue(record), update: jest.fn() },
      $transaction: jest.fn(async (callback) => callback(tx)),
    };
    const storage: any = { getBuffer: jest.fn().mockResolvedValue(payload) };
    const result = await new ArchivesService(prisma, storage).restore(record.id);

    expect(tx.assessmentAttempt.createMany).toHaveBeenCalled();
    expect(tx.studentAnswer.createMany).toHaveBeenCalled();
    expect(tx.report.createMany).toHaveBeenCalled();
    expect(tx.exportJob.createMany).toHaveBeenCalled();
    expect(result.status).toBe("RESTORED");
  });
});