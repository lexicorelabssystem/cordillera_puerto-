import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "../ErrorBoundary";

function BrokenComponent(): never {
  throw new Error("Error simulado en componente");
}

describe("ErrorBoundary", () => {
  it("renderiza hijos sin error", () => {
    render(
      <ErrorBoundary>
        <div>Contenido seguro</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("Contenido seguro")).toBeInTheDocument();
  });

  it("muestra mensaje de error cuando un hijo falla", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Algo salio mal")).toBeInTheDocument();
    expect(screen.getByText("Error simulado en componente")).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("muestra fallback personalizado si se provee", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary fallback={<strong>Error 500</strong>}>
        <BrokenComponent />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Error 500")).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("boton Reintentar resetea el estado de error", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const onReset = vi.fn();

    render(
      <ErrorBoundary onReset={onReset}>
        <BrokenComponent />
      </ErrorBoundary>,
    );

    screen.getByText("Reintentar").click();
    expect(onReset).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });
});
