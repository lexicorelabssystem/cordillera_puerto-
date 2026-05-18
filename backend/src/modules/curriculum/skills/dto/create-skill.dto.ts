import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsOptional, MinLength } from "class-validator";

export class CreateSkillDto {
  @ApiProperty({ example: "Analizar" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ example: "Capacidad de descomponer información para comprenderla" })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateSkillDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
