import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import type { JwtPayload } from "../../common/decorators/current-user.decorator.js";
import { resolveUserScope } from "../../common/authz/access-scope.js";

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: {
    action?: string; entityType?: string; entityId?: string;
    actorId?: string; dateFrom?: string; dateTo?: string; search?: string;
  }, page = 1, limit = 50, user?: JwtPayload) {
    const where: Record<string, unknown> = {};
    const scope = user ? await resolveUserScope(this.prisma, user) : null;

    if (filters.action) where.action = filters.action;
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.actorId) where.actorId = filters.actorId;
    if (scope && !scope.isGlobalAdmin) {
      where.institutionId = scope.institutionId ?? "00000000-0000-0000-0000-000000000000";
    }
    if (filters.search) {
      where.metadata = { path: "$", string_contains: filters.search };
    }
    if (filters.dateFrom || filters.dateTo) {
      const createdAt: Record<string, Date> = {};
      if (filters.dateFrom) createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) createdAt.lte = new Date(filters.dateTo);
      where.createdAt = createdAt;
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          actor: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
          institution: { select: { id: true, name: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrevious: page > 1 },
    };
  }

  async getActionsSummary(days = 7, user?: JwtPayload) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const scope = user ? await resolveUserScope(this.prisma, user) : null;

    const logs = await this.prisma.auditLog.findMany({
      where: {
        createdAt: { gte: since },
        ...(scope && !scope.isGlobalAdmin
          ? { institutionId: scope.institutionId ?? "00000000-0000-0000-0000-000000000000" }
          : {}),
      },
      select: { action: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    const byDay: Record<string, Record<string, number>> = {};
    const actionCounts: Record<string, number> = {};

    for (const log of logs) {
      const day = log.createdAt.toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = {};
      byDay[day][log.action] = (byDay[day][log.action] ?? 0) + 1;
      actionCounts[log.action] = (actionCounts[log.action] ?? 0) + 1;
    }

    const topActions = Object.entries(actionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([action, count]) => ({ action, count }));

    return {
      periodDays: days,
      totalEvents: logs.length,
      topActions,
      dailyActivity: Object.entries(byDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, actions]) => ({ day, total: Object.values(actions).reduce((s, c) => s + c, 0), actions })),
    };
  }

  async log(params: {
    actorId?: string | null; action: string; entityType: string;
    entityId?: string | null; institutionId?: string | null; metadata?: string | null;
  }) {
    return this.prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? undefined,
        institutionId: params.institutionId ?? undefined,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? undefined,
        metadata: params.metadata ?? undefined,
      },
    });
  }
}
