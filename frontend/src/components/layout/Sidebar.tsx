import { useState } from "react";
import { NavLink } from "react-router-dom";

export interface SidebarItem {
  id: string;
  label: string;
  description: string;
  path: string;
}

export interface SidebarCategory {
  id: string;
  label: string;
  items: SidebarItem[];
  defaultOpen?: boolean;
}

interface Props {
  categories: SidebarCategory[];
  title?: string;
}

function SidebarCategoryGroup({ category }: { category: SidebarCategory }) {
  const [open, setOpen] = useState(category.defaultOpen ?? true);

  return (
    <div className="sidebar-nav__category">
      <button
        className="sidebar-nav__category-header"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span>{category.label}</span>
        <span className={`sidebar-nav__chevron ${open ? "open" : ""}`} aria-hidden="true">
          &#9662;
        </span>
      </button>
      {open && (
        <div className="sidebar-nav__category-items">
          {category.items.map((item) => (
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
        </div>
      )}
    </div>
  );
}

export function Sidebar({ categories, title = "Gestion" }: Props) {
  return (
    <aside className="sidebar-nav" aria-label="Navegacion principal">
      {title && <div className="sidebar-nav__title">{title}</div>}
      <nav>
        {categories.map((cat) => (
          <SidebarCategoryGroup key={cat.id} category={cat} />
        ))}
      </nav>
    </aside>
  );
}
