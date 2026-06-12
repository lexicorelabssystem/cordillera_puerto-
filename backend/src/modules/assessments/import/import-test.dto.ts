import { Type } from "class-transformer";
import {
  IsArray,
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
