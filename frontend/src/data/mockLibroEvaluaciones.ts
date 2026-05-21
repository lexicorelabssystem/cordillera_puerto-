// ─── MOCK DATA: LIBRO DE EVALUACIONES ──────────────────────────────────
// Escuela Mario Muñoz Silva | Sistema de Monitoreo de Aprendizajes
// 24 cursos: 1° Básico → 4° Medio (A y B)

export interface EstudianteLibro {
  id: string;
  nombre: string;
  apellido: string;
  rut: string;
  cursoId: string;
  cursoNombre: string;
  userId?: string;
  activo: boolean;
}

export interface UsuarioLibro {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  studentId: string;
  cursoId: string;
  cursoNombre: string;
}

export interface EvaluacionLibro {
  id: string;
  nombreCorto: string;
  nombreCompleto: string;
  tipo: string;
  asignaturaId: string;
  asignaturaNombre: string;
  cursoId: string;
  fecha: string;
  oaId: string;
  oaCodigo: string;
  oaDescripcion: string;
  habilidad: string;
  eje: string;
  ponderacion: number;
  estado: "programada" | "aplicada" | "corregida" | "pendiente" | "cerrada";
  puntajeMaximo: number;
}

export interface NotaLibro {
  estudianteId: string;
  evaluacionId: string;
  nota: number | null;
  puntaje: number | null;
  observacion: string;
}

export interface OALibro {
  id: string;
  codigo: string;
  descripcion: string;
  asignaturaId: string;
  nivel: number;
  eje: string;
  habilidad: string;
}

export interface CursoLibro {
  id: string;
  nombre: string;
  nivel: number;
  asignaturas: string[];
}

export interface PeriodoLibro {
  id: string;
  nombre: string;
  tipo: string;
  inicio: string;
  fin: string;
}

// ─── ASIGNATURAS ─────────────────────────────────────────────────────────
export const asignaturas: Record<string, { id: string; nombre: string }> = {
  "asig-len": { id: "asig-len", nombre: "Lenguaje" },
  "asig-mat": { id: "asig-mat", nombre: "Matemática" },
  "asig-cie": { id: "asig-cie", nombre: "Ciencias Naturales" },
  "asig-his": { id: "asig-his", nombre: "Historia y Geografía" },
};

// ─── PERIODOS ──────────────────────────────────────────────────────────────
export const periodos: PeriodoLibro[] = [
  { id: "per-1", nombre: "Abril - Mayo", tipo: "Bimestre 1", inicio: "2026-04-01", fin: "2026-05-31" },
  { id: "per-2", nombre: "Junio - Julio", tipo: "Bimestre 2", inicio: "2026-06-01", fin: "2026-07-31" },
  { id: "per-3", nombre: "Agosto - Septiembre", tipo: "Bimestre 3", inicio: "2026-08-01", fin: "2026-09-30" },
  { id: "per-4", nombre: "Octubre - Diciembre", tipo: "Bimestre 4", inicio: "2026-10-01", fin: "2026-12-20" },
];

// ─── CURSOS: 1° Básico → 4° Medio (A y B) = 24 cursos ────────────────────
function buildCursos(): CursoLibro[] {
  const cursos: CursoLibro[] = [];
  const labels = [
    "1° Básico", "2° Básico", "3° Básico", "4° Básico",
    "5° Básico", "6° Básico", "7° Básico", "8° Básico",
    "1° Medio", "2° Medio", "3° Medio", "4° Medio",
  ];
  for (let i = 0; i < 12; i++) {
    const nivel = i + 1; // 1 a 12
    const baseId = labels[i].toLowerCase().replace(" ", "-").replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o");
    const asignaturasList: string[] = ["asig-len", "asig-mat"];
    if (nivel >= 5) asignaturasList.push("asig-cie");
    if (nivel >= 7) asignaturasList.push("asig-his");

    for (const letra of ["A", "B"]) {
      cursos.push({
        id: `curso-${baseId}-${letra.toLowerCase()}`,
        nombre: `${labels[i]} ${letra}`,
        nivel,
        asignaturas: asignaturasList,
      });
    }
  }
  return cursos;
}
export const cursos = buildCursos();

// ─── OA POR ASIGNATURA Y NIVEL (expandido a 1°-4° Medio) ─────────────────
export const oas: OALibro[] = [
  // ── Lenguaje ──
  { id: "oa-len-01", codigo: "OA 1", descripcion: "Reconocer que los textos escritos transmiten mensajes", asignaturaId: "asig-len", nivel: 1, eje: "Lectura", habilidad: "Comprender" },
  { id: "oa-len-02", codigo: "OA 2", descripcion: "Reconocer palabras a primera vista (vocabulario visual)", asignaturaId: "asig-len", nivel: 1, eje: "Lectura", habilidad: "Identificar" },
  { id: "oa-len-03", codigo: "OA 3", descripcion: "Leer palabras aisladas y en contexto", asignaturaId: "asig-len", nivel: 1, eje: "Lectura", habilidad: "Leer" },
  { id: "oa-len-04", codigo: "OA 4", descripcion: "Leer independientemente textos literarios", asignaturaId: "asig-len", nivel: 4, eje: "Lectura", habilidad: "Analizar" },
  { id: "oa-len-05", codigo: "OA 5", descripcion: "Analizar aspectos relevantes de narraciones leídas", asignaturaId: "asig-len", nivel: 4, eje: "Lectura", habilidad: "Analizar" },
  { id: "oa-len-06", codigo: "OA 6", descripcion: "Leer independientemente textos no literarios", asignaturaId: "asig-len", nivel: 4, eje: "Lectura", habilidad: "Comprender" },
  { id: "oa-len-07", codigo: "OA 7", descripcion: "Desarrollar el gusto por la lectura", asignaturaId: "asig-len", nivel: 4, eje: "Lectura", habilidad: "Valorar" },
  { id: "oa-len-08", codigo: "OA 8", descripcion: "Sintetizar y registrar información de textos leídos", asignaturaId: "asig-len", nivel: 6, eje: "Escritura", habilidad: "Sintetizar" },
  { id: "oa-len-09", codigo: "OA 9", descripcion: "Escribir artículos informativos", asignaturaId: "asig-len", nivel: 6, eje: "Escritura", habilidad: "Escribir" },
  { id: "oa-len-10", codigo: "OA 10", descripcion: "Aplicar estrategias de comprensión lectora avanzada", asignaturaId: "asig-len", nivel: 8, eje: "Lectura", habilidad: "Comprender" },
  { id: "oa-len-11", codigo: "OA 11", descripcion: "Leer y comprender textos no literarios de manera crítica", asignaturaId: "asig-len", nivel: 8, eje: "Lectura", habilidad: "Analizar" },
  { id: "oa-len-12", codigo: "OA 12", descripcion: "Expresarse en forma oral frente a diversos contextos", asignaturaId: "asig-len", nivel: 8, eje: "Comunicación oral", habilidad: "Expresar" },
  // Lenguaje 1°-4° Medio
  { id: "oa-len-m1", codigo: "OA M1", descripcion: "Analizar críticamente discursos argumentativos", asignaturaId: "asig-len", nivel: 9, eje: "Lectura", habilidad: "Analizar" },
  { id: "oa-len-m2", codigo: "OA M2", descripcion: "Producir textos argumentativos coherentes", asignaturaId: "asig-len", nivel: 9, eje: "Escritura", habilidad: "Escribir" },
  { id: "oa-len-m3", codigo: "OA M3", descripcion: "Interpretar obras literarias contemporáneas", asignaturaId: "asig-len", nivel: 10, eje: "Lectura", habilidad: "Interpretar" },
  { id: "oa-len-m4", codigo: "OA M4", descripcion: "Investigar y exponer temas de interés público", asignaturaId: "asig-len", nivel: 12, eje: "Comunicación oral", habilidad: "Investigar" },

  // ── Matemática ──
  { id: "oa-mat-01", codigo: "OA 1", descripcion: "Contar números del 0 al 100", asignaturaId: "asig-mat", nivel: 1, eje: "Números", habilidad: "Contar" },
  { id: "oa-mat-02", codigo: "OA 2", descripcion: "Comparar y ordenar números del 0 al 100", asignaturaId: "asig-mat", nivel: 1, eje: "Números", habilidad: "Comparar" },
  { id: "oa-mat-03", codigo: "OA 3", descripcion: "Componer y descomponer números del 0 al 100", asignaturaId: "asig-mat", nivel: 1, eje: "Números", habilidad: "Calcular" },
  { id: "oa-mat-04", codigo: "OA 4", descripcion: "Describir y aplicar estrategias de cálculo mental", asignaturaId: "asig-mat", nivel: 4, eje: "Números y operaciones", habilidad: "Calcular" },
  { id: "oa-mat-05", codigo: "OA 5", descripcion: "Resolver problemas rutinarios usando las 4 operaciones", asignaturaId: "asig-mat", nivel: 4, eje: "Números y operaciones", habilidad: "Resolver" },
  { id: "oa-mat-06", codigo: "OA 6", descripcion: "Demostrar comprensión de fracciones", asignaturaId: "asig-mat", nivel: 4, eje: "Números y operaciones", habilidad: "Comprender" },
  { id: "oa-mat-07", codigo: "OA 7", descripcion: "Demostrar comprensión de porcentajes", asignaturaId: "asig-mat", nivel: 6, eje: "Números y operaciones", habilidad: "Comprender" },
  { id: "oa-mat-08", codigo: "OA 8", descripcion: "Resolver problemas que involucran variaciones porcentuales", asignaturaId: "asig-mat", nivel: 6, eje: "Números y operaciones", habilidad: "Resolver" },
  { id: "oa-mat-09", codigo: "OA 9", descripcion: "Calcular áreas y volúmenes de cuerpos geométricos", asignaturaId: "asig-mat", nivel: 6, eje: "Geometría", habilidad: "Calcular" },
  { id: "oa-mat-10", codigo: "OA 10", descripcion: "Resolver problemas de proporcionalidad directa e inversa", asignaturaId: "asig-mat", nivel: 8, eje: "Números y operaciones", habilidad: "Resolver" },
  { id: "oa-mat-11", codigo: "OA 11", descripcion: "Modelar situaciones usando lenguaje algebraico", asignaturaId: "asig-mat", nivel: 8, eje: "Álgebra", habilidad: "Modelar" },
  { id: "oa-mat-12", codigo: "OA 12", descripcion: "Representar datos mediante gráficos y analizarlos", asignaturaId: "asig-mat", nivel: 8, eje: "Datos y probabilidades", habilidad: "Analizar" },
  // Matemática 1°-4° Medio
  { id: "oa-mat-m1", codigo: "OA M1", descripcion: "Resolver ecuaciones e inecuaciones de primer y segundo grado", asignaturaId: "asig-mat", nivel: 9, eje: "Álgebra", habilidad: "Resolver" },
  { id: "oa-mat-m2", codigo: "OA M2", descripcion: "Aplicar funciones en contextos reales", asignaturaId: "asig-mat", nivel: 10, eje: "Álgebra", habilidad: "Aplicar" },
  { id: "oa-mat-m3", codigo: "OA M3", descripcion: "Calcular probabilidades condicionales", asignaturaId: "asig-mat", nivel: 11, eje: "Datos y probabilidades", habilidad: "Calcular" },
  { id: "oa-mat-m4", codigo: "OA M4", descripcion: "Resolver problemas de optimización con derivadas", asignaturaId: "asig-mat", nivel: 12, eje: "Cálculo", habilidad: "Resolver" },

  // ── Ciencias ──
  { id: "oa-cie-01", codigo: "OA 1", descripcion: "Explicar la formación de las capas de la Tierra", asignaturaId: "asig-cie", nivel: 6, eje: "Ciencias de la Tierra", habilidad: "Explicar" },
  { id: "oa-cie-02", codigo: "OA 2", descripcion: "Describir las características de la atmósfera", asignaturaId: "asig-cie", nivel: 6, eje: "Ciencias de la Tierra", habilidad: "Describir" },
  { id: "oa-cie-03", codigo: "OA 3", descripcion: "Investigar experimentalmente cambios químicos", asignaturaId: "asig-cie", nivel: 6, eje: "Química", habilidad: "Investigar" },
  { id: "oa-cie-04", codigo: "OA 4", descripcion: "Explicar el proceso de fotosíntesis", asignaturaId: "asig-cie", nivel: 6, eje: "Biología", habilidad: "Explicar" },
  { id: "oa-cie-05", codigo: "OA 5", descripcion: "Describir el rol de los microorganismos", asignaturaId: "asig-cie", nivel: 6, eje: "Biología", habilidad: "Describir" },
  { id: "oa-cie-06", codigo: "OA 6", descripcion: "Analizar los efectos de la actividad humana en ecosistemas", asignaturaId: "asig-cie", nivel: 6, eje: "Biología", habilidad: "Analizar" },
  // Ciencias 1°-4° Medio
  { id: "oa-cie-m1", codigo: "OA M1", descripcion: "Analizar la estructura y función celular", asignaturaId: "asig-cie", nivel: 9, eje: "Biología", habilidad: "Analizar" },
  { id: "oa-cie-m2", codigo: "OA M2", descripcion: "Comprender las leyes de la termodinámica", asignaturaId: "asig-cie", nivel: 10, eje: "Física", habilidad: "Comprender" },
  { id: "oa-cie-m3", codigo: "OA M3", descripcion: "Evaluar el impacto de reacciones químicas en el entorno", asignaturaId: "asig-cie", nivel: 11, eje: "Química", habilidad: "Evaluar" },
  { id: "oa-cie-m4", codigo: "OA M4", descripcion: "Explicar procesos evolutivos y de selección natural", asignaturaId: "asig-cie", nivel: 12, eje: "Biología", habilidad: "Explicar" },

  // ── Historia ──
  { id: "oa-his-01", codigo: "OA 1", descripcion: "Analizar el proceso de independencia de Chile", asignaturaId: "asig-his", nivel: 8, eje: "Historia", habilidad: "Analizar" },
  { id: "oa-his-02", codigo: "OA 2", descripcion: "Comparar visiones sobre la organización de la república", asignaturaId: "asig-his", nivel: 8, eje: "Historia", habilidad: "Comparar" },
  { id: "oa-his-03", codigo: "OA 3", descripcion: "Caracterizar la economía chilena del siglo XIX", asignaturaId: "asig-his", nivel: 8, eje: "Historia", habilidad: "Caracterizar" },
  { id: "oa-his-04", codigo: "OA 4", descripcion: "Evaluar el impacto de las transformaciones sociales", asignaturaId: "asig-his", nivel: 8, eje: "Historia", habilidad: "Evaluar" },
  { id: "oa-his-05", codigo: "OA 5", descripcion: "Comprender los conceptos de democracia y ciudadanía", asignaturaId: "asig-his", nivel: 8, eje: "Formación ciudadana", habilidad: "Comprender" },
  { id: "oa-his-06", codigo: "OA 6", descripcion: "Reconocer los derechos humanos como base de la convivencia", asignaturaId: "asig-his", nivel: 8, eje: "Formación ciudadana", habilidad: "Reconocer" },
  // Historia 1°-4° Medio
  { id: "oa-his-m1", codigo: "OA M1", descripcion: "Analizar la Guerra Fría y su impacto en Latinoamérica", asignaturaId: "asig-his", nivel: 9, eje: "Historia", habilidad: "Analizar" },
  { id: "oa-his-m2", codigo: "OA M2", descripcion: "Comprender los procesos de globalización", asignaturaId: "asig-his", nivel: 10, eje: "Historia", habilidad: "Comprender" },
  { id: "oa-his-m3", codigo: "OA M3", descripcion: "Evaluar los desafíos de la democracia contemporánea", asignaturaId: "asig-his", nivel: 11, eje: "Formación ciudadana", habilidad: "Evaluar" },
  { id: "oa-his-m4", codigo: "OA M4", descripcion: "Analizar la sociedad chilena actual y sus transformaciones", asignaturaId: "asig-his", nivel: 12, eje: "Historia", habilidad: "Analizar" },
];

// ─── ESTUDIANTES: 1 Alexis por curso ─────────────────────────────────────
const apellidosInventados = [
  "Muñoz Silva",       // 1°A
  "González Rojas",    // 1°B
  "Díaz Contreras",    // 2°A
  "Pérez Morales",     // 2°B
  "Soto Fuentes",      // 3°A
  "Martínez Hernández",// 3°B
  "Sepúlveda Torres",  // 4°A
  "Flores Araya",      // 4°B
  "Vargas Castillo",   // 5°A
  "Bravo Carrasco",    // 5°B
  "Gutiérrez Alarcón", // 6°A
  "Rivas Paredes",     // 6°B
  "Navarro Cáceres",   // 7°A
  "Pizarro Venegas",   // 7°B
  "Fuentes Salazar",   // 8°A
  "Miranda Zúñiga",    // 8°B
  "Ortega Parra",      // 1°M A
  "Guerrero Campos",   // 1°M B
  "Rivera Espinoza",   // 2°M A
  "Medina Tapia",      // 2°M B
  "Sandoval Guzmán",   // 3°M A
  "Henríquez Jara",    // 3°M B
  "Cárdenas Riquelme", // 4°M A
  "Farías Poblete",    // 4°M B
];

function generarRUT(idx: number): string {
  const base = 25000000 + idx * 37 + idx * 11;
  const dv = base % 11;
  const dvChar = dv === 10 ? "K" : String(dv);
  return `${base}-${dvChar}`;
}

export const todosEstudiantes: EstudianteLibro[] = cursos.map((c, idx) => ({
  id: `est-${c.id}`,
  nombre: "Alexis",
  apellido: apellidosInventados[idx],
  rut: generarRUT(idx),
  cursoId: c.id,
  cursoNombre: c.nombre,
  userId: `user-${c.id}`,
  activo: true,
}));

// ─── USUARIOS VINCULADOS ─────────────────────────────────────────────────
export const usuarios4A: UsuarioLibro[] = []; // legacy compat

export const todosUsuarios: UsuarioLibro[] = todosEstudiantes.map((est) => ({
  id: est.userId!,
  email: `alexis.${est.apellido.toLowerCase().replace(/\s+/g, ".").normalize("NFD").replace(/[\u0300-\u036f]/g, "")}@escuelamariomunoz.cl`,
  firstName: est.nombre,
  lastName: est.apellido,
  role: "STUDENT",
  isActive: est.activo,
  studentId: est.id,
  cursoId: est.cursoId,
  cursoNombre: est.cursoNombre,
}));

// ─── GENERAR EVALUACIONES ────────────────────────────────────────────────
export function generarEvaluaciones(cursoId: string, nivel: number, asignaturaIds: string[]): EvaluacionLibro[] {
  const evals: EvaluacionLibro[] = [];
  const asigOas = asignaturaIds.flatMap((aId) => oas.filter((oa) => oa.asignaturaId === aId && oa.nivel === nivel));
  let idxGlobal = 0;

  for (const asigId of asignaturaIds) {
    const asigOa = asigOas.filter((oa) => oa.asignaturaId === asigId);
    if (asigOa.length === 0) continue;
    const nombreAsig = asignaturas[asigId]?.nombre || asigId;

    for (let e = 1; e <= 4; e++) {
      const oa = asigOa[(e - 1) % asigOa.length];
      idxGlobal++;
      const tipos: Record<number, string> = { 1: "Diagnóstico", 2: "Monitoreo", 3: "Progreso", 4: "Prueba escrita" };
      evals.push({
        id: `eval-${cursoId}-${asigId}-e${e}`,
        nombreCorto: `E${idxGlobal}`,
        nombreCompleto: `Evaluación ${e}: ${nombreAsig} - ${oa.descripcion.slice(0, 40)}...`,
        tipo: tipos[e] || "Prueba escrita",
        asignaturaId: asigId,
        asignaturaNombre: nombreAsig,
        cursoId,
        fecha: `2026-0${3 + (e % 5)}-${10 + e * 5}`,
        oaId: oa.id,
        oaCodigo: oa.codigo,
        oaDescripcion: oa.descripcion,
        habilidad: oa.habilidad,
        eje: oa.eje,
        ponderacion: e === 4 ? 30 : 20,
        estado: e <= 3 ? "corregida" : "aplicada",
        puntajeMaximo: 100,
      });
    }
  }

  // Ensayos SIMCE por nivel (4° Básico, 6° Básico, 8° Básico, 2° Medio)
  const simceLevels = [4, 6, 8, 10];
  if (!simceLevels.includes(nivel)) return evals;

  const matOa = oas.find((oa) => oa.asignaturaId === "asig-mat" && oa.nivel === nivel) || asigOas[0];
  const lenOa = oas.find((oa) => oa.asignaturaId === "asig-len" && oa.nivel === nivel) || asigOas[0];
  const cieOa = oas.find((oa) => oa.asignaturaId === "asig-cie" && oa.nivel === nivel);

  if (asignaturaIds.includes("asig-mat") && matOa) {
    for (let s = 1; s <= 3; s++) {
      idxGlobal++;
      evals.push({
        id: `eval-${cursoId}-simce-mat-${s}`,
        nombreCorto: `SIMCE M${s}`,
        nombreCompleto: `Ensayo SIMCE Matemática N°${s}`,
        tipo: "Ensayo SIMCE",
        asignaturaId: "asig-mat",
        asignaturaNombre: "Matemática",
        cursoId, fecha: `2026-0${6 + Math.ceil(s / 2)}-${s * 10}`,
        oaId: matOa.id, oaCodigo: matOa.codigo, oaDescripcion: matOa.descripcion,
        habilidad: "Resolver", eje: "Números y operaciones",
        ponderacion: 10,
        estado: s <= 2 ? "corregida" : "programada",
        puntajeMaximo: 100,
      });
    }
  }
  if (asignaturaIds.includes("asig-len") && lenOa) {
    for (let s = 1; s <= 3; s++) {
      idxGlobal++;
      evals.push({
        id: `eval-${cursoId}-simce-len-${s}`,
        nombreCorto: `SIMCE L${s}`,
        nombreCompleto: `Ensayo SIMCE Comprensión Lectora N°${s}`,
        tipo: "Ensayo SIMCE",
        asignaturaId: "asig-len",
        asignaturaNombre: "Lenguaje",
        cursoId, fecha: `2026-0${6 + Math.ceil(s / 2)}-${s * 12}`,
        oaId: lenOa.id, oaCodigo: lenOa.codigo, oaDescripcion: lenOa.descripcion,
        habilidad: "Comprender", eje: "Lectura",
        ponderacion: 10,
        estado: s <= 2 ? "corregida" : "programada",
        puntajeMaximo: 100,
      });
    }
  }
  if (nivel >= 6 && asignaturaIds.includes("asig-cie") && cieOa) {
    for (let s = 1; s <= 3; s++) {
      idxGlobal++;
      evals.push({
        id: `eval-${cursoId}-simce-cie-${s}`,
        nombreCorto: `SIMCE C${s}`,
        nombreCompleto: `Ensayo SIMCE Ciencias N°${s}`,
        tipo: "Ensayo SIMCE",
        asignaturaId: "asig-cie",
        asignaturaNombre: "Ciencias Naturales",
        cursoId, fecha: `2026-0${8 + Math.ceil(s / 2)}-${s * 5}`,
        oaId: cieOa.id, oaCodigo: cieOa.codigo, oaDescripcion: cieOa.descripcion,
        habilidad: "Explicar", eje: "Biología",
        ponderacion: 10,
        estado: s <= 1 ? "corregida" : "programada",
        puntajeMaximo: 100,
      });
    }
  }
  return evals;
}

// ─── GENERAR NOTAS ───────────────────────────────────────────────────────
function notaAleatoria(tendencia: number, dispersion: number): number {
  let nota = tendencia + (Math.random() - 0.5) * dispersion;
  nota = Math.round(nota * 10) / 10;
  return Math.max(1.0, Math.min(7.0, nota));
}

export function generarNotas(estudiantes: EstudianteLibro[], evaluaciones: EvaluacionLibro[]): NotaLibro[] {
  const notas: NotaLibro[] = [];
  for (const est of estudiantes) {
    const tendenciaBase = Math.random() < 0.2 ? 3.0 : Math.random() < 0.2 ? 5.8 : 4.3;
    const perfiles: Record<string, number> = {};
    for (const ev of evaluaciones) {
      if (!perfiles[ev.asignaturaId]) {
        perfiles[ev.asignaturaId] = tendenciaBase + (Math.random() - 0.5) * 1.8;
      }
    }
    for (const ev of evaluaciones) {
      const tendencia = Math.max(1.5, Math.min(6.8, perfiles[ev.asignaturaId]));
      let nota: number | null = null;
      let puntaje: number | null = null;
      if (ev.estado === "corregida") {
        puntaje = Math.round(notaAleatoria(tendencia, 3.5) * 10);
        nota = (puntaje / 100) * 6 + 1;
        nota = Math.round(nota * 10) / 10;
        nota = Math.max(1.0, Math.min(7.0, nota));
        if (Math.random() < 0.06) { nota = null; puntaje = null; }
      }
      notas.push({
        estudianteId: est.id,
        evaluacionId: ev.id,
        nota,
        puntaje,
        observacion: nota === null ? "Pendiente" : nota < 4.0 ? "Requiere apoyo" : nota >= 6.0 ? "Destacado" : "",
      });
    }
  }
  return notas;
}

// ─── PRE-GENERAR ─────────────────────────────────────────────────────────
export const todasEvaluaciones = cursos.flatMap((c) => generarEvaluaciones(c.id, c.nivel, c.asignaturas));
export const todasNotas = generarNotas(todosEstudiantes, todasEvaluaciones);

// ─── HELPERS ─────────────────────────────────────────────────────────────
export function formatearNota(n: number | null): string {
  if (n === null || n === undefined) return "-";
  return n.toFixed(1).replace(".", ",");
}

export function colorNota(n: number | null): string {
  if (n === null) return "var(--muted)";
  if (n < 4.0) return "var(--danger)";
  if (n >= 6.0) return "var(--success)";
  return "var(--ink)";
}

export function calcularPromedioSimple(notasEstudiante: NotaLibro[], evaluacionesIds: string[]): number | null {
  const valores = evaluacionesIds
    .map((eid) => notasEstudiante.find((n) => n.evaluacionId === eid))
    .filter((n) => n && n.nota !== null)
    .map((n) => n!.nota!);
  if (valores.length === 0) return null;
  return Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 10) / 10;
}

export function calcularPromedioPonderado(notasEstudiante: NotaLibro[], evaluaciones: EvaluacionLibro[]): number | null {
  const evalPesos = new Map(evaluaciones.map((e) => [e.id, e.ponderacion]));
  let sumaPonderada = 0;
  let sumaPesos = 0;
  for (const n of notasEstudiante) {
    if (n.nota !== null) {
      const peso = evalPesos.get(n.evaluacionId) || 0;
      sumaPonderada += n.nota * peso;
      sumaPesos += peso;
    }
  }
  if (sumaPesos === 0) return null;
  return Math.round((sumaPonderada / sumaPesos) * 10) / 10;
}

export function getNivelLogro(nota: number | null): string {
  if (nota === null) return "Pendiente";
  if (nota >= 5.0) return "Adecuado";
  if (nota >= 4.0) return "Medio";
  return "Descendido";
}

export function getEstadoEstudiante(notasEstudiante: NotaLibro[], evaluacionesIds: string[]): string {
  const notasValidas = evaluacionesIds
    .map((eid) => notasEstudiante.find((n) => n.evaluacionId === eid))
    .filter((n) => n && n.nota !== null)
    .map((n) => n!.nota!);
  const pendientes = evaluacionesIds.filter((eid) => {
    const n = notasEstudiante.find((nn) => nn.evaluacionId === eid);
    return !n || n.nota === null;
  });
  const promedio = notasValidas.length > 0
    ? notasValidas.reduce((a, b) => a + b, 0) / notasValidas.length
    : null;
  const algunaRoja = notasValidas.some((n) => n < 4.0);
  if (promedio === null) return "Pendiente";
  if (promedio < 4.0) return "Requiere apoyo";
  if (algunaRoja) return "En riesgo";
  if (pendientes.length > 0) return "Pendiente";
  return "Al día";
}

export function detectarOADescendidos(notasPorEstudiante: Map<string, NotaLibro[]>, evaluaciones: EvaluacionLibro[]): { oaId: string; oaCodigo: string; oaDescripcion: string; promedio: number }[] {
  const oaNotas = new Map<string, number[]>();
  for (const ev of evaluaciones) {
    if (!oaNotas.has(ev.oaId)) oaNotas.set(ev.oaId, []);
  }
  for (const [, notas] of notasPorEstudiante) {
    for (const n of notas) {
      if (n.nota !== null) {
        const ev = evaluaciones.find((e) => e.id === n.evaluacionId);
        if (ev) oaNotas.get(ev.oaId)?.push(n.nota);
      }
    }
  }
  return Array.from(oaNotas.entries())
    .map(([oaId, notas]) => {
      const ev = evaluaciones.find((e) => e.oaId === oaId);
      const prom = notas.length > 0 ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10 : 0;
      return { oaId, oaCodigo: ev?.oaCodigo || "", oaDescripcion: ev?.oaDescripcion || "", promedio: prom };
    })
    .filter((oa) => oa.promedio > 0 && oa.promedio < 4.0)
    .sort((a, b) => a.promedio - b.promedio);
}
