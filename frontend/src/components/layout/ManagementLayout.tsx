import type { ReactNode } from "react";
import { Sidebar, type SidebarItem } from "./Sidebar";
import { ShellLayout } from "../common/ShellLayout";

interface Props {
  title: string;
  subtitle: string;
  right?: ReactNode;
  sidebarItems: SidebarItem[];
  sidebarTitle?: string;
  children: ReactNode;
  currentLabel: string;
}

export function ManagementLayout({
  title,
  subtitle,
  right,
  sidebarItems,
  sidebarTitle,
  children,
  currentLabel,
}: Props) {
  return (
    <ShellLayout title={title} subtitle={subtitle} right={right}>
      <div className="management-layout">
        <Sidebar items={sidebarItems} title={sidebarTitle} />
        <main className="management-content">
          <div className="section-heading">
            <span>Area activa</span>
            <h2>{currentLabel}</h2>
          </div>
          {children}
        </main>
      </div>
    </ShellLayout>
  );
}
