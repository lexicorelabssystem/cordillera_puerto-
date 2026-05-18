import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoadingSpinner } from "../LoadingSpinner";

describe("LoadingSpinner", () => {
  it("renderiza spinner con tamaño por defecto", () => {
    const { container } = render(<LoadingSpinner />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("renderiza label cuando se provee", () => {
    render(<LoadingSpinner label="Cargando datos..." />);
    expect(screen.getByText("Cargando datos...")).toBeInTheDocument();
  });

  it("sin label no muestra texto", () => {
    const { container } = render(<LoadingSpinner />);
    const labels = container.querySelectorAll("span");
    expect(labels.length).toBe(0);
  });

  it("acepta tamaño sm", () => {
    const { container } = render(<LoadingSpinner size="sm" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("acepta tamaño lg", () => {
    const { container } = render(<LoadingSpinner size="lg" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });
});
