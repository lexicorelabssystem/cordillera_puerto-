import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsUUID, IsOptional, IsDateString, IsEnum, IsArray, MinLength } from "class-validator";
import { LessonStatus } from "@prisma/client";

export class CreateLessonDto {
  @ApiProperty({ description: "ID de la institución" })
  @IsUUID()
  institutionId!: string;

  @ApiProperty({ description: "ID del curso" })
  @IsUUID()
  courseId!: string;

  @ApiProperty({ description: "ID de la asignatura" })
  @IsUUID()
  subjectId!: string;

  @ApiProperty({ example: "Clase 1: Introducción a Textos Narrativos" })
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiProperty({ example: "2026-05-20" })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ description: "ID del año académico" })
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @ApiPropertyOptional({ example: "Comprender la estructura de un texto narrativo" })
  @IsOptional()
  @IsString()
  objective?: string;

  @ApiPropertyOptional({ description: "Descripción del inicio de la clase" })
  @IsOptional()
  @IsString()
  startDescription?: string;

  @ApiPropertyOptional({ description: "Descripción del desarrollo" })
  @IsOptional()
  @IsString()
  developmentDescription?: string;

  @ApiPropertyOptional({ description: "Descripción del cierre" })
  @IsOptional()
  @IsString()
  closureDescription?: string;

  @ApiPropertyOptional({ description: "Notas del docente" })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: "IDs de recursos a vincular" })
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  resourceIds?: string[];

  @ApiPropertyOptional({ description: "ID de evaluación asociada" })
  @IsOptional()
  @IsUUID()
  assessmentId?: string;
}

export class UpdateLessonDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  objective?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  developmentDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  closureDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class LessonFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(LessonStatus)
  status?: LessonStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
