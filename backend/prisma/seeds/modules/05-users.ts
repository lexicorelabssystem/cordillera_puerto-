import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 10;

export interface UserSeedResult {
  teacherIds: Record<string, string>;
  adminUserId: string;
}

export async function seed(prisma: PrismaClient, institutionId: string): Promise<UserSeedResult> {
  console.log("\n─── USERS ──────────────────────────────────");

  const superAdminHash = await bcrypt.hash("Demo2026*", BCRYPT_ROUNDS);
  const defaultHash = await bcrypt.hash("Admin2026*", BCRYPT_ROUNDS);
  const teacherHash = await bcrypt.hash("Profesor2026*", BCRYPT_ROUNDS);

  await prisma.user.upsert({
    where: { email: "superadmin@cordillera.cl" },
    update: {
      passwordHash: superAdminHash,
      isActive: true,
      deletedAt: null,
      mustChangePassword: false,
      role: "SUPER_ADMIN",
      institutionId: null,
    },
    create: {
      email: "superadmin@cordillera.cl",
      passwordHash: superAdminHash,
      firstName: "Super",
      lastName: "Admin",
      role: "SUPER_ADMIN",
    },
  });
  console.log("  [✓] Super Admin: superadmin@cordillera.cl / Demo2026*");

  const admin = await prisma.user.upsert({
    where: { email: "admin@cordillera.cl" },
    update: {
      passwordHash: defaultHash,
      isActive: true,
      deletedAt: null,
      mustChangePassword: false,
      role: "ADMIN",
      institutionId,
    },
    create: {
      email: "admin@cordillera.cl",
      passwordHash: defaultHash,
      firstName: "Admin",
      lastName: "Sistema",
      role: "ADMIN",
      institutionId,
    },
  });
  console.log("  [✓] Admin: admin@cordillera.cl / Admin2026*");

  const teacherDefs = [
    { email: "profesor@cordillera.cl", firstName: "Carlos", lastName: "Lenguaje", role: "TEACHER" as const },
    { email: "profe.mate@cordillera.cl", firstName: "Maria", lastName: "Matematica", role: "TEACHER" as const },
    { email: "profe.ciencias@cordillera.cl", firstName: "Pedro", lastName: "Ciencias", role: "TEACHER" as const },
    { email: "profe.historia@cordillera.cl", firstName: "Ana", lastName: "Historia", role: "TEACHER" as const },
    { email: "utp@cordillera.cl", firstName: "Jefa", lastName: "UTP", role: "UTP" as const },
    { email: "director@cordillera.cl", firstName: "Director", lastName: "Escuela", role: "DIRECTION" as const },
  ];

  const teacherIds: Record<string, string> = {};

  for (const def of teacherDefs) {
    const user = await prisma.user.upsert({
      where: { email: def.email },
      update: {
        passwordHash: teacherHash,
        isActive: true,
        deletedAt: null,
        mustChangePassword: false,
      },
      create: {
        email: def.email,
        passwordHash: teacherHash,
        firstName: def.firstName,
        lastName: def.lastName,
        role: def.role,
        institutionId,
      },
    });

    if (def.role === "TEACHER") {
      const teacher = await prisma.teacher.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id },
      });
      teacherIds[def.email] = teacher.id;
    }
  }

  console.log(`  [✓] Teachers: ${Object.keys(teacherIds).length} (profesor / profe.mate / profe.ciencias / profe.historia)`);
  console.log("  [✓] Staff: utp@cordillera.cl / director@cordillera.cl");
  console.log("  [✓] All staff passwords: Profesor2026*");

  return { teacherIds, adminUserId: admin.id };
}
