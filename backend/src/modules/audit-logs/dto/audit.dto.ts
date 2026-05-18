import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsDateString } from "class-validator";

export class AuditFilterDto {
  @ApiPropertyOptional({ description: "Filtrar por acción (LOGIN_SUCCESS, ASSESSMENT_CREATED, etc.)" })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ description: "Filtrar por tipo de entidad (USER, ASSESSMENT, GRADE, etc.)" })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional({ description: "Filtrar por ID de entidad" })
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional({ description: "Filtrar por ID del usuario que ejecutó la acción" })
  @IsOptional()
  @IsString()
  actorId?: string;

  @ApiPropertyOptional({ description: "Filtrar desde fecha (ISO)" })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: "Filtrar hasta fecha (ISO)" })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: "Búsqueda en metadata" })
  @IsOptional()
  @IsString()
  search?: string;
}
