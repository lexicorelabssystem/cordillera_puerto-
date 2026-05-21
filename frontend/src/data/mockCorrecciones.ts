// ─── MOCK DATA: MÓDULO DE CORRECCIÓN DE PRUEBAS ─────────────────────
// Respuestas de estudiantes con preguntas, opciones y feedback

export interface OpcionPregunta {
  id: string;
  texto: string;
  esCorrecta: boolean;
}

export interface PreguntaCorreccion {
  id: string;
  tipo: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER" | "ESSAY";
  enunciado: string;
  opciones: OpcionPregunta[];
  puntajeMaximo: number;
  explicacion: string;
  asignatura: string;
  oa: string;
  habilidad: string;
}

export interface RespuestaCorreccion {
  preguntaId: string;
  opcionSeleccionadaId: string | null;
  textoRespuesta: string | null;
  esCorrecta: boolean | null;
  puntaje: number | null;
  estado: "PENDIENTE" | "CORRECTA" | "INCORRECTA" | "PARCIAL" | "REVISION_MANUAL";
  retroalimentacion: string;
}

export interface EvaluacionCorreccion {
  id: string;
  titulo: string;
  tipo: string;
  asignatura: string;
  curso: string;
  nivel: number;
  estado: "IN_GRADING" | "GRADED" | "CLOSED";
  fechaAplicacion: string;
  totalPreguntas: number;
  preguntas: PreguntaCorreccion[];
}

export interface IntentoCorreccion {
  intentoId: string;
  estudianteId: string;
  estudianteNombre: string;
  estudianteRut: string;
  estadoIntento: "COMPLETADO" | "EN_PROGRESO" | "CORREGIDO";
  puntajeTotal: number | null;
  porcentaje: number | null;
  nota: number | null;
  respuestas: RespuestaCorreccion[];
  fechaEntrega: string;
}

// ─── PREGUNTAS MOCK ──────────────────────────────────────────────────

const preguntasLenguaje4: PreguntaCorreccion[] = [
  {
    id: "pq-len4-01",
    tipo: "MULTIPLE_CHOICE",
    enunciado: "Lee el siguiente texto:\n\n\"El zorro caminaba sigilosamente por el bosque. Sus patas apenas hacían ruido sobre las hojas secas. De pronto, escuchó un crujido y se detuvo. Sus orejas se levantaron y sus ojos brillaron en la oscuridad.\"\n\n¿Qué característica del zorro se destaca en el texto?",
    opciones: [
      { id: "op-len4-01-a", texto: "Su velocidad para correr", esCorrecta: false },
      { id: "op-len4-01-b", texto: "Su capacidad para moverse sin hacer ruido", esCorrecta: true },
      { id: "op-len4-01-c", texto: "Su habilidad para trepar árboles", esCorrecta: false },
      { id: "op-len4-01-d", texto: "Su fuerza para cazar animales grandes", esCorrecta: false },
    ],
    puntajeMaximo: 2,
    explicacion: "El texto describe al zorro caminando 'sigilosamente' y sus patas 'apenas hacían ruido', lo que indica su capacidad para moverse silenciosamente.",
    asignatura: "Lenguaje",
    oa: "OA 4",
    habilidad: "Comprender",
  },
  {
    id: "pq-len4-02",
    tipo: "MULTIPLE_CHOICE",
    enunciado: "¿Qué tipo de texto es el siguiente?\n\n\"Ingredientes: 2 tazas de harina, 1 taza de azúcar, 3 huevos, 1/2 taza de leche. Preparación: Mezclar la harina con el azúcar. Agregar los huevos uno a uno. Incorporar la leche y batir hasta obtener una mezcla homogénea.\"",
    opciones: [
      { id: "op-len4-02-a", texto: "Un cuento", esCorrecta: false },
      { id: "op-len4-02-b", texto: "Una receta", esCorrecta: true },
      { id: "op-len4-02-c", texto: "Una carta", esCorrecta: false },
      { id: "op-len4-02-d", texto: "Una noticia", esCorrecta: false },
    ],
    puntajeMaximo: 1,
    explicacion: "El texto presenta ingredientes y pasos de preparación, características propias de una receta de cocina.",
    asignatura: "Lenguaje",
    oa: "OA 6",
    habilidad: "Identificar",
  },
  {
    id: "pq-len4-03",
    tipo: "SHORT_ANSWER",
    enunciado: "Explica con tus propias palabras por qué es importante leer diferentes tipos de textos. Da al menos dos razones.",
    opciones: [],
    puntajeMaximo: 3,
    explicacion: "Se espera que el estudiante mencione razones como: aprender información nueva, desarrollar vocabulario, entretenerse, comprender el mundo, etc.",
    asignatura: "Lenguaje",
    oa: "OA 7",
    habilidad: "Analizar",
  },
  {
    id: "pq-len4-04",
    tipo: "ESSAY",
    enunciado: "Escribe un breve cuento (5-8 líneas) sobre un animal que descubre algo sorprendente en el bosque. Incluye un inicio, desarrollo y final.",
    opciones: [],
    puntajeMaximo: 4,
    explicacion: "Se evalúa estructura narrativa (inicio-desarrollo-final), creatividad, uso de vocabulario descriptivo y ortografía.",
    asignatura: "Lenguaje",
    oa: "OA 5",
    habilidad: "Escribir",
  },
];

const preguntasMatematica4: PreguntaCorreccion[] = [
  {
    id: "pq-mat4-01",
    tipo: "MULTIPLE_CHOICE",
    enunciado: "En una tienda, un cuaderno cuesta $850 y un lápiz $320. Si compro 2 cuadernos y 3 lápices, ¿cuánto debo pagar en total?",
    opciones: [
      { id: "op-mat4-01-a", texto: "$2,340", esCorrecta: false },
      { id: "op-mat4-01-b", texto: "$2,660", esCorrecta: true },
      { id: "op-mat4-01-c", texto: "$2,020", esCorrecta: false },
      { id: "op-mat4-01-d", texto: "$3,100", esCorrecta: false },
    ],
    puntajeMaximo: 3,
    explicacion: "2 × $850 = $1,700 | 3 × $320 = $960 | Total: $1,700 + $960 = $2,660. Se aplica multiplicación y suma.",
    asignatura: "Matemática",
    oa: "OA 5",
    habilidad: "Resolver",
  },
  {
    id: "pq-mat4-02",
    tipo: "MULTIPLE_CHOICE",
    enunciado: "¿Qué fracción representa la parte sombreada de un rectángulo dividido en 8 partes iguales, de las cuales 3 están sombreadas?",
    opciones: [
      { id: "op-mat4-02-a", texto: "3/8", esCorrecta: true },
      { id: "op-mat4-02-b", texto: "5/8", esCorrecta: false },
      { id: "op-mat4-02-c", texto: "8/3", esCorrecta: false },
      { id: "op-mat4-02-d", texto: "1/3", esCorrecta: false },
    ],
    puntajeMaximo: 1,
    explicacion: "La fracción se forma con el número de partes sombreadas (3) como numerador y el total de partes (8) como denominador: 3/8.",
    asignatura: "Matemática",
    oa: "OA 6",
    habilidad: "Comprender",
  },
  {
    id: "pq-mat4-03",
    tipo: "SHORT_ANSWER",
    enunciado: "Resuelve el siguiente problema y explica tu procedimiento:\n\n\"María tiene 156 láminas y las reparte entre 6 amigos en partes iguales. ¿Cuántas láminas recibe cada uno? ¿Sobran láminas?\"",
    opciones: [],
    puntajeMaximo: 3,
    explicacion: "156 ÷ 6 = 26. Cada amigo recibe 26 láminas, no sobran. Se evalúa la división exacta y la explicación del procedimiento.",
    asignatura: "Matemática",
    oa: "OA 4",
    habilidad: "Resolver",
  },
  {
    id: "pq-mat4-04",
    tipo: "MULTIPLE_CHOICE",
    enunciado: "Observa la secuencia: 4, 8, 12, 16, __ , 24. ¿Qué número falta?",
    opciones: [
      { id: "op-mat4-04-a", texto: "18", esCorrecta: false },
      { id: "op-mat4-04-b", texto: "20", esCorrecta: true },
      { id: "op-mat4-04-c", texto: "22", esCorrecta: false },
      { id: "op-mat4-04-d", texto: "19", esCorrecta: false },
    ],
    puntajeMaximo: 1,
    explicacion: "La secuencia aumenta de 4 en 4: 4, 8, 12, 16, 20, 24. El patrón es sumar 4 cada vez.",
    asignatura: "Matemática",
    oa: "OA 4",
    habilidad: "Identificar",
  },
];

const preguntasCiencias6: PreguntaCorreccion[] = [
  {
    id: "pq-cie6-01",
    tipo: "MULTIPLE_CHOICE",
    enunciado: "¿Cuál de las siguientes capas de la Tierra es la más externa?",
    opciones: [
      { id: "op-cie6-01-a", texto: "Núcleo", esCorrecta: false },
      { id: "op-cie6-01-b", texto: "Manto", esCorrecta: false },
      { id: "op-cie6-01-c", texto: "Corteza", esCorrecta: true },
      { id: "op-cie6-01-d", texto: "Astenósfera", esCorrecta: false },
    ],
    puntajeMaximo: 1,
    explicacion: "La corteza terrestre es la capa más externa de la Tierra. El manto está debajo, el núcleo en el centro.",
    asignatura: "Ciencias Naturales",
    oa: "OA 1",
    habilidad: "Identificar",
  },
  {
    id: "pq-cie6-02",
    tipo: "TRUE_FALSE",
    enunciado: "Indica si la siguiente afirmación es verdadera o falsa:\n\n\"La fotosíntesis es el proceso mediante el cual las plantas convierten la luz solar, el agua y el dióxido de carbono en glucosa y oxígeno.\"",
    opciones: [
      { id: "op-cie6-02-v", texto: "Verdadero", esCorrecta: true },
      { id: "op-cie6-02-f", texto: "Falso", esCorrecta: false },
    ],
    puntajeMaximo: 1,
    explicacion: "La afirmación es correcta. La fotosíntesis transforma energía luminosa en energía química (glucosa), liberando oxígeno.",
    asignatura: "Ciencias Naturales",
    oa: "OA 4",
    habilidad: "Comprender",
  },
  {
    id: "pq-cie6-03",
    tipo: "SHORT_ANSWER",
    enunciado: "Explica cómo los microorganismos pueden ser tanto beneficiosos como perjudiciales para los seres humanos. Da un ejemplo de cada caso.",
    opciones: [],
    puntajeMaximo: 3,
    explicacion: "Beneficiosos: bacterias intestinales ayudan a la digestión, levaduras para hacer pan. Perjudiciales: virus causan enfermedades, bacterias patógenas. Debe mencionar ambos aspectos con ejemplos.",
    asignatura: "Ciencias Naturales",
    oa: "OA 5",
    habilidad: "Explicar",
  },
  {
    id: "pq-cie6-04",
    tipo: "MULTIPLE_CHOICE",
    enunciado: "¿Qué gas es el principal responsable del efecto invernadero?",
    opciones: [
      { id: "op-cie6-04-a", texto: "Oxígeno (O₂)", esCorrecta: false },
      { id: "op-cie6-04-b", texto: "Nitrógeno (N₂)", esCorrecta: false },
      { id: "op-cie6-04-c", texto: "Dióxido de carbono (CO₂)", esCorrecta: true },
      { id: "op-cie6-04-d", texto: "Hidrógeno (H₂)", esCorrecta: false },
    ],
    puntajeMaximo: 1,
    explicacion: "El CO₂ es el principal gas de efecto invernadero emitido por actividades humanas como la quema de combustibles.",
    asignatura: "Ciencias Naturales",
    oa: "OA 6",
    habilidad: "Comprender",
  },
];

// ─── Evaluaciones disponibles para corrección ─────────────────────────

export const evaluacionesParaCorregir: EvaluacionCorreccion[] = [
  {
    id: "eval-cor-len4",
    titulo: "Evaluación 1: Comprensión Lectora y Escritura",
    tipo: "Monitoreo",
    asignatura: "Lenguaje",
    curso: "4° A",
    nivel: 4,
    estado: "IN_GRADING",
    fechaAplicacion: "2026-05-15",
    totalPreguntas: 4,
    preguntas: preguntasLenguaje4,
  },
  {
    id: "eval-cor-mat4",
    titulo: "Evaluación 1: Números, Operaciones y Problemas",
    tipo: "Monitoreo",
    asignatura: "Matemática",
    curso: "4° A",
    nivel: 4,
    estado: "IN_GRADING",
    fechaAplicacion: "2026-05-16",
    totalPreguntas: 4,
    preguntas: preguntasMatematica4,
  },
  {
    id: "eval-cor-cie6",
    titulo: "Evaluación 1: Ciencias de la Tierra y Biología",
    tipo: "Diagnóstico",
    asignatura: "Ciencias Naturales",
    curso: "6° A",
    nivel: 6,
    estado: "GRADED",
    fechaAplicacion: "2026-04-20",
    totalPreguntas: 4,
    preguntas: preguntasCiencias6,
  },
];

// ─── Generar respuestas de estudiantes ─────────────────────────────────

const nombresEstudiantes = [
  { nombre: "Martín", apellido: "González", rut: "25.400.001-5" },
  { nombre: "Sofía", apellido: "Muñoz", rut: "25.400.038-8" },
  { nombre: "Diego", apellido: "Rojas", rut: "25.400.075-1" },
  { nombre: "Valentina", apellido: "Díaz", rut: "25.400.112-3" },
  { nombre: "Benjamín", apellido: "Pérez", rut: "25.400.149-6" },
  { nombre: "Isabella", apellido: "Soto", rut: "25.400.186-9" },
  { nombre: "Lucas", apellido: "Contreras", rut: "25.400.223-2" },
  { nombre: "Emilia", apellido: "Martínez", rut: "25.400.260-5" },
  { nombre: "Gabriel", apellido: "Sepúlveda", rut: "25.400.297-8" },
  { nombre: "Catalina", apellido: "Morales", rut: "25.400.334-1" },
];

function generarRespuestasMC(pregunta: PreguntaCorreccion): { opcionSeleccionadaId: string; esCorrecta: boolean } {
  const correcta = pregunta.opciones.find((o) => o.esCorrecta)!;
  const incorrectas = pregunta.opciones.filter((o) => !o.esCorrecta);

  // 60% probabilidad de respuesta correcta
  if (Math.random() < 0.6) {
    return { opcionSeleccionadaId: correcta.id, esCorrecta: true };
  } else {
    const incorrecta = incorrectas[Math.floor(Math.random() * incorrectas.length)];
    return { opcionSeleccionadaId: incorrecta.id, esCorrecta: false };
  }
}

function generarRespuestaAbierta(_pregunta: PreguntaCorreccion, estudianteIdx: number): { textoRespuesta: string } {
  const respuestas = [
    "Es importante porque nos permite aprender cosas nuevas y conocer otras culturas.",
    "Leer diferentes textos ayuda a desarrollar el vocabulario y la imaginación.",
    "Porque cada tipo de texto nos enseña algo distinto, como las recetas nos enseñan a cocinar.",
    "Los textos nos ayudan a entender mejor el mundo y a comunicarnos con los demás.",
    "Porque podemos informarnos de noticias y también divertirnos con cuentos.",
    "Leer es importante para aprender a escribir mejor y conocer palabras nuevas.",
    "Los libros nos permiten viajar con la imaginación y aprender sobre historia.",
    "Porque mejora nuestra comprensión y nos ayuda en todas las materias del colegio.",
    "Leer diferentes textos nos prepara para la vida adulta y para entender instrucciones.",
    "Es importante porque desarrolla el cerebro y nos hace más inteligentes.",
  ];
  return { textoRespuesta: respuestas[estudianteIdx % respuestas.length] };
}

function generarRespuestaProblema(_pregunta: PreguntaCorreccion, estudianteIdx: number): { textoRespuesta: string; puntaje: number | null } {
  const correcta = "156 ÷ 6 = 26. Cada amigo recibe 26 láminas. No sobran láminas porque 156 es divisible exactamente por 6.";
  const incorrectas = [
    "156 ÷ 6 = 26. Cada uno recibe 26 láminas.",
    "Multipliqué 156 × 6 y me dio 936. Cada uno recibe 936 láminas.",
    "Dividí 156 entre 6 amigos y me dio 25 con resto 6.",
    "156 ÷ 6 = 24. Cada amigo recibe 24 láminas y sobran 12.",
  ];
  if (estudianteIdx < 5) {
    return { textoRespuesta: correcta, puntaje: 3 };
  } else {
    return { textoRespuesta: incorrectas[(estudianteIdx - 5) % incorrectas.length], puntaje: null };
  }
}

function generarRespuestaCiencias(_pregunta: PreguntaCorreccion, estudianteIdx: number): { textoRespuesta: string } {
  const respuestas = [
    "Los microorganismos beneficiosos: las bacterias del yogurt ayudan a la digestión. Perjudiciales: el virus de la gripe causa fiebre y malestar.",
    "Beneficiosos: la levadura hace crecer el pan. Perjudiciales: el coronavirus puede causar enfermedades graves.",
    "Algunas bacterias nos protegen de enfermedades, pero otras como la salmonella nos enferman si comemos alimentos contaminados.",
    "Los hongos como la penicilina nos ayudan con antibióticos. Los mohos en la comida pueden intoxicarnos.",
    "Microorganismos buenos: los del intestino ayudan a digerir. Malos: los estreptococos causan dolor de garganta.",
  ];
  return { textoRespuesta: respuestas[estudianteIdx % respuestas.length] };
}

export function generarIntentos(evaluacion: EvaluacionCorreccion): IntentoCorreccion[] {
  return nombresEstudiantes.slice(0, evaluacion.id.includes("cie") ? 8 : 10).map((est, idx) => {
    let puntajeTotal = 0;
    const puntajeMaximo = evaluacion.preguntas.reduce((s, p) => s + p.puntajeMaximo, 0);

    const respuestas: RespuestaCorreccion[] = evaluacion.preguntas.map((preg) => {
      if (preg.tipo === "MULTIPLE_CHOICE" || preg.tipo === "TRUE_FALSE") {
        const { opcionSeleccionadaId, esCorrecta } = generarRespuestasMC(preg);
        const puntaje = esCorrecta ? preg.puntajeMaximo : 0;
        puntajeTotal += puntaje;
        return {
          preguntaId: preg.id,
          opcionSeleccionadaId,
          textoRespuesta: null,
          esCorrecta,
          puntaje,
          estado: esCorrecta ? "CORRECTA" as const : "INCORRECTA" as const,
          retroalimentacion: esCorrecta ? "" : preg.explicacion,
        };
      } else if (preg.id.includes("mat")) {
        const { textoRespuesta, puntaje: puntajeManual } = generarRespuestaProblema(preg, idx);
        const necesitaRevision = puntajeManual === null;
        return {
          preguntaId: preg.id,
          opcionSeleccionadaId: null,
          textoRespuesta,
          esCorrecta: null,
          puntaje: necesitaRevision ? null : puntajeManual!,
          estado: necesitaRevision ? "REVISION_MANUAL" as const : "CORRECTA" as const,
          retroalimentacion: "",
        };
      } else if (preg.id.includes("cie")) {
        const { textoRespuesta } = generarRespuestaCiencias(preg, idx);
        const necesitaRevision = idx >= 3;
        return {
          preguntaId: preg.id,
          opcionSeleccionadaId: null,
          textoRespuesta,
          esCorrecta: null,
          puntaje: necesitaRevision ? null : 2,
          estado: necesitaRevision ? "REVISION_MANUAL" as const : "CORRECTA" as const,
          retroalimentacion: "",
        };
      } else {
        const { textoRespuesta } = generarRespuestaAbierta(preg, idx);
        const necesitaRevision = idx >= 4;
        return {
          preguntaId: preg.id,
          opcionSeleccionadaId: null,
          textoRespuesta,
          esCorrecta: null,
          puntaje: necesitaRevision ? null : (Math.random() > 0.3 ? preg.puntajeMaximo : 2),
          estado: necesitaRevision ? "REVISION_MANUAL" as const : "CORRECTA" as const,
          retroalimentacion: "",
        };
      }
    });

    const todasCorregidas = respuestas.every((r) => r.puntaje !== null);
    const notaCruda = todasCorregidas ? ((puntajeTotal / puntajeMaximo) * 6 + 1) : null;
    const nota = notaCruda ? Math.round(notaCruda * 10) / 10 : null;

    return {
      intentoId: `int-${evaluacion.id}-${idx + 1}`,
      estudianteId: `est-cor-${evaluacion.id}-${idx + 1}`,
      estudianteNombre: `${est.apellido}, ${est.nombre}`,
      estudianteRut: est.rut,
      estadoIntento: todasCorregidas ? "CORREGIDO" as const : "COMPLETADO" as const,
      puntajeTotal: todasCorregidas ? puntajeTotal : null,
      porcentaje: todasCorregidas ? Math.round((puntajeTotal / puntajeMaximo) * 100) : null,
      nota,
      respuestas,
      fechaEntrega: `2026-0${5 + Math.floor(idx / 3)}-${10 + idx * 2}`,
    };
  });
}

export function calcularEstadisticasCorreccion(intentos: IntentoCorreccion[]) {
  const completados = intentos.filter((i) => i.estadoIntento !== "EN_PROGRESO").length;
  const corregidos = intentos.filter((i) => i.estadoIntento === "CORREGIDO").length;
  const pendientesRevision = intentos.reduce(
    (s, i) => s + i.respuestas.filter((r) => r.estado === "REVISION_MANUAL").length,
    0,
  );
  const notasValidas = intentos.filter((i) => i.nota !== null).map((i) => i.nota!);
  const promedioNotas = notasValidas.length > 0
    ? Math.round((notasValidas.reduce((a, b) => a + b, 0) / notasValidas.length) * 10) / 10
    : 0;
  const bajo4 = notasValidas.filter((n) => n < 4.0).length;

  return { completados, corregidos, pendientesRevision, promedioNotas, bajo4, total: intentos.length };
}
