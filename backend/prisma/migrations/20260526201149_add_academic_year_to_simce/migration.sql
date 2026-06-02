-- AlterTable
ALTER TABLE "simce_assessments" ADD COLUMN     "academicYearId" UUID;

-- CreateIndex
CREATE INDEX "simce_assessments_academicYearId_idx" ON "simce_assessments"("academicYearId");

-- AddForeignKey
ALTER TABLE "simce_assessments" ADD CONSTRAINT "simce_assessments_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;
