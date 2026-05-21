import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockAutoTable,
  mockSave,
  mockText,
  mockSetFillColor,
  mockRect,
  mockSetTextColor,
  mockSetFontSize,
  mockSetFont,
  mockSetDrawColor,
  mockLine,
  mockSplitTextToSize,
  mockAddPage,
  mockSetPage,
  mockGetNumberOfPages,
  MockJsPDF,
  mockJsPDFInstance,
} = vi.hoisted(() => {
  const mockAutoTable = vi.fn().mockReturnThis();
  const mockSave = vi.fn();
  const mockText = vi.fn();
  const mockSetFillColor = vi.fn();
  const mockRect = vi.fn();
  const mockSetTextColor = vi.fn();
  const mockSetFontSize = vi.fn();
  const mockSetFont = vi.fn();
  const mockSetDrawColor = vi.fn();
  const mockLine = vi.fn();
  const mockSplitTextToSize = vi.fn().mockImplementation((text: string) => [text]);
  const mockAddPage = vi.fn();
  const mockSetPage = vi.fn();
  const mockGetNumberOfPages = vi.fn().mockReturnValue(1);

  const mockJsPDFInstance = {
    autoTable: mockAutoTable,
    save: mockSave,
    text: mockText,
    setFillColor: mockSetFillColor,
    rect: mockRect,
    setTextColor: mockSetTextColor,
    setFontSize: mockSetFontSize,
    setFont: mockSetFont,
    setDrawColor: mockSetDrawColor,
    line: mockLine,
    splitTextToSize: mockSplitTextToSize,
    addPage: mockAddPage,
    setPage: mockSetPage,
    getNumberOfPages: mockGetNumberOfPages,
    internal: {
      pageSize: { width: 297, height: 210 },
    },
    lastAutoTable: { finalY: 200 },
  };

  const MockJsPDF = vi.fn(function (this: typeof mockJsPDFInstance) { return mockJsPDFInstance; });

  return {
    mockAutoTable,
    mockSave,
    mockText,
    mockSetFillColor,
    mockRect,
    mockSetTextColor,
    mockSetFontSize,
    mockSetFont,
    mockSetDrawColor,
    mockLine,
    mockSplitTextToSize,
    mockAddPage,
    mockSetPage,
    mockGetNumberOfPages,
    MockJsPDF,
    mockJsPDFInstance,
  };
});

vi.mock("jspdf", () => ({
  default: MockJsPDF,
}));

vi.mock("jspdf-autotable", () => ({}));

import {
  exportGradebookToPdf,
  exportAssessmentToPdf,
  exportReportToPdf,
  type GradebookStudent,
  type GradebookAssessment,
  type GradebookStats,
  type AssessmentWithKey,
  type ReportData,
} from "../pdf";

beforeEach(() => {
  vi.clearAllMocks();
  MockJsPDF.mockImplementation(function (this: typeof mockJsPDFInstance) { return mockJsPDFInstance; });
  mockGetNumberOfPages.mockReturnValue(1);
});

describe("exportGradebookToPdf", () => {
  const courseName = "4° Basico A";
  const subjectName = "Matematica";
  const students: GradebookStudent[] = [
    {
      studentId: "s1",
      firstName: "Juan",
      lastName: "Perez",
      average: 5.8,
      hasPending: false,
      grades: [
        { assessmentId: "a1", grade: 6.0 },
        { assessmentId: "a2", grade: 5.5 },
      ],
    },
    {
      studentId: "s2",
      firstName: "Maria",
      lastName: "Lopez",
      average: 4.2,
      hasPending: true,
      grades: [
        { assessmentId: "a1", grade: 4.0 },
        { assessmentId: "a2", grade: null },
      ],
    },
  ];

  const assessments: GradebookAssessment[] = [
    { id: "a1", title: "Prueba de Diagnostico", type: "DIAGNOSTICA", weight: 1 },
    { id: "a2", title: "Prueba de Proceso", type: "PROCESO", weight: 2 },
  ];

  const stats: GradebookStats = {
    courseAvg: 5.0,
    approvalRate: 75,
    atRiskCount: 3,
    pendingsCount: 4,
    totalNotes: 60,
    appliedCount: 4,
    totalAssessments: 6,
  };

  it("crea una instancia de jsPDF en landscape A4", () => {
    exportGradebookToPdf(courseName, subjectName, students, assessments, stats);

    expect(MockJsPDF).toHaveBeenCalledWith("landscape", "mm", "a4");
  });

  it("dibuja el encabezado azul con el titulo del libro", () => {
    exportGradebookToPdf(courseName, subjectName, students, assessments, stats);

    expect(mockSetFillColor).toHaveBeenCalledWith(30, 64, 175);
    expect(mockRect).toHaveBeenCalledWith(0, 0, 297, 28, "F");
    expect(mockText).toHaveBeenCalledWith(
      "Libro de Calificaciones — 4° Basico A",
      14,
      18,
    );
  });

  it("dibuja el subtitulo con asignatura y fecha", () => {
    exportGradebookToPdf(courseName, subjectName, students, assessments, stats);

    const subtitleCall = mockText.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("Matematica"),
    );
    expect(subtitleCall).toBeDefined();
  });

  it("incluye las estadisticas KPI en el PDF", () => {
    exportGradebookToPdf(courseName, subjectName, students, assessments, stats);

    const kpiCall = mockText.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("Promedio:"),
    );
    expect(kpiCall).toBeDefined();
  });

  it("genera la tabla con autoTable con las columnas y filas correctas", () => {
    exportGradebookToPdf(courseName, subjectName, students, assessments, stats);

    expect(mockAutoTable).toHaveBeenCalled();
    const autoTableArg = mockAutoTable.mock.calls[0][0];
    expect(autoTableArg.columns).toBeDefined();
    expect(autoTableArg.columns.length).toBe(5);

    const nombreCol = autoTableArg.columns.find(
      (c: { header: string }) => c.header === "Estudiante",
    );
    expect(nombreCol).toBeDefined();

    expect(autoTableArg.body).toBeDefined();
    expect(autoTableArg.body.length).toBe(2);
    expect(autoTableArg.body[0].nombre).toBe("Perez, Juan");
  });

  it("llama a addFooter", () => {
    exportGradebookToPdf(courseName, subjectName, students, assessments, stats);

    expect(mockGetNumberOfPages).toHaveBeenCalled();
    expect(mockSetPage).toHaveBeenCalledWith(1);
  });

  it("llama a save con el nombre de archivo correcto", () => {
    exportGradebookToPdf(courseName, subjectName, students, assessments, stats);

    expect(mockSave).toHaveBeenCalledWith("libro-calificaciones-4\u00b0-basico-a.pdf");
  });

  it("maneja subjectName undefined correctamente", () => {
    exportGradebookToPdf(courseName, undefined, students, assessments, stats);

    const subtitleCall = mockText.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("Todas las asignaturas"),
    );
    expect(subtitleCall).toBeDefined();
  });

  it("maneja stats null sin mostrar KPIs", () => {
    exportGradebookToPdf(courseName, subjectName, students, assessments, null);

    const kpiCalls = mockText.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("Promedio:"),
    );
    expect(kpiCalls.length).toBe(0);
  });

  it("trunca titulos de evaluaciones largos", () => {
    const longTitleAssessments: GradebookAssessment[] = [
      { id: "a1", title: "Evaluacion de Proceso muy larga para truncar", type: "PROCESO", weight: 1 },
    ];

    exportGradebookToPdf(courseName, subjectName, students, longTitleAssessments, stats);

    const autoTableArg = mockAutoTable.mock.calls[0][0];
    const header = autoTableArg.columns[1].header;
    expect(header.length).toBeLessThanOrEqual(15);
  });

  it("formatea notas con decimales usando coma", () => {
    exportGradebookToPdf(courseName, subjectName, students, assessments, stats);

    const autoTableArg = mockAutoTable.mock.calls[0][0];
    const gradeCell = autoTableArg.body[0]["a1"];
    expect(gradeCell).toBe("6,0");
  });

  it("muestra guion para notas nulas", () => {
    exportGradebookToPdf(courseName, subjectName, students, assessments, stats);

    const autoTableArg = mockAutoTable.mock.calls[0][0];
    const nullGrade = autoTableArg.body[1]["a2"];
    expect(nullGrade).toBe("\u2014");
  });
});

describe("exportAssessmentToPdf", () => {
  const assessment: AssessmentWithKey = {
    title: "Evaluacion Final Matematica",
    subjectName: "Matematica",
    courseName: "4° Basico A",
    assessmentType: "FINAL",
    items: [
      {
        nro: 1,
        statement: "¿Cuanto es 2+2?",
        options: [
          { text: "3", isCorrect: false },
          { text: "4", isCorrect: true },
          { text: "5", isCorrect: false },
        ],
        type: "MULTIPLE_CHOICE",
        points: 2,
      },
      {
        nro: 2,
        statement: "¿Cuanto es 5*5?",
        options: [
          { text: "20", isCorrect: false },
          { text: "25", isCorrect: true },
        ],
        type: "MULTIPLE_CHOICE",
        points: 2,
      },
    ],
    totalPoints: 4,
  };

  it("crea una instancia de jsPDF en portrait A4", () => {
    exportAssessmentToPdf(assessment);

    expect(MockJsPDF).toHaveBeenCalledWith("portrait", "mm", "a4");
  });

  it("dibuja el encabezado con el titulo de la evaluacion", () => {
    exportAssessmentToPdf(assessment);

    expect(mockSetFillColor).toHaveBeenCalledWith(30, 64, 175);
    expect(mockText).toHaveBeenCalledWith("Evaluacion Final Matematica", 14, 18);
  });

  it("dibuja el subtitulo con curso, asignatura y tipo", () => {
    exportAssessmentToPdf(assessment);

    const subtitleCall = mockText.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("4\u00b0 Basico A"),
    );
    expect(subtitleCall).toBeDefined();
    expect(subtitleCall![0]).toContain("Examen Final");
  });

  it("renderiza cada pregunta con sus opciones", () => {
    exportAssessmentToPdf(assessment);

    const questionCalls = mockText.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "string" && call[0] === "1.",
    );
    expect(questionCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("marca la opcion correcta con checkmark", () => {
    exportAssessmentToPdf(assessment);

    const correctOptCall = mockText.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("\u2713"),
    );
    expect(correctOptCall).toBeDefined();
    expect(correctOptCall![0]).toContain("4");
  });

  it("muestra el total de preguntas y puntaje al final", () => {
    exportAssessmentToPdf(assessment);

    const totalCall = mockText.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("Total preguntas"),
    );
    expect(totalCall).toBeDefined();
    expect(totalCall![0]).toContain("2");
    expect(totalCall![0]).toContain("4 pts");
  });

  it("llama a save con el nombre de archivo basado en el titulo", () => {
    exportAssessmentToPdf(assessment);

    expect(mockSave).toHaveBeenCalledWith("prueba-evaluacion-final-matematica.pdf");
  });

  it("usa etiqueta por defecto para tipos desconocidos", () => {
    const unknownTypeAssessment = { ...assessment, assessmentType: "UNKNOWN_TYPE" };
    exportAssessmentToPdf(unknownTypeAssessment);

    const subtitleCall = mockText.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("UNKNOWN_TYPE"),
    );
    expect(subtitleCall).toBeDefined();
  });

  it("llama a addFooter con el numero de paginas", () => {
    exportAssessmentToPdf(assessment);

    expect(mockGetNumberOfPages).toHaveBeenCalled();
  });

  it("agrega nueva pagina si el contenido excede el espacio", () => {
    const longAssessment: AssessmentWithKey = {
      ...assessment,
      items: Array.from({ length: 30 }, (_, i) => ({
        nro: i + 1,
        statement: `Pregunta larga numero ${i + 1} con suficiente texto para ocupar espacio en la pagina del PDF.`,
        options: [
          { text: "Opcion A", isCorrect: false },
          { text: "Opcion B", isCorrect: true },
          { text: "Opcion C", isCorrect: false },
          { text: "Opcion D", isCorrect: false },
        ],
        type: "MULTIPLE_CHOICE",
        points: 1,
      })),
    };

    const prevAddPageCalls = mockAddPage.mock.calls.length;
    exportAssessmentToPdf(longAssessment);

    expect(mockAddPage).toHaveBeenCalled();
    expect(mockAddPage.mock.calls.length).toBeGreaterThan(prevAddPageCalls);
  });
});

describe("exportReportToPdf", () => {
  const report: ReportData = {
    type: "COURSE",
    institutionName: "Colegio Cordillera",
    courseName: "4° Basico A",
    studentName: undefined,
    subjectName: "Matematica",
    generatedAt: "2025-05-21",
    summary: {
      "Promedio Curso": "5.8",
      "Tasa de Aprobacion": "85%",
      "Estudiantes en Riesgo": "3",
    },
    rows: [
      { label: "Juan Perez", value: "6.2", highlight: false },
      { label: "Maria Lopez", value: "5.4", highlight: false },
      { label: "Pedro Gomez", value: "3.8", highlight: true },
    ],
  };

  it("crea una instancia de jsPDF en portrait A4", () => {
    exportReportToPdf(report);

    expect(MockJsPDF).toHaveBeenCalledWith("portrait", "mm", "a4");
  });

  it("dibuja el encabezado con el titulo del reporte", () => {
    exportReportToPdf(report);

    const titleCall = mockText.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && call[0] === "Reporte por Curso",
    );
    expect(titleCall).toBeDefined();
  });

  it("dibuja el subtitulo con datos de la institucion", () => {
    exportReportToPdf(report);

    const subtitleCall = mockText.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("Colegio Cordillera"),
    );
    expect(subtitleCall).toBeDefined();
    expect(subtitleCall![0]).toContain("4\u00b0 Basico A");
  });

  it("dibuja la tabla de resumen con indicadores", () => {
    exportReportToPdf(report);

    const autoTableCalls = mockAutoTable.mock.calls;
    expect(autoTableCalls.length).toBeGreaterThanOrEqual(1);

    const summaryTable = autoTableCalls[0][0];
    expect(summaryTable.columns[0].header).toBe("Indicador");
    expect(summaryTable.columns[1].header).toBe("Valor");
    expect(summaryTable.body.length).toBe(3);
  });

  it("dibuja la tabla de detalle con las filas", () => {
    exportReportToPdf(report);

    const autoTableCalls = mockAutoTable.mock.calls;
    expect(autoTableCalls.length).toBeGreaterThanOrEqual(2);

    const detailTable = autoTableCalls[1][0];
    expect(detailTable.body.length).toBe(3);
    expect(detailTable.body[0].label).toBe("Juan Perez");
  });

  it("llama a save con el nombre de archivo basado en el curso", () => {
    exportReportToPdf(report);

    expect(mockSave).toHaveBeenCalledWith("reporte-4\u00b0-basico-a.pdf");
  });

  it("no incluye tabla de detalle si rows esta vacio", () => {
    const reportNoRows: ReportData = { ...report, rows: [] };
    exportReportToPdf(reportNoRows);

    const autoTableCalls = mockAutoTable.mock.calls;
    expect(autoTableCalls.length).toBe(1);
  });

  it("usa nombre de archivo generico sin courseName", () => {
    const reportNoCourse: ReportData = { ...report, courseName: undefined };
    exportReportToPdf(reportNoCourse);

    expect(mockSave).toHaveBeenCalledWith("reporte-general.pdf");
  });

  it("usa etiqueta por defecto para tipos de reporte desconocidos", () => {
    const unknownTypeReport: ReportData = { ...report, type: "CUSTOM_TYPE" };
    exportReportToPdf(unknownTypeReport);

    const titleCall = mockText.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && call[0] === "CUSTOM_TYPE",
    );
    expect(titleCall).toBeDefined();
  });
});
