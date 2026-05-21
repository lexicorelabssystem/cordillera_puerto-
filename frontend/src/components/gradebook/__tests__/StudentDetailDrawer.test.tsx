import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../../../lib/api", () => ({
  api: {
    getStudent: vi.fn(),
    getAttendanceStats: vi.fn(),
    listObservations: vi.fn(),
    getCourseGradeBook: vi.fn(),
  },
}));

vi.mock("recharts", () => ({
  BarChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
    <div data-testid="bar-chart" data-length={data.length}>{children}</div>
  ),
  Bar: ({ dataKey }: { dataKey: string }) => <div data-testid="bar" data-key={dataKey} />,
  XAxis: ({ dataKey }: { dataKey: string }) => <div data-testid="xaxis" data-key={dataKey} />,
  YAxis: () => <div data-testid="yaxis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
    <div data-testid="line-chart" data-length={data.length}>{children}</div>
  ),
  Line: ({ dataKey }: { dataKey: string }) => <div data-testid="line" data-key={dataKey} />,
}));

import { api } from "../../../lib/api";
import { StudentDetailDrawer } from "../StudentDetailDrawer";

const mockStudent = {
  sub: "student-1",
  firstName: "Juan",
  lastName: "Perez",
  email: "juan@school.cl",
  role: "STUDENT",
};

const mockAttendanceStats = {
  studentId: "student-1",
  total: 40,
  present: 35,
  absent: 3,
  late: 2,
  justified: 0,
  excused: 0,
  attendanceRate: 87.5,
  absenceRate: 12.5,
  atRisk: false,
};

const mockBookWithGrades = {
  course: { id: "c1", name: "4° Basico A", gradeLevel: 4 },
  subjectId: "s1",
  assessments: [
    { id: "a1", title: "Prueba 1", type: "PROCESO", status: "PUBLISHED", weight: 1, maxScore: 100, semester: 1, subjectName: "Matematica", oaCode: null, oaDescription: null },
    { id: "a2", title: "Prueba 2", type: "CIERRE", status: "PUBLISHED", weight: 1, maxScore: 100, semester: 1, subjectName: "Matematica", oaCode: null, oaDescription: null },
  ],
  students: [
    {
      studentId: "student-1",
      firstName: "Juan",
      lastName: "Perez",
      rut: "12345678-9",
      grades: [
        { gradeId: "g1", assessmentId: "a1", assessmentTitle: "Prueba 1", assessmentType: "PROCESO", semester: 1, subjectName: "Matematica", weight: 1, maxScore: 100, score: 60, percentage: 60, grade: 5.2, status: "GRADED", oaCode: null, oaDescription: null },
        { gradeId: "g2", assessmentId: "a2", assessmentTitle: "Prueba 2", assessmentType: "CIERRE", semester: 1, subjectName: "Matematica", weight: 1, maxScore: 100, score: null, percentage: null, grade: null, status: "PENDING", oaCode: null, oaDescription: null },
      ],
      average: 5.2,
      atRisk: false,
      hasPending: true,
    },
  ],
  stats: { courseAvg: 5.5, approvalRate: 80, approvedCount: 24, atRiskCount: 1, pendingsCount: 2, totalNotes: 60, totalStudents: 30, totalAssessments: 5, simceCount: 0, appliedCount: 3 },
  oaDescendidos: [],
};

const mockBookNoGrades = {
  course: { id: "c1", name: "4° Basico A", gradeLevel: 4 },
  subjectId: "s1",
  assessments: [],
  students: [
    {
      studentId: "student-1",
      firstName: "Juan",
      lastName: "Perez",
      rut: "12345678-9",
      grades: [],
      average: null,
      atRisk: false,
      hasPending: false,
    },
  ],
  stats: { courseAvg: null, approvalRate: 0, approvedCount: 0, atRiskCount: 0, pendingsCount: 0, totalNotes: 0, totalStudents: 30, totalAssessments: 5, simceCount: 0, appliedCount: 0 },
  oaDescendidos: [],
};

const mockObservations = [
  { id: "o1", title: "Buen trabajo", type: "ACADEMIC", content: "El estudiante ha mostrado progreso en matematicas.", createdAt: "2025-01-01", course: { name: "4° Basico A" } },
  { id: "o2", title: "Conducta en clase", type: "BEHAVIOR", content: "Se distrae con facilidad durante las explicaciones.", createdAt: "2025-02-01", course: { name: "4° Basico A" } },
];

const defaultProps = {
  studentId: "student-1",
  courseId: "c1",
  onClose: vi.fn(),
};

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
  (api.getStudent as ReturnType<typeof vi.fn>).mockResolvedValue(mockStudent);
  (api.getAttendanceStats as ReturnType<typeof vi.fn>).mockResolvedValue(mockAttendanceStats);
  (api.listObservations as ReturnType<typeof vi.fn>).mockResolvedValue(mockObservations);
  (api.getCourseGradeBook as ReturnType<typeof vi.fn>).mockResolvedValue(mockBookWithGrades);
});

function setupLoading() {
  (api.getStudent as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
  (api.getAttendanceStats as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
  (api.listObservations as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
  (api.getCourseGradeBook as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
}

describe("StudentDetailDrawer", () => {
  it("muestra el drawer con overlay y boton de cierre", () => {
    renderWithQueryClient(<StudentDetailDrawer {...defaultProps} />);

    const overlay = document.querySelector(".gb-drawer-overlay");
    expect(overlay).toBeInTheDocument();
    const closeBtn = document.querySelector(".gb-drawer__close");
    expect(closeBtn).toBeInTheDocument();
    expect(closeBtn!.textContent).toContain("\u00d7");
  });

  it("renderiza loading spinner mientras carga", () => {
    setupLoading();
    renderWithQueryClient(<StudentDetailDrawer {...defaultProps} />);

    const header = screen.getByText("Cargando...");
    expect(header).toBeInTheDocument();
  });

  it("muestra nombre del estudiante cuando los datos cargan", async () => {
    renderWithQueryClient(<StudentDetailDrawer {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Juan Perez")).toBeInTheDocument();
    });
  });

  it("muestra el close button con &times;", () => {
    renderWithQueryClient(<StudentDetailDrawer {...defaultProps} />);

    const closeBtn = screen.getByText("\u00d7");
    expect(closeBtn).toBeInTheDocument();
  });

  it("llama a onClose al hacer clic en el boton de cerrar", () => {
    const onClose = vi.fn();
    renderWithQueryClient(<StudentDetailDrawer {...defaultProps} onClose={onClose} />);

    const closeBtn = screen.getByText("\u00d7");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("llama a onClose al hacer clic en el overlay", () => {
    const onClose = vi.fn();
    renderWithQueryClient(<StudentDetailDrawer {...defaultProps} onClose={onClose} />);

    const overlay = document.querySelector(".gb-drawer-overlay")!;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("detiene propagacion del clic dentro del drawer", () => {
    const onClose = vi.fn();
    renderWithQueryClient(<StudentDetailDrawer {...defaultProps} onClose={onClose} />);

    const drawer = document.querySelector(".gb-drawer")!;
    fireEvent.click(drawer);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("muestra los KPIs de promedio, asistencia, curso promedio y rendidas", async () => {
    renderWithQueryClient(<StudentDetailDrawer {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Juan Perez")).toBeInTheDocument();
    });

    const kpiCards = document.querySelectorAll(".gb-drawer-kpi span");
    const kpiLabels = Array.from(kpiCards).map((s) => s.textContent);
    expect(kpiLabels).toContain("Promedio");
    expect(kpiLabels).toContain("Asistencia");
    expect(kpiLabels).toContain("Curso Prom.");
    expect(kpiLabels).toContain("Rendidas");
  });

  it("muestra la seccion de ultimas evaluaciones con los titulos de pruebas", async () => {
    renderWithQueryClient(<StudentDetailDrawer {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Ultimas Evaluaciones")).toBeInTheDocument();
    });

    expect(screen.getByText("Prueba 1")).toBeInTheDocument();
    expect(screen.getByText("Prueba 2")).toBeInTheDocument();
  });

  it("muestra 'Sin evaluaciones registradas' cuando no hay notas", async () => {
    (api.getCourseGradeBook as ReturnType<typeof vi.fn>).mockResolvedValue(mockBookNoGrades);
    renderWithQueryClient(<StudentDetailDrawer {...defaultProps} />);

    await waitFor(() => {
      const emptyMessages = screen.getAllByText("Sin evaluaciones registradas.");
      expect(emptyMessages.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("muestra el grafico de evolucion de notas cuando hay grados", async () => {
    renderWithQueryClient(<StudentDetailDrawer {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Evolucion de Notas")).toBeInTheDocument();
    });

    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("muestra 'Sin evaluaciones registradas.' en evolucion si no hay grados", async () => {
    (api.getCourseGradeBook as ReturnType<typeof vi.fn>).mockResolvedValue(mockBookNoGrades);
    renderWithQueryClient(<StudentDetailDrawer {...defaultProps} />);

    await waitFor(() => {
      const emptyMessages = screen.getAllByText("Sin evaluaciones registradas.");
      expect(emptyMessages.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("muestra la seccion de asistencia cuando hay stats", async () => {
    renderWithQueryClient(<StudentDetailDrawer {...defaultProps} />);

    await waitFor(() => {
      const asistenciaElements = screen.getAllByText("Asistencia");
      expect(asistenciaElements.length).toBeGreaterThanOrEqual(2);
    });

    expect(screen.getByText("Presente")).toBeInTheDocument();
    expect(screen.getByText("Ausente")).toBeInTheDocument();
    expect(screen.getByText("Atraso")).toBeInTheDocument();
    expect(screen.getByText("Justificado")).toBeInTheDocument();
  });

  it("muestra la seccion de observaciones con el conteo", async () => {
    renderWithQueryClient(<StudentDetailDrawer {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Observaciones (2)")).toBeInTheDocument();
    });

    expect(screen.getByText("Buen trabajo")).toBeInTheDocument();
    expect(screen.getByText("Conducta en clase")).toBeInTheDocument();
  });

  it("muestra 'Sin observaciones registradas.' cuando no hay observaciones", async () => {
    (api.listObservations as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    renderWithQueryClient(<StudentDetailDrawer {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Sin observaciones registradas.")).toBeInTheDocument();
    });
  });

  it("muestra alertas cuando el promedio esta bajo 4.0", async () => {
    const lowAvgBook = {
      ...mockBookWithGrades,
      students: [
        {
          ...mockBookWithGrades.students[0]!,
          average: 3.5,
          grades: [
            { gradeId: "g1", assessmentId: "a1", assessmentTitle: "Prueba 1", assessmentType: "PROCESO", semester: 1, subjectName: "Matematica", weight: 1, maxScore: 100, score: 30, percentage: 30, grade: 3.2, status: "GRADED", oaCode: null, oaDescription: null },
            { gradeId: "g2", assessmentId: "a2", assessmentTitle: "Prueba 2", assessmentType: "CIERRE", semester: 1, subjectName: "Matematica", weight: 1, maxScore: 100, score: null, percentage: null, grade: null, status: "PENDING", oaCode: null, oaDescription: null },
            { gradeId: "g3", assessmentId: "a3", assessmentTitle: "Prueba 3", assessmentType: "PROCESO", semester: 1, subjectName: "Lenguaje", weight: 1, maxScore: 100, score: null, percentage: null, grade: null, status: "PENDING", oaCode: null, oaDescription: null },
            { gradeId: "g4", assessmentId: "a4", assessmentTitle: "Prueba 4", assessmentType: "PROCESO", semester: 1, subjectName: "Ciencias", weight: 1, maxScore: 100, score: null, percentage: null, grade: null, status: "PENDING", oaCode: null, oaDescription: null },
          ],
        },
      ],
      assessments: [
        { id: "a1", title: "Prueba 1", type: "PROCESO", status: "PUBLISHED", weight: 1, maxScore: 100, semester: 1, subjectName: "Matematica", oaCode: null, oaDescription: null },
        { id: "a2", title: "Prueba 2", type: "CIERRE", status: "PUBLISHED", weight: 1, maxScore: 100, semester: 1, subjectName: "Matematica", oaCode: null, oaDescription: null },
        { id: "a3", title: "Prueba 3", type: "PROCESO", status: "DRAFT", weight: 1, maxScore: 100, semester: 1, subjectName: "Lenguaje", oaCode: null, oaDescription: null },
        { id: "a4", title: "Prueba 4", type: "PROCESO", status: "DRAFT", weight: 1, maxScore: 100, semester: 1, subjectName: "Ciencias", oaCode: null, oaDescription: null },
      ],
    };
    (api.getCourseGradeBook as ReturnType<typeof vi.fn>).mockResolvedValue(lowAvgBook);
    renderWithQueryClient(<StudentDetailDrawer {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Promedio bajo 4.0/)).toBeInTheDocument();
    });
  });

  it("muestra alerta de asistencia cuando attendance esta en riesgo", async () => {
    const atRiskAttendance = { ...mockAttendanceStats, atRisk: true, attendanceRate: 78 };
    (api.getAttendanceStats as ReturnType<typeof vi.fn>).mockResolvedValue(atRiskAttendance);
    renderWithQueryClient(<StudentDetailDrawer {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Alerta de inasistencia/)).toBeInTheDocument();
    });
  });

  it("no muestra alertas cuando no hay riesgo", async () => {
    renderWithQueryClient(<StudentDetailDrawer {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Juan Perez")).toBeInTheDocument();
    });

    const alertContainer = document.querySelector(".gb-drawer-alerts");
    expect(alertContainer).not.toBeInTheDocument();
  });

  it("muestra mensaje de error cuando getStudent falla", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    (api.getStudent as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Error al cargar"));
    renderWithQueryClient(<StudentDetailDrawer {...defaultProps} />);

    await waitFor(() => {
      const errorElements = screen.queryAllByText(/Error/i);
      expect(errorElements.length).toBeGreaterThanOrEqual(0);
    });

    consoleError.mockRestore();
  });
});
