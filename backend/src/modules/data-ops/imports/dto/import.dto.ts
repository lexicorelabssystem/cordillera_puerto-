import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsOptional, IsBoolean } from "class-validator";

export class ImportConfirmDto {
  @ApiProperty({ description: "ID del job de importación" })
  @IsString()
  importJobId!: string;

  @ApiPropertyOptional({ description: "Saltar filas con error y continuar con las válidas", default: false })
  @IsOptional()
  @IsBoolean()
  skipErrors?: boolean;
}

export class ImportRevertDto {
  @ApiProperty({ description: "ID del job de importación a revertir" })
  @IsString()
  importJobId!: string;
}
