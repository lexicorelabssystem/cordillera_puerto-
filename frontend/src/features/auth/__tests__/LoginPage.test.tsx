import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginPage } from "../LoginPage";

describe("LoginPage", () => {
  it("renderiza el formulario de login", () => {
    render(<LoginPage onLogin={vi.fn()} loading={false} error="" />);

    expect(screen.getByAltText("EducaCore")).toBeInTheDocument();
    expect(screen.getByText("Iniciar Sesion")).toBeInTheDocument();
    expect(screen.getByLabelText("Correo electronico")).toBeInTheDocument();
    expect(screen.getByLabelText("Contrasena")).toBeInTheDocument();
    expect(screen.getByText("Ingresar")).toBeInTheDocument();
  });

  it("llama a onLogin con email y password al enviar", async () => {
    const onLogin = vi.fn().mockResolvedValue(undefined);
    render(<LoginPage onLogin={onLogin} loading={false} error="" />);

    await userEvent.type(screen.getByLabelText("Correo electronico"), "admin@cordillera.cl");
    await userEvent.type(screen.getByLabelText("Contrasena"), "Admin123*");
    await userEvent.click(screen.getByText("Ingresar"));

    expect(onLogin).toHaveBeenCalledWith("admin@cordillera.cl", "Admin123*");
  });

  it("deshabilita el boton mientras carga", () => {
    render(<LoginPage onLogin={vi.fn()} loading={true} error="" />);

    const button = screen.getByText("Verificando...");
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

    const link = screen.getByText("Olvidaste tu contrasena?");
    expect(link).toHaveAttribute("href", "/forgot-password");
  });
});
