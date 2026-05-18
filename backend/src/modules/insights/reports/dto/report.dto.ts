import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsUUID, IsOptional, IsEnum } from "class-validator";

export class GenerateReportDto {
  @ApiProperty({ enum: ["STUDENT", "COURSE", "SUBJECT", "OA", "INSTITUTIONAL"], example: "COURSE" })
  @IsString()
  type!: string;

  @ApiPropertyOptional({ description: "ID del estudiante (para STUDENT)" })
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional({ description: "ID del curso (para COURSE, SUBJECT)" })
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @ApiPropertyOptional({ description: "ID de la asignatura (para SUBJECT)" })
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional({ description: "ID del OA (para OA)" })
  @IsOptional()
  @IsUUID()
  learningObjectiveId?: string;

  @ApiPropertyOptional({ description: "ID de la institución (para INSTITUTIONAL)" })
  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @ApiPropertyOptional({ enum: ["PDF", "EXCEL", "JSON"], default: "JSON" })
  @IsOptional()
  @IsString()
  format?: string;
}
