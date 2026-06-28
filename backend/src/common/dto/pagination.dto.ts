import { IsOptional, IsInt, Min, Max } from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class PaginationDto {
  @ApiPropertyOptional({ description: "Número de página (1-based)", default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: "Registros por página", default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}
export function normalizePagination(
  page: number | undefined,
  limit: number | undefined,
  defaultLimit = 20,
  maxLimit = 100,
) {
  const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page!)) : 1;
  const requestedLimit = Number.isFinite(limit) ? Math.floor(limit!) : defaultLimit;
  const safeLimit = Math.min(maxLimit, Math.max(1, requestedLimit));
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
}