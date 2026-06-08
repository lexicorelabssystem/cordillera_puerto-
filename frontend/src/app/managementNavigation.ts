import type { SidebarCategory } from "../components/layout/Sidebar";
import type { FeatureFlag } from "../hooks/useFeatureFlags";

export type ManagementMode = "admin" | "direction" | "utp";

export const MANAGEMENT_ITEM_FEATURE_FLAGS: Record<string, FeatureFlag> = {
  simce: "simce_bank",
  remedial: "remedial_routes",
  correccion: "online_assessments",
  monitoreo: "online_assessments",
};

export const ADMIN_ONLY_PATHS = ["importar", "exportar"];

export function getManagementBasePath(mode: ManagementMode) {
  return mode === "direction" ? "/direction" : mode === "utp" ? "/utp" : "/admin";
}

export function buildManagementCategories(basePath: string, mode: ManagementMode): SidebarCategory[] {
  const dashCategory: SidebarCategory = {
    id: "dashboard",
    label: "Panel Principal",
    defaultOpen: true,
    items: [
      { id: "inicio", label: "Inicio", description: "KPIs y resumen general", path: basePath },
    ],
  };

  const academicCategory: SidebarCategory = {
    id: "academico",
    label: "Gestion Academica",
    defaultOpen: true,
    items: [
      { id: "instituciones", label: "Instituciones", description: "Establecimientos y configuracion", path: `${basePath}/instituciones` },
      { id: "academico", label: "Años y Periodos", description: "Calendario académico", path: `${basePath}/academico` },
      { id: "cursos", label: "Cursos y Asignaturas", description: "Niveles, cursos y materias", path: `${basePath}/cursos` },
      { id: "profesores", label: "Profesores", description: "Docentes, asignaciones y evaluaciones", path: `${basePath}/profesores` },
    ],
  };

  if (mode === "admin" || mode === "utp") {
    academicCategory.items.splice(1, 0, {
      id: "usuarios",
      label: mode === "utp" ? "Usuarios UTP" : "Usuarios y Permisos",
      description: "Cuentas, roles y accesos",
      path: `${basePath}/usuarios`,
    });
  }

  if (mode !== "admin") {
    academicCategory.items = academicCategory.items.filter((item) =>
      mode === "utp" ? !["profesores", "cursos"].includes(item.id) : item.id !== "profesores",
    );
  }

  const peopleCategory: SidebarCategory | null = mode === "admin" ? null : {
    id: "usuarios-institucionales",
    label: "Usuarios Institucionales",
    defaultOpen: true,
    items: [
      { id: "profesores", label: "Profesores", description: "Crear reemplazos, retirar y asignar docentes", path: `${basePath}/profesores` },
      { id: "alumnos-curso", label: "Alumnos por Curso", description: "Ingresar alumnos desde el detalle del curso", path: `${basePath}/alumnos` },
    ],
  };

  const curriculumCategory: SidebarCategory = {
    id: "curriculo",
    label: "Diseno Curricular",
    items: [
      { id: "curriculum", label: "Ejes, OA y Habilidades", description: "Estructura curricular", path: `${basePath}/curriculum` },
      { id: "cobertura-curricular", label: "Cobertura por Nivel", description: "Asignaturas por grado", path: `${basePath}/cobertura-curricular` },
      { id: "banco-preguntas", label: "Banco de Preguntas", description: "Creacion y catalogo", path: `${basePath}/banco-preguntas` },
    ],
  };

  const evalCategory: SidebarCategory = {
    id: "evaluacion",
    label: "Evaluaciones y Notas",
    defaultOpen: true,
    items: [
      { id: "evaluaciones", label: "Evaluaciones", description: "Crear, publicar y monitorear", path: `${basePath}/evaluaciones` },
      { id: "libro-evaluaciones", label: "Libro de Evaluaciones", description: "Vista tipo libro de clases digital", path: `${basePath}/libro-evaluaciones` },
      { id: "gradebook", label: "Libro de Calificaciones", description: "Vista moderna de notas y perfil alumno", path: `${basePath}/gradebook` },
      { id: "monitoreo", label: "Monitoreo por Estado", description: "Resumen por tipo", path: `${basePath}/monitoreo` },
      { id: "notas", label: "Notas por Alumno", description: "Registro y edicion", path: `${basePath}/notas` },
      { id: "cambios-nota", label: "Cambios de Nota", description: "Solicitudes y aprobacion", path: `${basePath}/cambios-nota` },
      { id: "simce", label: "Ensayos SIMCE", description: "Banco de ensayos tipo", path: `${basePath}/simce` },
      { id: "promedios", label: "Promedios Ponderados", description: "Calculo por periodo", path: `${basePath}/promedios` },
      { id: "correccion", label: "Correccion Rapida", description: "Preguntas pendientes", path: `${basePath}/correccion` },
      { id: "correccion-rapida", label: "Correccion Masiva", description: "Carga rapida de respuestas", path: `${basePath}/correccion-rapida` },
    ],
  };

  const insightsCategory: SidebarCategory = {
    id: "insights",
    label: "Analisis y Reportes",
    items: [
      { id: "reportes", label: "Reportes", description: "Generar y consultar", path: `${basePath}/reportes` },
      { id: "remedial", label: "Rutas Remediales", description: "Planes de refuerzo por OA", path: `${basePath}/remedial` },
      { id: "alertas", label: "Alertas", description: "Riesgo academico", path: `${basePath}/alertas` },
      { id: "bandeja", label: "Bandeja UTP", description: "Notificaciones de cambios de nota", path: `${basePath}/bandeja` },
    ],
  };

  const resourcesCategory: SidebarCategory = {
    id: "recursos",
    label: "Material Pedagogico",
    items: [
      { id: "materiales", label: "Recursos y Guias", description: "Guias, presentaciones, material", path: `${basePath}/materiales` },
    ],
  };

  const opsCategory: SidebarCategory = {
    id: "operaciones",
    label: mode === "admin" ? "Datos y Auditoria" : "Auditoria",
    items: mode === "admin"
      ? [
          { id: "importar", label: "Importar Datos", description: "Carga masiva Excel/CSV", path: `${basePath}/importar` },
          { id: "exportar", label: "Exportar Datos", description: "Descarga en XLSX/CSV/JSON", path: `${basePath}/exportar` },
          { id: "auditoria", label: "Auditoria", description: "Registro de acciones", path: `${basePath}/auditoria` },
        ]
      : [
          { id: "auditoria", label: "Auditoria institucional", description: "Registro de acciones del establecimiento", path: `${basePath}/auditoria` },
        ],
  };

  const categories = [
    dashCategory,
    ...(peopleCategory ? [peopleCategory] : []),
    academicCategory,
    curriculumCategory,
    evalCategory,
    insightsCategory,
    resourcesCategory,
  ];

  if (mode === "admin" || mode === "direction" || mode === "utp") {
    categories.push(opsCategory);
  }

  return categories;
}
