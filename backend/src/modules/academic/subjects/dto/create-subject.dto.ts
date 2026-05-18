import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsOptional, IsBoolean, MinLength } from "class-validator";

export class CreateSubjectDto {
  @ApiProperty({ example: "Lenguaje" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ example: "LEN" })
  @IsOptional()
  @IsString()
  code?: string;
}

export class UpdateSubjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
