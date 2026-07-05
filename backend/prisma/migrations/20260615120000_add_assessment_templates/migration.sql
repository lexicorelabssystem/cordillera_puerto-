CREATE TABLE "assessment_templates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "institutionId" UUID,
  "subjectId" UUID,
  "gradeLevel" INTEGER,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "sourceFileId" UUID,
  "fileName" TEXT,
  "mimeType" TEXT,
  "instructions" TEXT,
  "totalPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMPTZ,

  CONSTRAINT "assessment_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assessment_template_questions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "templateId" UUID NOT NULL,
  "type" "QuestionType" NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "statement" TEXT NOT NULL,
  "points" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "explanation" TEXT,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "assessment_template_questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assessment_template_options" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "questionId" UUID NOT NULL,
  "label" TEXT,
  "text" TEXT NOT NULL,
  "isCorrect" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "assessment_template_options_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "assessment_templates_institutionId_status_idx" ON "assessment_templates"("institutionId", "status");
CREATE INDEX "assessment_templates_subjectId_gradeLevel_idx" ON "assessment_templates"("subjectId", "gradeLevel");
CREATE INDEX "assessment_template_questions_templateId_sortOrder_idx" ON "assessment_template_questions"("templateId", "sortOrder");
CREATE INDEX "assessment_template_options_questionId_idx" ON "assessment_template_options"("questionId");

ALTER TABLE "assessment_template_questions"
  ADD CONSTRAINT "assessment_template_questions_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "assessment_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assessment_template_options"
  ADD CONSTRAINT "assessment_template_options_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "assessment_template_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
