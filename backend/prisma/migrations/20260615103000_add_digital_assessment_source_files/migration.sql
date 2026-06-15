ALTER TABLE "imported_test_drafts"
  ADD COLUMN "fileAssetId" UUID,
  ADD COLUMN "instructions" TEXT;

ALTER TABLE "assessments"
  ADD COLUMN "sourceFileId" UUID;

CREATE INDEX "imported_test_drafts_fileAssetId_idx" ON "imported_test_drafts"("fileAssetId");
CREATE INDEX "assessments_sourceFileId_idx" ON "assessments"("sourceFileId");
