import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsOptional, IsBoolean, IsEmail, IsNumber, Min, Max, MinLength } from "class-validator";

export class CreateInstitutionDto {
  @ApiProperty({ example: "Colegio San Ignacio" })
  @IsString()
  @MinLength(3)
  name!: string;

  @ApiPropertyOptional({ example: "25123-1" })
  @IsOptional()
  @IsString()
  rbd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: "contacto@colegio.cl" })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ example: "Sede Central" })
  @IsOptional()
  @IsString()
  sede?: string;

  @ApiPropertyOptional({ example: "Metropolitana" })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ example: "Santiago" })
  @IsOptional()
  @IsString()
  comuna?: string;

  @ApiPropertyOptional({ example: "MAÑANA" })
  @IsOptional()
  @IsString()
  jornada?: string;
}

export class UpdateInstitutionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rbd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sede?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comuna?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jornada?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateInstitutionConfigDto {
  @ApiPropertyOptional({ default: 1.0, example: 1.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  gradingScaleMin?: number;

  @ApiPropertyOptional({ default: 7.0, example: 7.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  gradingScaleMax?: number;

  @ApiPropertyOptional({ default: 60, example: 60 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  exigencia?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allowGradeEdit?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowSelfRegistration?: boolean;

  @ApiPropertyOptional({ default: "es-CL" })
  @IsOptional()
  @IsString()
  defaultLanguage?: string;
}

export class UpdateInstitutionConfigDto extends CreateInstitutionConfigDto {}

