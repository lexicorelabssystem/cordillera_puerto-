import { PrismaClient } from "@prisma/client";

export interface InstitutionSeedResult {
  institutionId: string;
}

export async function seed(prisma: PrismaClient): Promise<InstitutionSeedResult> {
  console.log("\n─── INSTITUTION ───────────────────────────");

  const institution = await prisma.institution.upsert({
    where: { rbd: "DEMO-001" },
    update: {
      address: "Av. Educación 1234, Santiago",
      phone: "+56221234567",
      email: "contacto@cordillera.cl",
      sede: "Sede Central",
      region: "Metropolitana",
      comuna: "Santiago",
      jornada: "MAÑANA",
    },
    create: {
      name: "Colegio Cordillera Demo",
      rbd: "DEMO-001",
      address: "Av. Educación 1234, Santiago",
      phone: "+56221234567",
      email: "contacto@cordillera.cl",
      sede: "Sede Central",
      region: "Metropolitana",
      comuna: "Santiago",
      jornada: "MAÑANA",
    },
  });
  console.log(`  [✓] Institution: ${institution.name}`);

  await prisma.institutionConfig.upsert({
    where: { institutionId: institution.id },
    update: {},
    create: {
      institutionId: institution.id,
      gradingScaleMin: 1.0,
      gradingScaleMax: 7.0,
      exigencia: 60.0,
      allowGradeEdit: true,
      allowSelfRegistration: false,
      defaultLanguage: "es-CL",
    },
  });
  console.log("  [✓] Institution Config: escala 1.0-7.0, exigencia 60%");

  return { institutionId: institution.id };
}
