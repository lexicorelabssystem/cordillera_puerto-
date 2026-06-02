import { useMemo } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { AuthUser, AdminOverview } from "../../types/api";
import { api } from "../../lib/api";
import { ManagementLayout } from "../../components/layout/ManagementLayout";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { useInstitution } from "../../app/InstitutionContext";
import { useFeatureFlags } from "../../hooks/useFeatureFlags";
import {
  ADMIN_ONLY_PATHS,
  MANAGEMENT_ITEM_FEATURE_FLAGS,
  buildManagementCategories,
  getManagementBasePath,
  type ManagementMode,
} from "../../app/managementNavigation";

const EMPTY_OVERVIEW: AdminOverview = {
  studentCount: 0,
  courseCount: 0,
  teacherCount: 0,
  assessmentCount: 0,
  coverageRate: 0,
  subjectCount: 0,
  totals: { users: 0, courses: 0, students: 0, assessments: 0 },
  courses: [],
  students: [],
  teachers: [],
  subjects: [],
  recentAssessments: [],
  semaforoCursos: [],
  alertas: [],
};

interface Props {
  user: AuthUser;
  onLogout: () => void;
  mode: ManagementMode;
}

export function AdminLayout({ user, onLogout, mode }: Props) {
  const location = useLocation();
  const basePath = getManagementBasePath(mode);
  const { selectedInstitution, institutions, setInstitutionId, isLoading: institutionsLoading } = useInstitution();
  const { isEnabled } = useFeatureFlags();

  const categories = useMemo(() => {
    const allCategories = buildManagementCategories(basePath, mode);
    return allCategories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter((item) => {
          const flag = MANAGEMENT_ITEM_FEATURE_FLAGS[item.id];
          return flag ? isEnabled(flag) : true;
        }),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [basePath, mode, isEnabled]);

  const overview = useQuery<AdminOverview>({
    queryKey: ["admin-overview", selectedInstitution?.id],
    queryFn: () => api.adminOverview(selectedInstitution?.id),
    enabled: !institutionsLoading,
  });

  const overviewData = overview.data ?? EMPTY_OVERVIEW;

  const title =
    mode === "admin" ? "Panel Administrador" :
    mode === "utp" ? "Panel UTP" :
    "Panel Direccion";
  const subtitle =
    mode === "admin"
      ? `Bienvenido/a, ${user.name}. Gestion integral de la plataforma.`
      : mode === "utp"
      ? `Bienvenido/a, ${user.name}. Seguimiento pedagogico, evaluaciones y alertas institucionales.`
      : `Bienvenido/a, ${user.name}. Supervision pedagogica y monitoreo institucional.`;

  const currentPath = location.pathname.replace(basePath, "").replace(/^\//, "");
  const allItems = categories.flatMap((c) => c.items);
  const currentItem = allItems.find((item) => item.path === location.pathname);
  const currentCategory = categories.find((c) => c.items.some((i) => i.path === location.pathname));

  const breadcrumbs = [
    { label: mode === "admin" ? "Admin" : mode === "utp" ? "UTP" : "Direccion", path: basePath },
    ...(currentCategory ? [{ label: currentCategory.label }] : []),
    ...(currentItem ? [{ label: currentItem.label }] : []),
  ];

  const shouldRenderSidebar = !ADMIN_ONLY_PATHS.includes(currentPath) || mode === "admin";

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
      className={`shell--${mode}`}
    >
      {overview.isLoading && !overview.data ? (
        <LoadingSpinner label="Cargando panel principal..." />
      ) : (
        <>
          {overview.isError && (
            <section className="panel">
              <p className="panel-error">
                No fue posible cargar el resumen global. Las secciones siguen disponibles con datos propios.
              </p>
            </section>
          )}
          <Outlet context={{ overview: overviewData }} />
        </>
      )}
    </ManagementLayout>
  );
}
