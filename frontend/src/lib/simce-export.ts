import jsPDF from "jspdf";
import "jspdf-autotable";

const BLUE = "#1E40AF";
const WHITE = "#FFFFFF";
const MUTED = "#6b7280";

function addHeader(doc: jsPDF, title: string, subtitle: string, y: number): number {
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFillColor(BLUE);
  doc.rect(0, 0, pageW, 30, "F");

  doc.setFontSize(13);
  doc.setTextColor(WHITE);
  doc.setFont("helvetica", "bold");
  doc.text(title, 10, y + 6);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(subtitle, 10, y + 13);

  return 38;
}

function addFooter(doc: jsPDF, currentPage: number, totalPages: number) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  doc.setFontSize(7);
  doc.setTextColor(MUTED);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Cordillera SaaS — Módulo SIMCE — Página ${currentPage} de ${totalPages}`,
    pageW / 2,
    pageH - 6,
    { align: "center" },
  );
}

function levelLabel(pct: number): string {
  if (pct >= 80) return "Avanzado";
  if (pct >= 60) return "Adecuado";
  if (pct >= 40) return "Básico";
  return "Crítico";
}

// ─── Reporte por curso ─────────────────────────────────

interface SimceResultsSummaryLike {
  assessment: { id: string; title: string; status: string };
  maxScore: number;
  totalQuestions: number;
  totalStudents: number;
  answeredCount: number;
  avgPercentage: number;
  results: {
    student: { id: string; firstName: string; lastName: string; rut?: string | null };
    answered: boolean;
    totalCorrect: number;
    totalIncorrect: number;
    totalOmitted: number;
    totalQuestions: number;
    totalScore: number;
    percentage: number;
  }[];
  weakestQuestions?: { questionNumber: number; correctOption: string; correctPercent: number }[];
}

export function exportSimceCourseResultsToPdf(data: SimceResultsSummaryLike) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  let y = 10;
  y = addHeader(doc, "Resultados SIMCE — Curso", data.assessment.title, y);

  // KPI summary
  doc.setFontSize(9);
  doc.setTextColor("#1f2937");
  doc.setFont("helvetica", "normal");
  doc.text(`Promedio: ${data.avgPercentage}%`, 10, y);
  doc.text(`Máx puntaje: ${data.maxScore}`, 60, y);
  doc.text(`Preguntas: ${data.totalQuestions}`, 110, y);
  doc.text(`Respondieron: ${data.answeredCount}/${data.totalStudents}`, 160, y);
  y += 8;

  // Student table
  const head = [["#", "Estudiante", "Correctas", "Incorrectas", "Omitidas", "Puntaje", "%", "Nivel"]];
  const body = data.results.map((r, i) => [
    String(i + 1),
    r.answered ? `${r.student.lastName}, ${r.student.firstName}` : `${r.student.lastName}, ${r.student.firstName} (s/r)`,
    r.answered ? String(r.totalCorrect) : "—",
    r.answered ? String(r.totalIncorrect) : "—",
    r.answered ? String(r.totalOmitted) : "—",
    r.answered ? `${r.totalScore}/${data.maxScore}` : "—",
    r.answered ? `${r.percentage}%` : "—",
    r.answered ? levelLabel(r.percentage) : "—",
  ]);

  (doc as any).autoTable({
    startY: y,
    head,
    body,
    headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 8, cellPadding: 2 },
    alternateRowStyles: { fillColor: "#f3f4f6" },
    margin: { left: 8, right: 8 },
  });

  if (data.weakestQuestions && data.weakestQuestions.length > 0) {
    const finalY = (doc as any).lastAutoTable?.finalY ?? y + 20;
    const spaceLeft = doc.internal.pageSize.getHeight() - finalY - 20;
    if (spaceLeft < 60) doc.addPage();

    const qY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : finalY + 10;

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor("#1f2937");
    doc.text("Preguntas con mayor dificultad", 10, qY);

    const qHead = [["Pregunta", "Alt. Correcta", "% Acierto"]];
    const qBody = data.weakestQuestions.map((q) => [
      String(q.questionNumber),
      q.correctOption,
      `${q.correctPercent}%`,
    ]);

    (doc as any).autoTable({
      startY: qY + 4,
      head: qHead,
      body: qBody,
      headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 8, cellPadding: 2 },
      margin: { left: 8, right: 8 },
    });
  }

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }

  doc.save(`simce_resultados_curso_${data.assessment.id.slice(0, 8)}.pdf`);
}

// ─── Reporte por estudiante ─────────────────────────────

interface StudentResultLike {
  student: { firstName: string; lastName: string; rut?: string | null };
  assessment: { title: string };
  summary: {
    totalCorrect: number;
    totalIncorrect: number;
    totalOmitted: number;
    totalQuestions: number;
    totalScore: number;
    maxScore: number;
    percentage: number;
    performanceLevel: string;
  };
  questions: {
    questionNumber: number;
    correctOption: string;
    score: number;
    selectedOption: string | null;
    isCorrect: boolean | null;
    scoreObtained: number;
    status: string;
  }[];
}

export function exportSimceStudentResultToPdf(data: StudentResultLike) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  let y = 10;
  y = addHeader(doc, "Resultado SIMCE — Estudiante", data.assessment.title, y);

  doc.setFontSize(9);
  doc.setTextColor("#1f2937");
  doc.setFont("helvetica", "normal");
  doc.text(`Estudiante: ${data.student.lastName}, ${data.student.firstName}`, 10, y);
  y += 5;
  doc.text(`Nivel: ${data.summary.performanceLevel}`, 10, y);
  y += 8;

  const summaryHead = [["Correctas", "Incorrectas", "Omitidas", "Puntaje", "Porcentaje", "Nivel"]];
  const summaryBody = [[
    String(data.summary.totalCorrect),
    String(data.summary.totalIncorrect),
    String(data.summary.totalOmitted),
    `${data.summary.totalScore}/${data.summary.maxScore}`,
    `${data.summary.percentage}%`,
    data.summary.performanceLevel,
  ]];

  (doc as any).autoTable({
    startY: y,
    head: summaryHead,
    body: summaryBody,
    headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 9, cellPadding: 3, halign: "center" },
    margin: { left: 10, right: 10 },
  });

  const detailY = (doc as any).lastAutoTable?.finalY ?? y + 15;

  const detailHead = [["Preg.", "Alt. Correcta", "Marcó", "Resultado", "Puntaje"]];
  const detailBody = data.questions.map((q) => [
    String(q.questionNumber),
    q.correctOption,
    q.selectedOption || "—",
    q.status === "CORRECT" ? "Correcta" : q.status === "INCORRECT" ? "Incorrecta" : "Omitida",
    `${q.scoreObtained}/${q.score}`,
  ]);

  (doc as any).autoTable({
    startY: detailY + 6,
    head: detailHead,
    body: detailBody,
    headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 8, cellPadding: 2 },
    alternateRowStyles: { fillColor: "#f3f4f6" },
    margin: { left: 10, right: 10 },
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }

  doc.save(`simce_resultado_${data.student.lastName.toLowerCase()}.pdf`);
}
