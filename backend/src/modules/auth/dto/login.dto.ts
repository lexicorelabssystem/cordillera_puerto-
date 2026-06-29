import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "admin@cordillera.cl", description: "Correo electrónico del usuario" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "Admin123*", description: "Contraseña", minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class LoginResponseDto {
  @ApiProperty({ description: "Access token JWT" })
  token!: string;

  @ApiProperty({ description: "Refresh token para renovar sesión" })
  refreshToken!: string;

  @ApiProperty({ description: "Datos del usuario autenticado" })
  user!: {
    sub: string;
    role: string;
    name: string;
    email: string;
    institutionId: string | null;
    mustChangePassword: boolean;
  };
}

export class ChangePasswordDto {
  @ApiProperty({ description: "Contraseña actual" })
  @IsString()
  @MinLength(6)
  currentPassword!: string;

  @ApiProperty({
    description:
      "Nueva contraseña (mín. 10 caracteres, 1 mayúscula, 1 minúscula, 1 número, 1 símbolo)",
  })
  @IsString()
  @MinLength(10)
  newPassword!: string;
}

export class UpdateProfileDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  lastName!: string;
}

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description: "Refresh token obtenido en el login (opcional si se envía vía cookie httpOnly)",
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class AuthUserDto {
  @ApiProperty()
  sub!: string;

  @ApiProperty({ enum: ["SUPER_ADMIN", "ADMIN", "DIRECTION", "UTP", "TEACHER", "STUDENT"] })
  role!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional()
  institutionId!: string | null;

  @ApiProperty()
  mustChangePassword!: boolean;
}
