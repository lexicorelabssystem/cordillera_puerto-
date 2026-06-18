import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const rounds = Number(process.env.BCRYPT_ROUNDS || 10);

const ADMIN_EMAIL = "benjamin.marileo@educacore.cl";
const ADMIN_PASSWORD = "Temp2026**";

async function main() {
  const institution = await prisma.institution.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
  });

  if (!institution) {
    throw new Error("No active institution found. Run the full seed first.");
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, rounds);
  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      passwordHash,
      firstName: "Benjamin",
      lastName: "Marileo",
      role: "ADMIN",
      isActive: true,
      deletedAt: null,
      mustChangePassword: false,
      institutionId: institution.id,
    },
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      firstName: "Benjamin",
      lastName: "Marileo",
      role: "ADMIN",
      isActive: true,
      mustChangePassword: false,
      institutionId: institution.id,
    },
  });

  console.log(`${user.email} -> ${user.role}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
