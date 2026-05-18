import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";


@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOverview(institutionId?: string) {
    const [totals, courses, students, teachers, subjects, recentAssessments] =
      await Promise.all([
        this.getTotals(institutionId),
        this.getCourses(institutionId),
        this.getStudents(institutionId),
        this.getTeachers(institutionId),
        this.getSubjects(),
        this.getRecentAssessments(institutionId),
      ]);

    const semaforo = await this.getSemaforo(institutionId);
    const alerts = await this.getAlerts(institutionId);

    return {
      totals,
      courses,
      students,
      teachers,
      subjects,
      recentAssessments,
      semaforoCursos: semaforo,
      alertas: alerts,
    };
  }

  private async getTotals(institutionId?: string) {
    const where = institutionId ? { institutionId } : {};

    const [users, courses, students, assessments] = await Promise.all([
      this.prisma.user.count({ where: { ...where, deletedAt: null } }),
      this.prisma.course.count({ where: { ...where, isActive: true } }),
      this.prisma.student.count({ where: { deletedAt: null } }),
      this.prisma.assessment.count({
        where: { ...where, isActive: true },
      }),
    ]);

    return {
      users,
      courses,
      students,
      assessments,
    };
  }

  private async getCourses(institutionId?: string) {
    const where = institutionId
      ? { institutionId, isActive: true }
      : { isActive: true };

    const courses = await this.prisma.course.findMany({
      where,
      orderBy: { gradeLevel: "asc" },
      include: { _count: { select: { enrollments: { where: { isActive: true } } } } },
    });

    return courses.map((c) => ({
      course_id: c.id,
      course_name: c.name,
      grade_level: c.gradeLevel,
      section: c.section,
      students_count: c._count.enrollments,
    }));
  }

  private async getStudents(institutionId?: string) {
    const where = institutionId
      ? { user: { institutionId, deletedAt: null } }
      : { deletedAt: null };

    const students = await this.prisma.student.findMany({
      where,
      take: 100,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: {
        user: { select: { email: true } },
        enrollments: {
          where: { isActive: true },
          select: { course: { select: { name: true } } },
        },
      },
    });

    return students.map((s) => ({
      student_id: s.id,
      first_name: s.firstName,
      last_name: s.lastName,
      course_name: s.enrollments[0]?.course?.name ?? "Sin curso",
      email: s.user?.email ?? null,
    }));
  }

  private async getTeachers(institutionId?: string) {
    const where = institutionId
      ? { user: { institutionId } }
      : {};

    const teachers = await this.prisma.teacher.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        courseAssignments: {
          include: { course: { select: { name: true } }, subject: { select: { name: true } } },
        },
        _count: { select: { assessments: true } },
      },
    });

    return teachers.map((t) => ({
      user_id: t.userId,
      teacher_id: t.id,
      teacher_name: `${t.user.firstName} ${t.user.lastName}`,
      email: t.user.email,
      courses: t.courseAssignments.map((a) => ({
        course: a.course.name,
        subject: a.subject.name,
      })),
      total_assessments: t._count.assessments,
    }));
  }

  private async getSubjects() {
    const subjects = await this.prisma.subject.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });

    return subjects.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
    }));
  }

  private async getRecentAssessments(institutionId?: string) {
    const where = institutionId
      ? { course: { institutionId } }
      : {};

    const assessments = await this.prisma.assessment.findMany({
      where,
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        course: { select: { name: true } },
        subject: { select: { name: true } },
        teacher: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        _count: { select: { attempts: true, grades: true } },
      },
    });

    return assessments.map((a) => ({
      assessment_id: a.id,
      title: a.title,
      assessment_type: a.assessmentType,
      status: a.status,
      course_name: a.course.name,
      subject_name: a.subject.name,
      teacher_name: `${a.teacher.user.firstName} ${a.teacher.user.lastName}`,
      attempts_count: a._count.attempts,
      grades_count: a._count.grades,
      created_at: a.createdAt,
      published_at: a.publishedAt,
    }));
  }

  private async getSemaforo(institutionId?: string) {
    const where = institutionId
      ? { course: { institutionId } }
      : {};

    const courses = await this.prisma.course.findMany({
      where: institutionId ? { institutionId, isActive: true } : { isActive: true },
      select: { id: true, name: true },
    });

    const results: {
      course_id: string;
      course_name: string;
      avg_grade: number | null;
      total_grades: number;
      level: string;
    }[] = [];

    for (const course of courses) {
      const grades = await this.prisma.grade.aggregate({
        where: { ...where, studentId: { not: undefined } },
        _avg: { grade: true },
        _count: { grade: true },
      });

      const avg = grades._avg.grade ? Math.round(grades._avg.grade * 100) / 100 : null;
      let level = "Sin datos";

      if (avg !== null) {
        if (avg >= 5.5) level = "Alto";
        else if (avg >= 4.0) level = "Medio";
        else level = "Bajo";
      }

      results.push({
        course_id: course.id,
        course_name: course.name,
        avg_grade: avg,
        total_grades: grades._count.grade,
        level,
      });
    }

    return results;
  }

  private async getAlerts(institutionId?: string) {
    const where = institutionId
      ? { course: { institutionId } }
      : {};

    const courses = await this.prisma.course.findMany({
      where: institutionId ? { institutionId, isActive: true } : { isActive: true },
      select: { id: true, name: true },
    });

    const alerts: {
      courseName: string;
      avgGrade: number;
      suggestion: string;
    }[] = [];

    for (const course of courses) {
      const grades = await this.prisma.grade.aggregate({
        where: { ...where, studentId: { not: undefined } },
        _avg: { grade: true },
      });

      const avg = grades._avg.grade ? Math.round(grades._avg.grade * 100) / 100 : 0;

      if (avg < 4.0) {
        alerts.push({
          courseName: course.name,
          avgGrade: avg,
          suggestion: `Implementar plan remedial urgente. Promedio bajo 4.0.`,
        });
      }
    }

    return alerts;
  }
}
