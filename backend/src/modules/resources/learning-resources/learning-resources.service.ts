import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { CreateResourceDto, ResourceFilterDto, ResourceUsageDto, UpdateResourceDto } from "./dto/create-resource.dto.js";
import { GuideType, Prisma, ResourceType } from "@prisma/client";
import { assertCourseScope, assertInstitutionScope, resolveUserScope } from "../../../common/authz/access-scope.js";

@Injectable()
export class LearningResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateResourceDto, userId: string) {
    if (dto.type === "GUIDE" && !dto.guideType) {
      throw new BadRequestException("Las guías requieren especificar guideType");
    }

    const resource = await this.prisma.learningResource.create({
      data: {
        institutionId: dto.institutionId,
        title: dto.title,
        description: dto.description ?? null,
        type: dto.type,
        subjectId: dto.subjectId ?? null,
        courseId: dto.courseId ?? null,
        gradeLevel: dto.gradeLevel ?? null,
        axisId: dto.axisId ?? null,
        learningObjectiveId: dto.learningObjectiveId ?? null,
        skillId: dto.skillId ?? null,
        assessmentId: dto.assessmentId ?? null,
        remedialPlanId: dto.remedialPlanId ?? null,
        status: "DRAFT",
        createdBy: userId,
      },
    });

    if (dto.type === "GUIDE" && dto.guideType) {
      await this.prisma.guide.create({
        data: {
          resourceId: resource.id,
          guideType: dto.guideType,
          instructions: dto.instructions ?? null,
          isPrintable: dto.isPrintable ?? true,
        },
      });
    }

    if (dto.type === "PRESENTATION" && dto.presentationType) {
      await this.prisma.presentation.create({
        data: {
          resourceId: resource.id,
          presentationType: dto.presentationType,
        },
      });
    }

    return this.findById(resource.id);
  }

  async findAll(filters: ResourceFilterDto, page = 1, limit = 20) {
    page = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
    limit = Number.isFinite(limit) ? Math.min(100, Math.max(1, Math.floor(limit))) : 20;
    const where: Record<string, unknown> = { status: { not: "ARCHIVED" } };
    if (filters.institutionId) where.institutionId = filters.institutionId;
    if (filters.type) where.type = filters.type;
    if (filters.subjectId) where.subjectId = filters.subjectId;
    if (filters.courseId) where.courseId = filters.courseId;
    if (filters.learningObjectiveId) where.learningObjectiveId = filters.learningObjectiveId;
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.learningResource.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: {
          subject: { select: { id: true, name: true } },
          course: { select: { id: true, name: true, gradeLevel: true } },
          learningObjective: { select: { id: true, code: true, description: true } },
          guide: true,
          presentation: true,
          _count: { select: { lessonResources: true } },
        },
      }),
      this.prisma.learningResource.count({ where }),
    ]);

    const usageByResource = await this.usageSummaryForResources(data.map((resource) => resource.id));

    return {
      data: data.map((resource) => ({
        ...resource,
        usageLogs: usageByResource[resource.id]?.latest ? [usageByResource[resource.id].latest] : [],
        _count: {
          ...resource._count,
          usageLogs: usageByResource[resource.id]?.count ?? 0,
        },
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrevious: page > 1 },
    };
  }

  async findById(id: string) {
    const resource = await this.prisma.learningResource.findUnique({
      where: { id },
      include: {
        institution: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        course: { select: { id: true, name: true, gradeLevel: true } },
        axis: { select: { id: true, name: true } },
        learningObjective: { select: { id: true, code: true, description: true } },
        skill: { select: { id: true, name: true } },
        assessment: { select: { id: true, title: true, status: true } },
        remedialPlan: { select: { id: true, title: true, status: true } },
        guide: true,
        presentation: { include: { fileAsset: true } },
        lessonResources: {
          include: { lesson: { select: { id: true, title: true, date: true, course: { select: { name: true } } } } },
        },
      },
    });
    if (!resource) throw new NotFoundException("Recurso no encontrado");
    const usageLogs = await this.usageHistory(id, false);
    return { ...resource, usageLogs };
  }

  async update(id: string, dto: UpdateResourceDto) {
    await this.findById(id);

    const updated = await this.prisma.learningResource.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.learningObjectiveId !== undefined && { learningObjectiveId: dto.learningObjectiveId }),
        ...(dto.assessmentId !== undefined && { assessmentId: dto.assessmentId }),
        version: { increment: 1 },
      },
    });

    if (dto.instructions !== undefined || dto.isPrintable !== undefined) {
      await this.prisma.guide.updateMany({
        where: { resourceId: id },
        data: {
          ...(dto.instructions !== undefined && { instructions: dto.instructions }),
          ...(dto.isPrintable !== undefined && { isPrintable: dto.isPrintable }),
        },
      });
    }

    return this.findById(id);
  }

  async publish(id: string) {
    const resource = await this.prisma.learningResource.findUnique({ where: { id } });
    if (!resource) throw new NotFoundException("Recurso no encontrado");
    if (resource.status !== "DRAFT" && resource.status !== "READY") {
      throw new BadRequestException("Solo se pueden publicar recursos en estado DRAFT o READY");
    }
    return this.prisma.learningResource.update({
      where: { id },
      data: { status: "PUBLISHED" },
    });
  }

  async usageHistory(id: string, ensureResource = true) {
    if (ensureResource) {
      const exists = await this.prisma.learningResource.findUnique({ where: { id }, select: { id: true } });
      if (!exists) throw new NotFoundException("Recurso no encontrado");
    }
    return this.usageRows(id, 100);
  }

  async markUsed(id: string, dto: ResourceUsageDto, userId: string) {
    const resource = await this.prisma.learningResource.findUnique({ where: { id } });
    if (!resource) throw new NotFoundException("Recurso no encontrado");
    await assertCourseScope(this.prisma, userId, dto.courseId, dto.subjectId);
    const now = new Date();

    await this.prisma.learningResource.update({
      where: { id },
      data: { status: "USED_IN_CLASS", usedAt: now },
    });

    const subjectId = dto.subjectId ?? resource.subjectId;
    const [usage] = await this.prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO resource_usage_logs ("resourceId", "courseId", "subjectId", "usedById", "action", "usedAt", "notes")
      VALUES (${id}::uuid, ${dto.courseId}::uuid, ${subjectId}::uuid, ${userId}::uuid, ${(dto.action || "USED").toUpperCase()}, ${now}, ${dto.notes ?? null})
      RETURNING id
    `;
    const [row] = await this.usageRowsByIds([usage.id]);
    return row;
  }

  private async usageSummaryForResources(resourceIds: string[]) {
    if (!resourceIds.length) return {};
    const rows = await this.prisma.$queryRaw<Array<{
      resourceId: string;
      count: bigint;
      id: string | null;
      action: string | null;
      usedAt: Date | null;
      notes: string | null;
      courseId: string | null;
      courseName: string | null;
      gradeLevel: number | null;
      section: string | null;
      subjectId: string | null;
      subjectName: string | null;
      usedById: string | null;
      firstName: string | null;
      lastName: string | null;
    }>>`
      SELECT
        lr.id AS "resourceId",
        COUNT(rul.id) AS "count",
        latest.id,
        latest.action,
        latest."usedAt",
        latest.notes,
        c.id AS "courseId",
        c.name AS "courseName",
        c."gradeLevel",
        c.section,
        s.id AS "subjectId",
        s.name AS "subjectName",
        u.id AS "usedById",
        u."firstName",
        u."lastName"
      FROM learning_resources lr
      LEFT JOIN resource_usage_logs rul ON rul."resourceId" = lr.id
      LEFT JOIN LATERAL (
        SELECT * FROM resource_usage_logs usage
        WHERE usage."resourceId" = lr.id
        ORDER BY usage."usedAt" DESC
        LIMIT 1
      ) latest ON true
      LEFT JOIN courses c ON c.id = latest."courseId"
      LEFT JOIN subjects s ON s.id = latest."subjectId"
      LEFT JOIN users u ON u.id = latest."usedById"
      WHERE lr.id IN (${Prisma.join(resourceIds.map((id) => Prisma.sql`${id}::uuid`))})
      GROUP BY lr.id, latest.id, latest.action, latest."usedAt", latest.notes, c.id, c.name, c."gradeLevel", c.section, s.id, s.name, u.id, u."firstName", u."lastName"
    `;
    return rows.reduce<Record<string, { count: number; latest: unknown | null }>>((acc, row) => {
      acc[row.resourceId] = {
        count: Number(row.count),
        latest: row.id ? this.mapUsageRow(row) : null,
      };
      return acc;
    }, {});
  }

  private async usageRows(resourceId: string, limit: number) {
    const rows = await this.prisma.$queryRaw<Array<{
      id: string;
      action: string;
      usedAt: Date;
      notes: string | null;
      courseId: string;
      courseName: string;
      gradeLevel: number | null;
      section: string | null;
      subjectId: string | null;
      subjectName: string | null;
      usedById: string;
      firstName: string;
      lastName: string;
    }>>`
      SELECT
        rul.id,
        rul.action,
        rul."usedAt",
        rul.notes,
        c.id AS "courseId",
        c.name AS "courseName",
        c."gradeLevel",
        c.section,
        s.id AS "subjectId",
        s.name AS "subjectName",
        u.id AS "usedById",
        u."firstName",
        u."lastName"
      FROM resource_usage_logs rul
      INNER JOIN courses c ON c.id = rul."courseId"
      LEFT JOIN subjects s ON s.id = rul."subjectId"
      INNER JOIN users u ON u.id = rul."usedById"
      WHERE rul."resourceId" = ${resourceId}::uuid
      ORDER BY rul."usedAt" DESC
      LIMIT ${limit}
    `;
    return rows.map((row) => this.mapUsageRow(row));
  }

  private async usageRowsByIds(ids: string[]) {
    if (!ids.length) return [];
    const rows = await this.prisma.$queryRaw<Array<{
      id: string;
      action: string;
      usedAt: Date;
      notes: string | null;
      courseId: string;
      courseName: string;
      gradeLevel: number | null;
      section: string | null;
      subjectId: string | null;
      subjectName: string | null;
      usedById: string;
      firstName: string;
      lastName: string;
    }>>`
      SELECT
        rul.id,
        rul.action,
        rul."usedAt",
        rul.notes,
        c.id AS "courseId",
        c.name AS "courseName",
        c."gradeLevel",
        c.section,
        s.id AS "subjectId",
        s.name AS "subjectName",
        u.id AS "usedById",
        u."firstName",
        u."lastName"
      FROM resource_usage_logs rul
      INNER JOIN courses c ON c.id = rul."courseId"
      LEFT JOIN subjects s ON s.id = rul."subjectId"
      INNER JOIN users u ON u.id = rul."usedById"
      WHERE rul.id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
    `;
    return rows.map((row) => this.mapUsageRow(row));
  }

  private mapUsageRow(row: {
    id: string | null;
    action: string | null;
    usedAt: Date | null;
    notes: string | null;
    courseId: string | null;
    courseName: string | null;
    gradeLevel: number | null;
    section: string | null;
    subjectId: string | null;
    subjectName: string | null;
    usedById: string | null;
    firstName: string | null;
    lastName: string | null;
  }) {
    return {
      id: row.id,
      action: row.action,
      usedAt: row.usedAt,
      notes: row.notes,
      course: row.courseId ? { id: row.courseId, name: row.courseName, gradeLevel: row.gradeLevel, section: row.section } : null,
      subject: row.subjectId ? { id: row.subjectId, name: row.subjectName } : null,
      usedBy: row.usedById ? { id: row.usedById, firstName: row.firstName, lastName: row.lastName } : null,
    };
  }
  async archive(id: string, userId?: string) {
    const resource = await this.prisma.learningResource.findUnique({
      where: { id },
      select: { id: true, institutionId: true, courseId: true, subjectId: true, createdBy: true },
    });
    if (!resource) throw new NotFoundException("Recurso no encontrado");
    if (userId) {
      const scope = await resolveUserScope(this.prisma, userId);
      if (!scope.isSuperAdmin && !scope.isGlobalAdmin && resource.createdBy !== scope.userId) {
        if (resource.courseId) {
          await assertCourseScope(this.prisma, userId, resource.courseId, resource.subjectId ?? undefined);
        } else {
          await assertInstitutionScope(this.prisma, userId, resource.institutionId);
        }
      }
    }
    return this.prisma.learningResource.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });
  }

  async findByOa(learningObjectiveId: string) {
    return this.prisma.learningResource.findMany({
      where: {
        learningObjectiveId,
        status: { in: ["PUBLISHED", "USED_IN_CLASS"] },
        OR: [
          { type: "GUIDE" },
          { type: "WORKSHEET" },
          { type: "REMEDIAL_ACTIVITY" },
        ],
      },
      include: {
        guide: true,
        learningObjective: { select: { code: true, description: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async suggestForRemedial(learningObjectiveId: string) {
    const resources = await this.findByOa(learningObjectiveId);
    const lowestDifficulty = await this.prisma.learningResource.findMany({
      where: {
        learningObjectiveId,
        status: { in: ["PUBLISHED", "USED_IN_CLASS"] },
        type: "REMEDIAL_ACTIVITY",
      },
      take: 3,
      orderBy: { updatedAt: "desc" },
    });

    return {
      objectiveId: learningObjectiveId,
      directResources: resources,
      suggestedRemedial: lowestDifficulty,
    };
  }
}
