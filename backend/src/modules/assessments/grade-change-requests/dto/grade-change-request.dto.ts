import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsUUID, IsNumber, IsString, IsOptional, Min, Max, IsIn } from "class-validator";

export class CreateGradeChangeRequestDto {
  @ApiProperty({ description: "ID del registro Grade a modificar" })
  @IsUUID()
  gradeId!: string;

  @ApiProperty({ description: "Nueva nota propuesta" })
  @IsNumber()
  @Min(1.0)
  @Max(7.0)
  newGrade!: number;

  @ApiProperty({ description: "Motivo del cambio de nota" })
  @IsString()
  reason!: string;
}

export class ReviewGradeChangeRequestDto {
  @ApiProperty({ description: "APPROVED o REJECTED" })
  @IsIn(["APPROVED", "REJECTED"])
  status!: "APPROVED" | "REJECTED";

  @ApiPropertyOptional({ description: "Notas del revisor" })
  @IsOptional()
  @IsString()
  reviewNotes?: string;
}

export class GradeChangeRequestFilterDto {
  @ApiPropertyOptional({ description: "PENDING, APPROVED o REJECTED" })
  @IsOptional()
  @IsIn(["PENDING", "APPROVED", "REJECTED"])
  status?: "PENDING" | "APPROVED" | "REJECTED";

  @ApiPropertyOptional({ description: "Filtrar por alumno" })
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional({ description: "Filtrar por curso" })
  @IsOptional()
  @IsUUID()
  courseId?: string;
}
