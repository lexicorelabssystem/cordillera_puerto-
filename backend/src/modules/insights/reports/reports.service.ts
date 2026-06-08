import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private average(values: number[]) {
    return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : 0;
  }

  private level(avg: number) {
    if (avg <= 0) return "Sin datos";
    if (avg < 4) return "Critico";
    if (avg < 5) return "Basico";
    if (avg < 6) return "Adecuado";
    return "Avanzado";
  }

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
      grades: {
        assessmentTitle: string;
        subjectName: string;
        grade: number;
        percentage: number | null;
        score: number | null;
        comments: string | null;
        recordedAt: string;
      }[];
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
            score: g.score,
            comments: g.comments,
            recordedAt: g.createdAt.toISOString(),
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

  async generateLearningObjectiveReport(filters: {
    institutionId?: string;
    academicYearId?: string;
    courseId?: string;
    subjectId?: string;
    learningObjectiveId?: string;
  }) {
    const assessments = await this.prisma.assessment.findMany({
      where: {
        status: "GRADED",
        ...(filters.courseId ? { courseId: filters.courseId } : {}),
        ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
        course: {
          ...(filters.institutionId ? { institutionId: filters.institutionId } : {}),
          ...(filters.academicYearId ? { academicYearId: filters.academicYearId } : {}),
        },
        questions: {
          some: {
            question: {
              ...(filters.learningObjectiveId ? { learningObjectiveId: filters.learningObjectiveId } : {}),
              ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
            },
          },
        },
      },
      include: {
        course: { select: { id: true, name: true, gradeLevel: true } },
        subject: { select: { id: true, name: true } },
        questions: {
          where: {
            question: {
              ...(filters.learningObjectiveId ? { learningObjectiveId: filters.learningObjectiveId } : {}),
              ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
            },
          },
          include: {
            question: {
              include: {
                learningObjective: { select: { id: true, code: true, description: true, gradeLevel: true } },
              },
            },
          },
        },
        attempts: {
          where: { status: { in: ["COMPLETED", "CLOSED"] } },
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
            answers: {
              include: {
                question: {
                  select: {
                    id: true,
                    learningObjectiveId: true,
                    learningObjective: { select: { id: true, code: true, description: true, gradeLevel: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ course: { gradeLevel: "asc" } }, { title: "asc" }],
    });

    const objectiveMap: Record<string, {
      id: string;
      code: string;
      description: string;
      gradeLevel: number;
      totalAnswers: number;
      correctAnswers: number;
      scores: number[];
      courses: Record<string, { courseId: string; courseName: string; totalAnswers: number; correctAnswers: number }>;
      students: Record<string, { studentId: string; studentName: string; totalAnswers: number; correctAnswers: number }>;
    }> = {};

    for (const assessment of assessments) {
      for (const assessmentQuestion of assessment.questions) {
        const oa = assessmentQuestion.question.learningObjective;
        if (!oa) continue;
        objectiveMap[oa.id] ??= {
          id: oa.id,
          code: oa.code,
          description: oa.description,
          gradeLevel: oa.gradeLevel,
          totalAnswers: 0,
          correctAnswers: 0,
          scores: [],
          courses: {},
          students: {},
        };
      }

      for (const attempt of assessment.attempts) {
        for (const answer of attempt.answers) {
          const oa = answer.question.learningObjective;
          if (!oa || !objectiveMap[oa.id]) continue;

          const bucket = objectiveMap[oa.id];
          const isCorrect = answer.isCorrect === true || (answer.score ?? 0) > 0;
          bucket.totalAnswers++;
          if (isCorrect) bucket.correctAnswers++;
          if (answer.score != null) bucket.scores.push(answer.score);

          bucket.courses[assessment.course.id] ??= {
            courseId: assessment.course.id,
            courseName: assessment.course.name,
            totalAnswers: 0,
            correctAnswers: 0,
          };
          bucket.courses[assessment.course.id].totalAnswers++;
          if (isCorrect) bucket.courses[assessment.course.id].correctAnswers++;

          bucket.students[attempt.student.id] ??= {
            studentId: attempt.student.id,
            studentName: `${attempt.student.firstName} ${attempt.student.lastName}`,
            totalAnswers: 0,
            correctAnswers: 0,
          };
          bucket.students[attempt.student.id].totalAnswers++;
          if (isCorrect) bucket.students[attempt.student.id].correctAnswers++;
        }
      }
    }

    const objectives = Object.values(objectiveMap).map((oa) => ({
      id: oa.id,
      code: oa.code,
      description: oa.description,
      gradeLevel: oa.gradeLevel,
      totalAnswers: oa.totalAnswers,
      correctAnswers: oa.correctAnswers,
      achievement: oa.totalAnswers ? Number(((oa.correctAnswers / oa.totalAnswers) * 100).toFixed(1)) : 0,
      averageScore: this.average(oa.scores),
      courses: Object.values(oa.courses).map((course) => ({
        ...course,
        achievement: course.totalAnswers ? Number(((course.correctAnswers / course.totalAnswers) * 100).toFixed(1)) : 0,
      })),
      students: Object.values(oa.students)
        .map((student) => ({
          ...student,
          achievement: student.totalAnswers ? Number(((student.correctAnswers / student.totalAnswers) * 100).toFixed(1)) : 0,
        }))
        .sort((a, b) => a.achievement - b.achievement),
    })).sort((a, b) => a.achievement - b.achievement);

    return {
      type: "OA",
      generatedAt: new Date().toISOString(),
      filters,
      assessmentCount: assessments.length,
      objectiveCount: objectives.length,
      lowAchievementCount: objectives.filter((oa) => oa.totalAnswers > 0 && oa.achievement < 60).length,
      objectives,
    };
  }

  async generateRiskReport(filters: {
    institutionId?: string;
    academicYearId?: string;
    courseId?: string;
    subjectId?: string;
    threshold?: number;
  }) {
    const threshold = filters.threshold ?? 4;
    const grades = await this.prisma.grade.findMany({
      where: {
        assessment: {
          status: "GRADED",
          ...(filters.courseId ? { courseId: filters.courseId } : {}),
          ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
          course: {
            ...(filters.institutionId ? { institutionId: filters.institutionId } : {}),
            ...(filters.academicYearId ? { academicYearId: filters.academicYearId } : {}),
          },
        },
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
        assessment: {
          select: {
            subject: { select: { id: true, name: true } },
            course: { select: { id: true, name: true, gradeLevel: true } },
          },
        },
      },
      orderBy: { grade: "asc" },
    });

    const studentMap: Record<string, {
      studentId: string;
      studentName: string;
      courseId: string;
      courseName: string;
      grades: number[];
      subjects: Record<string, { subjectId: string; subjectName: string; grades: number[] }>;
    }> = {};

    for (const grade of grades) {
      studentMap[grade.studentId] ??= {
        studentId: grade.studentId,
        studentName: `${grade.student.firstName} ${grade.student.lastName}`,
        courseId: grade.assessment.course.id,
        courseName: grade.assessment.course.name,
        grades: [],
        subjects: {},
      };

      const student = studentMap[grade.studentId];
      student.grades.push(grade.grade);
      const subjectId = grade.assessment.subject.id;
      student.subjects[subjectId] ??= {
        subjectId,
        subjectName: grade.assessment.subject.name,
        grades: [],
      };
      student.subjects[subjectId].grades.push(grade.grade);
    }

    const students = Object.values(studentMap)
      .map((student) => {
        const average = this.average(student.grades);
        return {
          studentId: student.studentId,
          studentName: student.studentName,
          courseId: student.courseId,
          courseName: student.courseName,
          average,
          level: this.level(average),
          gradeCount: student.grades.length,
          subjects: Object.values(student.subjects).map((subject) => ({
            subjectId: subject.subjectId,
            subjectName: subject.subjectName,
            average: this.average(subject.grades),
            gradeCount: subject.grades.length,
          })),
        };
      })
      .filter((student) => student.gradeCount > 0 && student.average < threshold)
      .sort((a, b) => a.average - b.average);

    return {
      type: "RISK",
      generatedAt: new Date().toISOString(),
      filters: { ...filters, threshold },
      threshold,
      totalStudentsWithGrades: Object.keys(studentMap).length,
      atRiskCount: students.length,
      students,
    };
  }

  async saveReport(
    type: string,
    entityId: string | null,
    data: unknown,
    userId: string,
    meta?: { courseId?: string; subjectId?: string; studentId?: string; format?: string; filters?: Record<string, unknown> },
  ) {
    const existing = await this.prisma.report.findFirst({
      where: { type, entityId, status: "GENERATED" },
      orderBy: { version: "desc" },
    });

    const version = (existing?.version ?? 0) + 1;

    return this.prisma.report.create({
      data: {
        type,
        entityId,
        courseId: meta?.courseId ?? null,
        subjectId: meta?.subjectId ?? null,
        studentId: meta?.studentId ?? null,
        version,
        status: "GENERATED",
        format: meta?.format ?? "JSON",
        filters: {
          ...(meta?.filters ?? {}),
          summary: data,
        } as Prisma.InputJsonValue,
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
