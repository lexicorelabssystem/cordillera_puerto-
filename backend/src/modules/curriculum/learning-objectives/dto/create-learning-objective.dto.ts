import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsUUID, IsInt, IsBoolean, IsOptional, Min, Max, MinLength, IsArray } from "class-validator";

export class CreateLearningObjectiveDto {
  @ApiProperty({ description: "ID de la asignatura" })
  @IsUUID()
  subjectId!: string;

  @ApiPropertyOptional({ description: "ID del eje (opcional)" })
  @IsOptional()
  @IsUUID()
  axisId?: string;

  @ApiPropertyOptional({ description: "ID de la unidad curricular (opcional)" })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiProperty({ example: "OA-3-LEN-4" })
  @IsString()
  @MinLength(3)
  code!: string;

  @ApiProperty({ example: "Leer y comprender textos narrativos" })
  @IsString()
  @MinLength(5)
  description!: string;

  @ApiProperty({ example: 4, minimum: 1, maximum: 8 })
  @IsInt()
  @Min(1)
  @Max(8)
  gradeLevel!: number;

  @ApiPropertyOptional({ description: "IDs de habilidades asociadas" })
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  skillIds?: string[];

  @ApiPropertyOptional({ description: "Indicadores de evaluación" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  indicators?: string[];
}

export class UpdateLearningObjectiveDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(5)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  axisId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  skillIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
