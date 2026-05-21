import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString, IsUUID, IsDateString, IsOptional, IsInt, Min,
} from "class-validator";

export class CreateClassBookEntryDto {
  @ApiProperty()
  @IsUUID()
  courseId!: string;

  @ApiProperty()
  @IsUUID()
  subjectId!: string;

  @ApiProperty({ example: "2026-05-21" })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  semester?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  classNumber?: number;

  @ApiPropertyOptional({ example: "Unidad 2: Genética y Herencia" })
  @IsOptional()
  @IsString()
  unitName?: string;

  @ApiPropertyOptional({ example: "Leyes de Mendel" })
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiPropertyOptional({ example: "Se explicaron las leyes de Mendel mediante ejemplos..." })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ example: "Ejercicios del libro página 45. Trabajo en parejas." })
  @IsOptional()
  @IsString()
  activities?: string;

  @ApiPropertyOptional({ example: "Guía de ejercicios, PPT Genética" })
  @IsOptional()
  @IsString()
  resources?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateClassBookEntryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  semester?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  classNumber?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unitName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  activities?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resources?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
