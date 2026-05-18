import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsUUID, IsInt, IsOptional, Min, Max, MinLength } from "class-validator";

export class CreateCourseDto {
  @ApiProperty({ description: "ID de la institución" })
  @IsUUID()
  institutionId!: string;

  @ApiProperty({ description: "ID del año académico" })
  @IsUUID()
  academicYearId!: string;

  @ApiProperty({ example: "3° A", description: "Nombre del curso" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: 3, minimum: 1, maximum: 8 })
  @IsInt()
  @Min(1)
  @Max(8)
  gradeLevel!: number;

  @ApiPropertyOptional({ example: "A", description: "Letra de sección" })
  @IsOptional()
  @IsString()
  section?: string;

  @ApiPropertyOptional({ default: 45 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  maxStudents?: number;
}

export class UpdateCourseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  section?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  maxStudents?: number;
}
