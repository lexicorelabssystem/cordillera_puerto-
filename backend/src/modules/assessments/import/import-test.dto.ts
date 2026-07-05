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

export class CommitImportedQuestionDto {
  @IsOptional()
  @IsUUID()
  draftQuestionId?: string;

  @IsInt()
  @Min(1)
  number!: number;

  @IsString()
  statement!: string;

  @IsIn(["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER", "ESSAY"])
  type!: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER" | "ESSAY";

  @IsArray()
  @IsString({ each: true })
  alternatives!: string[];

  @IsOptional()
  @IsString()
  correctAnswer?: string | null;

  @IsNumber()
  @Min(0.1)
  @Max(100)
  points!: number;
}

export class CommitImportedTestDto {
  @IsUUID()
  subjectId!: string;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommitImportedQuestionDto)
  questions!: CommitImportedQuestionDto[];
}

export class CreateAssessmentFromImportedTestDto extends CommitImportedTestDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(AssessmentType)
  assessmentType!: AssessmentType;

  @IsOptional()
  @IsEnum(AssessmentDeliveryMode)
  deliveryMode?: AssessmentDeliveryMode;

  @IsInt()
  @Min(1)
  @Max(2)
  semester!: number;

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
}
