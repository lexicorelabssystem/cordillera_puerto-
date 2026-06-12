import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { QuestionType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";
import { assertCourseScope, resolveUserScope } from "../../../common/authz/access-scope.js";
import type { JwtPayload } from "../../../common/decorators/current-user.decorator.js";
import type { CommitImportedQuestionDto, CommitImportedTestDto } from "./import-test.dto.js";

type DetectedQuestion = {
  number: number;
  statement: string;
  type: QuestionType;
  alternatives: string[];
  correctAnswer: null;
  points: number;
  confidence: number;
};

@Injectable()
export class ImportTestService {
  constructor(private readonly prisma: PrismaService) {}

  async importPdf(params: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
    fileSize: number;
    subjectId: string;
    courseId?: string;
    user: JwtPayload;
  }) {
    if (!params.mimeType.includes("pdf") && !params.fileName.toLowerCase().endsWith(".pdf")) {
      throw new BadRequestException("Solo se aceptan archivos PDF");
    }

    const scope = params.courseId
      ? (await assertCourseScope(this.prisma, params.user, params.courseId, params.subjectId)).scope
      : await resolveUserScope(this.prisma, params.user);

    if (scope.role === "TEACHER" && !scope.teacherId) {
      throw new ForbiddenException("Perfil docente no encontrado");
    }

    const subject = await this.prisma.subject.findUnique({
      where: { id: params.subjectId },
      select: { id: true },
    });
    if (!subject) throw new NotFoundException("Asignatura no encontrada");

    const rawText = await this.extractPdfText(params.buffer);
    const questions = this.detectQuestions(rawText);
    if (!questions.length) {
      throw new BadRequestException("No se detectaron preguntas en el PDF. Revisa que sea un PDF digital con texto seleccionable.");
    }

    const draft = await this.prisma.importedTestDraft.create({
      data: {
        courseId: params.courseId ?? null,
        subjectId: params.subjectId,
        teacherId: scope.teacherId,
        createdBy: scope.userId,
        fileName: params.fileName,
        fileSize: params.fileSize,
        mimeType: params.mimeType,
        rawText,
        questions: {
          create: questions.map((question) => ({
            number: question.number,
            statement: question.statement,
            type: question.type,
            alternatives: question.alternatives,
            correctAnswer: null,
            points: question.points,
            confidence: question.confidence,
          })),
        },
      },
      include: { questions: { orderBy: { number: "asc" } } },
    });

    return this.formatDraft(draft);
  }

  async commitDraft(draftId: string, dto: CommitImportedTestDto, user: JwtPayload) {
    const draft = await this.prisma.importedTestDraft.findUnique({
      where: { id: draftId },
      include: { questions: true },
    });
    if (!draft) throw new NotFoundException("Borrador de importacion no encontrado");

    const scope = draft.courseId
      ? (await assertCourseScope(this.prisma, user, draft.courseId, draft.subjectId)).scope
      : await resolveUserScope(this.prisma, user);

    if (!scope.isGlobalAdmin && draft.createdBy !== scope.userId && scope.role === "TEACHER") {
      throw new ForbiddenException("No tienes acceso a este borrador");
    }

    if (dto.courseId || draft.courseId) {
      await assertCourseScope(this.prisma, user, dto.courseId ?? draft.courseId!, dto.subjectId);
    }

    const approved = dto.questions.filter((question) => question.statement.trim());
    if (!approved.length) throw new BadRequestException("Debes aprobar al menos una pregunta");

    for (const question of approved) {
      if (question.type === "MULTIPLE_CHOICE" || question.type === "TRUE_FALSE") {
        const alternatives = this.cleanAlternatives(question.alternatives);
        if (alternatives.length < 2) {
          throw new BadRequestException(`La pregunta ${question.number} debe tener al menos dos alternativas`);
        }
        if (!question.correctAnswer || !alternatives.includes(question.correctAnswer)) {
          throw new BadRequestException(`La pregunta ${question.number} requiere respuesta correcta confirmada por el profesor`);
        }
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const rows = [];
      for (const item of approved) {
        const alternatives = this.cleanAlternatives(item.alternatives);
        const question = await tx.question.create({
          data: {
            subjectId: dto.subjectId,
            type: item.type as QuestionType,
            statement: item.statement.trim(),
            points: item.points,
            difficulty: 2,
            createdBy: scope.userId,
            options: alternatives.length
              ? {
                  create: alternatives.map((text, index) => ({
                    text,
                    sortOrder: index,
                    isCorrect: text === item.correctAnswer,
                  })),
                }
              : undefined,
          },
          include: { options: { orderBy: { sortOrder: "asc" } } },
        });

        if (item.draftQuestionId) {
          await tx.importedTestDraftQuestion.update({
            where: { id: item.draftQuestionId },
            data: {
              statement: item.statement.trim(),
              alternatives,
              correctAnswer: item.correctAnswer ?? null,
              points: item.points,
              type: item.type,
              status: "APPROVED",
              questionId: question.id,
            },
          });
        }
        rows.push(question);
      }

      await tx.importedTestDraft.update({
        where: { id: draft.id },
        data: { status: "COMMITTED", committedAt: new Date() },
      });

      return rows;
    });

    return { draftId, createdCount: created.length, questions: created };
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

    const text = pages.join("\n").replace(/\s+/g, " ").trim();
    if (text.length < 40) {
      throw new BadRequestException("El PDF parece escaneado o no contiene texto suficiente. Este MVP soporta PDFs digitales.");
    }
    return text;
  }

  private detectQuestions(rawText: string): DetectedQuestion[] {
    const normalized = rawText
      .replace(/\r/g, "\n")
      .replace(/(\d{1,3})[\).\s-]+/g, "\n$1. ")
      .replace(/\s+([A-Ea-e])[\)\.\-:]\s+/g, "\n$1) ")
      .replace(/\n{2,}/g, "\n")
      .trim();

    const matches = [...normalized.matchAll(/(?:^|\n)(\d{1,3})[\).]\s+([\s\S]*?)(?=\n\d{1,3}[\).]\s+|$)/g)];
    return matches
      .map((match, index) => this.parseQuestionBlock(Number(match[1] ?? index + 1), match[2] ?? ""))
      .filter((question): question is DetectedQuestion => Boolean(question))
      .slice(0, 80);
  }

  private parseQuestionBlock(number: number, block: string): DetectedQuestion | null {
    const optionPattern = /(?:^|\n)\s*([A-Ea-e])[\)\.\-:]\s+([\s\S]*?)(?=\n\s*[A-Ea-e][\)\.\-:]\s+|$)/g;
    const optionMatches = [...block.matchAll(optionPattern)];
    const alternatives = optionMatches
      .map((match) => (match[2] ?? "").replace(/\s+/g, " ").trim())
      .filter(Boolean);

    const firstOptionIndex = block.search(/(?:^|\n)\s*[A-Ea-e][\)\.\-:]\s+/);
    const statement = (firstOptionIndex >= 0 ? block.slice(0, firstOptionIndex) : block)
      .replace(/\s+/g, " ")
      .trim();

    if (statement.length < 8) return null;

    const confidence = Math.min(0.95, 0.45 + (alternatives.length >= 2 ? 0.35 : 0) + (statement.length > 25 ? 0.15 : 0));

    return {
      number,
      statement,
      type: alternatives.length >= 2 ? QuestionType.MULTIPLE_CHOICE : QuestionType.SHORT_ANSWER,
      alternatives,
      correctAnswer: null,
      points: 1,
      confidence: Number(confidence.toFixed(2)),
    };
  }

  private cleanAlternatives(alternatives: string[]) {
    return alternatives.map((item) => item.trim()).filter(Boolean).slice(0, 8);
  }

  private formatDraft(draft: {
    id: string;
    status: string;
    fileName: string;
    subjectId: string;
    courseId: string | null;
    questions: {
      id: string;
      number: number;
      statement: string;
      type: string;
      alternatives: unknown;
      correctAnswer: string | null;
      points: number;
      confidence: number;
    }[];
  }) {
    return {
      draftId: draft.id,
      status: draft.status,
      fileName: draft.fileName,
      subjectId: draft.subjectId,
      courseId: draft.courseId,
      questions: draft.questions.map((question) => ({
        draftQuestionId: question.id,
        numero: question.number,
        enunciado: question.statement,
        tipo: question.type,
        alternativas: Array.isArray(question.alternatives) ? question.alternatives : [],
        respuestaCorrecta: question.correctAnswer,
        puntaje: question.points,
        confianza: question.confidence,
      })),
    };
  }
}
