import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsUUID, IsOptional, IsIn } from "class-validator";

export class ExportRequestDto {
  @ApiProperty({ enum: ["students", "grades", "courses", "questions", "reports"], example: "students" })
  @IsString()
  @IsIn(["students", "grades", "courses", "questions", "reports"])
  entityType!: string;

  @ApiProperty({ enum: ["xlsx", "csv", "json"], default: "xlsx" })
  @IsString()
  @IsIn(["xlsx", "csv", "json"])
  format!: string;

  @ApiPropertyOptional({ description: "ID del curso (para filtrar)" })
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @ApiPropertyOptional({ description: "ID de la asignatura" })
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional({ description: "ID de la institución" })
  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @ApiPropertyOptional({ description: "ID del año académico" })
  @IsOptional()
  @IsUUID()
  academicYearId?: string;
}
