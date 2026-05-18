import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsOptional, IsString, IsUUID } from "class-validator";
import { PermissionAction } from "@prisma/client";

export class AssignPermissionsDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsUUID()
  userId!: string;

  @ApiProperty({
    enum: PermissionAction,
    isArray: true,
    example: ["USERS_READ", "QUESTIONS_CREATE"],
  })
  @IsArray()
  @IsString({ each: true })
  permissionActions!: string[];
}

export class RevokePermissionDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsUUID()
  userId!: string;

  @ApiProperty({ enum: PermissionAction, example: "QUESTIONS_CREATE" })
  @IsString()
  permissionAction!: string;
}

export class UserPermissionsResponseDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  role!: string;

  @ApiProperty({ type: [String] })
  permissions!: string[];
}

export class PermissionCatalogItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: PermissionAction })
  action!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  module!: string;
}
