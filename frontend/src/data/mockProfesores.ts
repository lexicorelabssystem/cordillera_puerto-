// ─── MOCK DATA: GESTIÓN DE PROFESORES ──────────────────────────────────

export interface ProfesorRow {
  userId: string;
  teacherId: string;
  nombre: string;
  email: string;
  rut: string | null;
  titulo: string | null;
  asignaciones: AsignacionProfesor[];
  totalEvaluaciones: number;
  activo: boolean;
}

export interface AsignacionProfesor {
  assignmentId: string;
  cursoId: string;
  cursoNombre: string;
  cursoNivel: number;
  asignaturaId: string;
  asignaturaNombre: string;
  evaluacionesCreadas: number;
}

export const profesores: ProfesorRow[] = [
  {
    userId: "user-prof-01",
    teacherId: "tch-001",
    nombre: "Carolina Vega",
    email: "carolina.vega@escuelamariomunoz.cl",
    rut: "16.200.300-4",
    titulo: "Profesora de Educación General Básica",
    asignaciones: [
      { assignmentId: "asg-01", cursoId: "curso-1a", cursoNombre: "1° A", cursoNivel: 1, asignaturaId: "asig-len", asignaturaNombre: "Lenguaje", evaluacionesCreadas: 3 },
      { assignmentId: "asg-02", cursoId: "curso-1a", cursoNombre: "1° A", cursoNivel: 1, asignaturaId: "asig-mat", asignaturaNombre: "Matemática", evaluacionesCreadas: 2 },
      { assignmentId: "asg-03", cursoId: "curso-4a", cursoNombre: "4° A", cursoNivel: 4, asignaturaId: "asig-len", asignaturaNombre: "Lenguaje", evaluacionesCreadas: 4 },
    ],
    totalEvaluaciones: 9,
    activo: true,
  },
  {
    userId: "user-prof-02",
    teacherId: "tch-002",
    nombre: "Roberto Contreras",
    email: "roberto.contreras@escuelamariomunoz.cl",
    rut: "17.500.600-1",
    titulo: "Profesor de Matemática",
    asignaciones: [
      { assignmentId: "asg-04", cursoId: "curso-4a", cursoNombre: "4° A", cursoNivel: 4, asignaturaId: "asig-mat", asignaturaNombre: "Matemática", evaluacionesCreadas: 5 },
      { assignmentId: "asg-05", cursoId: "curso-6a", cursoNombre: "6° A", cursoNivel: 6, asignaturaId: "asig-mat", asignaturaNombre: "Matemática", evaluacionesCreadas: 3 },
    ],
    totalEvaluaciones: 8,
    activo: true,
  },
  {
    userId: "user-prof-03",
    teacherId: "tch-003",
    nombre: "Valentina Araya",
    email: "valentina.araya@escuelamariomunoz.cl",
    rut: "18.900.100-8",
    titulo: "Profesora de Ciencias Naturales",
    asignaciones: [
      { assignmentId: "asg-06", cursoId: "curso-6a", cursoNombre: "6° A", cursoNivel: 6, asignaturaId: "asig-cie", asignaturaNombre: "Ciencias Naturales", evaluacionesCreadas: 2 },
    ],
    totalEvaluaciones: 2,
    activo: true,
  },
  {
    userId: "user-prof-04",
    teacherId: "tch-004",
    nombre: "Felipe Morales",
    email: "felipe.morales@escuelamariomunoz.cl",
    rut: "19.300.700-k",
    titulo: "Profesor de Historia y Geografía",
    asignaciones: [
      { assignmentId: "asg-07", cursoId: "curso-8a", cursoNombre: "8° A", cursoNivel: 8, asignaturaId: "asig-his", asignaturaNombre: "Historia y Geografía", evaluacionesCreadas: 1 },
      { assignmentId: "asg-08", cursoId: "curso-6a", cursoNombre: "6° A", cursoNivel: 6, asignaturaId: "asig-len", asignaturaNombre: "Lenguaje", evaluacionesCreadas: 3 },
    ],
    totalEvaluaciones: 4,
    activo: true,
  },
  {
    userId: "user-prof-05",
    teacherId: "tch-005",
    nombre: "Marcela Flores",
    email: "marcela.flores@escuelamariomunoz.cl",
    rut: "15.100.500-2",
    titulo: "Profesora de Educación Básica",
    asignaciones: [
      { assignmentId: "asg-09", cursoId: "curso-8a", cursoNombre: "8° A", cursoNivel: 8, asignaturaId: "asig-len", asignaturaNombre: "Lenguaje", evaluacionesCreadas: 2 },
      { assignmentId: "asg-10", cursoId: "curso-8a", cursoNombre: "8° A", cursoNivel: 8, asignaturaId: "asig-mat", asignaturaNombre: "Matemática", evaluacionesCreadas: 2 },
    ],
    totalEvaluaciones: 4,
    activo: true,
  },
];
