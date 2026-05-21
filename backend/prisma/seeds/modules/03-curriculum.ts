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
  const cienciasUnits = [
    { name: "Unidad 1: Seres vivos y ecosistemas", semester: 1 },
    { name: "Unidad 2: Materia y energía", semester: 1 },
    { name: "Unidad 3: Tierra y universo", semester: 2 },
    { name: "Unidad 4: Ciencia, tecnología y sociedad", semester: 2 },
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
    for (const u of cienciasUnits) {
      await prisma.curriculumUnit.upsert({
        where: { subjectId_gradeLevel_name: { subjectId: subjects["Ciencias"]!, gradeLevel: grade, name: u.name } },
        update: {},
        create: { subjectId: subjects["Ciencias"]!, gradeLevel: grade, name: u.name, semester: u.semester },
      });
    }
  }
  console.log("  [✓] Curriculum Units: 96 (Lenguaje + Matemática + Ciencias, 1°-8°)");

  const oaLang: { code: string; description: string; axisName: string; skillNames: string[] }[] = [
    { code: "OA1-LEN", description: "Leer comprensivamente textos narrativos de estructura simple", axisName: "Comprensión Lectora", skillNames: ["Analizar", "Interpretar"] },
    { code: "OA2-LEN", description: "Extraer información explícita e implícita de textos literarios", axisName: "Comprensión Lectora", skillNames: ["Inferir", "Analizar"] },
    { code: "OA3-LEN", description: "Producir textos escritos con estructura clara", axisName: "Producción Escrita", skillNames: ["Sintetizar", "Aplicar"] },
    { code: "OA4-LEN", description: "Expresar ideas oralmente con coherencia", axisName: "Comunicación Oral", skillNames: ["Argumentar", "Aplicar"] },
  ];
  const oaCiencias: { code: string; description: string; axisName: string; skillNames: string[]; indicators: string[] }[] = [
    { code: "OA1-CIE", description: "Reconocer y explicar que los seres vivos están formados por células", axisName: "Ciencias de la Vida", skillNames: ["Analizar", "Interpretar"], indicators: [
      "Identifica las partes principales de la célula (membrana, citoplasma y núcleo)",
      "Explica la función del núcleo celular en la dirección de las actividades celulares",
      "Reconoce que todos los seres vivos, desde bacterias hasta animales, están formados por células",
    ]},
    { code: "OA2-CIE", description: "Describir las características y necesidades de los seres vivos", axisName: "Ciencias de la Vida", skillNames: ["Clasificar", "Comparar"], indicators: [
      "Clasifica seres vivos según su tipo de alimentación (herbívoros, carnívoros, omnívoros)",
      "Compara las estructuras de desplazamiento de distintos animales",
      "Describe las necesidades básicas comunes a todos los seres vivos (agua, alimento, aire)",
    ]},
    { code: "OA3-CIE", description: "Observar y comparar las propiedades de la materia", axisName: "Ciencias Físicas y Químicas", skillNames: ["Comparar", "Clasificar"], indicators: [
      "Compara la masa y el volumen de distintos objetos usando instrumentos de medición",
      "Clasifica materiales según su estado (sólido, líquido o gas)",
      "Identifica cambios de estado de la materia en situaciones cotidianas",
    ]},
    { code: "OA4-CIE", description: "Identificar y describir fuentes y transformaciones de energía", axisName: "Ciencias Físicas y Químicas", skillNames: ["Analizar", "Aplicar"], indicators: [
      "Distingue entre fuentes de energía renovables y no renovables",
      "Describe transformaciones de energía en aparatos de uso cotidiano (linterna, ampolleta, motor)",
      "Aplica el concepto de conservación de energía en ejemplos simples",
    ]},
    { code: "OA5-CIE", description: "Describir las capas de la Tierra y sus principales características", axisName: "Ciencias de la Vida", skillNames: ["Interpretar", "Sintetizar"], indicators: [
      "Nombra y describe las capas de la Tierra (corteza, manto, núcleo)",
      "Relaciona los fenómenos sísmicos y volcánicos con el movimiento de las capas terrestres",
      "Sintetiza información sobre la composición de cada capa en un organizador gráfico",
    ]},
    { code: "OA6-CIE", description: "Analizar los efectos de la actividad humana en los ecosistemas", axisName: "Ciencias de la Vida", skillNames: ["Evaluar", "Argumentar"], indicators: [
      "Identifica acciones humanas que dañan los ecosistemas (deforestación, contaminación, sobreexplotación)",
      "Evalúa el impacto ambiental de distintas actividades productivas en su región",
      "Argumenta sobre la importancia de las áreas protegidas para la conservación de la biodiversidad",
    ]},
  ];
  const oaMath: { code: string; description: string; axisName: string; skillNames: string[] }[] = [
    { code: "OA1-MAT", description: "Resolver problemas que involucran adición y sustracción", axisName: "Números y Operaciones", skillNames: ["Resolver", "Aplicar"] },
    { code: "OA2-MAT", description: "Comprender la multiplicación y división", axisName: "Números y Operaciones", skillNames: ["Resolver", "Analizar"] },
    { code: "OA3-MAT", description: "Identificar y describir figuras geométricas", axisName: "Geometría", skillNames: ["Clasificar", "Comparar"] },
    { code: "OA4-MAT", description: "Recolectar y representar datos en gráficos", axisName: "Medición y Datos", skillNames: ["Interpretar", "Sintetizar"] },
  ];

  await prisma.evaluationIndicator.deleteMany({ where: { learningObjective: { subjectId: subjects["Ciencias"]!, isActive: true } } });

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
    for (const oa of oaCiencias) {
      const created = await prisma.learningObjective.upsert({
        where: { code: `${oa.code}-${grade}` },
        update: {},
        create: {
          subjectId: subjects["Ciencias"]!,
          axisId: axes[`Ciencias|${oa.axisName}`] ?? null,
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
      for (let i = 0; i < oa.indicators.length; i++) {
        await prisma.evaluationIndicator.create({
          data: { learningObjectiveId: created.id, description: oa.indicators[i], sortOrder: i },
        });
      }
    }
  }
  console.log("  [✓] Learning Objectives: 112 (8 grades × 4 Lenguaje + 4 Matemática + 6 Ciencias)");
  console.log("  [✓] Evaluation Indicators: 144 (48 Ciencias OAs × 3 indicators)");

  return { axes, skills };
}
