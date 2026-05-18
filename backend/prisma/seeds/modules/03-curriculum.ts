import { PrismaClient } from "@prisma/client";

export interface CurriculumSeedResult {
  axes: Record<string, string>;
  skills: Record<string, string>;
}

export async function seed(prisma: PrismaClient, subjects: Record<string, string>): Promise<CurriculumSeedResult> {
  console.log("\n─── CURRICULUM ─────────────────────────────");

  const axesData: { subjectName: string; name: string; description: string }[] = [
    { subjectName: "Lenguaje", name: "Comprensión Lectora", description: "Extraer información explícita e implícita de textos" },
    { subjectName: "Lenguaje", name: "Producción Escrita", description: "Producir textos coherentes y cohesionados" },
    { subjectName: "Lenguaje", name: "Comunicación Oral", description: "Expresarse y comprender discursos orales" },
    { subjectName: "Matemática", name: "Números y Operaciones", description: "Comprender y aplicar operaciones aritméticas" },
    { subjectName: "Matemática", name: "Geometría", description: "Identificar y analizar formas y figuras geométricas" },
    { subjectName: "Matemática", name: "Medición y Datos", description: "Medir, recolectar y analizar datos" },
    { subjectName: "Ciencias", name: "Ciencias de la Vida", description: "Seres vivos y ecosistemas" },
    { subjectName: "Ciencias", name: "Ciencias Físicas y Químicas", description: "Materia, energía y sus transformaciones" },
    { subjectName: "Historia y Geografía", name: "Historia", description: "Comprensión del tiempo histórico" },
    { subjectName: "Historia y Geografía", name: "Geografía", description: "Relación ser humano-medio ambiente" },
  ];
  const axes: Record<string, string> = {};
  for (const a of axesData) {
    const axis = await prisma.axis.upsert({
      where: { subjectId_name: { subjectId: subjects[a.subjectName]!, name: a.name } },
      update: {},
      create: { subjectId: subjects[a.subjectName]!, name: a.name, description: a.description },
    });
    axes[`${a.subjectName}|${a.name}`] = axis.id;
  }
  console.log(`  [✓] Axes: ${axesData.length}`);

  const skillsData: string[] = [
    "Analizar", "Interpretar", "Resolver", "Argumentar", "Comparar",
    "Clasificar", "Inferir", "Evaluar", "Sintetizar", "Aplicar",
  ];
  const skills: Record<string, string> = {};
  for (const s of skillsData) {
    const skill = await prisma.skill.upsert({
      where: { name: s },
      update: {},
      create: { name: s },
    });
    skills[s] = skill.id;
  }
  console.log(`  [✓] Skills: ${skillsData.length}`);

  const langUnits = [
    { name: "Unidad 1: Textos Narrativos", semester: 1 },
    { name: "Unidad 2: Textos Informativos", semester: 1 },
    { name: "Unidad 3: Poesía y Drama", semester: 2 },
    { name: "Unidad 4: Medios de Comunicación", semester: 2 },
  ];
  const mathUnits = [
    { name: "Unidad 1: Números y Operaciones", semester: 1 },
    { name: "Unidad 2: Patrones y Álgebra", semester: 1 },
    { name: "Unidad 3: Geometría", semester: 2 },
    { name: "Unidad 4: Medición y Datos", semester: 2 },
  ];
  for (let grade = 1; grade <= 8; grade++) {
    for (const u of langUnits) {
      await prisma.curriculumUnit.upsert({
        where: { subjectId_gradeLevel_name: { subjectId: subjects["Lenguaje"]!, gradeLevel: grade, name: u.name } },
        update: {},
        create: { subjectId: subjects["Lenguaje"]!, gradeLevel: grade, name: u.name, semester: u.semester },
      });
    }
    for (const u of mathUnits) {
      await prisma.curriculumUnit.upsert({
        where: { subjectId_gradeLevel_name: { subjectId: subjects["Matemática"]!, gradeLevel: grade, name: u.name } },
        update: {},
        create: { subjectId: subjects["Matemática"]!, gradeLevel: grade, name: u.name, semester: u.semester },
      });
    }
  }
  console.log("  [✓] Curriculum Units: 64 (Lenguaje + Matemática, 1°-8°)");

  const oaLang: { code: string; description: string; axisName: string; skillNames: string[] }[] = [
    { code: "OA1-LEN", description: "Leer comprensivamente textos narrativos de estructura simple", axisName: "Comprensión Lectora", skillNames: ["Analizar", "Interpretar"] },
    { code: "OA2-LEN", description: "Extraer información explícita e implícita de textos literarios", axisName: "Comprensión Lectora", skillNames: ["Inferir", "Analizar"] },
    { code: "OA3-LEN", description: "Producir textos escritos con estructura clara", axisName: "Producción Escrita", skillNames: ["Sintetizar", "Aplicar"] },
    { code: "OA4-LEN", description: "Expresar ideas oralmente con coherencia", axisName: "Comunicación Oral", skillNames: ["Argumentar", "Aplicar"] },
  ];
  const oaMath: { code: string; description: string; axisName: string; skillNames: string[] }[] = [
    { code: "OA1-MAT", description: "Resolver problemas que involucran adición y sustracción", axisName: "Números y Operaciones", skillNames: ["Resolver", "Aplicar"] },
    { code: "OA2-MAT", description: "Comprender la multiplicación y división", axisName: "Números y Operaciones", skillNames: ["Resolver", "Analizar"] },
    { code: "OA3-MAT", description: "Identificar y describir figuras geométricas", axisName: "Geometría", skillNames: ["Clasificar", "Comparar"] },
    { code: "OA4-MAT", description: "Recolectar y representar datos en gráficos", axisName: "Medición y Datos", skillNames: ["Interpretar", "Sintetizar"] },
  ];

  for (let grade = 1; grade <= 8; grade++) {
    for (const oa of oaLang) {
      const created = await prisma.learningObjective.upsert({
        where: { code: `${oa.code}-${grade}` },
        update: {},
        create: {
          subjectId: subjects["Lenguaje"]!,
          axisId: axes[`Lenguaje|${oa.axisName}`] ?? null,
          code: `${oa.code}-${grade}`,
          description: `${oa.description} (${grade}° básico)`,
          gradeLevel: grade,
        },
      });
      for (const skillName of oa.skillNames) {
        await prisma.learningObjectiveSkill.upsert({
          where: { learningObjectiveId_skillId: { learningObjectiveId: created.id, skillId: skills[skillName]! } },
          update: {},
          create: { learningObjectiveId: created.id, skillId: skills[skillName]! },
        });
      }
    }
    for (const oa of oaMath) {
      const created = await prisma.learningObjective.upsert({
        where: { code: `${oa.code}-${grade}` },
        update: {},
        create: {
          subjectId: subjects["Matemática"]!,
          axisId: axes[`Matemática|${oa.axisName}`] ?? null,
          code: `${oa.code}-${grade}`,
          description: `${oa.description} (${grade}° básico)`,
          gradeLevel: grade,
        },
      });
      for (const skillName of oa.skillNames) {
        await prisma.learningObjectiveSkill.upsert({
          where: { learningObjectiveId_skillId: { learningObjectiveId: created.id, skillId: skills[skillName]! } },
          update: {},
          create: { learningObjectiveId: created.id, skillId: skills[skillName]! },
        });
      }
    }
  }
  console.log("  [✓] Learning Objectives: 64 (8 grades × 4 Lenguaje + 4 Matemática)");

  return { axes, skills };
}
