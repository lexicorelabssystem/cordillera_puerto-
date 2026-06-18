import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const rounds = Number(process.env.BCRYPT_ROUNDS || 10);

const users = [
  {
    email: "superadmin@cordillera.cl",
    password: "Demo2026*",
    firstName: "Super",
    lastName: "Admin",
    role: "SUPER_ADMIN",
    institution: false,
  },
  {
    email: "admin@cordillera.cl",
    password: "Admin2026*",
    firstName: "Admin",
    lastName: "Sistema",
    role: "ADMIN",
    institution: true,
  },
  {
    email: "benjamin.marileo@educacore.cl",
    password: "Temp2026**",
    firstName: "Benjamin",
    lastName: "Marileo",
    role: "ADMIN",
    institution: true,
  },
  {
    email: "utp@cordillera.cl",
    password: "Profesor2026*",
    firstName: "Jefa",
    lastName: "UTP",
    role: "UTP",
    institution: true,
  },
  {
    email: "director@cordillera.cl",
    password: "Profesor2026*",
    firstName: "Director",
    lastName: "Escuela",
    role: "DIRECTION",
    institution: true,
  },
  {
    email: "profesor@cordillera.cl",
    password: "Profesor2026*",
    firstName: "Carlos",
    lastName: "Lenguaje",
    role: "TEACHER",
    institution: true,
    teacher: true,
  },
  {
    email: "profe.mate@cordillera.cl",
    password: "Profesor2026*",
    firstName: "Maria",
    lastName: "Matematica",
    role: "TEACHER",
    institution: true,
    teacher: true,
  },
  {
    email: "profe.ciencias@cordillera.cl",
    password: "Profesor2026*",
    firstName: "Pedro",
    lastName: "Ciencias",
    role: "TEACHER",
    institution: true,
    teacher: true,
  },
  {
    email: "profe.historia@cordillera.cl",
    password: "Profesor2026*",
    firstName: "Ana",
    lastName: "Historia",
    role: "TEACHER",
    institution: true,
    teacher: true,
  },
];

async function main() {
  const institution = await prisma.institution.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
  });

  if (!institution) {
    throw new Error("No active institution found. Run the full seed first.");
  }

  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, rounds);
    const saved = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        passwordHash,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: true,
        deletedAt: null,
        mustChangePassword: false,
        institutionId: user.institution ? institution.id : null,
      },
      create: {
        email: user.email,
        passwordHash,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: true,
        mustChangePassword: false,
        institutionId: user.institution ? institution.id : null,
      },
    });

    if (user.teacher) {
      await prisma.teacher.upsert({
        where: { userId: saved.id },
        update: {},
        create: { userId: saved.id },
      });
    }

    console.log(`${user.email} -> ${user.role}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
