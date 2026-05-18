-- CreateEnum
CREATE TYPE "GradeChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "grade_change_requests" (
    "id" UUID NOT NULL,
    "gradeId" UUID NOT NULL,
    "requestedBy" UUID NOT NULL,
    "reviewedBy" UUID,
    "oldGrade" DOUBLE PRECISION NOT NULL,
    "newGrade" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "GradeChangeStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMPTZ,

    CONSTRAINT "grade_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "grade_change_requests_gradeId_idx" ON "grade_change_requests"("gradeId");
CREATE INDEX "grade_change_requests_requestedBy_idx" ON "grade_change_requests"("requestedBy");
CREATE INDEX "grade_change_requests_status_idx" ON "grade_change_requests"("status");

-- AddForeignKey
ALTER TABLE "grade_change_requests" ADD CONSTRAINT "grade_change_requests_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "grades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "grade_change_requests" ADD CONSTRAINT "grade_change_requests_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "grade_change_requests" ADD CONSTRAINT "grade_change_requests_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
