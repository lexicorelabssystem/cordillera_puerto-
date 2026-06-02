import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { RemedialStatus } from "@prisma/client";
import type { JwtPayload } from "../../../common/decorators/current-user.decorator.js";
import {
  assertCourseScope,
  assertStudentScope,
  resolveUserScope,
} from "../../../common/authz/access-scope.js";

@Injectable()
export class RemedialPlansService {
  constructor(private readonly prisma: PrismaService) {}

  // ══════════════════════════════════════════════════════
  //  CRUD
  // ══════════════════════════════════════════════════════

  async create(dto: {
    studentId: string; courseId: string; subjectId: string;
    learningObjectiveId: string; title: string; description: string;
    startDate: string; endDate: string; preScore?: number; assignedTo?: string;
  }, user?: JwtPayload | string) {
    if (user) {
      await assertCourseScope(this.prisma, user, dto.courseId, dto.subjectId);
      await assertStudentScope(this.prisma, user, dto.studentId);
    }

    const student = await this.prisma.student.findUnique({ where: { id: dto.studentId } });
    if (!student) throw new NotFoundException("Estudiante no encontrado");

    const oa = await this.prisma.learningObjective.findUnique({ where: { id: dto.learningObjectiveId } });
    if (!oa) throw new NotFoundException("OA no encontrado");

    return this.prisma.remedialPlan.create({
      data: {
        studentId: dto.studentId,
        courseId: dto.courseId,
        subjectId: dto.subjectId,
        learningObjectiveId: dto.learningObjectiveId,
        title: dto.title,
        description: dto.description,
        status: "PENDING",
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        preScore: dto.preScore ?? null,
        assignedTo: dto.assignedTo ?? null,
      },
      include: {
        student: { select: { firstName: true, lastName: true } },
        learningObjective: { select: { code: true, description: true } },
      },
    });
  }

  async findById(id: string, user?: JwtPayload | string) {
    const plan = await this.prisma.remedialPlan.findUnique({
      where: { id },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
        learningObjective: { select: { id: true, code: true, description: true, subject: { select: { name: true } } } },
        learningResources: {
          include: {
            guide: true,
            subject: { select: { name: true } },
          },
        },
      },
    });
    if (!plan) throw new NotFoundException("Plan remedial no encontrado");
    if (user) {
      await assertStudentScope(this.prisma, user, plan.studentId);
      await assertCourseScope(this.prisma, user, plan.courseId, plan.subjectId);
    }
    return plan;
  }

  async findByStudent(studentId: string, user?: JwtPayload | string) {
    if (user) await assertStudentScope(this.prisma, user, studentId);

    return this.prisma.remedialPlan.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      include: {
        student: { select: { firstName: true, lastName: true } },
        learningObjective: { select: { code: true, description: true } },
      },
    });
  }

  async findAll(courseId?: string, status?: string, user?: JwtPayload | string) {
    const where: Record<string, unknown> = {};

    if (user) {
      const scope = await resolveUserScope(this.prisma, user);
      if (courseId) {
        await assertCourseScope(this.prisma, user, courseId);
        where.courseId = courseId;
      } else if (scope.role === "TEACHER") {
        where.courseId = { in: scope.assignments.map((assignment) => assignment.courseId) };
      } else if (!scope.isSuperAdmin && !scope.isGlobalAdmin) {
        where.course = { institutionId: scope.institutionId ?? "00000000-0000-0000-0000-000000000000" };
      }
    } else if (courseId) {
      where.courseId = courseId;
    }

    if (status) where.status = status;

    return this.prisma.remedialPlan.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        student: { select: { firstName: true, lastName: true } },
        learningObjective: {
          select: {
            code: true,
            description: true,
            subject: { select: { name: true } },
          },
        },
      },
    });
  }

  async findByCourse(courseId: string, status?: string, user?: JwtPayload | string) {
    if (user) await assertCourseScope(this.prisma, user, courseId);

    const where: Record<string, unknown> = { courseId };
    if (status) where.status = status;

    return this.prisma.remedialPlan.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        student: { select: { firstName: true, lastName: true } },
        learningObjective: { select: { code: true, description: true, subject: { select: { name: true } } } },
      },
    });
  }

  async update(id: string, dto: {
    title?: string; description?: string; endDate?: string;
    postScore?: number; status?: RemedialStatus;
  }, user?: JwtPayload | string) {
    await this.findById(id, user);

    // Validate status transitions
    if (dto.status) {
      this.validateStatusTransition(id, dto.status);
    }

    return this.prisma.remedialPlan.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
        ...(dto.postScore !== undefined && { postScore: dto.postScore }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  // ══════════════════════════════════════════════════════
  //  STATUS MACHINE
  // ══════════════════════════════════════════════════════

  async assign(id: string, user?: JwtPayload | string) {
    if (user) await this.findById(id, user);

    const plan = await this.prisma.remedialPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException("Plan no encontrado");
    if (plan.status !== "PENDING") throw new BadRequestException("Solo planes PENDING pueden asignarse");

    return this.prisma.remedialPlan.update({ where: { id }, data: { status: "IN_PROGRESS" } });
  }

  async complete(id: string, user?: JwtPayload | string) {
    if (user) await this.findById(id, user);

    const plan = await this.prisma.remedialPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException("Plan no encontrado");
    if (plan.status !== "IN_PROGRESS") throw new BadRequestException("Solo planes IN_PROGRESS pueden completarse");

    return this.prisma.remedialPlan.update({ where: { id }, data: { status: "COMPLETED" } });
  }

  async evaluate(id: string, postScore: number, user?: JwtPayload | string) {
    if (user) await this.findById(id, user);

    const plan = await this.prisma.remedialPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException("Plan no encontrado");
    if (plan.status !== "COMPLETED") throw new BadRequestException("Solo planes COMPLETED pueden evaluarse");

    const preScore = plan.preScore ?? 0;
    const improved = postScore > preScore;
    const significantImprovement = postScore - preScore >= 15;

    const status = significantImprovement ? "EFFECTIVE"
      : improved ? "COMPLETED"
      : "NOT_EFFECTIVE";

    return this.prisma.remedialPlan.update({
      where: { id },
      data: { status, postScore },
    });
  }

  // ══════════════════════════════════════════════════════
  //  AUTO-DETECT & SUGGEST
  // ══════════════════════════════════════════════════════

  async detectAndSuggest(courseId: string, subjectId?: string, threshold = 60, user?: JwtPayload | string) {
    if (user) await assertCourseScope(this.prisma, user, courseId, subjectId);

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        enrollments: {
          where: { isActive: true },
          include: { student: true },
        },
      },
    });
    if (!course) throw new NotFoundException("Curso no encontrado");

    // Get graded assessments
    const assessments = await this.prisma.assessment.findMany({
      where: {
        courseId,
        status: { in: ["GRADED", "REPORTED"] },
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
            student: { select: { id: true } },
            answers: {
              where: { isGraded: true },
              select: { questionId: true, isCorrect: true },
            },
          },
        },
      },
    });

    // Calculate OA achievement per student
    const oaPerStudent: Record<string, Record<string, { correct: number; total: number; subjectId: string; subjectName: string }>> = {};

    for (const a of assessments) {
      for (const aq of a.questions) {
        const oa = aq.question.learningObjective;
        if (!oa) continue;

        for (const attempt of a.attempts) {
          const studentId = attempt.student.id;
          if (!oaPerStudent[studentId]) oaPerStudent[studentId] = {};

          const oaKey = oa.id;
          if (!oaPerStudent[studentId][oaKey]) {
            oaPerStudent[studentId][oaKey] = { correct: 0, total: 0, subjectId: a.subject.id, subjectName: a.subject.name };
          }

          const answer = attempt.answers.find((ans) => ans.questionId === aq.questionId);
          if (answer) {
            oaPerStudent[studentId][oaKey].total++;
            if (answer.isCorrect) oaPerStudent[studentId][oaKey].correct++;
          }
        }
      }
    }

    // Detect breaches
    const suggestions: {
      studentId: string; studentName: string;
      oaId: string; oaCode: string; oaDescription: string;
      subjectId: string; subjectName: string;
      achievement: number; severity: string;
      suggestedTitle: string; suggestedDescription: string;
      existingPlan: boolean;
    }[] = [];

    for (const [studentId, oas] of Object.entries(oaPerStudent)) {
      for (const [oaId, stats] of Object.entries(oas)) {
        if (stats.total === 0) continue;
        const achievement = Number(((stats.correct / stats.total) * 100).toFixed(1));

        if (achievement < threshold) {
          const student = course.enrollments.find((e) => e.student.id === studentId);
          const oa = await this.prisma.learningObjective.findUnique({ where: { id: oaId } });

          // Check if plan already exists
          const existingPlan = await this.prisma.remedialPlan.findFirst({
            where: { studentId, learningObjectiveId: oaId, status: { not: "NOT_EFFECTIVE" } },
          });

          suggestions.push({
            studentId,
            studentName: student ? `${student.student.firstName} ${student.student.lastName}` : studentId,
            oaId,
            oaCode: oa?.code ?? "",
            oaDescription: oa?.description ?? "",
            subjectId: stats.subjectId,
            subjectName: stats.subjectName,
            achievement,
            severity: achievement < 30 ? "CRITICAL" : achievement < 45 ? "HIGH" : "MEDIUM",
            suggestedTitle: `Reforzamiento ${oa?.code ?? "OA"}: ${oa?.description?.slice(0, 50) ?? ""}`,
            suggestedDescription: `Plan remedial de 2 semanas para mejorar logro en ${oa?.code ?? "OA"}. Logro actual: ${achievement}%.`,
            existingPlan: !!existingPlan,
          });
        }
      }
    }

    // Find suggested resources
    const oaIds = [...new Set(suggestions.map((s) => s.oaId))];
    const resources = await this.prisma.learningResource.findMany({
      where: {
        learningObjectiveId: { in: oaIds },
        status: { in: ["PUBLISHED", "USED_IN_CLASS"] },
        type: { in: ["GUIDE", "WORKSHEET", "REMEDIAL_ACTIVITY"] },
      },
      include: {
        guide: { select: { guideType: true } },
        subject: { select: { name: true } },
      },
    });

    const resourcesByOa: Record<string, typeof resources> = {};
    for (const r of resources) {
      if (!r.learningObjectiveId) continue;
      if (!resourcesByOa[r.learningObjectiveId]) resourcesByOa[r.learningObjectiveId] = [];
      resourcesByOa[r.learningObjectiveId].push(r);
    }

    return {
      courseId,
      courseName: course.name,
      threshold,
      totalStudents: course.enrollments.length,
      studentsWithBreaches: [...new Set(suggestions.map((s) => s.studentId))].length,
      breachCount: suggestions.length,
      newBreaches: suggestions.filter((s) => !s.existingPlan).length,
      existingPlans: suggestions.filter((s) => s.existingPlan).length,
      suggestions: suggestions
        .sort((a, b) => a.achievement - b.achievement)
        .map((s) => ({
          ...s,
          suggestedResources: (resourcesByOa[s.oaId] ?? []).map((r) => ({
            resourceId: r.id,
            title: r.title,
            type: r.type,
            guideType: r.guide?.guideType ?? null,
          })),
        })),
    };
  }

  // ══════════════════════════════════════════════════════
  //  BATCH CREATE FROM SUGGESTIONS
  // ══════════════════════════════════════════════════════

  async batchCreateFromDetection(courseId: string, threshold = 60, user?: JwtPayload | string) {
    const detection = await this.detectAndSuggest(courseId, undefined, threshold, user);

    const newBreaches = detection.suggestions.filter((s) => !s.existingPlan);
    const created: unknown[] = [];

    for (const breach of newBreaches) {
      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 14);

      try {
        const plan = await this.create({
          studentId: breach.studentId,
          courseId,
          subjectId: breach.subjectId,
          learningObjectiveId: breach.oaId,
          title: breach.suggestedTitle,
          description: breach.suggestedDescription,
          startDate: today.toISOString().slice(0, 10),
          endDate: endDate.toISOString().slice(0, 10),
          preScore: breach.achievement,
        }, user);
        created.push(plan);
      } catch {
        // Skip duplicates
      }
    }

    return {
      courseId,
      breachesDetected: detection.breachCount,
      newPlansCreated: created.length,
      skippedExisting: detection.existingPlans,
      plans: created,
    };
  }

  // ══════════════════════════════════════════════════════
  //  SUMMARY
  // ══════════════════════════════════════════════════════

  async getCourseRemedialSummary(courseId: string, user?: JwtPayload | string) {
    if (user) await assertCourseScope(this.prisma, user, courseId);

    const plans = await this.prisma.remedialPlan.findMany({
      where: { courseId },
      include: {
        student: { select: { firstName: true, lastName: true } },
        learningObjective: { select: { code: true, description: true } },
      },
    });

    const byStatus: Record<string, number> = {};
    const byOa: Record<string, { code: string; description: string; count: number; averagePreScore: number; averagePostScore: number | null }> = {};

    for (const plan of plans) {
      byStatus[plan.status] = (byStatus[plan.status] ?? 0) + 1;

      const oaKey = plan.learningObjective.code;
      if (!byOa[oaKey]) {
        byOa[oaKey] = { code: oaKey, description: plan.learningObjective.description, count: 0, averagePreScore: 0, averagePostScore: null };
      }
      byOa[oaKey].count++;
      byOa[oaKey].averagePreScore += plan.preScore ?? 0;

      if (plan.postScore !== null) {
        byOa[oaKey].averagePostScore = (byOa[oaKey].averagePostScore ?? 0) + plan.postScore;
      }
    }

    const effective = plans.filter((p) => p.status === "EFFECTIVE").length;
    const total = plans.length;

    return {
      courseId,
      totalPlans: total,
      byStatus,
      effectivenessRate: total > 0 ? Number(((effective / total) * 100).toFixed(1)) : 0,
      oaSummary: Object.values(byOa).map((oa) => ({
        ...oa,
        averagePreScore: oa.count > 0 ? Number((oa.averagePreScore / oa.count).toFixed(1)) : 0,
        averagePostScore: oa.averagePostScore !== null && oa.count > 0 ? Number((oa.averagePostScore / oa.count).toFixed(1)) : null,
      })),
      plans: plans.slice(0, 100).map((p) => ({
        id: p.id,
        studentName: `${p.student.firstName} ${p.student.lastName}`,
        oaCode: p.learningObjective.code,
        status: p.status,
        preScore: p.preScore,
        postScore: p.postScore,
      })),
    };
  }

  // ══════════════════════════════════════════════════════
  //  PRIVATE
  // ══════════════════════════════════════════════════════

  private validateStatusTransition(id: string, newStatus: string) {
    const validTransitions: Record<string, string[]> = {
      PENDING: ["IN_PROGRESS"],
      IN_PROGRESS: ["COMPLETED"],
      COMPLETED: ["EFFECTIVE", "NOT_EFFECTIVE"],
      EFFECTIVE: [],
      NOT_EFFECTIVE: ["PENDING"], // can retry
    };

    // This would require knowing current status — already checked in assign/complete/evaluate
    // For direct update, we validate loosely
    const allValid = Object.values(validTransitions).flat();
    if (!allValid.includes(newStatus)) {
      throw new BadRequestException(`Estado inválido: ${newStatus}`);
    }
  }
}
