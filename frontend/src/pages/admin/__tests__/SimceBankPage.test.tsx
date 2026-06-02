import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { ToastProvider } from "../../../components/common/Toast";

vi.mock("../../../lib/api", () => ({
  api: {
    listSimceAssessments: vi.fn(),
    listCourses: vi.fn().mockResolvedValue([]),
    listSubjects: vi.fn().mockResolvedValue([]),
  },
}));

import { api } from "../../../lib/api";
import { SimceBankPage } from "../SimceBankPage";

const mockSimceAssessments = {
  data: [
    {
      id: "s1",
      title: "Ensayo SIMCE Matemática 4°",
      status: "DRAFT",
      gradeLevel: 4,
      date: "2026-05-20",
      course: { id: "c1", name: "4° Básico A", gradeLevel: 4 },
      subject: { id: "sub1", name: "Matemática" },
      _count: { answerKeys: 0, responses: 0 },
    },
    {
      id: "s2",
      title: "Ensayo SIMCE Lenguaje 4°",
      status: "KEY_PENDING",
      gradeLevel: 4,
      date: "2026-05-18",
      course: { id: "c2", name: "4° Básico B", gradeLevel: 4 },
      subject: { id: "sub2", name: "Lenguaje" },
      _count: { answerKeys: 15, responses: 0 },
    },
    {
      id: "s3",
      title: "Ensayo SIMCE Matemática 6°",
      status: "CORRECTED",
      gradeLevel: 6,
      date: "2026-05-10",
      course: { id: "c3", name: "6° Básico A", gradeLevel: 6 },
      subject: { id: "sub1", name: "Matemática" },
      _count: { answerKeys: 30, responses: 90 },
    },
  ],
  meta: { total: 3, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrevious: false },
};

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          {ui}
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  (api.listSimceAssessments as ReturnType<typeof vi.fn>).mockResolvedValue(mockSimceAssessments);
});

describe("SimceBankPage", () => {
  it("renderiza el título 'Módulo SIMCE'", async () => {
    renderWithProviders(<SimceBankPage />);

    await waitFor(() => {
      expect(screen.getByText("Módulo SIMCE")).toBeInTheDocument();
    });
  });

  it("muestra la descripción del módulo", async () => {
    renderWithProviders(<SimceBankPage />);

    await waitFor(() => {
      expect(screen.getByText(/Sube pruebas PDF/)).toBeInTheDocument();
    });
  });

  it("muestra tarjetas KPI con totales correctos", async () => {
    renderWithProviders(<SimceBankPage />);

    await waitFor(() => {
      expect(screen.getByText("Total")).toBeInTheDocument();
    });

    const kpiCards = document.querySelectorAll(".kpi-card strong");
    const values = Array.from(kpiCards).slice(0, 5).map((el) => el.textContent);
    expect(values).toEqual(["3", "1", "1", "0", "1"]);
  });

  it("muestra la tabla con las pruebas SIMCE", async () => {
    renderWithProviders(<SimceBankPage />);

    await waitFor(() => {
      expect(screen.getByText("Ensayo SIMCE Matemática 4°")).toBeInTheDocument();
    });

    expect(screen.getByText("Ensayo SIMCE Lenguaje 4°")).toBeInTheDocument();
    expect(screen.getByText("Ensayo SIMCE Matemática 6°")).toBeInTheDocument();
  });

  it("muestra el botón 'Nueva prueba'", async () => {
    renderWithProviders(<SimceBankPage />);

    await waitFor(() => {
      expect(screen.getByText("+ Nueva prueba")).toBeInTheDocument();
    });
  });

  it("muestra mensaje de selección cuando no hay prueba seleccionada", async () => {
    renderWithProviders(<SimceBankPage />);

    await waitFor(() => {
      expect(screen.getByText("Selecciona una prueba SIMCE")).toBeInTheDocument();
    });
  });

  it("muestra tabla vacía cuando no hay pruebas", async () => {
    (api.listSimceAssessments as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0, hasNext: false, hasPrevious: false } });
    renderWithProviders(<SimceBankPage />);

    await waitFor(() => {
      expect(screen.getByText("Sin pruebas SIMCE")).toBeInTheDocument();
    });
  });

  it("renderiza los encabezados de tabla correctos", async () => {
    renderWithProviders(<SimceBankPage />);

    await waitFor(() => {
      const headers = document.querySelectorAll(".simce-table-wrap thead th");
      expect(headers.length).toBe(6);
    });

    const headerTexts = Array.from(document.querySelectorAll(".simce-table-wrap thead th")).map((h) => h.textContent);
    expect(headerTexts).toContain("Prueba");
    expect(headerTexts).toContain("Curso");
    expect(headerTexts).toContain("Asignatura");
    expect(headerTexts).toContain("Preguntas");
    expect(headerTexts).toContain("Estado");
  });
});
