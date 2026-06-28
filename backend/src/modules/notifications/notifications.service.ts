import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { Prisma } from "@prisma/client";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        channel: "IN_APP",
        status: "PENDING",
        metadata: (data.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
  }

  async createForRole(options: {
    role: string;
    institutionId?: string;
    type: string;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
  }) {
    const where: Record<string, unknown> = {
      role: options.role,
      isActive: true,
    };
    if (options.institutionId) {
      where.institutionId = options.institutionId;
    }

    const users = await this.prisma.user.findMany({
      where,
      select: { id: true },
    });

    if (users.length === 0) {
      this.logger.debug(`No active ${options.role} users found to notify`);
      return [];
    }

    const notifications = await Promise.all(
      users.map((u) =>
        this.create({
          userId: u.id,
          type: options.type,
          title: options.title,
          message: options.message,
          metadata: options.metadata,
        })
      )
    );

    this.logger.log(`Created ${notifications.length} notifications for role ${options.role}`);
    return notifications;
  }

  async findByUser(userId: string, params?: { status?: string; limit?: number; offset?: number }) {
    const limit = Math.min(100, Math.max(1, Number.isFinite(params?.limit) ? Math.floor(params!.limit!) : 50));
    const offset = Math.max(0, Number.isFinite(params?.offset) ? Math.floor(params!.offset!) : 0);
    const where: Record<string, unknown> = { userId };
    if (params?.status) {
      where.status = params.status;
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { notifications, total };
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, status: { in: ["PENDING", "SENT"] } },
    });
  }

  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) return null;

    return this.prisma.notification.update({
      where: { id },
      data: { status: "READ", readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, status: { in: ["PENDING", "SENT"] } },
      data: { status: "READ", readAt: new Date() },
    });

    return { marked: result.count };
  }
}
