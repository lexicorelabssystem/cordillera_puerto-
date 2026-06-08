import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: Record<string, unknown>) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

function formatGrade(n: number | null): string {
  if (n === null || n === undefined) return "\u2014";
  return n.toFixed(1).replace(".", ",");
}

function addHeader(doc: jsPDF, title: string, subtitle?: string) {
  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, doc.internal.pageSize.width, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 18);
  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(subtitle, 14, 25);
  }
}

function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages?.() ?? 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Cordillera SaaS v3.0 \u2014 Plataforma de Monitoreo de Aprendizajes \u2014 P\u00e1gina ${i} de ${pageCount}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 8,
      { align: "center" }
    );
  }
}

export interface GradebookStudent {
  studentId: string;
  firstName: string;
  lastName: string;
  average: number | null;
  hasPending: boolean;
  grades: { assessmentId: string; grade: number | null }[];
}

export interface GradebookAssessment {
  id: string;
  title: string;
  type: string;
  weight: number;
}

export interface GradebookStats {
  courseAvg: number | null;
  approvalRate: number;
  atRiskCount: number;
  pendingsCount: number;
  totalNotes: number;
  appliedCount: number;
  totalAssessments: number;
}

export function exportGradebookToPdf(
  courseName: string,
  subjectName: string | undefined,
  students: GradebookStudent[],
  assessments: GradebookAssessment[],
  stats: GradebookStats | null,
  generatedBy: string = "Sistema"
) {
  const doc = new jsPDF("landscape", "mm", "a4");
  const title = `Libro de Calificaciones \u2014 ${courseName}`;
  const subtitle = `${subjectName ?? "Todas las asignaturas"} \u2022 ${new Date().toLocaleDateString("es-CL")} \u2022 Generado por: ${generatedBy}`;

  addHeader(doc, title, subtitle);

  let y = 35;

  if (stats) {
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    const kpiData = [
      `Promedio: ${formatGrade(stats.courseAvg)}`,
      `Aprobaci\u00f3n: ${stats.approvalRate}%`,
      `En Riesgo: ${stats.atRiskCount}`,
      `Pendientes: ${stats.pendingsCount}`,
      `Notas: ${stats.totalNotes}`,
      `Evaluaciones: ${stats.appliedCount}/${stats.totalAssessments}`,
    ];
    doc.text(kpiData.join("  |  "), 14, y);
    y += 8;
  }

  const columns = [
    { header: "N\u00b0", dataKey: "nro" },
    { header: "Estudiante", dataKey: "nombre" },
    ...assessments.map((a) => ({
      header: `${a.title.length > 12 ? a.title.slice(0, 12) + "..." : a.title}`,
      dataKey: a.id,
    })),
    { header: "Promedio", dataKey: "promedio" },
  ];

  const rows = students.map((est, idx) => {
    const row: Record<string, string> = {
      nro: String(idx + 1),
      nombre: `${est.lastName}, ${est.firstName}`,
      promedio: formatGrade(est.average),
    };
    for (const a of assessments) {
      const g = est.grades.find((n) => n.assessmentId === a.id);
      row[a.id] = formatGrade(g?.grade ?? null);
    }
    return row;
  });

  autoTable(doc, {
    columns,
    body: rows,
    startY: y,
    styles: { fontSize: 7, cellPadding: 2, lineColor: [220, 220, 220], lineWidth: 0.1 },
    headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.5 },
    bodyStyles: { textColor: [40, 40, 40] },
    columnStyles: {
      nro: { cellWidth: 10 },
      nombre: { cellWidth: 40, fontStyle: "bold" },
      promedio: { cellWidth: 20, fontStyle: "bold", halign: "center" },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  addFooter(doc);
  doc.save(`libro-calificaciones-${courseName.replace(/\s/g, "-").toLowerCase()}.pdf`);
}

export interface AssessmentWithKey {
  title: string;
  subjectName: string;
  courseName: string;
  assessmentType: string;
  items: {
    nro: number;
    statement: string;
    options: { text: string; isCorrect: boolean }[];
    type: string;
    points: number;
  }[];
  totalPoints: number;
}

export function exportAssessmentToPdf(assessment: AssessmentWithKey, generatedBy: string = "Sistema") {
  const doc = new jsPDF("portrait", "mm", "a4");
  const typeLabels: Record<string, string> = {
    DIAGNOSTICA: "Evaluaci\u00f3n Diagn\u00f3stica",
    PROCESO: "Evaluaci\u00f3n de Proceso",
    CIERRE: "Evaluaci\u00f3n de Cierre",
    PARCIAL: "Prueba Parcial",
    FINAL: "Examen Final",
    SIMCE: "Ensayo SIMCE",
  };

  const title = assessment.title;
  const subtitle = `${assessment.courseName} \u2022 ${assessment.subjectName} \u2022 ${typeLabels[assessment.assessmentType] ?? assessment.assessmentType}`;

  addHeader(doc, title, subtitle);

  let y = 38;

  for (let i = 0; i < assessment.items.length; i++) {
    const item = assessment.items[i]!;

    if (y > 240) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 64, 175);
    doc.text(`${i + 1}.`, 14, y);

    const textLines = doc.splitTextToSize(item.statement, 155);
    let textY = y;
    doc.setFontSize(8.5);
    doc.setTextColor(30, 30, 30);
    doc.text(textLines, 22, textY);
    textY += textLines.length * 4.5 + 2;

    for (const opt of item.options) {
      const prefix = opt.isCorrect ? "\u2713" : "\u25CB";
      doc.setFont("helvetica", opt.isCorrect ? "bold" : "normal");
      doc.text(`${prefix}  ${opt.text}`, 26, textY);
      textY += 4;
    }

    y = textY + 5;
  }

  if (y < 250) {
    y += 5;
    doc.setDrawColor(220, 220, 220);
    doc.line(14, y, doc.internal.pageSize.width - 14, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 64, 175);
    doc.text(`Total preguntas: ${assessment.items.length}  |  Puntaje total: ${assessment.totalPoints} pts`, 14, y);
  }

  addFooter(doc);
  doc.save(`prueba-${assessment.title.replace(/\s/g, "-").toLowerCase()}.pdf`);
}

export interface ReportData {
  type: string;
  institutionName: string;
  courseName?: string;
  studentName?: string;
  subjectName?: string;
  generatedAt: string;
  summary: Record<string, string | number>;
  rows: { label: string; value: string | number; highlight?: boolean }[];
}

export function exportReportToPdf(report: ReportData, generatedBy: string = "Sistema") {
  const doc = new jsPDF("portrait", "mm", "a4");
  const typeLabels: Record<string, string> = {
    STUDENT: "Reporte por Estudiante",
    COURSE: "Reporte por Curso",
    INSTITUTIONAL: "Reporte Institucional",
  };

  const title = typeLabels[report.type] ?? report.type;
  const subtitle = [
    report.institutionName,
    report.courseName,
    report.studentName,
    report.subjectName,
    `Generado: ${report.generatedAt}`,
  ]
    .filter(Boolean)
    .join(" \u2022 ");

  addHeader(doc, title, subtitle);

  let y = 40;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 175);
  doc.text("Resumen", 14, y);
  y += 7;

  const summaryRows = Object.entries(report.summary).map(([key, value]) => [key, String(value)]);
  autoTable(doc, {
    columns: [
      { header: "Indicador", dataKey: "label" },
      { header: "Valor", dataKey: "value" },
    ],
    body: summaryRows.map(([label, value]) => ({ label, value })),
    startY: y,
    styles: { fontSize: 7.5, cellPadding: 2.5, lineColor: [220, 220, 220], lineWidth: 0.1 },
    headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
    bodyStyles: { textColor: [40, 40, 40] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      label: { cellWidth: 80 },
      value: { cellWidth: 80, halign: "center" },
    },
  });

  y = doc.lastAutoTable.finalY + 10;

  if (report.rows.length > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 64, 175);
    doc.text("Detalle", 14, y);
    y += 6;

    autoTable(doc, {
      columns: [
        { header: "Item", dataKey: "label" },
        { header: "Valor", dataKey: "value" },
      ],
      body: report.rows.map((r) => ({ label: r.label, value: String(r.value) })),
      startY: y,
      styles: { fontSize: 7.5, cellPadding: 2.5, lineColor: [220, 220, 220], lineWidth: 0.1 },
      headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
      bodyStyles: { textColor: [40, 40, 40] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        label: { cellWidth: 100 },
        value: { cellWidth: 60, halign: "center" },
      },
    });
  }

  addFooter(doc);
  const slug = report.courseName?.replace(/\s/g, "-").toLowerCase() ?? "general";
  doc.save(`reporte-${slug}.pdf`);
}
