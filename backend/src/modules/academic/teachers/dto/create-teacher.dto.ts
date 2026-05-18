import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString, IsUUID, IsOptional, IsEmail, MinLength,
} from "class-validator";

export class CreateTeacherDto {
  @ApiProperty({ example: "Paula" })
  @IsString()
  @MinLength(2)
  firstName!: string;

  @ApiProperty({ example: "Docente" })
  @IsString()
  @MinLength(2)
  lastName!: string;

  @ApiProperty({ example: "paula.docente@colegio.cl" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "Temp2026*", minLength: 10 })
  @IsString()
  @MinLength(10)
  temporaryPassword!: string;

  @ApiPropertyOptional({ example: "12.345.678-9" })
  @IsOptional()
  @IsString()
  rut?: string;

  @ApiPropertyOptional({ example: "Profesor de Lenguaje" })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: "ID de la institución" })
  @IsOptional()
  @IsUUID()
  institutionId?: string;
}

export class UpdateTeacherDto {
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
  title?: string;
}

export class AssignTeacherDto {
  @ApiProperty({ description: "ID del profesor (Teacher.id)", required: false })
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @ApiProperty({ description: "ID de usuario con rol TEACHER (User.id)", required: false })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({ description: "ID del curso" })
  @IsUUID()
  courseId!: string;

  @ApiProperty({ description: "ID de la asignatura" })
  @IsUUID()
  subjectId!: string;
}
