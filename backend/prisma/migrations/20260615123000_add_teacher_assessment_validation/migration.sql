ALTER TABLE "assessments"
  ADD COLUMN "sourceTemplateId" UUID,
  ADD COLUMN "teacherValidatedAt" TIMESTAMPTZ,
  ADD COLUMN "teacherValidatedBy" UUID;

CREATE INDEX "assessments_sourceTemplateId_idx" ON "assessments"("sourceTemplateId");
