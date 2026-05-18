import { Injectable, Inject } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { DEFAULT_FEATURES, type FeatureFlag } from "@cordillera/shared/features.js";

@Injectable()
export class FeatureFlagsService {
  private institutionCache = new Map<string, Record<FeatureFlag, boolean>>();

  constructor(private readonly prisma: PrismaService) {}

  async getFlags(institutionId: string): Promise<Record<FeatureFlag, boolean>> {
    const cached = this.institutionCache.get(institutionId);
    if (cached) return cached;

    const config = await this.prisma.institutionConfig.findUnique({
      where: { institutionId },
      select: { allowGradeEdit: true, allowSelfRegistration: true },
    });

    const flags = { ...DEFAULT_FEATURES };

    if (config?.allowSelfRegistration) {
      flags.parent_portal = true;
    }

    this.institutionCache.set(institutionId, flags);
    return flags;
  }

  async isEnabled(institutionId: string, flag: FeatureFlag): Promise<boolean> {
    const flags = await this.getFlags(institutionId);
    return flags[flag] ?? DEFAULT_FEATURES[flag];
  }

  clearCache(institutionId?: string): void {
    if (institutionId) {
      this.institutionCache.delete(institutionId);
    } else {
      this.institutionCache.clear();
    }
  }
}
