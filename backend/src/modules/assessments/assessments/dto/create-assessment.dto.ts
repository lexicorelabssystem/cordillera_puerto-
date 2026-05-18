import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString, IsUUID, IsInt, IsOptional, IsEnum, IsBoolean, IsDateString,
  IsNumber, IsArray, Min, Max, MinLength,
} from "class-validator";
import { AssessmentType, AssessmentDeliveryMode } from "@prisma/client";

export class AssessmentItemDto {
  @ApiProperty({ description: "ID de la pregunta" })
  @IsUUID()
  questionId!: string;

  @ApiPropertyOptional({ description: "Orden en la evaluación", default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ description: "Puntaje específico para esta pregunta en esta evaluación", default: 1.0 })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  points?: number;
}

export class CreateAssessmentDto {
  @ApiProperty({ description: "ID del curso" })
  @IsUUID()
  courseId!: string;

  @ApiProperty({ description: "ID de la asignatura" })
  @IsUUID()
  subjectId!: string;

  @ApiProperty({ example: "Evaluación Diagnóstica Lenguaje 4°" })
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: AssessmentType, example: "DIAGNOSTICA" })
  @IsEnum(AssessmentType)
  assessmentType!: AssessmentType;

  @ApiPropertyOptional({ enum: AssessmentDeliveryMode, default: "ONLINE" })
  @IsOptional()
  @IsEnum(AssessmentDeliveryMode)
  deliveryMode?: AssessmentDeliveryMode;

  @ApiProperty({ example: 1, description: "Semestre 1 o 2" })
  @IsInt()
  @Min(1)
  @Max(2)
  semester!: number;

  @ApiPropertyOptional({ default: 100.0 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxScore?: number;

  @ApiPropertyOptional({ description: "Tiempo límite en minutos (null = sin límite)" })
  @IsOptional()
  @IsInt()
  @Min(1)
  timeLimitMin?: number;

  @ApiPropertyOptional({ example: "2026-05-20T08:00:00Z" })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: "2026-05-22T18:00:00Z" })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: "ID del periodo académico" })
  @IsOptional()
  @IsUUID()
  periodId?: string;

  @ApiPropertyOptional({ description: "Ponderación dentro del periodo (0-100). 0 = diagnóstica/informativa", minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowRetake?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean;

  @ApiPropertyOptional({ description: "Preguntas a incluir" })
  @IsOptional()
  @IsArray()
  items?: AssessmentItemDto[];
}

export class UpdateAssessmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(AssessmentDeliveryMode)
  deliveryMode?: AssessmentDeliveryMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  timeLimitMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowRetake?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean;

  @ApiPropertyOptional({ description: "Ponderación dentro del periodo (0-100)" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weight?: number;
}

export class ReorderItemsDto {
  @ApiProperty({ description: "Array de IDs de assessment_questions en el nuevo orden" })
  @IsArray()
  @IsUUID("4", { each: true })
  itemIds!: string[];
}
