import { useMemo } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { AuthUser, AdminOverview } from "../../types/api";
import { api } from "../../lib/api";
import { ManagementLayout } from "../../components/layout/ManagementLayout";
import type { SidebarCategory } from "../../components/layout/Sidebar";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { useInstitution } from "../../app/InstitutionContext";
import { useFeatureFlags, type FeatureFlag } from "../../hooks/useFeatureFlags";

const ITEM_FEATURE_FLAGS: Record<string, FeatureFlag> = {
  simce: "simce_bank",
  remedial: "remedial_routes",
  correccion: "online_assessments",
  monitoreo: "online_assessments",
};

const adminOnlyPages = ["usuarios", "auditoria", "importar", "exportar"];

function buildCategories(basePath: string, mode: "admin" | "direction"): SidebarCategory[] {
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
      { id: "academico", label: "Anos y Periodos", description: "Calendario academico", path: `${basePath}/academico` },
      { id: "cursos", label: "Cursos y Asignaturas", description: "Niveles, cursos y materias", path: `${basePath}/cursos` },
      { id: "profesores", label: "Profesores", description: "Docentes, asignaciones y evaluaciones", path: `${basePath}/profesores` },
    ],
  };

  if (mode === "admin") {
    academicCategory.items.splice(1, 0, {
      id: "usuarios", label: "Usuarios y Permisos", description: "Cuentas, roles y accesos", path: `${basePath}/usuarios`,
    });
  }

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
    label: "Datos y Auditoria",
    items: [
      { id: "importar", label: "Importar Datos", description: "Carga masiva Excel/CSV", path: `${basePath}/importar` },
      { id: "exportar", label: "Exportar Datos", description: "Descarga en XLSX/CSV/JSON", path: `${basePath}/exportar` },
      { id: "auditoria", label: "Auditoria", description: "Registro de acciones", path: `${basePath}/auditoria` },
    ],
  };

  const cats = [
    dashCategory,
    academicCategory,
    curriculumCategory,
    evalCategory,
    insightsCategory,
    resourcesCategory,
  ];

  if (mode === "admin") {
    cats.push(opsCategory);
  }

  return cats;
}

interface Props {
  user: AuthUser;
  onLogout: () => void;
  mode: "admin" | "direction";
}

export function AdminLayout({ user, onLogout, mode }: Props) {
  const location = useLocation();
  const basePath = mode === "direction" ? "/direction" : "/admin";
  const { selectedInstitution, institutions, setInstitutionId } = useInstitution();
  const { isEnabled } = useFeatureFlags();

  const categories = useMemo(() => {
    const allCategories = buildCategories(basePath, mode);
    return allCategories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter((item) => {
          const flag = ITEM_FEATURE_FLAGS[item.id];
          return flag ? isEnabled(flag) : true;
        }),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [basePath, mode, isEnabled]);

  const overview = useQuery<AdminOverview>({
    queryKey: ["admin-overview", selectedInstitution?.id],
    queryFn: () => api.adminOverview(selectedInstitution?.id),
    enabled: Boolean(selectedInstitution?.id),
  });

  const title = mode === "admin" ? "Panel Administrador" : "Panel Direccion";
  const subtitle =
    mode === "admin"
      ? `Bienvenido/a, ${user.name}. Gestion integral de la plataforma.`
      : `Bienvenido/a, ${user.name}. Supervision pedagogica y monitoreo institucional.`;

  const currentPath = location.pathname.replace(basePath, "").replace(/^\//, "");
  const allItems = categories.flatMap((c) => c.items);
  const currentItem = allItems.find((item) => item.path === location.pathname);
  const currentCategory = categories.find((c) => c.items.some((i) => i.path === location.pathname));

  const breadcrumbs = [
    { label: mode === "admin" ? "Admin" : "Direccion", path: basePath },
    ...(currentCategory ? [{ label: currentCategory.label }] : []),
    ...(currentItem ? [{ label: currentItem.label }] : []),
  ];

  const shouldRenderSidebar = !adminOnlyPages.includes(currentPath) || mode === "admin";

  return (
    <ManagementLayout
      title={title}
      subtitle={subtitle}
      right={
        <div className="header-actions">
          {institutions.length > 0 && (
            <select
              className="institution-select"
              value={selectedInstitution?.id || ""}
              onChange={(e) => setInstitutionId(e.target.value)}
              aria-label="Seleccionar institucion"
            >
              {institutions.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}
                </option>
              ))}
            </select>
          )}
          <div className="header-user">
            <span className="header-user__role">{user.role}</span>
            <span className="header-user__name">{user.name}</span>
          </div>
          <button className="btn-logout" onClick={onLogout}>
            Salir
          </button>
        </div>
      }
      sidebarCategories={shouldRenderSidebar ? categories : []}
      sidebarTitle="Navegacion"
      breadcrumbs={breadcrumbs}
    >
      {overview.isLoading ? (
        <LoadingSpinner label="Cargando panel principal..." />
      ) : overview.isError ? (
        <section className="panel">
          <p className="panel-error">No fue posible cargar los datos globales. Verifica tu conexion.</p>
        </section>
      ) : (
        <Outlet context={{ overview: overview.data! }} />
      )}
    </ManagementLayout>
  );
}
