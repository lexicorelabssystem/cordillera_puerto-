import { ReactNode } from "react";

interface Props {
  title: string;
  subtitle: string;
  right?: ReactNode;
  children: ReactNode;
}

export function ShellLayout({ title, subtitle, right, children }: Props) {
  return (
    <div className="shell">
      <header className="shell-header">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {right ? <div>{right}</div> : null}
      </header>
      {children}
    </div>
  );
}
