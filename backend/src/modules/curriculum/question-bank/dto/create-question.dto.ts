import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString, IsUUID, IsInt, IsOptional, IsEnum, IsArray, Min, Max, MinLength,
  ValidateNested, IsNumber, IsBoolean,
} from "class-validator";
import { Type } from "class-transformer";
import { QuestionType } from "@prisma/client";

export class CreateQuestionOptionDto {
  @ApiProperty({ example: "La capital de Chile es Santiago" })
  @IsString()
  @MinLength(1)
  text!: string;

  @ApiProperty({ description: "Indica si esta opción es correcta" })
  @IsBoolean()
  isCorrect!: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreateQuestionDto {
  @ApiProperty({ description: "ID de la asignatura" })
  @IsUUID()
  subjectId!: string;

  @ApiPropertyOptional({ description: "ID del eje" })
  @IsOptional()
  @IsUUID()
  axisId?: string;

  @ApiPropertyOptional({ description: "ID del objetivo de aprendizaje" })
  @IsOptional()
  @IsUUID()
  learningObjectiveId?: string;

  @ApiPropertyOptional({ description: "ID de la habilidad" })
  @IsOptional()
  @IsUUID()
  skillId?: string;

  @ApiProperty({ enum: QuestionType, example: "MULTIPLE_CHOICE" })
  @IsEnum(QuestionType)
  type!: QuestionType;

  @ApiProperty({ example: "¿Cuál es la capital de Chile?" })
  @IsString()
  @MinLength(5)
  statement!: string;

  @ApiPropertyOptional({ example: "Santiago es la capital desde 1818" })
  @IsOptional()
  @IsString()
  explanation?: string;

  @ApiPropertyOptional({ description: "1:Fácil 2:Medio 3:Difícil", default: 2, minimum: 1, maximum: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  difficulty?: number;

  @ApiPropertyOptional({ default: 1.0 })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  points?: number;

  @ApiPropertyOptional({ description: "Opciones de respuesta (requerido para MULTIPLE_CHOICE, TRUE_FALSE)" })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionOptionDto)
  options?: CreateQuestionOptionDto[];
}

export class UpdateQuestionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(5)
  statement?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  explanation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  axisId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  learningObjectiveId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  skillId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  difficulty?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  points?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class QuestionFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  learningObjectiveId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  axisId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  difficulty?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
