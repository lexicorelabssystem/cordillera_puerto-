import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";

@Injectable()
export class CalculationsService {
  constructor(private readonly prisma: PrismaService) {}

  // ══════════════════════════════════════════════════════
  //  SET ASSESSMENT WEIGHTS (BULK)
  // ══════════════════════════════════════════════════════

  async setAssessmentWeights(periodId: string, weights: { assessmentId: string; weight: number }[]) {
    const period = await this.prisma.period.findUnique({ where: { id: periodId } });
    if (!period) throw new NotFoundException("Periodo no encontrado");

    if (period.status === "CLOSED") {
      throw new BadRequestException("No se pueden modificar ponderaciones de un periodo cerrado");
    }

    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01 && totalWeight !== 0) {
      throw new BadRequestException(
        `La suma de ponderaciones debe ser 100%. Actual: ${totalWeight.toFixed(1)}%`,
      );
    }

    for (const item of weights) {
      const assessment = await this.prisma.assessment.findFirst({
        where: { id: item.assessmentId, periodId },
      });
      if (!assessment) {
        throw new BadRequestException(
          `La evaluación ${item.assessmentId} no pertenece al periodo especificado`,
        );
      }

      await this.prisma.assessment.update({
        where: { id: item.assessmentId },
        data: { weight: item.weight },
      });
    }

    return { periodId, updatedCount: weights.length, totalWeight };
  }

  // ══════════════════════════════════════════════════════
  //  PERIOD AVERAGES (per student, per subject)
  // ══════════════════════════════════════════════════════

  async getPeriodAverages(periodId: string, courseId?: string) {
    const period = await this.prisma.period.findUnique({ where: { id: periodId } });
    if (!period) throw new NotFoundException("Periodo no encontrado");

    const whereClause: Record<string, unknown> = { periodId };
    if (courseId) whereClause.courseId = courseId;

    const assessments = await this.prisma.assessment.findMany({
      where: whereClause,
      include: {
        subject: { select: { id: true, name: true } },
        course: { select: { id: true, name: true, gradeLevel: true } },
        grades: { include: { student: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });

    // Group assessments by course + subject
    const grouped: Record<string, {
      courseId: string; courseName: string; gradeLevel: number;
      subjectId: string; subjectName: string;
      assessments: { id: string; title: string; weight: number; assessmentType: string;
        grades: { studentId: string; studentName: string; grade: number; percentage: number | null }[];
      }[];
    }> = {};

    for (const a of assessments) {
      const key = `${a.courseId}_${a.subjectId}`;
      if (!grouped[key]) {
        grouped[key] = {
          courseId: a.course.id,
          courseName: a.course.name,
          gradeLevel: a.course.gradeLevel,
          subjectId: a.subject.id,
          subjectName: a.subject.name,
          assessments: [],
        };
      }

      grouped[key].assessments.push({
        id: a.id,
        title: a.title,
        weight: a.weight ?? 0,
        assessmentType: a.assessmentType,
        grades: a.grades.map((g) => ({
          studentId: g.student.id,
          studentName: `${g.student.firstName} ${g.student.lastName}`,
          grade: g.grade,
          percentage: g.percentage,
        })),
      });
    }

    // Calculate weighted averages per student
    const results = [];
    for (const [, group] of Object.entries(grouped)) {
      const studentGrades: Record<string, { studentId: string; studentName: string; weightedSum: number; weightSum: number; count: number }> = {};

      for (const a of group.assessments) {
        if (a.assessmentType === "DIAGNOSTICA" && a.weight === 0) continue; // Skip diagnostic with 0 weight

        const effectiveWeight = a.weight > 0 ? a.weight : (100 / group.assessments.length);

        for (const g of a.grades) {
          if (!studentGrades[g.studentId]) {
            studentGrades[g.studentId] = { studentId: g.studentId, studentName: g.studentName, weightedSum: 0, weightSum: 0, count: 0 };
          }
          studentGrades[g.studentId].weightedSum += g.grade * effectiveWeight;
          studentGrades[g.studentId].weightSum += effectiveWeight;
          studentGrades[g.studentId].count++;
        }
      }

      const studentAverages = Object.values(studentGrades).map((sg) => ({
        studentId: sg.studentId,
        studentName: sg.studentName,
        average: sg.weightSum > 0 ? Number((sg.weightedSum / sg.weightSum).toFixed(2)) : 0,
        gradesCount: sg.count,
        level: sg.weightSum > 0
          ? sg.weightedSum / sg.weightSum < 4 ? "Critico" : sg.weightedSum / sg.weightSum < 5 ? "Basico" : sg.weightedSum / sg.weightSum < 6 ? "Adecuado" : "Avanzado"
          : "Sin evaluaciones",
      })).sort((a, b) => a.studentName.localeCompare(b.studentName));

      results.push({
        courseId: group.courseId,
        courseName: group.courseName,
        gradeLevel: group.gradeLevel,
        subjectId: group.subjectId,
        subjectName: group.subjectName,
        assessmentCount: group.assessments.length,
        students: studentAverages,
      });
    }

    return {
      periodId: period.id,
      periodName: period.name,
      courses: results,
    };
  }

  // ══════════════════════════════════════════════════════
  //  YEAR AVERAGE (weighted by period weights)
  // ══════════════════════════════════════════════════════

  async getYearAverage(academicYearId: string, courseId?: string) {
    const academicYear = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId },
      include: { periods: true },
    });
    if (!academicYear) throw new NotFoundException("Año académico no encontrado");

    const periods = academicYear.periods.filter((p) => p.status === "CLOSED" || p.status === "ACTIVE");

    if (periods.length === 0) {
      throw new BadRequestException("No hay periodos activos o cerrados para calcular el promedio anual");
    }

    const totalPeriodWeight = periods.reduce((sum, p) => sum + (p.weight ?? 100 / periods.length), 0);

    // Get all students via courses in the academic year
    const courses = await this.prisma.course.findMany({
      where: { academicYearId, ...(courseId ? { id: courseId } : {}) },
      include: {
        enrollments: {
          where: { isActive: true },
          include: { student: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });

    const results = [];

    for (const course of courses) {
      const studentAverages: Record<string, {
        studentId: string; studentName: string; periodGrades: { periodId: string; periodName: string; periodWeight: number; average: number | null }[];
        yearAverage: number | null; level: string;
      }> = {};

      for (const enrollment of course.enrollments) {
        studentAverages[enrollment.student.id] = {
          studentId: enrollment.student.id,
          studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
          periodGrades: [],
          yearAverage: null,
          level: "Sin datos",
        };
      }

      for (const period of periods) {
        const effectivePeriodWeight = period.weight ?? 100 / periods.length;

        // Get period averages for this period and course
        const subjectAverages = await this.getPeriodAverages(period.id, course.id);

        for (const subject of subjectAverages.courses) {
          for (const student of subject.students) {
            if (studentAverages[student.studentId]) {
              studentAverages[student.studentId].periodGrades.push({
                periodId: period.id,
                periodName: period.name,
                periodWeight: effectivePeriodWeight,
                average: student.average,
              });
            }
          }
        }
      }

      // Calculate year average
      for (const [, sa] of Object.entries(studentAverages)) {
        let weightedSum = 0;
        let weightSum = 0;

        for (const pg of sa.periodGrades) {
          if (pg.average !== null && pg.average > 0) {
            weightedSum += pg.average * pg.periodWeight;
            weightSum += pg.periodWeight;
          }
        }

        const yearAvg = weightSum > 0 ? Number((weightedSum / weightSum).toFixed(2)) : null;
        sa.yearAverage = yearAvg;
        sa.level = yearAvg === null ? "Sin evaluaciones"
          : yearAvg < 4 ? "Critico" : yearAvg < 5 ? "Basico" : yearAvg < 6 ? "Adecuado" : "Avanzado";
      }

      results.push({
        courseId: course.id,
        courseName: course.name,
        gradeLevel: course.gradeLevel,
        studentCount: course.enrollments.length,
        totalPeriodWeight,
        students: Object.values(studentAverages).sort((a, b) => a.studentName.localeCompare(b.studentName)),
      });
    }

    return {
      academicYearId,
      year: academicYear.year,
      periods: periods.map((p) => ({ id: p.id, name: p.name, weight: p.weight, status: p.status })),
      courses: results,
    };
  }

  // ══════════════════════════════════════════════════════
  //  VALIDATE PERIOD WEIGHTS
  // ══════════════════════════════════════════════════════

  async validatePeriodWeights(periodId: string) {
    const period = await this.prisma.period.findUnique({ where: { id: periodId } });
    if (!period) throw new NotFoundException("Periodo no encontrado");

    const assessments = await this.prisma.assessment.findMany({
      where: {
        periodId,
        status: { notIn: ["DRAFT", "ARCHIVED"] },
        assessmentType: { not: "DIAGNOSTICA" },
      },
      select: { id: true, title: true, weight: true, assessmentType: true, status: true },
    });

    const totalWeight = assessments.reduce((sum, a) => sum + (a.weight ?? 0), 0);
    const valid = Math.abs(totalWeight - 100) < 0.01;

    return {
      periodId,
      periodName: period.name,
      isValid: valid,
      totalWeight: Number(totalWeight.toFixed(2)),
      assessments: assessments.map((a) => ({
        id: a.id,
        title: a.title,
        type: a.assessmentType,
        status: a.status,
        weight: a.weight ?? 0,
      })),
      message: valid
        ? "Ponderaciones válidas. El periodo puede cerrarse."
        : `Ponderaciones inválidas. Suma actual: ${totalWeight.toFixed(1)}%. Debe ser 100%.`,
    };
  }

  // ══════════════════════════════════════════════════════
  //  STUDENT YEAR SUMMARY (per student)
  // ══════════════════════════════════════════════════════

  async getStudentYearSummary(studentId: string, academicYearId: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException("Estudiante no encontrado");

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        studentId,
        isActive: true,
        course: { academicYearId },
      },
      include: {
        course: {
          include: {
            assessments: {
              where: { status: "GRADED" },
              include: {
                subject: { select: { id: true, name: true } },
                period: { select: { id: true, name: true, weight: true } },
                grades: { where: { studentId }, select: { grade: true, percentage: true } },
              },
            },
          },
        },
      },
    });

    if (!enrollment) throw new NotFoundException("El estudiante no está matriculado en este año académico");

    // Group by subject then by period
    const bySubject: Record<string, {
      subjectId: string; subjectName: string;
      periods: Record<string, { periodId: string; periodName: string; periodWeight: number; grades: { assessmentId: string; title: string; weight: number; grade: number }[] }>;
    }> = {};

    for (const a of enrollment.course.assessments) {
      if (!bySubject[a.subject.id]) {
        bySubject[a.subject.id] = { subjectId: a.subject.id, subjectName: a.subject.name, periods: {} };
      }

      const periodId = a.period?.id ?? "no-period";
      const periodName = a.period?.name ?? "Sin periodo";
      const periodWeight = a.period?.weight ?? 0;

      if (!bySubject[a.subject.id].periods[periodId]) {
        bySubject[a.subject.id].periods[periodId] = { periodId, periodName, periodWeight, grades: [] };
      }

      const grade = a.grades[0]?.grade ?? 0;
      bySubject[a.subject.id].periods[periodId].grades.push({
        assessmentId: a.id,
        title: a.title,
        weight: a.weight ?? 0,
        grade,
      });
    }

    // Calculate averages per subject per period, then year average per subject
    const subjectSummaries = Object.values(bySubject).map((subj) => {
      const periodAverages = Object.values(subj.periods).map((per) => {
        let weightedSum = 0;
        let weightSum = 0;
        for (const g of per.grades) {
          const effectiveWeight = g.weight > 0 ? g.weight : (100 / per.grades.length);
          weightedSum += g.grade * effectiveWeight;
          weightSum += effectiveWeight;
        }
        return {
          periodId: per.periodId,
          periodName: per.periodName,
          periodWeight: per.periodWeight,
          average: weightSum > 0 ? Number((weightedSum / weightSum).toFixed(2)) : null,
          gradeCount: per.grades.length,
        };
      });

      let yearWeightedSum = 0;
      let yearWeightSum = 0;
      for (const pa of periodAverages) {
        if (pa.average !== null && pa.average > 0 && pa.periodWeight > 0) {
          yearWeightedSum += pa.average * pa.periodWeight;
          yearWeightSum += pa.periodWeight;
        }
      }

      return {
        subjectId: subj.subjectId,
        subjectName: subj.subjectName,
        periodAverages,
        yearAverage: yearWeightSum > 0 ? Number((yearWeightedSum / yearWeightSum).toFixed(2)) : null,
      };
    });

    const overallAverage = subjectSummaries
      .filter((s) => s.yearAverage !== null)
      .reduce((sum, s, _, arr) => sum + (s.yearAverage! / arr.length), 0);

    return {
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      courseName: enrollment.course.name,
      gradeLevel: enrollment.course.gradeLevel,
      subjects: subjectSummaries,
      overallAverage: subjectSummaries.some((s) => s.yearAverage !== null)
        ? Number(overallAverage.toFixed(2))
        : null,
      level: overallAverage < 4 ? "Critico" : overallAverage < 5 ? "Basico" : overallAverage < 6 ? "Adecuado" : "Avanzado",
    };
  }
}
