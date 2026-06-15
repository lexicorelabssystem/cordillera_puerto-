import { QuestionType } from "@prisma/client";
import {
  DocumentAssessmentParserService,
  type ParsedAssessmentQuestion,
} from "./document-assessment-parser.service.js";

describe("DocumentAssessmentParserService", () => {
  let service: DocumentAssessmentParserService;

  beforeEach(() => {
    service = new DocumentAssessmentParserService();
  });

  it("detecta preguntas con encabezado tipo SIMCE y alternativas A-D separadas por espacio", () => {
    const rawText = `
SIMCE 2026
Sistema de Medicion de la Calidad de la Educacion
INSTRUCCIONES - Lee con atencion antes de comenzar
Este ensayo contiene 30 preguntas de seleccion multiple.

Pregunta 1 OA4 · Division de decimales
¿Cuanto es 7,2 ÷ 0,9?
A 8
B 0,8
C 80
D 0,08
`;

    const questions = (service as unknown as {
      detectQuestions: (text: string) => ParsedAssessmentQuestion[];
    }).detectQuestions(rawText);
    const instructions = (service as unknown as {
      detectInstructions: (text: string, firstQuestionNumber: number) => string | null;
    }).detectInstructions(rawText, questions[0].number);

    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({
      number: 1,
      statement: "¿Cuanto es 7,2 ÷ 0,9?",
      type: QuestionType.MULTIPLE_CHOICE,
      alternatives: ["8", "0,8", "80", "0,08"],
    });
    expect(instructions).toContain("SIMCE 2026");
    expect(instructions).toContain("INSTRUCCIONES");
  });

  it("ignora hoja de respuestas y lee pauta docente al final del documento", () => {
    const rawText = `
Pregunta 1 ¿Cuánto es 7,2 ÷ 0,9? A 8 B 0,8 C 80 D 0,08
Pregunta 2 Las notas de un alumno son: 5, 6, 7, 4, 8. ¿Cuál es su promedio? A 6 B 5 C 7 D 5,5
HOJA DE RESPUESTAS — RELLENA COMPLETAMENTE UN CÍRCULO POR PREGUNTA
1 A B C D 2 A B C D
PAUTA DE RESPUESTAS — EXCLUSIVO DOCENTE
N° OA HABILIDAD EVALUADA RESPUESTA CORRECTA ALT.
1 OA4 División de decimales 8 A
2 OA10 Promedio aritmético 6 A
TOTAL PREGUNTAS PUNT. MÁXIMO EXIGENCIA SIMCE PUNT. MÍN. LOGRO
`;

    const answerKey = (service as unknown as {
      detectAnswerKey: (text: string) => Map<number, string>;
    }).detectAnswerKey(rawText);
    const questions = (service as unknown as {
      detectQuestions: (text: string) => ParsedAssessmentQuestion[];
    }).detectQuestions(rawText).map((question) => ({
      ...question,
      correctAnswer: answerKey.get(question.number) ?? null,
    }));

    expect(questions).toHaveLength(2);
    expect(questions[1]).toMatchObject({
      number: 2,
      statement: "Las notas de un alumno son: 5, 6, 7, 4, 8. ¿Cuál es su promedio?",
      alternatives: ["6", "5", "7", "5,5"],
      correctAnswer: "A",
    });
  });
});
