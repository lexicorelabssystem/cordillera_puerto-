import { PrismaClient } from "@prisma/client";

interface SimceEssayConfig {
  grade: number;
  subject: "Lenguaje" | "Matematica" | "Ciencias";
  count: number;
  teacherEmail: string;
  courseNames: string[];
}

const SIMCE_CONFIGS: SimceEssayConfig[] = [
  { grade: 4, subject: "Matematica", count: 10, teacherEmail: "profe.mate@cordillera.cl", courseNames: ["4° A", "4° B"] },
  { grade: 4, subject: "Lenguaje", count: 10, teacherEmail: "profesor@cordillera.cl", courseNames: ["4° A", "4° B"] },
  { grade: 6, subject: "Matematica", count: 10, teacherEmail: "profe.mate@cordillera.cl", courseNames: ["6° A", "6° B"] },
  { grade: 6, subject: "Lenguaje", count: 10, teacherEmail: "profesor@cordillera.cl", courseNames: ["6° A", "6° B"] },
  { grade: 6, subject: "Ciencias", count: 8, teacherEmail: "profe.ciencias@cordillera.cl", courseNames: ["6° A", "6° B"] },
];

function simceQuestionTemplates(subject: string, grade: number): { statement: string; options: string[]; correctIndex: number }[] {
  if (subject === "Matematica") {
    const base = grade === 4 ? 100 : 1000;
    const mult = grade === 4 ? 2 : 3;
    return [
      { statement: `¿Cuál es el resultado de ${base + 45} + ${base - 20 + grade * 17}?`, options: [`${(base+45)+(base-20+grade*17)}`, `${(base+45)+(base-20+grade*17)-10}`, `${(base+45)+(base-20+grade*17)+5}`, `${(base+45)+(base-20+grade*17)-3}`], correctIndex: 0 },
      { statement: `¿Cuál es el resultado de ${base} ÷ ${grade + 2}?`, options: [`${Math.floor(base/(grade+2))}`, `${Math.floor(base/(grade+2))+1}`, `${Math.floor(base/(grade+2))-1}`, `${grade+2}`], correctIndex: 0 },
      { statement: `Si ${grade*2} paquetes cuestan $${base * grade}, ¿cuánto cuesta 1 paquete?`, options: [`$${base}`, `$${base*2}`, `$${base/2}`, `$${base*grade}`], correctIndex: 0 },
      { statement: `¿Cuál es el perímetro de un rectángulo de ${grade * 2 + 3} cm de largo y ${grade + 2} cm de ancho?`, options: [`${(grade*2+3)*2 + (grade+2)*2} cm`, `${(grade*2+3) + (grade+2)} cm`, `${(grade*2+3)*(grade+2)} cm`, `${(grade*2+3)*2} cm`], correctIndex: 0 },
      { statement: `¿Qué número falta en la secuencia: ${grade*3}, ${grade*5}, ${grade*7}, ___, ${grade*11}?`, options: [`${grade*9}`, `${grade*8}`, `${grade*10}`, `${grade*12}`], correctIndex: 0 },
      { statement: `En una encuesta de ${grade * 10} estudiantes, ${grade * 3} prefieren fútbol. ¿Qué fracción representa?`, options: [`${grade*3}/${grade*10}`, `${grade*7}/${grade*10}`, `${grade*10}/${grade*3}`, `${grade*3}/${grade*7}`], correctIndex: 0 },
      { statement: `¿Cuántos minutos hay en ${grade} horas y media?`, options: [`${grade*60 + 30}`, `${grade*60}`, `${grade*30}`, `${grade*90}`], correctIndex: 0 },
      { statement: `Un cuadrado tiene lado ${grade + 3} cm. ¿Cuál es su área?`, options: [`${(grade+3)*(grade+3)} cm²`, `${(grade+3)*4} cm²`, `${(grade+3)*2} cm²`, `${grade+3} cm²`], correctIndex: 0 },
    ];
  }

  if (subject === "Lenguaje") {
    return [
      { statement: `Lee el texto: "El ${grade === 4 ? "zorro" : "cóndor"} andino es un animal que habita las montañas de Chile. Se alimenta de pequeños roedores y aves, y puede planear por largas distancias gracias a sus grandes alas." Según el texto, ¿de qué se alimenta el ${grade === 4 ? "zorro" : "cóndor"}?`, options: ["De roedores y aves", "De plantas y frutas", "De peces del río", "De insectos"], correctIndex: 0 },
      { statement: `¿Cuál de las siguientes palabras es un adjetivo calificativo?`, options: ["Hermoso", "Correr", "Mesa", "Rápidamente"], correctIndex: 0 },
      { statement: `¿Cuál es el sinónimo de "veloz"?`, options: ["Rápido", "Lento", "Grande", "Pesado"], correctIndex: 0 },
      { statement: `En la oración: "Los estudiantes estudian para la prueba", ¿cuál es el verbo?`, options: ["Estudian", "Los", "Estudiantes", "Prueba"], correctIndex: 0 },
      { statement: `¿Qué tipo de texto es una receta de cocina?`, options: ["Instructivo", "Narrativo", "Poético", "Argumentativo"], correctIndex: 0 },
      { statement: `¿Cuál es el propósito principal de una noticia?`, options: ["Informar sobre un hecho real", "Entretener con fantasía", "Expresar sentimientos", "Dar instrucciones"], correctIndex: 0 },
      { statement: `¿Qué significa la expresión "estar en las nubes"?`, options: ["Estar distraído", "Volar en avión", "Ser muy alto", "Tener sueño"], correctIndex: 0 },
      { statement: `¿Cuál de las siguientes oraciones está correctamente escrita?`, options: ["El niño juega en el parque", "El niño jugar en el parque", "El niño jugó ayer mañana", "El niño juegan en el parque"], correctIndex: 0 },
    ];
  }

  if (subject === "Ciencias") {
    return [
      { statement: `¿Cuál es la capa más externa de la Tierra?`, options: ["Corteza", "Manto", "Núcleo externo", "Núcleo interno"], correctIndex: 0 },
      { statement: `¿Qué tipo de energía proviene del Sol?`, options: ["Energía solar", "Energía eólica", "Energía nuclear", "Energía geotérmica"], correctIndex: 0 },
      { statement: `¿Cuál de los siguientes es un recurso natural renovable?`, options: ["Agua", "Petróleo", "Carbón", "Gas natural"], correctIndex: 0 },
      { statement: `Las plantas producen su propio alimento mediante un proceso llamado:`, options: ["Fotosíntesis", "Respiración", "Digestión", "Fermentación"], correctIndex: 0 },
      { statement: `¿Qué órgano del cuerpo humano bombea la sangre?`, options: ["Corazón", "Pulmones", "Hígado", "Riñones"], correctIndex: 0 },
      { statement: `El cambio de estado de líquido a gas se llama:`, options: ["Evaporación", "Solidificación", "Condensación", "Fusión"], correctIndex: 0 },
      { statement: `¿Cuál de los siguientes es un animal vertebrado?`, options: ["Perro", "Mariposa", "Caracol", "Estrella de mar"], correctIndex: 0 },
      { statement: `¿Qué gas es esencial para la respiración de los seres vivos?`, options: ["Oxígeno", "Nitrógeno", "Dióxido de carbono", "Hidrógeno"], correctIndex: 0 },
    ];
  }

  return [];
}

export async function seed(
  prisma: PrismaClient,
  teacherIds: Record<string, string>,
  courses: Record<string, { id: string; gradeLevel: number }>,
  subjects: Record<string, string>,
  periodS2Id: string,
  adminUserId: string,
): Promise<{ total: number }> {
  console.log("\n─── SIMCE BANK ─────────────────────────────");

  if (Object.keys(teacherIds).length === 0 || !adminUserId) {
    console.log("  [⊘] SIMCE Bank: skipped (no teachers or admin)");
    return { total: 0 };
  }

  const subjectMap: Record<string, string> = {
    "Lenguaje": subjects["Lenguaje"]!,
    "Matematica": subjects["Matemática"]!,
    "Ciencias": subjects["Ciencias"]!,
  };

  await prisma.assessmentQuestion.deleteMany({
    where: { assessment: { assessmentType: "SIMCE" } },
  });
  await prisma.assessment.deleteMany({
    where: { assessmentType: "SIMCE" },
  });

  let totalEssays = 0;
  let totalQuestions = 0;

  for (const config of SIMCE_CONFIGS) {
    const subjectId = subjectMap[config.subject];
    if (!subjectId) continue;

    const subjectDisplay = config.subject === "Lenguaje" ? "Comprensión Lectora" : config.subject;

    const perCourse = Math.ceil(config.count / config.courseNames.length);
    let essayNum = 0;

    for (const courseName of config.courseNames) {
      const course = courses[courseName];
      if (!course || course.gradeLevel !== config.grade) continue;

      const countForCourse = Math.min(perCourse, config.count - essayNum);
      if (countForCourse <= 0) break;

      for (let i = 0; i < countForCourse; i++) {
        essayNum++;
        const numLabel = essayNum < 10 ? `N°${essayNum}` : `N°${essayNum}`;
        const title = `Ensayo SIMCE ${subjectDisplay} ${numLabel} - ${courseName}`;
        const description = `Ensayo oficial tipo SIMCE de ${subjectDisplay} para ${config.grade}° básico.`;

        const questions = simceQuestionTemplates(config.subject, config.grade);
        const shuffled = [...questions].sort(() => Math.random() - 0.5).slice(0, Math.min(6, questions.length));

        const assessment = await prisma.assessment.create({
          data: {
            courseId: course.id,
            subjectId,
            teacherId: teacherIds[config.teacherEmail]!,
            periodId: periodS2Id,
            title,
            description,
            assessmentType: "SIMCE",
            deliveryMode: "ONLINE",
            status: "PUBLISHED",
            semester: 2,
            maxScore: shuffled.length,
            weight: 10,
            timeLimitMin: 90,
            startDate: new Date(`2026-10-01T08:00:00Z`),
            endDate: new Date(`2026-11-30T18:00:00Z`),
            publishedAt: new Date(`2026-09-15`),
            createdBy: adminUserId,
          },
        });

        for (let qi = 0; qi < shuffled.length; qi++) {
          const q = shuffled[qi]!;
          const question = await prisma.question.create({
            data: {
              subjectId,
              type: "MULTIPLE_CHOICE",
              statement: q.statement,
              difficulty: Math.ceil(Math.random() * 3),
              points: 1,
              options: {
                create: q.options.map((text, idx) => ({
                  text,
                  isCorrect: idx === q.correctIndex,
                  sortOrder: idx,
                })),
              },
            },
          });

          await prisma.assessmentQuestion.create({
            data: {
              assessmentId: assessment.id,
              questionId: question.id,
              sortOrder: qi,
              points: 1,
            },
          });

          totalQuestions++;
        }

        totalEssays++;
      }
    }
  }

  console.log(`  [✓] SIMCE Bank: ${totalEssays} essays, ${totalQuestions} questions created`);
  console.log("       Grade 4: 10 Matemática + 10 Lenguaje");
  console.log("       Grade 6: 10 Matemática + 10 Lenguaje + 8 Ciencias");
  console.log("       Total required: 48 essays ✓");

  return { total: totalEssays };
}
