import { BadRequestException, Injectable } from "@nestjs/common";
import { QuestionType } from "@prisma/client";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const JSZip: typeof import("jszip") = require("jszip");

export type ParsedAssessmentQuestion = {
  number: number;
  statement: string;
  type: QuestionType;
  alternatives: string[];
  correctAnswer: string | null;
  points: number;
  confidence: number;
};

export type ParsedAssessmentDocument = {
  rawText: string;
  instructions: string | null;
  questions: ParsedAssessmentQuestion[];
};

@Injectable()
export class DocumentAssessmentParserService {
  async parse(params: { buffer: Buffer; fileName: string; mimeType: string }): Promise<ParsedAssessmentDocument> {
    const extension = params.fileName.toLowerCase().split(".").pop() ?? "";
    const rawText = extension === "pdf" || params.mimeType.includes("pdf")
      ? await this.extractPdfText(params.buffer)
      : extension === "docx" || params.mimeType.includes("wordprocessingml")
        ? await this.extractDocxText(params.buffer)
        : this.unsupportedWordMessage(extension);

    const answerKey = this.detectAnswerKey(rawText);
    const questions = this.detectQuestions(rawText).map((question) => ({
      ...question,
      correctAnswer: answerKey.get(question.number) ?? null,
    }));
    if (!questions.length) {
      throw new BadRequestException(
        "No se detectaron preguntas. Revisa que el archivo tenga texto seleccionable o crea la evaluacion manualmente.",
      );
    }

    return {
      rawText,
      instructions: this.detectInstructions(rawText, questions[0]?.number ?? 1),
      questions,
    };
  }

  private unsupportedWordMessage(extension: string): never {
    if (extension === "doc") {
      throw new BadRequestException("Los archivos .doc antiguos no se pueden analizar de forma segura. Guarda el documento como .docx o PDF.");
    }
    throw new BadRequestException("Solo se aceptan archivos PDF o Word .docx.");
  }

  private async extractPdfText(buffer: Buffer) {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      disableFontFace: true,
      isEvalSupported: false,
      useWorkerFetch: false,
    });
    const pdf = await loadingTask.promise;
    const pages: string[] = [];
    try {
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const text = content.items
          .map((item) => {
            const value = item as { str?: unknown };
            return typeof value.str === "string" ? value.str : "";
          })
          .filter(Boolean)
          .join(" ");
        pages.push(text);
      }
    } finally {
      await pdf.destroy();
    }

    const text = this.normalizeText(pages.join("\n"));
    if (text.length < 40) {
      throw new BadRequestException("El PDF parece escaneado o no contiene texto suficiente. Este analizador soporta PDFs digitales.");
    }
    return text;
  }

  private async extractDocxText(buffer: Buffer) {
    let zip: InstanceType<typeof JSZip>;
    try {
      zip = await JSZip.loadAsync(buffer);
    } catch {
      throw new BadRequestException(
        "No se pudo leer el contenido del archivo Word. Guarda el documento nuevamente como .docx.",
      );
    }

    const documentXml = zip.file("word/document.xml") || zip.file("/word/document.xml");
    if (!documentXml) {
      throw new BadRequestException(
        "No se encontro word/document.xml en el archivo Word. Guarda el documento nuevamente como .docx.",
      );
    }

    const xml = await documentXml.async("string");
    if (!xml) {
      throw new BadRequestException("El archivo word/document.xml esta vacio.");
    }

    const paragraphs = [...xml.matchAll(/<w:p[\s\S]*?<\/w:p>/g)]
      .map((paragraph) => {
        const text = [...paragraph[0].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
          .map((match) => this.decodeXml(match[1] ?? ""))
          .join("");
        return text.trim();
      })
      .filter(Boolean);

    const normalized = this.normalizeText(paragraphs.join("\n"));
    if (normalized.length < 40) {
      throw new BadRequestException("El Word no contiene texto suficiente para detectar preguntas.");
    }
    return normalized;
  }

  private detectQuestions(rawText: string): ParsedAssessmentQuestion[] {
    const studentText = rawText.split(/(?:📝\s*)?HOJA DE RESPUESTAS\s*[—-]\s*RELLENA|(?:🔒\s*)?PAUTA DE RESPUESTAS|NIVELES DE LOGRO SIMCE|REGISTRO DE RESULTADOS DEL CURSO/i)[0] ?? rawText;
    const normalized = studentText
      .replace(/\r/g, "\n")
      .replace(/\bPregunta\s+(\d{1,3})\b/gi, "\n$1. ")
      .replace(/(^|\n|\s)([A-Ea-e])[\)\.\-:]\s+/g, "$1\n$2) ")
      .replace(/\n{2,}/g, "\n")
      .trim();

    const markerPattern = rawText.match(/\bPregunta\s+\d{1,3}\b/i)
      ? /(?:^|\n)(\d{1,3})[\).]\s+([\s\S]*?)(?=\n\d{1,3}[\).]\s+|$)/g
      : /(?:^|\n)(\d{1,3})[\).]\s+([\s\S]*?)(?=\n\d{1,3}[\).]\s+|$)/g;
    const matches = [...normalized.matchAll(markerPattern)];
    return matches
      .map((match, index) => this.parseQuestionBlock(Number(match[1] ?? index + 1), match[2] ?? ""))
      .filter((question): question is ParsedAssessmentQuestion => Boolean(question))
      .slice(0, 100);
  }

  private detectAnswerKey(rawText: string) {
    const keyText = rawText.split(/(?:🔒\s*)?PAUTA DE RESPUESTAS/i)[1] ?? "";
    const rowsText = keyText.split(/\b(?:TOTAL PREGUNTAS|NIVELES DE LOGRO SIMCE|REGISTRO DE RESULTADOS DEL CURSO)\b/i)[0] ?? keyText;
    const answerKey = new Map<number, string>();
    const rowPattern = /(?:^|\s)(\d{1,3})\s+OA\d+\s+[\s\S]*?\s([A-D])(?=\s+\d{1,3}\s+OA\d+\s+|\s+TOTAL PREGUNTAS|\s*$)/g;

    for (const match of rowsText.matchAll(rowPattern)) {
      const questionNumber = Number(match[1]);
      const correctOption = match[2]?.toUpperCase();
      if (questionNumber > 0 && correctOption) answerKey.set(questionNumber, correctOption);
    }

    return answerKey;
  }

  private parseQuestionBlock(number: number, block: string): ParsedAssessmentQuestion | null {
    const optionMatches = this.findOptionMarkers(block);
    let alternatives = optionMatches
      .map((match, index) => block.slice(match.contentStart, optionMatches[index + 1]?.markerStart ?? block.length))
      .map((text) => this.cleanOptionText(text))
      .filter(Boolean)
      .slice(0, 4);

    const firstOptionIndex = optionMatches[0]?.markerStart ?? -1;
    const statement = this.cleanStatement(firstOptionIndex >= 0 ? block.slice(0, firstOptionIndex) : block);

    if (statement.length < 8) return null;

    const lower = `${statement} ${alternatives.join(" ")}`.toLowerCase();
    const looksTrueFalse = /\b(verdadero|falso|v\/f|true|false)\b/.test(lower);
    if (!alternatives.length && looksTrueFalse) alternatives = ["Verdadero", "Falso"];

    const type = alternatives.length >= 2
      ? looksTrueFalse && alternatives.length <= 2
        ? QuestionType.TRUE_FALSE
        : QuestionType.MULTIPLE_CHOICE
      : /desarroll|argument|explica|justifica|ensayo/i.test(statement)
        ? QuestionType.ESSAY
        : QuestionType.SHORT_ANSWER;

    const confidence = Math.min(
      0.96,
      0.42 + (alternatives.length >= 2 ? 0.35 : 0) + (statement.length > 25 ? 0.14 : 0) + (looksTrueFalse ? 0.05 : 0),
    );

    return {
      number,
      statement,
      type,
      alternatives,
      correctAnswer: null,
      points: 1,
      confidence: Number(confidence.toFixed(2)),
    };
  }

  private detectInstructions(rawText: string, firstQuestionNumber: number) {
    const marker = new RegExp(`(?:^|\\n|\\s)(?:Pregunta\\s+)?${firstQuestionNumber}[\\).]?\\s+`, "i");
    const match = rawText.match(marker);
    const instructions = (match?.index ? rawText.slice(0, match.index) : "")
      .replace(/\s+/g, " ")
      .trim();
    return instructions.length >= 12 ? instructions.slice(0, 4000) : null;
  }

  private normalizeText(value: string) {
    return value
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  private decodeXml(value: string) {
    return value
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, "\"")
      .replace(/&apos;/g, "'");
  }

  private findOptionMarkers(block: string) {
    const markerPattern = /(^|\n|\s)([A-E])(?:[\)\.\-:]|\s+)(?=\S)|(^|\n|\s)([a-e])[\)\.\-:]\s+(?=\S)/g;
    return [...block.matchAll(markerPattern)].map((match) => {
      const leading = match[1] ?? match[3] ?? "";
      return {
        markerStart: match.index + leading.length,
        contentStart: match.index + match[0].length,
      };
    });
  }

  private cleanStatement(value: string) {
    let text = value.trim();
    const questionStart = text.indexOf("¿");
    if (questionStart > 0 && /^(?:O[A-Z]?\d+|[A-Z]{1,4}\d+)/i.test(text.slice(0, questionStart).trim())) {
      text = text.slice(questionStart);
    }

    return text
      .replace(/^\s*O[A-Z]?\d+\s*[^\w¿?\n]*\s*[^¿?\n]*?(?=¿)/i, "")
      .replace(/^\s*(?:eje|habilidad|contenido|indicador)\s*[:.\-]\s*[^¿?\n]*?(?=¿)/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private cleanOptionText(value: string) {
    return value
      .split(/\b(?:Sistema de Medici[oó]n|Agencia de Calidad|ASIGNATURA|Este ensayo contiene|Lee con calma|Marca tu respuesta|Usa l[aá]piz|No se permite|Dispones de|No est[aá] permitido|Al finalizar|OA\d+|SIMCE 2026|Documento oficial|Pagina|Página)\b/i)[0]
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^[\)\.\-:]\s*/, "");
  }
}
