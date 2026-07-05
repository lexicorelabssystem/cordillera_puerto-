import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { AssessmentDeliveryMode, AssessmentType } from "@prisma/client";

export class AssessmentTemplateOptionDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsOptional()
  @IsString()
  label?: string | null;

  @IsString()
  text!: string;

  @IsBoolean()
  isCorrect!: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpsertAssessmentTemplateQuestionDto {
  @IsIn(["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER", "ESSAY"])
  type!: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER" | "ESSAY";

  @IsString()
  statement!: string;

  @IsNumber()
  @Min(0.1)
  @Max(100)
  points!: number;

  @IsOptional()
  @IsString()
  explanation?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssessmentTemplateOptionDto)
  options?: AssessmentTemplateOptionDto[];
}

export class UpdateAssessmentTemplateDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsUUID()
  subjectId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  gradeLevel?: number | null;

  @IsOptional()
  @IsString()
  instructions?: string | null;
}

export class CreateAssessmentFromTemplateDto {
  @IsUUID()
  courseId!: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(AssessmentType)
  assessmentType?: AssessmentType;

  @IsOptional()
  @IsEnum(AssessmentDeliveryMode)
  deliveryMode?: AssessmentDeliveryMode;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2)
  semester?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsUUID()
  periodId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  timeLimitMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weight?: number;

  @IsOptional()
  @IsBoolean()
  allowRetake?: boolean;

  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean;

  @IsOptional()
  @IsBoolean()
  publishNow?: boolean;
}
