import { useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { AuthUser, AdminOverview } from "../../types/api";
import { api } from "../../lib/api";
import { ManagementLayout } from "../../components/layout/ManagementLayout";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { useToast } from "../../components/common/Toast";
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const basePath = getManagementBasePath(mode);
  const { selectedInstitution, institutions, setInstitutionId, isLoading: institutionsLoading } = useInstitution();
  const { toast } = useToast();
  const { isEnabled } = useFeatureFlags();
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [displayName, setDisplayName] = useState(user.name);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState(() => {
    const [firstName = "", ...rest] = user.name.split(" ").filter(Boolean);
    return { firstName, lastName: rest.join(" ") };
  });
  const [profileSaving, setProfileSaving] = useState(false);

  const categories = useMemo(() => {
    const allCategories = buildManagementCategories(basePath, mode);
    return allCategories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter((item) => {
          if (item.id === "instituciones" && user.role !== "SUPER_ADMIN") return false;
          const flag = MANAGEMENT_ITEM_FEATURE_FLAGS[item.id];
          return flag ? isEnabled(flag) : true;
        }),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [basePath, mode, isEnabled, user.role]);

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
  const canSwitchInstitution = user.role === "SUPER_ADMIN";
  const avatarStorageKey = `cordillera_avatar_${user.sub}`;
  const userInitials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  useEffect(() => {
    setDisplayName(user.name);
    const [firstName = "", ...rest] = user.name.split(" ").filter(Boolean);
    setProfileForm({ firstName, lastName: rest.join(" ") });
    setAvatarUrl(localStorage.getItem(avatarStorageKey));
  }, [avatarStorageKey, user.name]);

  async function handleProfileSave() {
    if (!profileForm.firstName.trim() || !profileForm.lastName.trim()) return;
    setProfileSaving(true);
    try {
      const result = await api.updateMyProfile({
        firstName: profileForm.firstName.trim(),
        lastName: profileForm.lastName.trim(),
      });
      localStorage.setItem("cordillera_user", JSON.stringify(result.user));
      setDisplayName(result.user.name);
      setIsEditingProfile(false);
      toast("Nombre actualizado correctamente.", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "No fue posible actualizar el nombre.", "error");
    } finally {
      setProfileSaving(false);
    }
  }

  function handleAvatarFile(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const nextAvatar = typeof reader.result === "string" ? reader.result : null;
      if (!nextAvatar) return;
      localStorage.setItem(avatarStorageKey, nextAvatar);
      setAvatarUrl(nextAvatar);
    };
    reader.readAsDataURL(file);
  }

  return (
    <ManagementLayout
      title={title}
      subtitle={subtitle}
      right={
        <div className={`header-actions ${canSwitchInstitution ? "" : "header-actions--session-only"}`}>
          {canSwitchInstitution && institutions.length > 0 && (
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
          <div className="header-user-menu">
            <button
              className="header-user"
              type="button"
              onClick={() => setSessionMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={sessionMenuOpen}
            >
              <div className="header-user__copy">
                <span className="header-user__eyebrow">Sesion</span>
                <span className="header-user__name">{displayName}</span>
                <span className="header-user__role">{user.role}</span>
              </div>
              <span className="header-user__avatar" aria-hidden="true">
                {avatarUrl ? <img src={avatarUrl} alt="" /> : userInitials || "U"}
              </span>
            </button>
            {sessionMenuOpen ? (
              <div className="session-menu" role="menu">
                {isEditingProfile ? (
                  <div className="session-menu__form">
                    <label>
                      Nombre
                      <input
                        value={profileForm.firstName}
                        onChange={(event) => setProfileForm((form) => ({ ...form, firstName: event.target.value }))}
                      />
                    </label>
                    <label>
                      Apellido
                      <input
                        value={profileForm.lastName}
                        onChange={(event) => setProfileForm((form) => ({ ...form, lastName: event.target.value }))}
                      />
                    </label>
                    <div className="session-menu__row">
                      <button type="button" onClick={handleProfileSave} disabled={profileSaving}>
                        {profileSaving ? "Guardando..." : "Guardar"}
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => setIsEditingProfile(false)}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button type="button" onClick={() => setIsEditingProfile(true)} role="menuitem">
                      Editar nombre
                    </button>
                    <button type="button" onClick={() => fileInputRef.current?.click()} role="menuitem">
                      Agregar imagen
                    </button>
                    {avatarUrl ? (
                      <button
                        type="button"
                        onClick={() => {
                          localStorage.removeItem(avatarStorageKey);
                          setAvatarUrl(null);
                        }}
                        role="menuitem"
                      >
                        Quitar imagen
                      </button>
                    ) : null}
                    <button type="button" className="session-menu__logout" onClick={onLogout} role="menuitem">
                      Salir
                    </button>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={(event) => {
                    handleAvatarFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </div>
            ) : null}
          </div>
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
          <Outlet context={{ overview: overviewData, user }} />
        </>
      )}
    </ManagementLayout>
  );
}
