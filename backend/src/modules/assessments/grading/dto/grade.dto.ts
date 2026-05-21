import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsUUID, IsNumber, IsOptional, IsString, IsEnum, Min, Max, IsArray, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { AnswerStatus } from "@prisma/client";

export class GradeAnswerDto {
  @ApiProperty({ description: "Puntaje asignado (0 = incorrecto, puntos totales = correcto)" })
  @IsNumber()
  @Min(0)
  score!: number;

  @ApiPropertyOptional({ description: "Comentario de retroalimentación" })
  @IsOptional()
  @IsString()
  feedback?: string;

  @ApiPropertyOptional({ enum: AnswerStatus, description: "Estado manual de la respuesta" })
  @IsOptional()
  @IsEnum(AnswerStatus)
  status?: AnswerStatus;
}

export class BulkGradeItemDto {
  @ApiProperty({ description: "ID de la respuesta (student_answer)" })
  @IsUUID()
  answerId!: string;

  @ApiProperty({ description: "Puntaje asignado" })
  @IsNumber()
  @Min(0)
  score!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  feedback?: string;

  @ApiPropertyOptional({ enum: AnswerStatus })
  @IsOptional()
  @IsEnum(AnswerStatus)
  status?: AnswerStatus;
}

export class BulkGradeDto {
  @ApiProperty({ description: "Array de respuestas a calificar", type: [BulkGradeItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkGradeItemDto)
  grades!: BulkGradeItemDto[];
}

/* ─── Direct Grade (Libro de Evaluaciones) ─── */

export class DirectGradeDto {
  @ApiProperty({ description: "ID de la evaluación" })
  @IsUUID()
  assessmentId!: string;

  @ApiProperty({ description: "ID del estudiante" })
  @IsUUID()
  studentId!: string;

  @ApiProperty({ description: "Nota entre 1.0 y 7.0" })
  @IsNumber()
  @Min(1.0)
  @Max(7.0)
  grade!: number;

  @ApiPropertyOptional({ description: "Comentario u observación" })
  @IsOptional()
  @IsString()
  comments?: string;
}

export class BulkDirectGradeItemDto {
  @ApiProperty({ description: "ID de la evaluación" })
  @IsUUID()
  assessmentId!: string;

  @ApiProperty({ description: "ID del estudiante" })
  @IsUUID()
  studentId!: string;

  @ApiProperty({ description: "Nota entre 1.0 y 7.0" })
  @IsNumber()
  @Min(1.0)
  @Max(7.0)
  grade!: number;

  @ApiPropertyOptional({ description: "Comentario u observación" })
  @IsOptional()
  @IsString()
  comments?: string;
}

export class BulkDirectGradeDto {
  @ApiProperty({ description: "Array de notas directas a crear/actualizar", type: [BulkDirectGradeItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkDirectGradeItemDto)
  grades!: BulkDirectGradeItemDto[];
}
