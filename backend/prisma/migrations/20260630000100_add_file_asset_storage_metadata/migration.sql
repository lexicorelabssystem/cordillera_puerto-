ALTER TABLE "file_assets"
  ADD COLUMN "storageProvider" TEXT NOT NULL DEFAULT 'local',
  ADD COLUMN "bucket" TEXT,
  ADD COLUMN "objectKey" TEXT;

UPDATE "file_assets"
SET
  "storageProvider" = CASE WHEN "storagePath" LIKE 'minio://%' THEN 'minio' ELSE 'local' END,
  "bucket" = CASE
    WHEN "storagePath" LIKE 'minio://%' THEN split_part(substring("storagePath" from 9), '/', 1)
    ELSE NULL
  END,
  "objectKey" = CASE
    WHEN "storagePath" LIKE 'minio://%' THEN substring(substring("storagePath" from 9) from position('/' in substring("storagePath" from 9)) + 1)
    ELSE NULL
  END;

CREATE INDEX "file_assets_storageProvider_idx" ON "file_assets"("storageProvider");
CREATE INDEX "file_assets_bucket_objectKey_idx" ON "file_assets"("bucket", "objectKey");