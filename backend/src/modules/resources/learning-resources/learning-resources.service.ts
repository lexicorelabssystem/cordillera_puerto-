import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { CreateResourceDto, UpdateResourceDto, ResourceFilterDto } from "./dto/create-resource.dto.js";
import { ResourceType, GuideType } from "@prisma/client";

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
    const where: Record<string, unknown> = {};
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

    return {
      data,
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
    return resource;
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

  async markUsed(id: string) {
    const resource = await this.prisma.learningResource.findUnique({ where: { id } });
    if (!resource) throw new NotFoundException("Recurso no encontrado");

    return this.prisma.learningResource.update({
      where: { id },
      data: { status: "USED_IN_CLASS", usedAt: new Date() },
    });
  }

  async archive(id: string) {
    await this.findById(id);
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
