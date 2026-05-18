import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsUUID, IsOptional, IsString, IsArray, ValidateNested, IsBoolean } from "class-validator";
import { Type } from "class-transformer";

export class SingleAnswerDto {
  @ApiProperty({ description: "ID de la pregunta" })
  @IsUUID()
  questionId!: string;

  @ApiPropertyOptional({ description: "ID de la opción seleccionada" })
  @IsOptional()
  @IsUUID()
  selectedOptionId?: string;

  @ApiPropertyOptional({ description: "Respuesta de texto (para preguntas abiertas)" })
  @IsOptional()
  @IsString()
  textAnswer?: string;
}

export class SaveAnswersDto {
  @ApiProperty({ description: "Array de respuestas a guardar", type: [SingleAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SingleAnswerDto)
  answers!: SingleAnswerDto[];

  @ApiPropertyOptional({ description: "Tiempo transcurrido en segundos hasta ahora" })
  @IsOptional()
  timeSpentSec?: number;
}

export class SubmitAttemptDto {
  @ApiPropertyOptional({ description: "Tiempo total empleado en segundos" })
  @IsOptional()
  timeSpentSec?: number;

  @ApiPropertyOptional({ description: "Confirmar envío aunque haya preguntas sin responder" })
  @IsOptional()
  @IsBoolean()
  confirmEmpty?: boolean;
}

export class StartAttemptResponseDto {
  @ApiProperty()
  attemptId!: string;

  @ApiProperty()
  assessmentId!: string;

  @ApiProperty()
  startedAt!: string;

  @ApiPropertyOptional()
  deadline?: string;

  @ApiProperty()
  timeLimitMin!: number | null;

  @ApiProperty()
  totalQuestions!: number;

  @ApiProperty()
  status!: string;
}
