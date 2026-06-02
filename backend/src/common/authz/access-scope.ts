import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { UserRole } from "@prisma/client";
import type { PrismaService } from "../../modules/prisma/prisma.service.js";
import type { JwtPayload } from "../decorators/current-user.decorator.js";

type AccessUser = JwtPayload | string;

export interface UserScope {
  userId: string;
  role: UserRole;
  institutionId: string | null;
  teacherId: string | null;
  studentId: string | null;
  assignments: { courseId: string; subjectId: string }[];
  isSuperAdmin: boolean;
  isGlobalAdmin: boolean;
}

function userIdOf(user: AccessUser) {
  return typeof user === "string" ? user : user.sub;
}

function isScopedStaff(scope: UserScope) {
  return ["ADMIN", "DIRECTION", "UTP"].includes(scope.role);
}

export async function resolveUserScope(prisma: PrismaService, user: AccessUser): Promise<UserScope> {
  const userId = userIdOf(user);
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      teacher: {
        include: {
          courseAssignments: {
            select: { courseId: true, subjectId: true },
          },
        },
      },
      student: { select: { id: true } },
    },
  });

  if (!dbUser || !dbUser.isActive || dbUser.deletedAt) {
    throw new ForbiddenException("Usuario no autorizado");
  }

  const role = dbUser.role;
  const institutionId = dbUser.institutionId ?? (typeof user === "string" ? null : user.institutionId ?? null);

  return {
    userId: dbUser.id,
    role,
    institutionId,
    teacherId: dbUser.teacher?.id ?? null,
    studentId: dbUser.student?.id ?? null,
    assignments: dbUser.teacher?.courseAssignments ?? [],
    isSuperAdmin: role === "SUPER_ADMIN",
    isGlobalAdmin: role === "SUPER_ADMIN" || (role === "ADMIN" && !institutionId),
  };
}

export async function assertInstitutionScope(
  prisma: PrismaService,
  user: AccessUser,
  institutionId?: string | null,
) {
  const scope = await resolveUserScope(prisma, user);
  if (!institutionId || scope.isGlobalAdmin) return scope;

  const exists = await prisma.institution.findUnique({ where: { id: institutionId }, select: { id: true } });
  if (!exists) throw new NotFoundException("Institucion no encontrada");

  if (!scope.institutionId || scope.institutionId !== institutionId) {
    throw new ForbiddenException("No tienes acceso a esta institucion");
  }

  return scope;
}

export async function assertAcademicManagementInstitutionScope(
  prisma: PrismaService,
  user: AccessUser,
  institutionId?: string | null,
) {
  const scope = await resolveUserScope(prisma, user);
  if (!institutionId || scope.isGlobalAdmin) return scope;

  return assertInstitutionScope(prisma, user, institutionId);
}

export async function assertCourseScope(
  prisma: PrismaService,
  user: AccessUser,
  courseId: string,
  subjectId?: string | null,
) {
  const scope = await resolveUserScope(prisma, user);
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, institutionId: true },
  });
  if (!course) throw new NotFoundException("Curso no encontrado");

  if (scope.isGlobalAdmin) return { scope, course };

  if (isScopedStaff(scope)) {
    if (!scope.institutionId || course.institutionId !== scope.institutionId) {
      throw new ForbiddenException("No tienes acceso a este curso");
    }
    return { scope, course };
  }

  if (scope.role === "TEACHER") {
    const assigned = scope.assignments.some(
      (a) => a.courseId === courseId && (!subjectId || a.subjectId === subjectId),
    );
    if (!assigned) throw new ForbiddenException("No tienes asignado este curso/asignatura");
    return { scope, course };
  }

  if (scope.role === "STUDENT" && scope.studentId) {
    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId: scope.studentId, courseId, isActive: true },
      select: { id: true },
    });
    if (!enrollment) throw new ForbiddenException("No estas matriculado en este curso");
    return { scope, course };
  }

  throw new ForbiddenException("No tienes acceso a este curso");
}

export async function assertStudentScope(prisma: PrismaService, user: AccessUser, studentId: string) {
  const scope = await resolveUserScope(prisma, user);
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, userId: true },
  });
  if (!student) throw new NotFoundException("Estudiante no encontrado");

  if (scope.isGlobalAdmin) return { scope, student };

  if (scope.role === "STUDENT") {
    if (!scope.studentId || scope.studentId !== studentId) {
      throw new ForbiddenException("No tienes acceso a este estudiante");
    }
    return { scope, student };
  }

  if (scope.role === "TEACHER") {
    if (!scope.teacherId) throw new ForbiddenException("Perfil docente no encontrado");
    const assignedCourseIds = scope.assignments.map((a) => a.courseId);
    const enrollment = assignedCourseIds.length
      ? await prisma.enrollment.findFirst({
          where: { studentId, isActive: true, courseId: { in: assignedCourseIds } },
          select: { id: true },
        })
      : null;
    if (!enrollment) throw new ForbiddenException("No tienes acceso a este estudiante");
    return { scope, student };
  }

  if (isScopedStaff(scope)) {
    if (!scope.institutionId) throw new ForbiddenException("Usuario sin institucion asignada");
    const scopedStudent = await prisma.student.findFirst({
      where: {
        id: studentId,
        OR: [
          { user: { institutionId: scope.institutionId } },
          { enrollments: { some: { isActive: true, course: { institutionId: scope.institutionId } } } },
        ],
      },
      select: { id: true },
    });
    if (!scopedStudent) throw new ForbiddenException("No tienes acceso a este estudiante");
    return { scope, student };
  }

  throw new ForbiddenException("No tienes acceso a este estudiante");
}

export async function assertAssessmentScope(
  prisma: PrismaService,
  user: AccessUser,
  assessmentId: string,
) {
  const scope = await resolveUserScope(prisma, user);
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: {
      id: true,
      courseId: true,
      subjectId: true,
      teacherId: true,
      course: { select: { institutionId: true } },
      teacher: { select: { userId: true } },
    },
  });
  if (!assessment) throw new NotFoundException("Evaluacion no encontrada");

  if (scope.isGlobalAdmin) return { scope, assessment };

  if (isScopedStaff(scope)) {
    if (!scope.institutionId || assessment.course.institutionId !== scope.institutionId) {
      throw new ForbiddenException("No tienes acceso a esta evaluacion");
    }
    return { scope, assessment };
  }

  if (scope.role === "TEACHER") {
    const assigned =
      assessment.teacher.userId === scope.userId ||
      scope.assignments.some((a) => a.courseId === assessment.courseId && a.subjectId === assessment.subjectId);
    if (!assigned) throw new ForbiddenException("No tienes acceso a esta evaluacion");
    return { scope, assessment };
  }

  if (scope.role === "STUDENT" && scope.studentId) {
    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId: scope.studentId, courseId: assessment.courseId, isActive: true },
      select: { id: true },
    });
    if (!enrollment) throw new ForbiddenException("No tienes acceso a esta evaluacion");
    return { scope, assessment };
  }

  throw new ForbiddenException("No tienes acceso a esta evaluacion");
}

export async function assertGradeScope(prisma: PrismaService, user: AccessUser, gradeId: string) {
  const grade = await prisma.grade.findUnique({
    where: { id: gradeId },
    select: { id: true, assessmentId: true, studentId: true },
  });
  if (!grade) throw new NotFoundException("Registro de nota no encontrado");

  await assertAssessmentScope(prisma, user, grade.assessmentId);
  await assertStudentScope(prisma, user, grade.studentId);

  return grade;
}
