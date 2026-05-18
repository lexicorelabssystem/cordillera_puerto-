import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsUUID, IsNumber, Min, Max, IsArray, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class AssessmentWeightItemDto {
  @ApiProperty({ description: "ID de la evaluación" })
  @IsUUID()
  assessmentId!: string;

  @ApiProperty({ description: "Ponderación (0-100)" })
  @IsNumber()
  @Min(0)
  @Max(100)
  weight!: number;
}

export class SetWeightsDto {
  @ApiProperty({ description: "ID del periodo" })
  @IsUUID()
  periodId!: string;

  @ApiProperty({ description: "Array de evaluaciones con su ponderación", type: [AssessmentWeightItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssessmentWeightItemDto)
  weights!: AssessmentWeightItemDto[];
}
