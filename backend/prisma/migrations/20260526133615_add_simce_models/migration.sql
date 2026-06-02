-- CreateEnum
CREATE TYPE "SimceStatus" AS ENUM ('DRAFT', 'KEY_PENDING', 'READY_TO_CORRECT', 'CORRECTED');

-- CreateTable
CREATE TABLE "simce_assessments" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "courseId" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "creatorId" UUID NOT NULL,
    "pdfFileId" UUID,
    "gradeLevel" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "status" "SimceStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "simce_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simce_answer_keys" (
    "id" UUID NOT NULL,
    "assessmentId" UUID NOT NULL,
    "questionNumber" INTEGER NOT NULL,
    "correctOption" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "axisId" UUID,
    "skillId" UUID,
    "oaId" UUID,
    "observation" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "simce_answer_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simce_student_responses" (
    "id" UUID NOT NULL,
    "assessmentId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "questionNumber" INTEGER NOT NULL,
    "selectedOption" TEXT,
    "isCorrect" BOOLEAN,
    "scoreObtained" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "simce_student_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "simce_assessments_courseId_subjectId_idx" ON "simce_assessments"("courseId", "subjectId");

-- CreateIndex
CREATE INDEX "simce_assessments_teacherId_status_idx" ON "simce_assessments"("teacherId", "status");

-- CreateIndex
CREATE INDEX "simce_assessments_status_idx" ON "simce_assessments"("status");

-- CreateIndex
CREATE INDEX "simce_answer_keys_assessmentId_idx" ON "simce_answer_keys"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "simce_answer_keys_assessmentId_questionNumber_key" ON "simce_answer_keys"("assessmentId", "questionNumber");

-- CreateIndex
CREATE INDEX "simce_student_responses_assessmentId_studentId_idx" ON "simce_student_responses"("assessmentId", "studentId");

-- CreateIndex
CREATE INDEX "simce_student_responses_assessmentId_idx" ON "simce_student_responses"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "simce_student_responses_assessmentId_studentId_questionNumb_key" ON "simce_student_responses"("assessmentId", "studentId", "questionNumber");

-- AddForeignKey
ALTER TABLE "simce_assessments" ADD CONSTRAINT "simce_assessments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simce_assessments" ADD CONSTRAINT "simce_assessments_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simce_assessments" ADD CONSTRAINT "simce_assessments_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simce_assessments" ADD CONSTRAINT "simce_assessments_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simce_assessments" ADD CONSTRAINT "simce_assessments_pdfFileId_fkey" FOREIGN KEY ("pdfFileId") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simce_answer_keys" ADD CONSTRAINT "simce_answer_keys_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "simce_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simce_answer_keys" ADD CONSTRAINT "simce_answer_keys_axisId_fkey" FOREIGN KEY ("axisId") REFERENCES "axes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simce_answer_keys" ADD CONSTRAINT "simce_answer_keys_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simce_answer_keys" ADD CONSTRAINT "simce_answer_keys_oaId_fkey" FOREIGN KEY ("oaId") REFERENCES "learning_objectives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simce_student_responses" ADD CONSTRAINT "simce_student_responses_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "simce_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simce_student_responses" ADD CONSTRAINT "simce_student_responses_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
