import { IsDateString, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class CreateArchiveDto {
  @IsDateString()
  cutoffDate!: string;

  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2)
  semester?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  retentionYears?: number;
}