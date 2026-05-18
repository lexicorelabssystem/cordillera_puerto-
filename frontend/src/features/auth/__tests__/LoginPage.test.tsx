import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginPage } from "../LoginPage";

describe("LoginPage", () => {
  it("renderiza el formulario de login", () => {
    render(<LoginPage onLogin={vi.fn()} loading={false} error="" />);

    expect(screen.getByText("CORDILLERA SAAS v4")).toBeInTheDocument();
    expect(screen.getByText("Ingreso")).toBeInTheDocument();
    expect(screen.getByLabelText("Correo")).toBeInTheDocument();
    expect(screen.getByLabelText("Clave")).toBeInTheDocument();
    expect(screen.getByText("Entrar")).toBeInTheDocument();
  });

  it("llama a onLogin con email y password al enviar", async () => {
    const onLogin = vi.fn().mockResolvedValue(undefined);
    render(<LoginPage onLogin={onLogin} loading={false} error="" />);

    await userEvent.type(screen.getByLabelText("Correo"), "admin@cordillera.cl");
    await userEvent.type(screen.getByLabelText("Clave"), "Admin123*");
    await userEvent.click(screen.getByText("Entrar"));

    expect(onLogin).toHaveBeenCalledWith("admin@cordillera.cl", "Admin123*");
  });

  it("deshabilita el boton mientras carga", () => {
    render(<LoginPage onLogin={vi.fn()} loading={true} error="" />);

    const button = screen.getByText("Entrando...");
    expect(button).toBeDisabled();
  });

  it("muestra mensaje de error cuando hay error", () => {
    render(<LoginPage onLogin={vi.fn()} loading={false} error="Credenciales invalidas" />);

    expect(screen.getByText("Credenciales invalidas")).toBeInTheDocument();
  });

  it("no muestra error si string esta vacio", () => {
    render(<LoginPage onLogin={vi.fn()} loading={false} error="" />);

    expect(screen.queryByText("Credenciales invalidas")).not.toBeInTheDocument();
  });

  it("tiene enlace a forgot-password", () => {
    render(<LoginPage onLogin={vi.fn()} loading={false} error="" />);

    const link = screen.getByText("¿Olvidaste tu clave?");
    expect(link).toHaveAttribute("href", "/forgot-password");
  });
});
