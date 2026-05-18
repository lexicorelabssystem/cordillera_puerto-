-- CreateEnum
CREATE TYPE "PermissionAction" AS ENUM ('USERS_CREATE', 'USERS_READ', 'USERS_UPDATE', 'USERS_DISABLE', 'USERS_EXPORT', 'ROLES_ASSIGN', 'PERMISSIONS_ASSIGN', 'SETTINGS_UPDATE', 'INSTITUTIONS_CREATE', 'INSTITUTIONS_UPDATE', 'INSTITUTIONS_DELETE', 'ACADEMIC_YEARS_CREATE', 'ACADEMIC_YEARS_UPDATE', 'ACADEMIC_YEARS_CLOSE', 'COURSES_CREATE', 'COURSES_UPDATE', 'SUBJECTS_CREATE', 'SUBJECTS_UPDATE', 'STUDENTS_CREATE', 'STUDENTS_UPDATE', 'STUDENTS_DISABLE', 'STUDENTS_IMPORT', 'STUDENTS_EXPORT', 'STUDENTS_TRANSFER', 'CURRICULUM_CREATE', 'CURRICULUM_UPDATE', 'CURRICULUM_IMPORT', 'CURRICULUM_EXPORT', 'QUESTIONS_CREATE', 'QUESTIONS_READ', 'QUESTIONS_UPDATE', 'QUESTIONS_DISABLE', 'QUESTIONS_SHARE', 'QUESTIONS_IMPORT', 'QUESTIONS_EXPORT', 'ASSESSMENTS_CREATE', 'ASSESSMENTS_READ', 'ASSESSMENTS_UPDATE', 'ASSESSMENTS_PUBLISH', 'ASSESSMENTS_APPLY', 'ASSESSMENTS_CLOSE', 'ASSESSMENTS_EXPORT', 'RESULTS_READ', 'RESULTS_EXPORT', 'RESULTS_CHANGE_REQUEST', 'RESULTS_CHANGE_APPROVE', 'RESULTS_CHANGE_REJECT', 'REPORTS_READ', 'REPORTS_EXPORT', 'VOICE_USE', 'AUDIT_READ', 'IMPORTS_EXECUTE', 'EXPORTS_EXECUTE');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'PARENT';

-- AlterTable
ALTER TABLE "institutions" ADD COLUMN     "comuna" TEXT,
ADD COLUMN     "jornada" TEXT,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "sede" TEXT;

-- CreateTable
CREATE TABLE "institution_configs" (
    "id" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "gradingScaleMin" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "gradingScaleMax" DOUBLE PRECISION NOT NULL DEFAULT 7.0,
    "exigencia" DOUBLE PRECISION NOT NULL DEFAULT 60.0,
    "allowGradeEdit" BOOLEAN NOT NULL DEFAULT true,
    "allowSelfRegistration" BOOLEAN NOT NULL DEFAULT false,
    "defaultLanguage" TEXT NOT NULL DEFAULT 'es-CL',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "institution_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "action" "PermissionAction" NOT NULL,
    "description" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permissions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "grantedBy" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "institution_configs_institutionId_key" ON "institution_configs"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_action_key" ON "permissions"("action");

-- CreateIndex
CREATE INDEX "user_permissions_userId_idx" ON "user_permissions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_userId_permissionId_key" ON "user_permissions"("userId", "permissionId");

-- AddForeignKey
ALTER TABLE "institution_configs" ADD CONSTRAINT "institution_configs_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
