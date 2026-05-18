import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsUUID, IsOptional, IsDateString } from "class-validator";

export class CreateAcademicYearDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsUUID()
  institutionId!: string;

  @ApiProperty({ example: 2027 })
  @IsInt()
  year!: number;

  @ApiProperty({ example: "2027-03-01" })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: "2027-12-20" })
  @IsDateString()
  endDate!: string;
}

export class UpdateAcademicYearDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  year?: number;
}
