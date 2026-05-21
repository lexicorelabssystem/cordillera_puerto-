import { PrismaClient } from "@prisma/client";

export async function seed(
  prisma: PrismaClient,
  subjects: Record<string, string>,
  axes: Record<string, string>,
  skills: Record<string, string>,
): Promise<void> {
  console.log("\n─── DEMO QUESTIONS ─────────────────────────");

  const demoQuestions = [
    {
      subjectName: "Lenguaje", axisName: "Comprensión Lectora",
      type: "MULTIPLE_CHOICE" as const, difficulty: 2, points: 1,
      statement: "Lee el siguiente texto: 'El zorro corría veloz por el bosque persiguiendo una liebre.' ¿Qué hacía el zorro?",
      explanation: "El texto indica explícitamente la acción",
      oaCode: "OA1-LEN", skillName: "Analizar", gradeLevel: 4,
      options: [
        { text: "Corría por el bosque", isCorrect: true },
        { text: "Dormía bajo un árbol", isCorrect: false },
        { text: "Nadaba en el río", isCorrect: false },
        { text: "Volaba entre los árboles", isCorrect: false },
      ],
    },
    {
      subjectName: "Lenguaje", axisName: "Producción Escrita",
      type: "MULTIPLE_CHOICE" as const, difficulty: 1, points: 1,
      statement: "¿Cuál de las siguientes oraciones está correctamente escrita?",
      oaCode: "OA3-LEN", skillName: "Aplicar", gradeLevel: 4,
      options: [
        { text: "El niño juega en el parque con sus amigos.", isCorrect: true },
        { text: "El niño jugar en el parque con sus amigos.", isCorrect: false },
        { text: "El niño jugará ayer en el parque.", isCorrect: false },
        { text: "El niño juegan en el parque.", isCorrect: false },
      ],
    },
    {
      subjectName: "Matemática", axisName: "Números y Operaciones",
      type: "MULTIPLE_CHOICE" as const, difficulty: 1, points: 1,
      statement: "¿Cuál es el resultado de 345 + 278?",
      explanation: "Suma con reserva de tres dígitos",
      oaCode: "OA1-MAT", skillName: "Resolver", gradeLevel: 4,
      options: [
        { text: "623", isCorrect: true },
        { text: "613", isCorrect: false },
        { text: "523", isCorrect: false },
        { text: "633", isCorrect: false },
      ],
    },
    {
      subjectName: "Matemática", axisName: "Geometría",
      type: "TRUE_FALSE" as const, difficulty: 1, points: 1,
      statement: "Un triángulo tiene 3 lados.",
      explanation: "Propiedad fundamental de los triángulos",
      oaCode: "OA3-MAT", skillName: "Clasificar", gradeLevel: 4,
      options: [
        { text: "Verdadero", isCorrect: true },
        { text: "Falso", isCorrect: false },
      ],
    },
    {
      subjectName: "Matemática", axisName: "Números y Operaciones",
      type: "MULTIPLE_CHOICE" as const, difficulty: 2, points: 1,
      statement: "Si tienes 24 caramelos y los repartes entre 6 amigos, ¿cuántos recibe cada uno?",
      explanation: "División exacta",
      oaCode: "OA2-MAT", skillName: "Resolver", gradeLevel: 4,
      options: [
        { text: "4", isCorrect: true },
        { text: "3", isCorrect: false },
        { text: "6", isCorrect: false },
        { text: "5", isCorrect: false },
      ],
    },
    {
      subjectName: "Lenguaje", axisName: "Comprensión Lectora",
      type: "MULTIPLE_CHOICE" as const, difficulty: 1, points: 1,
      statement: "¿Qué significa la palabra 'veloz' en el texto?",
      explanation: "Vocabulario contextual",
      oaCode: "OA1-LEN", skillName: "Interpretar", gradeLevel: 4,
      options: [
        { text: "Rápido", isCorrect: true },
        { text: "Lento", isCorrect: false },
        { text: "Grande", isCorrect: false },
        { text: "Pequeño", isCorrect: false },
      ],
    },
    {
      subjectName: "Matemática", axisName: "Medición y Datos",
      type: "MULTIPLE_CHOICE" as const, difficulty: 2, points: 1,
      statement: "En una encuesta, 15 niños prefieren fútbol y 10 prefieren básquetbol. ¿Cuál es el total de niños encuestados?",
      explanation: "Interpretación de datos simples",
      oaCode: "OA4-MAT", skillName: "Interpretar", gradeLevel: 4,
      options: [
        { text: "25", isCorrect: true },
        { text: "15", isCorrect: false },
        { text: "5", isCorrect: false },
        { text: "20", isCorrect: false },
      ],
    },
    {
      subjectName: "Lenguaje", axisName: "Comunicación Oral",
      type: "TRUE_FALSE" as const, difficulty: 1, points: 1,
      statement: "Al exponer oralmente, es importante hablar con claridad y en voz alta.",
      explanation: "Elementos de la comunicación oral efectiva",
      oaCode: "OA4-LEN", skillName: "Argumentar", gradeLevel: 4,
      options: [
        { text: "Verdadero", isCorrect: true },
        { text: "Falso", isCorrect: false },
      ],
    },
    // ─── CIENCIAS ──────────────────────────────
    {
      subjectName: "Ciencias", axisName: "Ciencias de la Vida",
      type: "MULTIPLE_CHOICE" as const, difficulty: 1, points: 1,
      statement: "¿Cuál de las siguientes es una parte fundamental de toda célula?",
      explanation: "Toda célula posee membrana, citoplasma y material genético",
      oaCode: "OA1-CIE", skillName: "Analizar", gradeLevel: 4,
      options: [
        { text: "Membrana celular", isCorrect: true },
        { text: "Pared de madera", isCorrect: false },
        { text: "Caparazón de calcio", isCorrect: false },
        { text: "Exoesqueleto de quitina", isCorrect: false },
      ],
    },
    {
      subjectName: "Ciencias", axisName: "Ciencias de la Vida",
      type: "MULTIPLE_CHOICE" as const, difficulty: 2, points: 1,
      statement: "Un león se alimenta exclusivamente de otros animales. Según su tipo de alimentación, ¿cómo se clasifica?",
      explanation: "Los carnívoros se alimentan de otros animales",
      oaCode: "OA2-CIE", skillName: "Clasificar", gradeLevel: 4,
      options: [
        { text: "Carnívoro", isCorrect: true },
        { text: "Herbívoro", isCorrect: false },
        { text: "Omnívoro", isCorrect: false },
        { text: "Descomponedor", isCorrect: false },
      ],
    },
    {
      subjectName: "Ciencias", axisName: "Ciencias Físicas y Químicas",
      type: "MULTIPLE_CHOICE" as const, difficulty: 1, points: 1,
      statement: "El agua puede encontrarse en estado sólido, líquido y gaseoso. ¿Cómo se llama el cambio de estado líquido a gaseoso?",
      explanation: "La evaporación es el paso de líquido a gas",
      oaCode: "OA3-CIE", skillName: "Comparar", gradeLevel: 4,
      options: [
        { text: "Evaporación", isCorrect: true },
        { text: "Solidificación", isCorrect: false },
        { text: "Condensación", isCorrect: false },
        { text: "Fusión", isCorrect: false },
      ],
    },
    {
      subjectName: "Ciencias", axisName: "Ciencias Físicas y Químicas",
      type: "MULTIPLE_CHOICE" as const, difficulty: 2, points: 1,
      statement: "¿Cuál de las siguientes es una fuente de energía renovable?",
      explanation: "La energía solar proviene del sol y es inagotable a escala humana",
      oaCode: "OA4-CIE", skillName: "Analizar", gradeLevel: 4,
      options: [
        { text: "Energía solar", isCorrect: true },
        { text: "Petróleo", isCorrect: false },
        { text: "Carbón", isCorrect: false },
        { text: "Gas natural", isCorrect: false },
      ],
    },
    {
      subjectName: "Ciencias", axisName: "Ciencias de la Vida",
      type: "MULTIPLE_CHOICE" as const, difficulty: 2, points: 1,
      statement: "¿Cuál es la capa más externa de la Tierra?",
      explanation: "La corteza terrestre es la capa más superficial",
      oaCode: "OA5-CIE", skillName: "Interpretar", gradeLevel: 4,
      options: [
        { text: "Corteza", isCorrect: true },
        { text: "Manto", isCorrect: false },
        { text: "Núcleo externo", isCorrect: false },
        { text: "Núcleo interno", isCorrect: false },
      ],
    },
    {
      subjectName: "Ciencias", axisName: "Ciencias de la Vida",
      type: "TRUE_FALSE" as const, difficulty: 1, points: 1,
      statement: "La tala indiscriminada de bosques contribuye a la pérdida de biodiversidad.",
      explanation: "La deforestación destruye hábitats y reduce la biodiversidad",
      oaCode: "OA6-CIE", skillName: "Evaluar", gradeLevel: 4,
      options: [
        { text: "Verdadero", isCorrect: true },
        { text: "Falso", isCorrect: false },
      ],
    },
  ];

  await prisma.questionOption.deleteMany({ where: { question: { subjectId: { in: Object.values(subjects) } } } });
  await prisma.question.deleteMany({ where: { subjectId: { in: Object.values(subjects) } } });

  for (const q of demoQuestions) {
    const oaCode = `${q.oaCode}-${q.gradeLevel}`;
    const oa = await prisma.learningObjective.findUnique({ where: { code: oaCode } });
    await prisma.question.create({
      data: {
        subjectId: subjects[q.subjectName]!,
        axisId: axes[`${q.subjectName}|${q.axisName}`] ?? null,
        learningObjectiveId: oa?.id ?? null,
        skillId: skills[q.skillName] ?? null,
        type: q.type,
        statement: q.statement,
        explanation: q.explanation ?? null,
        difficulty: q.difficulty,
        points: q.points,
        options: {
          create: q.options.map((opt, idx) => ({ text: opt.text, isCorrect: opt.isCorrect, sortOrder: idx })),
        },
      },
    });
  }
  console.log(`  [✓] Demo Questions: ${demoQuestions.length} (linked to OA and skills)`);
}
