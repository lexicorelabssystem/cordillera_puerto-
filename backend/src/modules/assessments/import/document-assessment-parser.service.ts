import { BadRequestException, Injectable } from "@nestjs/common";
import { QuestionType } from "@prisma/client";
import * as zlib from "node:zlib";

export type ParsedAssessmentQuestion = {
  number: number;
  statement: string;
  type: QuestionType;
  alternatives: string[];
  correctAnswer: null;
  points: number;
  confidence: number;
};

export type ParsedAssessmentDocument = {
  rawText: string;
  instructions: string | null;
  questions: ParsedAssessmentQuestion[];
};

type ZipEntry = {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

@Injectable()
export class DocumentAssessmentParserService {
  async parse(params: { buffer: Buffer; fileName: string; mimeType: string }): Promise<ParsedAssessmentDocument> {
    const extension = params.fileName.toLowerCase().split(".").pop() ?? "";
    const rawText = extension === "pdf" || params.mimeType.includes("pdf")
      ? await this.extractPdfText(params.buffer)
      : extension === "docx" || params.mimeType.includes("wordprocessingml")
        ? this.extractDocxText(params.buffer)
        : this.unsupportedWordMessage(extension);

    const questions = this.detectQuestions(rawText);
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

  private extractDocxText(buffer: Buffer) {
    const xml = this.readZipEntry(buffer, "word/document.xml");
    if (!xml) {
      throw new BadRequestException("No se pudo leer el contenido del archivo Word. Guarda el documento nuevamente como .docx.");
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

  private readZipEntry(buffer: Buffer, entryName: string) {
    const eocdOffset = this.findEndOfCentralDirectory(buffer);
    if (eocdOffset < 0) return null;

    const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
    const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
    const end = centralDirectoryOffset + centralDirectorySize;
    let offset = centralDirectoryOffset;

    while (offset < end && buffer.readUInt32LE(offset) === 0x02014b50) {
      const entry: ZipEntry = {
        compressionMethod: buffer.readUInt16LE(offset + 10),
        compressedSize: buffer.readUInt32LE(offset + 20),
        uncompressedSize: buffer.readUInt32LE(offset + 24),
        localHeaderOffset: buffer.readUInt32LE(offset + 42),
        name: "",
      };
      const fileNameLength = buffer.readUInt16LE(offset + 28);
      const extraLength = buffer.readUInt16LE(offset + 30);
      const commentLength = buffer.readUInt16LE(offset + 32);
      entry.name = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");

      if (entry.name === entryName) {
        return this.readZipEntryData(buffer, entry);
      }
      offset += 46 + fileNameLength + extraLength + commentLength;
    }
    return null;
  }

  private readZipEntryData(buffer: Buffer, entry: ZipEntry) {
    const localOffset = entry.localHeaderOffset;
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) return null;

    const fileNameLength = buffer.readUInt16LE(localOffset + 26);
    const extraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + fileNameLength + extraLength;
    const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize);

    if (entry.compressionMethod === 0) return compressed.toString("utf8");
    if (entry.compressionMethod === 8) return zlib.inflateRawSync(compressed, { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString("utf8");
    throw new BadRequestException(`El archivo Word usa compresion no soportada (${entry.compressionMethod}).`);
  }

  private findEndOfCentralDirectory(buffer: Buffer) {
    const minOffset = Math.max(0, buffer.length - 0xffff - 22);
    for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
      if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
    }
    return -1;
  }

  private detectQuestions(rawText: string): ParsedAssessmentQuestion[] {
    const normalized = rawText
      .replace(/\r/g, "\n")
      .replace(/(\d{1,3})[\).\s-]+/g, "\n$1. ")
      .replace(/\s+([A-Ea-e])[\)\.\-:]\s+/g, "\n$1) ")
      .replace(/\n{2,}/g, "\n")
      .trim();

    const matches = [...normalized.matchAll(/(?:^|\n)(\d{1,3})[\).]\s+([\s\S]*?)(?=\n\d{1,3}[\).]\s+|$)/g)];
    return matches
      .map((match, index) => this.parseQuestionBlock(Number(match[1] ?? index + 1), match[2] ?? ""))
      .filter((question): question is ParsedAssessmentQuestion => Boolean(question))
      .slice(0, 100);
  }

  private parseQuestionBlock(number: number, block: string): ParsedAssessmentQuestion | null {
    const optionPattern = /(?:^|\n)\s*([A-Ea-e])[\)\.\-:]\s+([\s\S]*?)(?=\n\s*[A-Ea-e][\)\.\-:]\s+|$)/g;
    const optionMatches = [...block.matchAll(optionPattern)];
    let alternatives = optionMatches
      .map((match) => (match[2] ?? "").replace(/\s+/g, " ").trim())
      .filter(Boolean);

    const firstOptionIndex = block.search(/(?:^|\n)\s*[A-Ea-e][\)\.\-:]\s+/);
    const statement = (firstOptionIndex >= 0 ? block.slice(0, firstOptionIndex) : block)
      .replace(/\s+/g, " ")
      .trim();

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
    const marker = new RegExp(`(?:^|\\n)${firstQuestionNumber}[\\).]\\s+`);
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
}
