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
    explanation?: string | null;
  }[];
  totalPoints: number;
}

export interface AssessmentPdfOptions {
  includeAnswerKey?: boolean;
  includeAnswerSheet?: boolean;
  fontSize?: "normal" | "large";
}

export interface GeneratedAssessmentPdf {
  kind: "assessment" | "answer-sheet";
  fileName: string;
  label: string;
}

function assessmentFileSlug(title: string) {
  return title.trim().replace(/[^a-zA-Z0-9\u00c0-\u017f]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

function addStudentFields(doc: jsPDF, y: number) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(35, 35, 35);
  doc.text("Nombre:", 14, y);
  doc.line(30, y + 1, 126, y + 1);
  doc.text("Fecha:", 139, y);
  doc.line(153, y + 1, 196, y + 1);
}

function createAssessmentDocument(assessment: AssessmentWithKey, options: Required<AssessmentPdfOptions>) {
  const doc = new jsPDF("portrait", "mm", "a4");
  const typeLabels: Record<string, string> = {
    DIAGNOSTICA: "Evaluaci\u00f3n Diagn\u00f3stica",
    PROCESO: "Evaluaci\u00f3n de Proceso",
    CIERRE: "Evaluaci\u00f3n de Cierre",
    PARCIAL: "Prueba Parcial",
    FINAL: "Examen Final",
    SIMCE: "Ensayo SIMCE",
  };
  const subtitle = `${assessment.courseName} \u2022 ${assessment.subjectName} \u2022 ${typeLabels[assessment.assessmentType] ?? assessment.assessmentType}`;
  const baseSize = options.fontSize === "large" ? 11 : 8.5;
  const lineHeight = options.fontSize === "large" ? 5.4 : 4.5;

  addHeader(doc, assessment.title, subtitle);
  addStudentFields(doc, 36);
  let y = 48;

  for (let i = 0; i < assessment.items.length; i++) {
    const item = assessment.items[i]!;
    const textLines = doc.splitTextToSize(item.statement, 168);
    const estimatedHeight = textLines.length * lineHeight + Math.max(item.options.length, 1) * lineHeight + 12;
    if (y + estimatedHeight > 276) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(baseSize);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 64, 175);
    doc.text(`${i + 1}.`, 14, y);
    doc.setTextColor(30, 30, 30);
    doc.text(textLines, 22, y);
    let textY = y + textLines.length * lineHeight + 2;

    for (let optionIndex = 0; optionIndex < item.options.length; optionIndex++) {
      const option = item.options[optionIndex]!;
      const marked = options.includeAnswerKey && option.isCorrect;
      const prefix = marked ? "\u2713" : "\u25cb";
      doc.setFont("helvetica", marked ? "bold" : "normal");
      if (marked) doc.setTextColor(6, 118, 71);
      else doc.setTextColor(30, 30, 30);
      const optionLines = doc.splitTextToSize(`${prefix}  ${String.fromCharCode(65 + optionIndex)}. ${option.text}`, 158);
      doc.text(optionLines.length === 1 ? optionLines[0]! : optionLines, 26, textY);
      textY += optionLines.length * lineHeight;
    }

    if (options.includeAnswerKey && item.explanation) {
      doc.setFontSize(Math.max(baseSize - 1, 7.5));
      doc.setFont("helvetica", "italic");
      doc.setTextColor(70, 85, 105);
      const explanation = doc.splitTextToSize(`Explicaci\u00f3n: ${item.explanation}`, 158);
      doc.text(explanation, 26, textY + 1);
      textY += explanation.length * lineHeight + 1;
    }
    y = textY + 5;
  }

  if (y < 274) {
    doc.setDrawColor(220, 220, 220);
    doc.line(14, y, doc.internal.pageSize.width - 14, y);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 64, 175);
    doc.text(`Total preguntas: ${assessment.items.length}  |  Puntaje total: ${assessment.totalPoints} pts`, 14, y + 6);
  }
  addFooter(doc);
  return doc;
}

function createAnswerSheetDocument(assessment: AssessmentWithKey, includeAnswerKey: boolean) {
  const doc = new jsPDF("portrait", "mm", "a4");
  addHeader(doc, "Hoja de respuestas", assessment.title);
  addStudentFields(doc, 36);
  doc.setFontSize(9);
  doc.setTextColor(55, 65, 81);
  doc.text(`Curso: ${assessment.courseName}`, 14, 44);

  const questionsPerColumn = Math.ceil(Math.max(assessment.items.length, 1) / 4);
  const columnWidth = 46;
  const startX = 14;
  const startY = 57;
  const rowHeight = Math.min(8, 205 / Math.max(questionsPerColumn, 1));

  assessment.items.forEach((item, index) => {
    const column = Math.floor(index / questionsPerColumn);
    const row = index % questionsPerColumn;
    const x = startX + column * columnWidth;
    const y = startY + row * rowHeight;
    if (column > 0 && row === 0) {
      doc.setDrawColor(185, 195, 207);
      doc.line(x - 4, startY - 5, x - 4, 272);
    }
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 30, 45);
    doc.text(`${index + 1}.`, x, y);

    const visibleOptions = item.options.slice(0, 4);
    visibleOptions.forEach((option, optionIndex) => {
      const isMarked = includeAnswerKey && option.isCorrect;
      const optionX = x + 9 + optionIndex * 8;
      doc.setFont("helvetica", isMarked ? "bold" : "normal");
      doc.setTextColor(isMarked ? 6 : 55, isMarked ? 118 : 65, isMarked ? 71 : 81);
      doc.text(`${isMarked ? "\u25cf" : "\u25cb"}${String.fromCharCode(65 + optionIndex)}`, optionX, y);
    });
  });

  if (includeAnswerKey) {
    doc.setFontSize(8);
    doc.setTextColor(6, 118, 71);
    doc.text("Pauta: las alternativas correctas aparecen marcadas.", 14, 282);
  }
  addFooter(doc);
  return doc;
}

export function exportAssessmentToPdf(
  assessment: AssessmentWithKey,
  generatedBy: string = "Sistema",
  pdfOptions: AssessmentPdfOptions = {},
): GeneratedAssessmentPdf[] {
  void generatedBy;
  const options: Required<AssessmentPdfOptions> = {
    includeAnswerKey: pdfOptions.includeAnswerKey ?? true,
    includeAnswerSheet: pdfOptions.includeAnswerSheet ?? false,
    fontSize: pdfOptions.fontSize ?? "normal",
  };
  const slug = assessmentFileSlug(assessment.title) || "evaluacion";
  const assessmentName = `${pdfOptions.includeAnswerKey === undefined ? "prueba" : options.includeAnswerKey ? "pauta" : "prueba"}-${slug}.pdf`;
  const generated: GeneratedAssessmentPdf[] = [
    { kind: "assessment", fileName: assessmentName, label: options.includeAnswerKey ? "Prueba con pauta" : "Prueba para estudiantes" },
  ];

  createAssessmentDocument(assessment, options).save(assessmentName);
  if (options.includeAnswerSheet) {
    const answerSheetName = `hoja-respuestas-${slug}.pdf`;
    createAnswerSheetDocument(assessment, options.includeAnswerKey).save(answerSheetName);
    generated.push({ kind: "answer-sheet", fileName: answerSheetName, label: "Hoja de respuestas" });
  }
  return generated;
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
