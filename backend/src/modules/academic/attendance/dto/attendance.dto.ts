import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString, IsUUID, IsDateString, IsOptional, IsArray, IsEnum, ValidateNested, ArrayMinSize,
} from "class-validator";
import { Type } from "class-transformer";
import { AttendanceStatus } from "@prisma/client";

export class CreateAttendanceDto {
  @ApiProperty()
  @IsUUID()
  studentId!: string;

  @ApiProperty()
  @IsUUID()
  courseId!: string;

  @ApiProperty({ example: "2026-05-21" })
  @IsDateString()
  date!: string;

  @ApiProperty({ enum: AttendanceStatus, default: AttendanceStatus.PRESENT })
  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;
}

export class BulkAttendanceItemDto {
  @ApiProperty()
  @IsUUID()
  studentId!: string;

  @ApiProperty({ enum: AttendanceStatus })
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;
}

export class BulkAttendanceDto {
  @ApiProperty()
  @IsUUID()
  courseId!: string;

  @ApiProperty({ example: "2026-05-21" })
  @IsDateString()
  date!: string;

  @ApiProperty({ type: [BulkAttendanceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => BulkAttendanceItemDto)
  items!: BulkAttendanceItemDto[];
}

export class UpdateAttendanceDto {
  @ApiProperty({ enum: AttendanceStatus })
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;
}
