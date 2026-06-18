import { Inject, Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";
import { PrismaService } from "./modules/prisma/prisma.service.js";
import type { AppConfig } from "./config/config.module.js";

const DEMO_USERS: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  needsInstitution: boolean;
  teacher?: boolean;
}[] = [
  {
    email: "superadmin@cordillera.cl",
    password: "Demo2026*",
    firstName: "Super",
    lastName: "Admin",
    role: "SUPER_ADMIN",
    needsInstitution: false,
  },
  {
    email: "admin@cordillera.cl",
    password: "Admin2026*",
    firstName: "Admin",
    lastName: "Sistema",
    role: "ADMIN",
    needsInstitution: true,
  },
  {
    email: "benjamin.marileo@educacore.cl",
    password: "Temp2026**",
    firstName: "Benjamin",
    lastName: "Marileo",
    role: "ADMIN",
    needsInstitution: true,
  },
  {
    email: "utp@cordillera.cl",
    password: "Profesor2026*",
    firstName: "Jefa",
    lastName: "UTP",
    role: "UTP",
    needsInstitution: true,
  },
  {
    email: "director@cordillera.cl",
    password: "Profesor2026*",
    firstName: "Director",
    lastName: "Escuela",
    role: "DIRECTION",
    needsInstitution: true,
  },
  {
    email: "profesor@cordillera.cl",
    password: "Profesor2026*",
    firstName: "Carlos",
    lastName: "Lenguaje",
    role: "TEACHER",
    needsInstitution: true,
    teacher: true,
  },
];

@Injectable()
export class DemoSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DemoSeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject("APP_CONFIG") private readonly config: AppConfig,
  ) {}

  async onApplicationBootstrap() {
    if (!this.config.enableDemoSeed) return;

    const institution = await this.prisma.institution.upsert({
      where: { rbd: "DEMO-CORDILLERA" },
      update: { name: "Colegio Cordillera Demo", isActive: true, deletedAt: null },
      create: {
        name: "Colegio Cordillera Demo",
        rbd: "DEMO-CORDILLERA",
        region: "Metropolitana",
        comuna: "Santiago",
        isActive: true,
      },
    });

    for (const demoUser of DEMO_USERS) {
      const passwordHash = await bcrypt.hash(demoUser.password, this.config.bcryptRounds);
      const user = await this.prisma.user.upsert({
        where: { email: demoUser.email },
        update: {
          passwordHash,
          firstName: demoUser.firstName,
          lastName: demoUser.lastName,
          role: demoUser.role,
          institutionId: demoUser.needsInstitution ? institution.id : null,
          isActive: true,
          deletedAt: null,
          mustChangePassword: false,
        },
        create: {
          email: demoUser.email,
          passwordHash,
          firstName: demoUser.firstName,
          lastName: demoUser.lastName,
          role: demoUser.role,
          institutionId: demoUser.needsInstitution ? institution.id : null,
          isActive: true,
          mustChangePassword: false,
        },
      });

      if (demoUser.teacher) {
        await this.prisma.teacher.upsert({
          where: { userId: user.id },
          update: {},
          create: { userId: user.id },
        });
      }
    }

    this.logger.warn("Demo users ensured because ENABLE_DEMO_SEED=true");
  }
}
