import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString, IsUUID, IsOptional, IsDateString, IsEmail, MinLength,
} from "class-validator";

export class CreateStudentDto {
  @ApiProperty({ example: "Sofía" })
  @IsString()
  @MinLength(2)
  firstName!: string;

  @ApiProperty({ example: "Rojas" })
  @IsString()
  @MinLength(2)
  lastName!: string;

  @ApiProperty({ description: "ID del curso donde se matricula" })
  @IsUUID()
  courseId!: string;

  @ApiPropertyOptional({ example: "sofia.rojas@colegio.cl" })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: "12.345.678-9" })
  @IsOptional()
  @IsString()
  rut?: string;

  @ApiPropertyOptional({ enum: ["M", "F"] })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ example: "2014-05-12" })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ example: "Temp2026*", minLength: 10 })
  @IsOptional()
  @IsString()
  @MinLength(10)
  temporaryPassword?: string;
}

export class UpdateStudentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rut?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  birthDate?: string;
}
