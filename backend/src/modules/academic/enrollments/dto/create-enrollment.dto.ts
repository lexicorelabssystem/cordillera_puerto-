import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsUUID, IsOptional, IsString } from "class-validator";

export class CreateEnrollmentDto {
  @ApiProperty({ description: "ID del estudiante" })
  @IsUUID()
  studentId!: string;

  @ApiProperty({ description: "ID del curso" })
  @IsUUID()
  courseId!: string;
}

export class UpdateEnrollmentDto {
  @ApiPropertyOptional({ enum: ["ACTIVE", "WITHDRAWN", "TRANSFERRED", "COMPLETED"] })
  @IsOptional()
  @IsString()
  status?: string;
}

export class TransferEnrollmentDto {
  @ApiProperty({ description: "ID del nuevo curso" })
  @IsUUID()
  newCourseId!: string;
}
