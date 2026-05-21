import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ══════════════════════════════════════════════════════
  //  STUDENT REPORT
  // ══════════════════════════════════════════════════════

  async generateStudentReport(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { email: true } },
        enrollments: {
          where: { isActive: true },
          include: {
            course: {
              include: {
                academicYear: { select: { year: true } },
                assessments: {
                  where: { status: "GRADED" },
                  include: {
                    subject: { select: { id: true, name: true } },
                    period: { select: { id: true, name: true, weight: true } },
                    grades: { where: { studentId }, select: { grade: true, percentage: true } },
                    questions: {
                      include: {
                        question: {
                          include: {
                            learningObjective: { select: { id: true, code: true, description: true } },
                            axis: { select: { id: true, name: true } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!student) throw new NotFoundException("Estudiante no encontrado");

    const enrollment = student.enrollments[0];
    if (!enrollment) throw new BadRequestException("El estudiante no tiene matrícula activa");

    // Subject summaries
    const bySubject: Record<string, {
      subjectName: string;
      grades: { title: string; grade: number; percentage: number | null; periodName: string }[];
      oas: Record<string, { code: string; description: string; correct: number; total: number }>;
    }> = {};

    for (const assessment of enrollment.course.assessments) {
      const subjectId = assessment.subject.id;
      if (!bySubject[subjectId]) {
        bySubject[subjectId] = { subjectName: assessment.subject.name, grades: [], oas: {} };
      }

      const grade = assessment.grades[0];
      if (grade) {
        bySubject[subjectId].grades.push({
          title: assessment.title,
          grade: grade.grade,
          percentage: grade.percentage,
          periodName: assessment.period?.name ?? "Sin periodo",
        });
      }

      // Track OA coverage
      for (const aq of assessment.questions) {
        if (aq.question.learningObjective) {
          const oaCode = aq.question.learningObjective.code;
          if (!bySubject[subjectId].oas[oaCode]) {
            bySubject[subjectId].oas[oaCode] = {
              code: oaCode,
              description: aq.question.learningObjective.description,
              correct: 0,
              total: 0,
            };
          }
          bySubject[subjectId].oas[oaCode].total++;
          // We'd need actual answer data to know if correct. Simplified for now.
        }
      }
    }

    const subjectSummaries = Object.entries(bySubject).map(([id, data]) => {
      const avg = data.grades.length > 0
        ? Number((data.grades.reduce((s, g) => s + g.grade, 0) / data.grades.length).toFixed(2))
        : 0;

      const oaBreaches = Object.values(data.oas).filter((oa) => oa.total > 0 && oa.correct / oa.total < 0.6);
      const oaStrengths = Object.values(data.oas).filter((oa) => oa.total > 0 && oa.correct / oa.total >= 0.7);

      return {
        subjectId: id,
        subjectName: data.subjectName,
        average: avg,
        level: avg < 4 ? "Crítico" : avg < 5 ? "Básico" : avg < 6 ? "Adecuado" : "Avanzado",
        gradeCount: data.grades.length,
        grades: data.grades.sort((a, b) => b.percentage! - a.percentage!),
        oaBreaches: oaBreaches.map((o) => ({ ...o, achievement: Number(((o.correct / o.total) * 100).toFixed(0)) })),
        oaStrengths: oaStrengths.map((o) => ({ ...o, achievement: Number(((o.correct / o.total) * 100).toFixed(0)) })),
      };
    });

    const overallAvg = subjectSummaries.length > 0
      ? Number((subjectSummaries.reduce((s, subj) => s + subj.average, 0) / subjectSummaries.length).toFixed(2))
      : 0;

    return {
      type: "STUDENT",
      generatedAt: new Date().toISOString(),
      student: {
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
        email: student.user?.email ?? null,
      },
      course: { name: enrollment.course.name, gradeLevel: enrollment.course.gradeLevel, year: enrollment.course.academicYear.year },
      overallAverage: overallAvg,
      overallLevel: overallAvg < 4 ? "Crítico" : overallAvg < 5 ? "Básico" : overallAvg < 6 ? "Adecuado" : "Avanzado",
      subjects: subjectSummaries,
      recommendations: subjectSummaries
        .filter((s) => s.average < 4)
        .map((s) => `Reforzar ${s.subjectName}: promedio ${s.average}. OA descendidos: ${s.oaBreaches.map((o) => o.code).join(", ") || "ninguno detectado"}`),
    };
  }

  // ══════════════════════════════════════════════════════
  //  COURSE REPORT
  // ══════════════════════════════════════════════════════

  async generateCourseReport(courseId: string, subjectId?: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        academicYear: { select: { year: true } },
        enrollments: {
          where: { isActive: true },
          include: { student: true },
        },
        assessments: {
          where: { status: "GRADED", ...(subjectId ? { subjectId } : {}) },
          include: {
            subject: { select: { id: true, name: true } },
            period: { select: { id: true, name: true } },
            grades: { include: { student: { select: { id: true, firstName: true, lastName: true } } } },
          },
        },
      },
    });
    if (!course) throw new NotFoundException("Curso no encontrado");

    // Student summaries
    const studentMap: Record<string, {
      id: string; name: string;
      grades: { assessmentTitle: string; subjectName: string; grade: number; percentage: number | null }[];
    }> = {};

    for (const enrollment of course.enrollments) {
      studentMap[enrollment.student.id] = {
        id: enrollment.student.id,
        name: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
        grades: [],
      };
    }

    const subjectSet = new Set<string>();
    for (const a of course.assessments) {
      subjectSet.add(a.subject.name);
      for (const g of a.grades) {
        if (studentMap[g.student.id]) {
          studentMap[g.student.id].grades.push({
            assessmentTitle: a.title,
            subjectName: a.subject.name,
            grade: g.grade,
            percentage: g.percentage,
          });
        }
      }
    }

    const students = Object.values(studentMap).map((s) => {
      const avg = s.grades.length > 0
        ? Number((s.grades.reduce((sum, g) => sum + g.grade, 0) / s.grades.length).toFixed(2))
        : 0;
      return {
        ...s,
        average: avg,
        level: avg < 4 ? "Crítico" : avg < 5 ? "Básico" : avg < 6 ? "Adecuado" : "Avanzado",
        gradeCount: s.grades.length,
      };
    }).sort((a, b) => a.average - b.average);

    const courseAvg = students.filter((s) => s.gradeCount > 0).length > 0
      ? Number((students.filter((s) => s.gradeCount > 0).reduce((sum, s) => sum + s.average, 0) / students.filter((s) => s.gradeCount > 0).length).toFixed(2))
      : 0;

    const atRisk = students.filter((s) => s.average < 4 && s.gradeCount > 0);
    const excellent = students.filter((s) => s.average >= 6 && s.gradeCount > 0);

    return {
      type: "COURSE",
      generatedAt: new Date().toISOString(),
      course: { id: course.id, name: course.name, gradeLevel: course.gradeLevel, year: course.academicYear.year },
      courseAverage: courseAvg,
      courseLevel: courseAvg < 4 ? "Crítico" : courseAvg < 5 ? "Básico" : courseAvg < 6 ? "Adecuado" : "Avanzado",
      totalStudents: course.enrollments.length,
      studentsWithGrades: students.filter((s) => s.gradeCount > 0).length,
      subjects: [...subjectSet],
      assessmentCount: course.assessments.length,
      atRiskCount: atRisk.length,
      excellentCount: excellent.length,
      atRiskStudents: atRisk.map((s) => ({ id: s.id, name: s.name, average: s.average })),
      students,
    };
  }

  // ══════════════════════════════════════════════════════
  //  INSTITUTIONAL REPORT
  // ══════════════════════════════════════════════════════

  async generateInstitutionalReport(institutionId: string, academicYearId?: string) {
    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      include: {
        courses: {
          where: { isActive: true, ...(academicYearId ? { academicYearId } : {}) },
          include: {
            academicYear: { select: { year: true } },
            _count: { select: { enrollments: { where: { isActive: true } }, assessments: true } },
            enrollments: {
              where: { isActive: true },
              include: { student: true },
            },
            assessments: {
              where: { status: "GRADED" },
              include: {
                subject: { select: { id: true, name: true } },
                grades: {
                  select: { studentId: true, grade: true },
                },
              },
            },
          },
        },
        _count: { select: { users: true } },
      },
    });
    if (!institution) throw new NotFoundException("Institución no encontrada");

    const courseSummaries = institution.courses.map((course) => {
      const gradeMap: Record<string, number[]> = {};
      for (const a of course.assessments) {
        for (const g of a.grades) {
          if (!gradeMap[g.studentId]) gradeMap[g.studentId] = [];
          gradeMap[g.studentId].push(g.grade);
        }
      }

      const studentsWithGrades = Object.keys(gradeMap).length;
      const courseAvg = studentsWithGrades > 0
        ? Number((Object.values(gradeMap)
            .reduce((sum, grades) => sum + (grades.reduce((s, g) => s + g, 0) / grades.length), 0) / studentsWithGrades)
            .toFixed(2))
        : 0;

      let atRiskCount = 0;
      for (const grades of Object.values(gradeMap)) {
        const studentAvg = grades.reduce((s, g) => s + g, 0) / grades.length;
        if (studentAvg < 4) atRiskCount++;
      }

      return {
        courseId: course.id,
        courseName: course.name,
        gradeLevel: course.gradeLevel,
        year: course.academicYear.year,
        students: course._count.enrollments,
        assessments: course._count.assessments,
        average: courseAvg,
        level: courseAvg < 4 ? "Crítico" : courseAvg < 5 ? "Básico" : courseAvg < 6 ? "Adecuado" : courseAvg === 0 ? "Sin datos" : "Avanzado",
        atRiskCount,
      };
    });

    const totalStudents = courseSummaries.reduce((s, c) => s + c.students, 0);
    const totalAtRisk = courseSummaries.reduce((s, c) => s + c.atRiskCount, 0);

    return {
      type: "INSTITUTIONAL",
      generatedAt: new Date().toISOString(),
      institution: { id: institution.id, name: institution.name, rbd: institution.rbd },
      totalUsers: institution._count.users,
      totalCourses: institution.courses.length,
      totalStudents,
      totalAtRisk,
      riskPercentage: totalStudents > 0 ? Number(((totalAtRisk / totalStudents) * 100).toFixed(1)) : 0,
      institutionalAverage: courseSummaries.length > 0
        ? Number((courseSummaries.reduce((s, c) => s + c.average, 0) / courseSummaries.length).toFixed(2))
        : 0,
      courses: courseSummaries,
    };
  }

  // ══════════════════════════════════════════════════════
  //  REPORT MANAGEMENT
  // ══════════════════════════════════════════════════════

  async saveReport(type: string, entityId: string | null, data: unknown, userId: string) {
    const existing = await this.prisma.report.findFirst({
      where: { type, entityId, status: "GENERATED" },
      orderBy: { version: "desc" },
    });

    const version = (existing?.version ?? 0) + 1;

    return this.prisma.report.create({
      data: {
        type,
        entityId,
        version,
        status: "GENERATED",
        format: "JSON",
        filters: data as object,
        generatedBy: userId,
        generatedAt: new Date(),
      },
    });
  }

  async listReports(type?: string, entityId?: string, page = 1, limit = 20) {
    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (entityId) where.entityId = entityId;

    const [data, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrevious: page > 1 },
    };
  }

  async getReport(reportId: string) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException("Reporte no encontrado");
    return report;
  }

  async invalidateReports(entityType: string, entityId: string) {
    const updated = await this.prisma.report.updateMany({
      where: { type: entityType, entityId, status: { in: ["GENERATED", "SENT"] } },
      data: { isOutdated: true, status: "OUTDATED" },
    });

    return { invalidated: updated.count, entityType, entityId };
  }
}
