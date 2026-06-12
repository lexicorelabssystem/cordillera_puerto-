CREATE TABLE "imported_test_drafts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "courseId" UUID,
  "subjectId" UUID NOT NULL,
  "teacherId" UUID,
  "createdBy" UUID NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "mimeType" TEXT NOT NULL,
  "rawText" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  "committedAt" TIMESTAMPTZ,

  CONSTRAINT "imported_test_drafts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "imported_test_draft_questions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "draftId" UUID NOT NULL,
  "number" INTEGER NOT NULL,
  "statement" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'MULTIPLE_CHOICE',
  "alternatives" JSONB NOT NULL,
  "correctAnswer" TEXT,
  "points" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "questionId" UUID,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,

  CONSTRAINT "imported_test_draft_questions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "imported_test_drafts_createdBy_status_idx" ON "imported_test_drafts"("createdBy", "status");
CREATE INDEX "imported_test_drafts_subjectId_idx" ON "imported_test_drafts"("subjectId");
CREATE UNIQUE INDEX "imported_test_draft_questions_draftId_number_key" ON "imported_test_draft_questions"("draftId", "number");
CREATE INDEX "imported_test_draft_questions_draftId_status_idx" ON "imported_test_draft_questions"("draftId", "status");

ALTER TABLE "imported_test_draft_questions"
  ADD CONSTRAINT "imported_test_draft_questions_draftId_fkey"
  FOREIGN KEY ("draftId") REFERENCES "imported_test_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
