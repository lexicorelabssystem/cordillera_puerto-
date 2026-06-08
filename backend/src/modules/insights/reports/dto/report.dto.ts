import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString, IsUUID } from "class-validator";

export class GenerateReportDto {
  @ApiProperty({ enum: ["STUDENT", "COURSE", "OA", "RISK", "INSTITUTIONAL"], example: "COURSE" })
  @IsString()
  type!: string;

  @ApiPropertyOptional({ description: "ID del estudiante para STUDENT" })
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional({ description: "ID del curso para COURSE, OA o RISK" })
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @ApiPropertyOptional({ description: "ID de la asignatura para COURSE, OA o RISK" })
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional({ description: "ID del objetivo de aprendizaje para OA" })
  @IsOptional()
  @IsUUID()
  learningObjectiveId?: string;

  @ApiPropertyOptional({ description: "ID de la institucion para INSTITUTIONAL o RISK global" })
  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @ApiPropertyOptional({ description: "ID del ano academico" })
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @ApiPropertyOptional({ description: "Nota de corte para reportes de riesgo", default: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  threshold?: number;

  @ApiPropertyOptional({ enum: ["PDF", "EXCEL", "CSV", "JSON"], default: "JSON" })
  @IsOptional()
  @IsString()
  format?: string;
}
