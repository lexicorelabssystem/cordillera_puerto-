import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsUUID, IsOptional, IsDateString, IsNumber, Min, Max, MinLength } from "class-validator";

export class CreatePeriodDto {
  @ApiProperty({ description: "ID del año académico" })
  @IsUUID()
  academicYearId!: string;

  @ApiProperty({ example: "Semestre 1", description: "Nombre del periodo" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ enum: ["SEMESTER", "TRIMESTER", "CUSTOM"], default: "SEMESTER" })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ example: "2027-03-01" })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: "2027-07-10" })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ description: "Ponderación del periodo (ej: 50 para 50%)", minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weight?: number;
}

export class UpdatePeriodDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

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
  @IsNumber()
  @Min(0)
  @Max(100)
  weight?: number;
}
