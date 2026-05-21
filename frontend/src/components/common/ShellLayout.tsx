import { ReactNode } from "react";
import { Link } from "react-router-dom";

interface Breadcrumb {
  label: string;
  path?: string;
}

interface Props {
  title: string;
  subtitle: string;
  right?: ReactNode;
  children: ReactNode;
  breadcrumbs?: Breadcrumb[];
}

export function ShellLayout({ title, subtitle, right, children, breadcrumbs }: Props) {
  return (
    <div className="shell">
      <header className="shell-header">
        <div>
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav className="breadcrumbs" aria-label="Breadcrumb">
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className="breadcrumbs__item">
                  {i > 0 && <span className="breadcrumbs__sep">/</span>}
                  {crumb.path && i < breadcrumbs.length - 1 ? (
                    <Link to={crumb.path}>{crumb.label}</Link>
                  ) : (
                    <span>{crumb.label}</span>
                  )}
                </span>
              ))}
            </nav>
          )}
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {right ? <div className="shell-header__actions">{right}</div> : null}
      </header>
      {children}
    </div>
  );
}
