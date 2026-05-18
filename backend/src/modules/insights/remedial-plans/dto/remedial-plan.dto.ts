import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString, IsUUID, IsOptional, IsDateString, IsNumber, Min, Max, IsEnum, MinLength,
} from "class-validator";
import { RemedialStatus } from "@prisma/client";

export class CreateRemedialPlanDto {
  @ApiProperty({ description: "ID del estudiante" })
  @IsUUID()
  studentId!: string;

  @ApiProperty({ description: "ID del curso" })
  @IsUUID()
  courseId!: string;

  @ApiProperty({ description: "ID de la asignatura" })
  @IsUUID()
  subjectId!: string;

  @ApiProperty({ description: "ID del OA descendido" })
  @IsUUID()
  learningObjectiveId!: string;

  @ApiProperty({ example: "Plan Remedial: Comprensión Lectora" })
  @IsString()
  @MinLength(5)
  title!: string;

  @ApiProperty({ example: "Reforzamiento focalizado en extracción de información explícita" })
  @IsString()
  description!: string;

  @ApiProperty({ example: "2026-06-01" })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: "2026-06-15" })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ description: "% de logro antes del plan" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  preScore?: number;

  @ApiPropertyOptional({ description: "ID del profesor asignado (user)" })
  @IsOptional()
  @IsUUID()
  assignedTo?: string;
}

export class UpdateRemedialPlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(5)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: "% de logro después del plan" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  postScore?: number;

  @ApiPropertyOptional({ enum: RemedialStatus })
  @IsOptional()
  @IsEnum(RemedialStatus)
  status?: RemedialStatus;
}

export class DetectAndSuggestDto {
  @ApiProperty({ description: "ID del curso" })
  @IsUUID()
  courseId!: string;

  @ApiPropertyOptional({ description: "ID de la asignatura (opcional)" })
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional({ description: "Umbral de % de logro para considerar brecha", default: 60 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  threshold?: number;
}
