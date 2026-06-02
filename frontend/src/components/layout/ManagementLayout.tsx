import type { ReactNode } from "react";
import { Sidebar, type SidebarCategory } from "./Sidebar";
import { ShellLayout } from "../common/ShellLayout";

interface Props {
  title: string;
  subtitle: string;
  right?: ReactNode;
  sidebarCategories: SidebarCategory[];
  sidebarTitle?: string;
  children: ReactNode;
  breadcrumbs?: { label: string; path?: string }[];
  className?: string;
}

export function ManagementLayout({
  title,
  subtitle,
  right,
  sidebarCategories,
  sidebarTitle,
  children,
  breadcrumbs,
  className,
}: Props) {
  return (
    <ShellLayout title={title} subtitle={subtitle} right={right} breadcrumbs={breadcrumbs} className={className}>
      <div className="management-layout">
        <Sidebar categories={sidebarCategories} title={sidebarTitle} />
        <main className="management-content">
          {children}
        </main>
      </div>
    </ShellLayout>
  );
}
