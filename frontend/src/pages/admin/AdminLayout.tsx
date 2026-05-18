import { useMemo } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { AuthUser, AdminOverview } from "../../types/api";
import { api } from "../../lib/api";
import { ManagementLayout } from "../../components/layout/ManagementLayout";
import type { SidebarItem } from "../../components/layout/Sidebar";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";

function buildNavItems(basePath: string, mode: "admin" | "direction"): SidebarItem[] {
  const items: SidebarItem[] = [
    { id: "inicio", label: "Inicio", description: "KPIs y resumen", path: basePath },
    { id: "instituciones", label: "Instituciones", description: "Establecimientos y configuracion", path: `${basePath}/instituciones` },
  ];

  if (mode === "admin") {
    items.push(
      { id: "usuarios", label: "Usuarios", description: "Gestion de cuentas y roles", path: `${basePath}/usuarios` },
    );
  }

  items.push(
    { id: "academico", label: "Años y Periodos", description: "Años academicos, semestres y trimestres", path: `${basePath}/academico` },
    { id: "cursos", label: "Cursos y Asignaturas", description: "Cursos, niveles y materias", path: `${basePath}/cursos` },
    { id: "curriculum", label: "Curriculum", description: "OA, ejes y habilidades", path: `${basePath}/curriculum` },
    { id: "cobertura-curricular", label: "Cobertura Curricular", description: "Asignaturas por nivel", path: `${basePath}/cobertura-curricular` },
    { id: "banco-preguntas", label: "Banco Preguntas", description: "Creacion y gestion", path: `${basePath}/banco-preguntas` },
    { id: "evaluaciones", label: "Evaluaciones", description: "Creacion y monitoreo", path: `${basePath}/evaluaciones` },
    { id: "monitoreo", label: "Monitoreo Ev.", description: "Resumen por tipo y estado", path: `${basePath}/monitoreo` },
    { id: "notas", label: "Notas por Alumno", description: "Semestres y edicion", path: `${basePath}/notas` },
    { id: "cambios-nota", label: "Cambios de Nota", description: "Aprobacion UTP", path: `${basePath}/cambios-nota` },
    { id: "simce", label: "Banco SIMCE", description: "Ensayos requeridos y faltantes", path: `${basePath}/simce` },
    { id: "reportes", label: "Reportes", description: "Historial digital", path: `${basePath}/reportes` },
    { id: "remedial", label: "Ruta Remedial", description: "Curso, estudiante y OA", path: `${basePath}/remedial` },
    { id: "materiales", label: "Recursos", description: "Guias y material pedagogico", path: `${basePath}/materiales` },
    { id: "promedios", label: "Promedios", description: "Calculo ponderado anual", path: `${basePath}/promedios` },
    { id: "correccion", label: "Correccion Rapida", description: "App movil o traspaso", path: `${basePath}/correccion` },
    { id: "alertas", label: "Alertas", description: "Riesgo academico", path: `${basePath}/alertas` },
  );

  if (mode === "admin") {
    items.push(
      { id: "auditoria", label: "Auditoria", description: "Registro de acciones", path: `${basePath}/auditoria` },
      { id: "importar", label: "Importar", description: "Carga masiva de datos", path: `${basePath}/importar` },
      { id: "exportar", label: "Exportar", description: "Descarga de datos", path: `${basePath}/exportar` },
    );
  }

  return items;
}

interface Props {
  user: AuthUser;
  onLogout: () => void;
  mode: "admin" | "direction";
}

export function AdminLayout({ user, onLogout, mode }: Props) {
  const location = useLocation();
  const basePath = mode === "direction" ? "/direction" : "/admin";

  const navItems = useMemo(() => buildNavItems(basePath, mode), [basePath, mode]);

  const overview = useQuery<AdminOverview>({
    queryKey: ["admin-overview"],
    queryFn: () => api.adminOverview(),
  });

  const title = mode === "admin" ? "Panel Administrador" : "Panel Direccion";
  const subtitle =
    mode === "admin"
      ? `Hola ${user.name}. Gestion global del sistema, usuarios, asignaciones y monitoreo institucional.`
      : `Hola ${user.name}. Supervisa resultados, cobertura de evaluaciones y gestion pedagogica en tiempo real.`;

  const currentLabel = navItems.find((item) => item.path === location.pathname)?.label || "Inicio";

  if (overview.isLoading) {
    return (
      <ManagementLayout
        title={title}
        subtitle={subtitle}
        right={<button onClick={onLogout}>Cerrar sesion</button>}
        sidebarItems={navItems}
        currentLabel={currentLabel}
      >
        <LoadingSpinner label="Cargando panel principal..." />
      </ManagementLayout>
    );
  }

  if (overview.isError || !overview.data) {
    return (
      <ManagementLayout
        title={title}
        subtitle={subtitle}
        right={<button onClick={onLogout}>Cerrar sesion</button>}
        sidebarItems={navItems}
        currentLabel={currentLabel}
      >
        <section className="panel"><p>No fue posible cargar datos globales.</p></section>
      </ManagementLayout>
    );
  }

  return (
    <ManagementLayout
      title={title}
      subtitle={subtitle}
      right={<button onClick={onLogout}>Cerrar sesion</button>}
      sidebarItems={navItems}
      currentLabel={currentLabel}
    >
      <Outlet context={{ overview: overview.data }} />
    </ManagementLayout>
  );
}
