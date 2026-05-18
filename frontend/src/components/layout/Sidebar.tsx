import { NavLink } from "react-router-dom";

export interface SidebarItem {
  id: string;
  label: string;
  description: string;
  path: string;
}

interface Props {
  items: SidebarItem[];
  title?: string;
}

export function Sidebar({ items, title = "Areas de gestion" }: Props) {
  return (
    <aside className="sidebar-nav" aria-label="Navegacion de gestion">
      <div className="sidebar-nav__title">{title}</div>
      <nav>
        {items.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) =>
              isActive ? "sidebar-nav__item active" : "sidebar-nav__item"
            }
          >
            <strong>{item.label}</strong>
            <span>{item.description}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
