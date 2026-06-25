import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  // ══════════════════════════════════════════════════════
  //  TEACHER ALERTS — Por curso/asignatura
  // ══════════════════════════════════════════════════════

  async getTeacherAlerts(teacherUserId: string) {
    const teacher = await this.prisma.teacher.findUnique({ where: { userId: teacherUserId } });
    if (!teacher) throw new NotFoundException("Profesor no encontrado");

    const assignments = await this.prisma.teacherCourseAssignment.findMany({
      where: { teacherId: teacher.id },
      include: {
        course: { select: { id: true, name: true, gradeLevel: true } },
        subject: { select: { id: true, name: true } },
      },
    });

    const alerts: {
      courseId: string; courseName: string; gradeLevel: number;
      subjectId: string; subjectName: string;
      type: string; severity: string; message: string;
      details: unknown;
    }[] = [];

    if (assignments.length === 0) {
      return { teacherId: teacher.id, totalAlerts: 0, alerts };
    }

    const courseIds = [...new Set(assignments.map((assignment) => assignment.courseId))];
    const subjectIds = [...new Set(assignments.map((assignment) => assignment.subjectId))];

    const enrollments = await this.prisma.enrollment.findMany({
      where: { courseId: { in: courseIds }, isActive: true },
      select: {
        courseId: true,
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            grades: {
              where: {
                assessment: {
                  courseId: { in: courseIds },
                  subjectId: { in: subjectIds },
                },
              },
              select: {
                grade: true,
                assessmentId: true,
                assessment: { select: { courseId: true, subjectId: true } },
              },
            },
          },
        },
      },
    });

    const assignmentsByCourse = new Map<string, typeof assignments>();
    for (const assignment of assignments) {
      const courseAssignments = assignmentsByCourse.get(assignment.courseId) ?? [];
      courseAssignments.push(assignment);
      assignmentsByCourse.set(assignment.courseId, courseAssignments);
    }

    for (const enrollment of enrollments) {
      const courseAssignments = assignmentsByCourse.get(enrollment.courseId) ?? [];
      if (courseAssignments.length === 0) continue;

      const gradesByAssignment = new Map<string, typeof enrollment.student.grades>();
      for (const grade of enrollment.student.grades) {
        const key = `${grade.assessment.courseId}:${grade.assessment.subjectId}`;
        const groupedGrades = gradesByAssignment.get(key) ?? [];
        groupedGrades.push(grade);
        gradesByAssignment.set(key, groupedGrades);
      }

      for (const assignment of courseAssignments) {
        const subjectGrades = gradesByAssignment.get(`${assignment.courseId}:${assignment.subjectId}`) ?? [];
        if (subjectGrades.length === 0) continue;

        const avg = subjectGrades.reduce((s, g) => s + g.grade, 0) / subjectGrades.length;
        const avgRounded = Number(avg.toFixed(2));

        if (avgRounded < 3.5) {
          alerts.push({
            courseId: assignment.course.id, courseName: assignment.course.name, gradeLevel: assignment.course.gradeLevel,
            subjectId: assignment.subject.id, subjectName: assignment.subject.name,
            type: "STUDENT_RISK",
            severity: "CRITICAL",
            message: `${enrollment.student.firstName} ${enrollment.student.lastName} tiene promedio ${avgRounded} en ${assignment.subject.name}`,
            details: { studentId: enrollment.student.id, average: avgRounded, gradeCount: subjectGrades.length },
          });
        } else if (avgRounded < 4.0) {
          alerts.push({
            courseId: assignment.course.id, courseName: assignment.course.name, gradeLevel: assignment.course.gradeLevel,
            subjectId: assignment.subject.id, subjectName: assignment.subject.name,
            type: "STUDENT_RISK",
            severity: "HIGH",
            message: `${enrollment.student.firstName} ${enrollment.student.lastName} está en riesgo (${avgRounded}) en ${assignment.subject.name}`,
            details: { studentId: enrollment.student.id, average: avgRounded, gradeCount: subjectGrades.length },
          });
        }
      }
    }

    return {
      teacherId: teacher.id,
      totalAlerts: alerts.length,
      alerts: alerts.sort((a, b) => {
        const severityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, INFO: 3 };
        return (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99);
      }),
    };
  }
  // ══════════════════════════════════════════════════════
  //  OA BREACHES — Objetivos descendidos por curso
  // ══════════════════════════════════════════════════════

  async getOaBreaches(courseId: string, subjectId?: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException("Curso no encontrado");

    const assessments = await this.prisma.assessment.findMany({
      where: {
        courseId,
        status: { in: ["GRADED", "REPORTED"] as any },
        ...(subjectId ? { subjectId } : {}),
      },
      include: {
        subject: { select: { id: true, name: true } },
        questions: {
          include: {
            question: {
              include: {
                learningObjective: { select: { id: true, code: true, description: true } },
              },
            },
          },
        },
        attempts: {
          include: {
            answers: {
              where: { isGraded: true },
              select: { questionId: true, isCorrect: true, status: true },
            },
          },
        },
      },
    });

    // Aggregate by OA
    const oaStats: Record<string, {
      oaCode: string; oaDescription: string; subjectName: string;
      totalQuestions: number; totalAnswers: number; correctAnswers: number;
      achievement: number;
    }> = {};

    for (const assessment of assessments) {
      for (const aq of assessment.questions) {
        if (!aq.question.learningObjective) continue;
        const oaCode = aq.question.learningObjective.code;

        if (!oaStats[oaCode]) {
          oaStats[oaCode] = {
            oaCode,
            oaDescription: aq.question.learningObjective.description,
            subjectName: assessment.subject.name,
            totalQuestions: 0,
            totalAnswers: 0,
            correctAnswers: 0,
            achievement: 0,
          };
        }

        oaStats[oaCode].totalQuestions++;

        for (const attempt of assessment.attempts) {
          const answer = attempt.answers.find((a) => a.questionId === aq.questionId);
          if (answer) {
            oaStats[oaCode].totalAnswers++;
            if (answer.isCorrect) oaStats[oaCode].correctAnswers++;
          }
        }
      }
    }

    const breaches = Object.values(oaStats)
      .filter((oa) => oa.totalAnswers > 0)
      .map((oa) => ({
        ...oa,
        achievement: Number(((oa.correctAnswers / oa.totalAnswers) * 100).toFixed(1)),
      }))
      .filter((oa) => oa.achievement < 60)
      .sort((a, b) => a.achievement - b.achievement);

    return {
      courseId,
      courseName: course.name,
      gradeLevel: course.gradeLevel,
      totalOasTracked: Object.keys(oaStats).length,
      breachCount: breaches.length,
      breaches: breaches.map((b) => ({
        ...b,
        severity: b.achievement < 30 ? "CRITICAL" : b.achievement < 45 ? "HIGH" : "MEDIUM",
        suggestion: `Aplicar reforzamiento focalizado en ${b.oaCode}: ${b.oaDescription.slice(0, 60)}...`,
      })),
    };
  }

  // ══════════════════════════════════════════════════════
  //  DIRECTION/UTP DASHBOARD ALERTS
  // ══════════════════════════════════════════════════════

  async getInstitutionalAlerts(institutionId: string) {
    const courses = await this.prisma.course.findMany({
      where: { institutionId, isActive: true },
      include: {
        academicYear: { select: { year: true } },
        assessments: {
          where: { status: { in: ["GRADED", "REPORTED", "CLOSED"] as any } },
          select: { status: true },
        },
        enrollments: {
          where: { isActive: true },
          include: {
            student: {
              include: {
                grades: { select: { grade: true } },
              },
            },
          },
        },
      },
    });

    const alerts: { type: string; severity: string; message: string; details: unknown }[] = [];

    for (const course of courses) {
      // Courses without assessments
      if (course.assessments.length === 0) {
        alerts.push({
          type: "NO_ASSESSMENTS",
          severity: "MEDIUM",
          message: `${course.name} (${course.academicYear.year}): sin evaluaciones registradas`,
          details: { courseId: course.id, courseName: course.name },
        });
        continue;
      }

      // Courses without GRADED assessments
      const gradedCount = course.assessments.filter((a) => a.status === "GRADED" || a.status === "REPORTED").length;
      if (gradedCount === 0 && course.assessments.length > 0) {
        alerts.push({
          type: "PENDING_GRADING",
          severity: "HIGH",
          message: `${course.name}: ${course.assessments.length} evaluaciones sin corregir`,
          details: { courseId: course.id, pendingCount: course.assessments.length },
        });
      }

      // Students at risk per course
      for (const enrollment of course.enrollments) {
        if (enrollment.student.grades.length === 0) continue;
        const avg = enrollment.student.grades.reduce((s, g) => s + g.grade, 0) / enrollment.student.grades.length;
        if (avg < 4.0) {
          alerts.push({
            type: "STUDENT_RISK",
            severity: avg < 3.0 ? "CRITICAL" : "HIGH",
            message: `${enrollment.student.firstName} ${enrollment.student.lastName} (${course.name}): promedio ${Number(avg.toFixed(2))}`,
            details: { studentId: enrollment.student.id, courseId: course.id, average: Number(avg.toFixed(2)) },
          });
        }
      }
    }

    const summary = {
      total: alerts.length,
      critical: alerts.filter((a) => a.severity === "CRITICAL").length,
      high: alerts.filter((a) => a.severity === "HIGH").length,
      medium: alerts.filter((a) => a.severity === "MEDIUM").length,
    };

    return {
      institutionId,
      generatedAt: new Date().toISOString(),
      summary,
      alerts: alerts.sort((a, b) => {
        const order: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
        return (order[a.severity] ?? 99) - (order[b.severity] ?? 99);
      }),
    };
  }
}
