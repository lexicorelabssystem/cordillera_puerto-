import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsUUID, IsOptional, IsIn } from "class-validator";

export class CreateExportJobDto {
  @ApiProperty({ enum: ["students", "grades", "courses", "questions", "reports"] })
  @IsString()
  @IsIn(["students", "grades", "courses", "questions", "reports"])
  entityType!: string;

  @ApiProperty({ enum: ["xlsx", "csv", "json"] })
  @IsString()
  @IsIn(["xlsx", "csv", "json"])
  format!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  academicYearId?: string;
}

export class JobStatusResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  jobType!: string;

  @ApiProperty()
  queueName!: string;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional()
  bullJobId?: string;

  @ApiPropertyOptional()
  result?: unknown;

  @ApiPropertyOptional()
  errorMessage?: string;
}
