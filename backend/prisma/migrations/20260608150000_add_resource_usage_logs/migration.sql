-- Historial reutilizable de uso de recursos pedagógicos.
-- Un recurso puede usarse muchas veces en distintos cursos/fechas sin perder trazabilidad.

CREATE TABLE "resource_usage_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "resourceId" UUID NOT NULL,
  "courseId" UUID NOT NULL,
  "subjectId" UUID,
  "usedById" UUID NOT NULL,
  "action" TEXT NOT NULL DEFAULT 'USED',
  "usedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,

  CONSTRAINT "resource_usage_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "resource_usage_logs_resourceId_usedAt_idx" ON "resource_usage_logs"("resourceId", "usedAt");
CREATE INDEX "resource_usage_logs_courseId_usedAt_idx" ON "resource_usage_logs"("courseId", "usedAt");
CREATE INDEX "resource_usage_logs_usedById_usedAt_idx" ON "resource_usage_logs"("usedById", "usedAt");

ALTER TABLE "resource_usage_logs"
  ADD CONSTRAINT "resource_usage_logs_resourceId_fkey"
  FOREIGN KEY ("resourceId") REFERENCES "learning_resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "resource_usage_logs"
  ADD CONSTRAINT "resource_usage_logs_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "resource_usage_logs"
  ADD CONSTRAINT "resource_usage_logs_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "resource_usage_logs"
  ADD CONSTRAINT "resource_usage_logs_usedById_fkey"
  FOREIGN KEY ("usedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
