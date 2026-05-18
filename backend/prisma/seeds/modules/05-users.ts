import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 10;

export interface UserSeedResult {
  teacherIds: Record<string, string>;
  adminUserId: string;
}

export async function seed(prisma: PrismaClient, institutionId: string): Promise<UserSeedResult> {
  console.log("\n─── USERS ──────────────────────────────────");

  const defaultHash = await bcrypt.hash("Demo2026*", BCRYPT_ROUNDS);

  const usersToCreate = [
    { email: "superadmin@cordillera.cl", firstName: "Super", lastName: "Admin", role: "SUPER_ADMIN" as const },
    { email: "admin@cordillera.cl", firstName: "Admin", lastName: "Cordillera", role: "ADMIN" as const },
    { email: "direccion@cordillera.cl", firstName: "Equipo", lastName: "Dirección", role: "DIRECTION" as const },
    { email: "utp@cordillera.cl", firstName: "Coordinadora", lastName: "UTP", role: "UTP" as const },
    { email: "profesor@cordillera.cl", firstName: "Paula", lastName: "Docente", role: "TEACHER" as const },
    { email: "profe.mate@cordillera.cl", firstName: "Mario", lastName: "Matemática", role: "TEACHER" as const },
    { email: "profe.historia@cordillera.cl", firstName: "Andrea", lastName: "Historia", role: "TEACHER" as const },
    { email: "profe.ciencias@cordillera.cl", firstName: "Carlos", lastName: "Ciencias", role: "TEACHER" as const },
  ];

  const teacherIds: Record<string, string> = {};
  let adminUserId = "";

  for (const u of usersToCreate) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        passwordHash: defaultHash,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        institutionId,
      },
    });

    if (u.email === "admin@cordillera.cl") adminUserId = user.id;

    if (u.role === "TEACHER") {
      const teacher = await prisma.teacher.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id, title: "Profesor/a" },
      });
      teacherIds[u.email] = teacher.id;
    }
  }
  console.log(`  [✓] Users: ${usersToCreate.length} (admin, direction, utp, 4 teachers)`);

  return { teacherIds, adminUserId };
}
