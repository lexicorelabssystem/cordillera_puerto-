import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString, IsUUID, IsOptional, IsEnum, MinLength,
} from "class-validator";
import { ObservationType } from "@prisma/client";

export class CreateObservationDto {
  @ApiProperty()
  @IsUUID()
  studentId!: string;

  @ApiProperty()
  @IsUUID()
  courseId!: string;

  @ApiProperty({ enum: ObservationType, default: ObservationType.GENERAL })
  @IsOptional()
  @IsEnum(ObservationType)
  type?: ObservationType;

  @ApiProperty({ example: "Observación de conducta" })
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiProperty({ example: "El estudiante ha mostrado una mejora significativa en..." })
  @IsString()
  content!: string;
}

export class UpdateObservationDto {
  @ApiPropertyOptional({ enum: ObservationType })
  @IsOptional()
  @IsEnum(ObservationType)
  type?: ObservationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;
}
