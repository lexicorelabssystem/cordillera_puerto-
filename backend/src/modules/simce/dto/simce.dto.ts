import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString, IsUUID, IsInt, IsOptional, IsEnum, IsNumber,
  IsArray, IsBoolean, Min, Max, MinLength, MaxLength, ValidateNested, ArrayMaxSize,
} from "class-validator";
import { Type } from "class-transformer";
import { SimceStatus } from "@prisma/client";

// ─── Crear/Actualizar evaluación SIMCE ─────────────────

export class CreateSimceAssessmentDto {
  @ApiProperty({ example: "Ensayo SIMCE Lenguaje 4° Básico" })
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiProperty({ description: "ID del curso" })
  @IsUUID()
  courseId!: string;

  @ApiProperty({ description: "ID de la asignatura" })
  @IsUUID()
  subjectId!: string;

  @ApiProperty({ example: 4, description: "Nivel (4°, 6°, 8°, 2°M, etc.)" })
  @IsInt()
  @Min(1)
  @Max(12)
  gradeLevel!: number;

  @ApiPropertyOptional({ description: "ID del año académico" })
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @ApiPropertyOptional({ example: "2026-05-20", description: "Fecha de la prueba" })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class UpdateSimceAssessmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  pdfFileId?: string;

  @ApiPropertyOptional({ description: "ID del año académico" })
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @ApiPropertyOptional({ enum: SimceStatus })
  @IsOptional()
  @IsEnum(SimceStatus)
  status?: SimceStatus;
}

// ─── Pauta de corrección ───────────────────────────────

export class SimceAnswerKeyItemDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  questionNumber!: number;

  @ApiProperty({ example: "B", description: "A | B | C | D | E" })
  @IsString()
  @MinLength(1)
  @MaxLength(1)
  correctOption!: string;

  @ApiPropertyOptional({ default: 1.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  score?: number;

  @ApiPropertyOptional({ description: "ID del eje curricular" })
  @IsOptional()
  @IsUUID()
  axisId?: string;

  @ApiPropertyOptional({ description: "ID de la habilidad" })
  @IsOptional()
  @IsUUID()
  skillId?: string;

  @ApiPropertyOptional({ description: "ID del OA" })
  @IsOptional()
  @IsUUID()
  oaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observation?: string;
}

export class SaveAnswerKeyDto {
  @ApiProperty({ type: [SimceAnswerKeyItemDto] })
  @IsArray()
  @ArrayMaxSize(120)
  @ValidateNested({ each: true })
  @Type(() => SimceAnswerKeyItemDto)
  items!: SimceAnswerKeyItemDto[];
}

// ─── Respuestas de estudiante ──────────────────────────

export class StudentResponseItemDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  questionNumber!: number;

  @ApiProperty({ example: "B", description: "A | B | C | D | E | null (omitida)" })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1)
  selectedOption?: string;
}

export class SaveStudentResponsesDto {
  @ApiProperty({ type: [StudentResponseItemDto] })
  @IsArray()
  @ArrayMaxSize(120)
  @ValidateNested({ each: true })
  @Type(() => StudentResponseItemDto)
  responses!: StudentResponseItemDto[];
}

export class BatchStudentResponsesDto {
  @ApiProperty({ description: "ID del estudiante" })
  @IsUUID()
  studentId!: string;

  @ApiProperty({ type: [StudentResponseItemDto] })
  @IsArray()
  @ArrayMaxSize(120)
  @ValidateNested({ each: true })
  @Type(() => StudentResponseItemDto)
  responses!: StudentResponseItemDto[];
}
