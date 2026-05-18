import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString, IsUUID, IsInt, IsOptional, IsEnum, IsBoolean, MinLength, IsArray,
} from "class-validator";
import { ResourceType, GuideType } from "@prisma/client";

export class CreateResourceDto {
  @ApiProperty({ description: "ID de la institución" })
  @IsUUID()
  institutionId!: string;

  @ApiProperty({ example: "Guía de Comprensión Lectora - Textos Narrativos" })
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ResourceType, example: "GUIDE" })
  @IsEnum(ResourceType)
  type!: ResourceType;

  @ApiPropertyOptional({ description: "ID de la asignatura" })
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional({ description: "ID del curso" })
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @ApiPropertyOptional({ description: "Nivel (1-8)" })
  @IsOptional()
  @IsInt()
  gradeLevel?: number;

  @ApiPropertyOptional({ description: "ID del eje" })
  @IsOptional()
  @IsUUID()
  axisId?: string;

  @ApiPropertyOptional({ description: "ID del OA" })
  @IsOptional()
  @IsUUID()
  learningObjectiveId?: string;

  @ApiPropertyOptional({ description: "ID de la habilidad" })
  @IsOptional()
  @IsUUID()
  skillId?: string;

  @ApiPropertyOptional({ description: "ID de evaluación asociada" })
  @IsOptional()
  @IsUUID()
  assessmentId?: string;

  @ApiPropertyOptional({ description: "ID de ruta remedial asociada" })
  @IsOptional()
  @IsUUID()
  remedialPlanId?: string;

  // Guide-specific
  @ApiPropertyOptional({ enum: GuideType })
  @IsOptional()
  @IsEnum(GuideType)
  guideType?: GuideType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isPrintable?: boolean;

  // Presentation-specific
  @ApiPropertyOptional({ default: "PDF" })
  @IsOptional()
  @IsString()
  presentationType?: string;
}

export class UpdateResourceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrintable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  learningObjectiveId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assessmentId?: string;
}

export class ResourceFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(ResourceType)
  type?: ResourceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  learningObjectiveId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
