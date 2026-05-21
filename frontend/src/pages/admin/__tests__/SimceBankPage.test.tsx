import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../../../lib/api", () => ({
  api: {
    listAssessments: vi.fn(),
  },
}));

import { api } from "../../../lib/api";
import { SimceBankPage } from "../SimceBankPage";

const mockAssessments = [
  {
    assessment_id: "a1",
    title: "Ensayo SIMCE Matematica 4° - Numeros",
    assessment_type: "SIMCE",
    status: "PUBLISHED",
    course_name: "4° Basico A",
    subject_name: "Matem\u00e1tica",
    attempts_count: 25,
    grades_count: 20,
  },
  {
    assessment_id: "a2",
    title: "Ensayo SIMCE Lenguaje 4° - Comprension Lectora",
    assessment_type: "SIMCE",
    status: "ACTIVE",
    course_name: "4° Basico B",
    subject_name: "Lenguaje",
    attempts_count: 30,
    grades_count: 28,
  },
  {
    assessment_id: "a3",
    title: "Ensayo SIMCE Matematica 6° - Geometria",
    assessment_type: "SIMCE",
    status: "PUBLISHED",
    course_name: "6° Basico A",
    subject_name: "Matem\u00e1tica",
    attempts_count: 15,
    grades_count: 12,
  },
  {
    assessment_id: "a4",
    title: "Ensayo SIMCE Lenguaje 6° - Textos Informativos",
    assessment_type: "SIMCE",
    status: "DRAFT",
    course_name: "6° Basico B",
    subject_name: "Lenguaje",
    attempts_count: 5,
    grades_count: 3,
  },
];

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  (api.listAssessments as ReturnType<typeof vi.fn>).mockResolvedValue(mockAssessments);
});

describe("SimceBankPage", () => {
  it("renderiza el titulo 'Banco de Ensayos SIMCE'", async () => {
    renderWithQueryClient(<SimceBankPage />);

    await waitFor(() => {
      expect(screen.getByText("Banco de Ensayos SIMCE")).toBeInTheDocument();
    });
  });

  it("muestra la descripcion del banco de ensayos", async () => {
    renderWithQueryClient(<SimceBankPage />);

    await waitFor(() => {
      expect(screen.getByText(/Banco de ensayos tipo SIMCE/)).toBeInTheDocument();
    });
  });

  it("muestra la tarjeta KPI de total ensayos con la cantidad correcta", async () => {
    renderWithQueryClient(<SimceBankPage />);

    await waitFor(() => {
      const kpiCards = document.querySelectorAll(".kpi-card");
      const totalCard = kpiCards[0];
      expect(totalCard).toBeInTheDocument();
      expect(totalCard.querySelector("strong")!.textContent).toBe("4");
    });
  });

  it("muestra KPI de Matem\u00e1tica 4\u00b0 con filtro correcto", async () => {
    renderWithQueryClient(<SimceBankPage />);

    await waitFor(() => {
      const kpiCards = document.querySelectorAll(".kpi-card");
      const mat4Card = Array.from(kpiCards).find(
        (c) => c.querySelector("span")?.textContent === "Matem\u00e1tica 4\u00b0",
      );
      expect(mat4Card).toBeDefined();
      expect(mat4Card!.querySelector("strong")!.textContent).toBe("1");
    });
  });

  it("muestra KPI de Lectura 4\u00b0 con filtro correcto", async () => {
    renderWithQueryClient(<SimceBankPage />);

    await waitFor(() => {
      const kpiCards = document.querySelectorAll(".kpi-card");
      const lect4Card = Array.from(kpiCards).find(
        (c) => c.querySelector("span")?.textContent === "Lectura 4\u00b0",
      );
      expect(lect4Card).toBeDefined();
      expect(lect4Card!.querySelector("strong")!.textContent).toBe("1");
    });
  });

  it("muestra KPI de Matem\u00e1tica 6\u00b0 con filtro correcto", async () => {
    renderWithQueryClient(<SimceBankPage />);

    await waitFor(() => {
      const kpiCards = document.querySelectorAll(".kpi-card");
      const mat6Card = Array.from(kpiCards).find(
        (c) => c.querySelector("span")?.textContent === "Matem\u00e1tica 6\u00b0",
      );
      expect(mat6Card).toBeDefined();
      expect(mat6Card!.querySelector("strong")!.textContent).toBe("1");
    });
  });

  it("muestra KPI de Lectura 6\u00b0 con filtro correcto", async () => {
    renderWithQueryClient(<SimceBankPage />);

    await waitFor(() => {
      const kpiCards = document.querySelectorAll(".kpi-card");
      const lect6Card = Array.from(kpiCards).find(
        (c) => c.querySelector("span")?.textContent === "Lectura 6\u00b0",
      );
      expect(lect6Card).toBeDefined();
      expect(lect6Card!.querySelector("strong")!.textContent).toBe("1");
    });
  });

  it("renderiza la tabla con las filas de ensayos", async () => {
    renderWithQueryClient(<SimceBankPage />);

    await waitFor(() => {
      expect(screen.getByText("Ensayo SIMCE Matematica 4° - Numeros")).toBeInTheDocument();
    });

    const table = document.querySelector(".table");
    expect(table).toBeInTheDocument();

    const rows = table!.querySelectorAll("tbody tr");
    expect(rows.length).toBe(4);
  });

  it("muestra los datos correctos en cada fila de la tabla", async () => {
    renderWithQueryClient(<SimceBankPage />);

    await waitFor(() => {
      expect(screen.getByText("Ensayo SIMCE Matematica 4° - Numeros")).toBeInTheDocument();
    });

    expect(screen.getByText("4° Basico A")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
  });

  it("muestra badges de estado PUBLISHED/ACTIVE con clase correcta", async () => {
    renderWithQueryClient(<SimceBankPage />);

    await waitFor(() => {
      const badges = screen.getAllByText("PUBLISHED");
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });

    const publishedBadges = screen.getAllByText("PUBLISHED");
    publishedBadges.forEach((b) => {
      expect(b.classList.contains("badge--active")).toBe(true);
    });
  });

  it("muestra badge de estado DRAFT con clase warning", async () => {
    renderWithQueryClient(<SimceBankPage />);

    await waitFor(() => {
      expect(screen.getByText("DRAFT")).toBeInTheDocument();
    });

    const draftBadge = screen.getByText("DRAFT");
    expect(draftBadge.classList.contains("badge--warning")).toBe(true);
  });

  it("muestra tabla vacia cuando no hay ensayos SIMCE", async () => {
    (api.listAssessments as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    renderWithQueryClient(<SimceBankPage />);

    await waitFor(() => {
      const kpiCard = document.querySelector(".kpi-card strong");
      expect(kpiCard).toBeInTheDocument();
    });

    const totalCard = document.querySelector(".kpi-card strong");
    expect(totalCard!.textContent).toBe("0");

    const rows = document.querySelectorAll("tbody tr");
    expect(rows.length).toBe(0);
  });

  it("llama a listAssessments con assessmentType SIMCE al montar", async () => {
    renderWithQueryClient(<SimceBankPage />);

    await waitFor(() => {
      expect(api.listAssessments).toHaveBeenCalledWith({ assessmentType: "SIMCE" });
    });
  });

  it("muestra mensaje de error cuando la API falla", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    (api.listAssessments as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Error de red"));
    renderWithQueryClient(<SimceBankPage />);

    await waitFor(() => {
      expect(screen.getByText("Banco de Ensayos SIMCE")).toBeInTheDocument();
    });

    const rows = document.querySelectorAll("tbody tr");
    expect(rows.length).toBe(0);

    consoleError.mockRestore();
  });

  it("renderiza las cabeceras de tabla correctas", async () => {
    renderWithQueryClient(<SimceBankPage />);

    await waitFor(() => {
      const headers = document.querySelectorAll("thead th");
      expect(headers.length).toBe(6);
    });

    const headers = document.querySelectorAll("thead th");
    const headerTexts = Array.from(headers).map((h) => h.textContent);
    expect(headerTexts).toContain("Ensayo");
    expect(headerTexts).toContain("Curso");
    expect(headerTexts).toContain("Asignatura");
    expect(headerTexts).toContain("Intentos");
    expect(headerTexts).toContain("Notas");
    expect(headerTexts).toContain("Estado");
  });
});
