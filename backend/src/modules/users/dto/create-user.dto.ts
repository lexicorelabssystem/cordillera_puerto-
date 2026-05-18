import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsString,
  IsEnum,
  IsOptional,
  MinLength,
  IsBoolean,
  IsUUID,
} from "class-validator";
import { UserRole } from "@prisma/client";

export class CreateUserDto {
  @ApiProperty({ example: "Juan" })
  @IsString()
  @MinLength(2)
  firstName!: string;

  @ApiProperty({ example: "Pérez" })
  @IsString()
  @MinLength(2)
  lastName!: string;

  @ApiProperty({ example: "juan.perez@colegio.cl" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "Temp2026*" })
  @IsString()
  @MinLength(10)
  temporaryPassword!: string;

  @ApiProperty({ enum: UserRole, example: "TEACHER" })
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiPropertyOptional({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsOptional()
  @IsUUID()
  institutionId?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: "Juan" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  firstName?: string;

  @ApiPropertyOptional({ example: "Pérez" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

export class UserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  mustChangePassword!: boolean;

  @ApiPropertyOptional()
  institutionId!: string | null;

  @ApiPropertyOptional()
  lastLoginAt!: string | null;

  @ApiPropertyOptional()
  studentId!: string | null;

  @ApiPropertyOptional()
  teacherId!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
