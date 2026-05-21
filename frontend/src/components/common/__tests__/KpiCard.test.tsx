import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiCard } from "../KpiCard";

describe("KpiCard", () => {
  it("renderiza el label y el value proporcionados", () => {
    render(<KpiCard label="Total Estudiantes" value={320} />);

    expect(screen.getByText("Total Estudiantes")).toBeInTheDocument();
    expect(screen.getByText("320")).toBeInTheDocument();
  });

  it("renderiza con valor string", () => {
    render(<KpiCard label="Promedio Curso" value="5.8" />);

    expect(screen.getByText("Promedio Curso")).toBeInTheDocument();
    expect(screen.getByText("5.8")).toBeInTheDocument();
  });

  it("renderiza con value 0", () => {
    render(<KpiCard label="Pendientes" value={0} />);

    expect(screen.getByText("Pendientes")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("renderiza un elemento article con la clase kpi-card", () => {
    const { container } = render(<KpiCard label="Test" value={1} />);

    const article = container.querySelector("article.kpi-card");
    expect(article).toBeInTheDocument();
  });

  it("tiene el label dentro de un span", () => {
    const { container } = render(<KpiCard label="Etiqueta" value={99} />);

    const span = container.querySelector("span");
    expect(span).toBeInTheDocument();
    expect(span!.textContent).toBe("Etiqueta");
  });

  it("tiene el value dentro de un strong", () => {
    const { container } = render(<KpiCard label="Etiqueta" value={99} />);

    const strong = container.querySelector("strong");
    expect(strong).toBeInTheDocument();
    expect(strong!.textContent).toBe("99");
  });

  it("renderiza valores numericos grandes", () => {
    render(<KpiCard label="Total Notas" value={99999} />);

    expect(screen.getByText("99999")).toBeInTheDocument();
  });

  it("renderiza label vacio", () => {
    render(<KpiCard label="" value={5} />);

    const span = document.querySelector("article.kpi-card span");
    expect(span).toBeInTheDocument();
    expect(span!.textContent).toBe("");
  });
});
